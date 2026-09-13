import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as QRCode from 'qrcode';
import type { WASocket } from '@whiskeysockets/baileys';
import { DisconnectReason, fetchLatestBaileysVersion, makeWASocket } from '@whiskeysockets/baileys';
import { Prisma, WhatsAppUnofficialStatus } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChatService } from '../chat/chat.service';
import { InteractiveReplyService } from './interactive-reply.service';
import { buildAgentHistory } from './whatsapp-agent-history';
import { useDatabaseAuthState } from './whatsapp-unofficial-auth-store';
import { WhatsAppButton } from './whatsapp.service';

const SESSION_ID = 'default';
const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;
const RECONNECT_DELAY_MS = 3000;

export interface WhatsAppUnofficialStatusView {
  status: WhatsAppUnofficialStatus;
  connectedNumber: string | null;
  lastError: string | null;
  qrDataUrl: string | null;
  qrGeneratedAt: Date | null;
}

/**
 * Second WhatsApp transport for the same platform number: an unofficial,
 * QR-linked connection (via Baileys) that bypasses Meta's Cloud API entirely.
 *
 * This is a deliberate, informed exception to "use official APIs only" -
 * the business accepted that WhatsApp can permanently ban the number for
 * running unsanctioned automation, in exchange for not waiting on Meta Tech
 * Provider approval. See WhatsAppBusinessConnectionService for the official,
 * ToS-compliant path this exists alongside.
 *
 * Reuses the exact same downstream pipeline as the official transport -
 * buildAgentHistory, ChatService.reply, InteractiveReplyService - so a
 * reminder, a contact lookup, or a calendar booking behaves identically no
 * matter which transport delivered the message.
 */
@Injectable()
export class WhatsAppUnofficialService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppUnofficialService.name);
  private sock: WASocket | null = null;
  private connecting = false;
  private loggingOut = false;
  private latestQr: { dataUrl: string; generatedAt: Date } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly memoryService: MemoryService,
    private readonly channelLinking: ChannelLinkingService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => InteractiveReplyService))
    private readonly interactiveReplies: InteractiveReplyService,
  ) {}

  /** Resumes an already-paired session on boot; a session with no stored creds waits for an explicit Connect. */
  async onModuleInit(): Promise<void> {
    const session = await this.prisma.whatsAppUnofficialSession.findUnique({ where: { id: SESSION_ID } });
    if (session && session.status !== WhatsAppUnofficialStatus.DISCONNECTED) {
      this.logger.log('Resuming a previously linked WhatsApp session.');
      await this.connect();
    }
  }

  async getStatus(): Promise<WhatsAppUnofficialStatusView> {
    const session = await this.prisma.whatsAppUnofficialSession.upsert({
      where: { id: SESSION_ID },
      create: { id: SESSION_ID },
      update: {},
    });

    return {
      status: session.status,
      connectedNumber: session.connectedNumber,
      lastError: session.lastError,
      qrDataUrl: this.latestQr?.dataUrl ?? null,
      qrGeneratedAt: this.latestQr?.generatedAt ?? null,
    };
  }

  /** True once actually paired - the only state in which sends will succeed. */
  async isConnected(): Promise<boolean> {
    const session = await this.prisma.whatsAppUnofficialSession.findUnique({ where: { id: SESSION_ID } });
    return session?.status === WhatsAppUnofficialStatus.CONNECTED && this.sock !== null;
  }

  /** Starts pairing (generating a QR code) or resumes an existing session. Safe to call repeatedly. */
  async connect(): Promise<void> {
    if (this.connecting || this.sock) return;
    this.connecting = true;

    try {
      const { state, saveCreds } = await useDatabaseAuthState(this.prisma, this.encryption);
      const { version } = await fetchLatestBaileysVersion();

      await this.setStatus(WhatsAppUnofficialStatus.CONNECTING);

      const sock = makeWASocket({ version, auth: state, syncFullHistory: false });
      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', (update) => {
        void this.handleConnectionUpdate(update);
      });

      sock.ev.on('messages.upsert', (event) => {
        void this.handleIncomingMessages(event);
      });
    } catch (error: any) {
      this.logger.error('Failed to start the WhatsApp connection', error);
      this.sock = null;
      await this.setStatus(WhatsAppUnofficialStatus.DISCONNECTED, error?.message ?? 'unknown error');
    } finally {
      this.connecting = false;
    }
  }

  /** Unlinks the device and clears every stored credential, so a future connect() requires a fresh QR scan. */
  async logout(): Promise<void> {
    this.loggingOut = true;
    try {
      await this.sock?.logout();
    } catch (error) {
      this.logger.warn('Logout call failed (continuing to clear local state)', error);
    } finally {
      this.sock = null;
      this.latestQr = null;
      const { clearAll } = await useDatabaseAuthState(this.prisma, this.encryption);
      await clearAll();
      await this.prisma.whatsAppUnofficialSession.upsert({
        where: { id: SESSION_ID },
        create: { id: SESSION_ID, status: WhatsAppUnofficialStatus.DISCONNECTED, connectedNumber: null },
        update: { status: WhatsAppUnofficialStatus.DISCONNECTED, connectedNumber: null, lastError: null },
      });
      this.loggingOut = false;
    }
  }

  private async handleConnectionUpdate(update: {
    connection?: string;
    lastDisconnect?: { error?: unknown };
    qr?: string;
  }): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.latestQr = { dataUrl: await QRCode.toDataURL(qr), generatedAt: new Date() };
      await this.setStatus(WhatsAppUnofficialStatus.CONNECTING);
    }

    if (connection === 'open') {
      this.latestQr = null;
      const connectedNumber = digitsOf(this.sock?.user?.id);
      const expected = digitsOf(process.env.WHATSAPP_UNOFFICIAL_EXPECTED_NUMBER);

      if (expected && connectedNumber !== expected) {
        this.logger.error(
          `QR was scanned by +${connectedNumber ?? 'unknown'}, not the expected +${expected}. Logging out immediately.`,
        );
        await this.logout();
        await this.setStatus(
          WhatsAppUnofficialStatus.DISCONNECTED,
          `Wrong number linked (+${connectedNumber ?? 'unknown'}, expected +${expected}). Logged out automatically - request a fresh QR and rescan with the correct phone.`,
        );
        return;
      }

      await this.setStatus(WhatsAppUnofficialStatus.CONNECTED, null, connectedNumber);
      this.logger.log(`WhatsApp linked as ${connectedNumber ?? 'unknown number'}.`);
    }

    if (connection === 'close') {
      this.sock = null;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = this.loggingOut || statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        this.latestQr = null;
        await this.setStatus(WhatsAppUnofficialStatus.DISCONNECTED, 'Logged out from the phone.');
        return;
      }

      this.logger.warn(`WhatsApp connection dropped (code ${statusCode}); reconnecting.`);
      setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
    }
  }

  private async setStatus(
    status: WhatsAppUnofficialStatus,
    lastError: string | null = null,
    connectedNumber?: string | null,
  ): Promise<void> {
    await this.prisma.whatsAppUnofficialSession.upsert({
      where: { id: SESSION_ID },
      create: { id: SESSION_ID, status, lastError, connectedNumber: connectedNumber ?? null },
      update: { status, lastError, ...(connectedNumber !== undefined ? { connectedNumber } : {}) },
    });
  }

  // ---- Outbound ----

  /** No 24-hour customer-service window applies here - a personal/linked WhatsApp account can message anyone, anytime. */
  isWithinCustomerServiceWindow(): boolean {
    return true;
  }

  async sendMessage(_userId: string, to: string, message: string): Promise<{ success: boolean; messageId: string }> {
    const jid = jidFor(to);
    const sent = await this.requireSocket().sendMessage(jid, { text: message });

    await this.recordOutbound(to, sent?.key?.id ?? `local_${Date.now()}`, message);
    return { success: true, messageId: sent?.key?.id ?? '' };
  }

  /**
   * Personal WhatsApp accounts can no longer reliably render true interactive
   * buttons (WhatsApp withdrew that support from unofficial clients), so this
   * renders a numbered list instead and records which button id each number
   * maps to - handleIncomingMessages resolves a bare "1"/"2"/"3" reply (or a
   * close match on the label) back to the same button id the official
   * transport would have used, so reminders/confirmations work identically.
   */
  async sendButtons(
    userId: string,
    to: string,
    body: string,
    buttons: WhatsAppButton[],
  ): Promise<{ success: boolean; messageId: string }> {
    const numbered = buttons.map((button, index) => `${index + 1}. ${button.title}`).join('\n');
    const text = `${body}\n\n${numbered}\n\nReply with a number.`;

    const jid = jidFor(to);
    const sent = await this.requireSocket().sendMessage(jid, { text });

    await this.recordOutbound(to, sent?.key?.id ?? `local_${Date.now()}`, text, {
      interactive: true,
      buttons: buttons.map((b) => b.id),
      buttonTitles: buttons.map((b) => b.title),
    });

    return { success: true, messageId: sent?.key?.id ?? '' };
  }

  /**
   * Templates exist only because Meta requires one outside the Cloud API's
   * 24-hour window - a restriction that doesn't apply here. This only exists
   * so callers written against the official transport's interface don't need
   * a special case; it renders the same as sendButtons and should not
   * normally be reached, since isWithinCustomerServiceWindow() always
   * reports the window open.
   */
  async sendTemplate(
    userId: string,
    to: string,
    template: { bodyParameters?: string[]; quickReplyPayloads?: string[] },
  ): Promise<{ success: boolean; messageId: string }> {
    const body = (template.bodyParameters ?? []).join(' ');
    const buttons = (template.quickReplyPayloads ?? []).map((id) => ({ id, title: id }));
    return this.sendButtons(userId, to, body, buttons);
  }

  private requireSocket(): WASocket {
    if (!this.sock) {
      throw new Error('The unofficial WhatsApp connection is not linked - scan the QR code from the admin page first.');
    }
    return this.sock;
  }

  private async recordOutbound(
    to: string,
    externalId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const metadataJson = metadata as Prisma.InputJsonValue | undefined;
    const channel = await this.prisma.channel.findFirst({ where: { type: 'WHATSAPP', externalId: to } });
    if (!channel) return;

    await this.prisma.channelMessage.create({
      data: { channelId: channel.id, externalId, content, type: 'TEXT', direction: 'OUTBOUND', metadata: metadataJson },
    });
  }

  // ---- Inbound ----

  private async handleIncomingMessages(event: { messages: any[]; type: string }): Promise<void> {
    for (const message of event.messages) {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        this.logger.error('Failed to process an incoming WhatsApp message', error);
      }
    }
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    const remoteJid: string | undefined = message.key?.remoteJid;
    if (!remoteJid || message.key?.fromMe) return;
    // Only 1:1 chats - group and broadcast/status traffic isn't a conversation with one accountable user.
    if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return;

    const from = digitsOf(remoteJid);
    if (!from) return;

    const text: string = message.message?.conversation ?? message.message?.extendedTextMessage?.text ?? '';
    if (!message.message) return; // reactions, protocol messages, etc. - nothing to act on

    const linkMatch = text.trim() ? LINK_CODE_PATTERN.exec(text.trim()) : null;
    if (linkMatch) {
      await this.handleLinkCode(from, linkMatch[1]);
      return;
    }

    const channel = await this.prisma.channel.findFirst({ where: { type: 'WHATSAPP', externalId: from } });
    if (!channel) {
      await this.trySend(
        from,
        "I don't recognize this number yet. Open Zoorzio, go to your Profile, and link your WhatsApp number first.",
      );
      return;
    }

    const content = text.trim() || `[${dominantMessageType(message.message)} message received]`;
    const externalId = message.key.id ?? `${Date.now()}`;

    const isNew = await this.recordInbound(channel.id, externalId, content);
    if (!isNew) return; // Baileys can redeliver on reconnect - a duplicate is dropped, not re-acted on.

    await this.memoryService.create(channel.userId, {
      content,
      type: 'MESSAGE',
      source: 'WHATSAPP',
      metadata: { senderPhone: from, pushName: message.pushName },
      tags: ['whatsapp'],
    } as any);

    if (!text.trim()) {
      await this.trySend(from, "I can only read text messages on this connection right now - could you type that out?");
      return;
    }

    const buttonTap = await this.matchPendingButton(channel.id, text);
    if (buttonTap) {
      const reply = await this.interactiveReplies.handle(channel.userId, buttonTap);
      if (reply) await this.sendMessage(channel.userId, from, reply);
      return;
    }

    await this.runAgent(channel.id, channel.userId, from, content, message.pushName);
  }

  private async runAgent(
    channelId: string,
    userId: string,
    from: string,
    latestMessage: string,
    pushName?: string,
  ): Promise<void> {
    try {
      const history = await buildAgentHistory(this.prisma, channelId, latestMessage);
      const reply = await this.chatService.reply(userId, history, pushName);
      if (reply?.trim()) await this.sendMessage(userId, from, reply);
    } catch (error) {
      this.logger.error(`Agent failed for user ${userId}`, error);
      await this.trySend(from, "Something went wrong on my end and I couldn't finish that. Could you try again?");
    }
  }

  /** Mirrors WhatsAppService's LINK <code> flow exactly - same regex, same ChannelLinkingService call. */
  private async handleLinkCode(from: string, code: string): Promise<void> {
    const userId = await this.channelLinking.consumeWhatsAppLinkCode(code, from);
    await this.trySend(
      from,
      userId
        ? "You're linked! I'll remember what you send me here from now on."
        : 'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.',
    );
  }

  /**
   * If the last message on this channel was an interactive prompt this
   * transport sent (see sendButtons) and nothing has answered it since, maps
   * a bare number or a close match on the button's label back to its id.
   * Returns null for anything that isn't answering a live prompt, which
   * falls through to the normal agent conversation.
   */
  private async matchPendingButton(channelId: string, text: string): Promise<string | null> {
    const last = await this.prisma.channelMessage.findFirst({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      skip: 1, // the message just recorded is newest; the prompt being answered is the one before it
    });

    const metadata = last?.metadata as { interactive?: boolean; buttons?: string[]; buttonTitles?: string[] } | null;
    if (last?.direction !== 'OUTBOUND' || !metadata?.interactive || !metadata.buttons?.length) return null;

    const trimmed = text.trim();
    const index = Number.parseInt(trimmed, 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index < metadata.buttons.length) {
      return metadata.buttons[index];
    }

    const normalized = trimmed.toLowerCase();
    const titleIndex = (metadata.buttonTitles ?? []).findIndex(
      (title) => title.toLowerCase() === normalized || title.toLowerCase().includes(normalized),
    );
    return titleIndex >= 0 ? metadata.buttons[titleIndex] : null;
  }

  /** Stores an inbound message, returning false if it was already stored (Baileys redelivers on reconnect). */
  private async recordInbound(channelId: string, externalId: string, content: string): Promise<boolean> {
    try {
      await this.prisma.channelMessage.create({
        data: { channelId, externalId, content, type: 'TEXT', direction: 'INBOUND' },
      });
      return true;
    } catch (error: any) {
      if (error?.code === 'P2002') return false;
      throw error;
    }
  }

  /** Best-effort reply for control-flow messages - never throws, matching the official transport's trySendMessage. */
  private async trySend(to: string, message: string): Promise<void> {
    try {
      await this.sendMessage('', to, message);
    } catch (error) {
      this.logger.error('Failed to send a WhatsApp reply', error);
    }
  }
}

/** Strips a Baileys JID ("447848472822:12@s.whatsapp.net") down to bare digits, matching how Channel.externalId is stored elsewhere. */
function digitsOf(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const digits = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  return digits || null;
}

function jidFor(phoneNumber: string): string {
  return `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
}

function dominantMessageType(message: Record<string, unknown>): string {
  const known = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
  const found = known.find((key) => key in message);
  return found ? found.replace('Message', '') : 'unsupported';
}
