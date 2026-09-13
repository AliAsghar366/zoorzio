import { createHmac, timingSafeEqual } from 'crypto';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIService } from '../ai/ai.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ChatService } from '../chat/chat.service';
import { InteractiveReplyService } from './interactive-reply.service';
import { WhatsAppBusinessConnectionService } from './whatsapp-business-connection.service';
import { graphApiVersion } from './whatsapp-graph';
import { buildAgentHistory } from './whatsapp-agent-history';
import { ChannelType, Prisma } from '@anchor/database';

/**
 * WhatsApp only accepts free-form messages (text, reply buttons) within 24
 * hours of the user's last message; outside that, only an approved template
 * can be sent. Five minutes are shaved off so a send that races the deadline
 * falls back to the template instead of being rejected.
 */
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

/** Keeps a template's rendered body under WhatsApp's 1,024-character limit. */
const TEMPLATE_PARAMETER_LIMIT = 900;

const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;

/** WhatsApp rejects reply-button messages whose body exceeds this. */
const INTERACTIVE_BODY_LIMIT = 1024;

/** WhatsApp truncates button labels beyond this. */
const BUTTON_TITLE_LIMIT = 20;

export interface WhatsAppButton {
  id: string;
  title: string;
}

/** The pair of values every Graph API call needs, resolved per user or shared. */
interface WhatsAppCreds {
  accessToken: string;
  phoneNumberId: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private aiService: AIService,
    private readonly http: HttpService,
    private readonly channelLinking: ChannelLinkingService,
    private readonly channelCredentials: ChannelCredentialsService,
    private readonly businessConnection: WhatsAppBusinessConnectionService,
    // The agent that turns an inbound message into real actions. Circular by
    // nature: the agent's tools include sending on this very channel.
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => InteractiveReplyService))
    private readonly interactiveReplies: InteractiveReplyService,
  ) {}

  /** The platform-wide Business account as configured in the environment. */
  private get envCreds(): WhatsAppCreds {
    return {
      accessToken: this.configService.get('WHATSAPP_BUSINESS_TOKEN') ?? '',
      phoneNumberId: this.configService.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
    };
  }

  /**
   * The platform-wide Business account, used when a user hasn't brought their
   * own. A number connected through Embedded Signup takes precedence over the
   * environment configuration, which stays as the fallback.
   */
  private async platformCreds(): Promise<WhatsAppCreds> {
    return (await this.businessConnection.getActiveCredentials()) ?? this.envCreds;
  }

  private get graphApiVersion(): string {
    return graphApiVersion(this.configService);
  }

  /** Resolves the Business account a given user sends on - their own if connected. */
  private async credsForUser(userId: string): Promise<WhatsAppCreds> {
    const own = await this.channelCredentials.getDecryptedToken(userId, ChannelType.WHATSAPP);
    const ownPhoneNumberId = (own?.metadata as any)?.phoneNumberId;
    if (own && ownPhoneNumberId) {
      return { accessToken: own.token, phoneNumberId: ownPhoneNumberId };
    }
    return this.platformCreds();
  }

  async initialize() {
    try {
      const accessToken = this.configService.get('WHATSAPP_BUSINESS_TOKEN');
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
      const verifyToken = this.configService.get('WHATSAPP_VERIFY_TOKEN');

      this.logger.log('WhatsApp service initialized');

      return {
        status: accessToken && phoneNumberId ? 'initialized' : 'not configured',
        phoneNumberId,
        verifyToken,
      };
    } catch (error) {
      this.logger.error('Failed to initialize WhatsApp service', error);
      throw error;
    }
  }

  /**
   * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw request
   * body, keyed by the app secret). The webhook endpoint is public, so this is
   * the only thing standing between the agent and anyone who discovers the URL
   * and posts a message claiming to be from a linked number.
   *
   * Users running their own Meta app sign with their own secret, so that
   * credential's secondaryToken is accepted as an alternative - which is what
   * that field holds for WhatsApp (a per-user *verify* token would never be
   * used: every account shares this one webhook URL, so the verify handshake
   * is always against the platform's WHATSAPP_VERIFY_TOKEN).
   */
  async verifySignature(rawBody: string, signature: string): Promise<boolean> {
    const platformSecret = this.configService.get<string>('WHATSAPP_APP_SECRET');
    const candidates: string[] = platformSecret ? [platformSecret] : [];

    const phoneNumberId = this.phoneNumberIdFrom(rawBody);
    if (phoneNumberId) {
      const own = await this.channelCredentials.getByWhatsAppPhoneNumberId(phoneNumberId);
      if (own?.secondaryToken) candidates.push(own.secondaryToken);
    }

    if (candidates.length === 0) {
      // Fail closed in production rather than processing unauthenticated
      // webhooks; stay permissive locally so the endpoint is testable without
      // a Meta app configured (mirrors EncryptionService's boot-time stance).
      if (this.configService.get('NODE_ENV') === 'production') {
        this.logger.error('Rejecting WhatsApp webhook: WHATSAPP_APP_SECRET is not configured.');
        return false;
      }
      this.logger.warn(
        'WHATSAPP_APP_SECRET is not set - accepting webhook without signature verification.',
      );
      return true;
    }

    if (!signature || !rawBody) return false;

    return candidates.some((secret) => {
      const expected =
        'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
      const expectedBuf = Buffer.from(expected);
      const actualBuf = Buffer.from(signature);
      return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    });
  }

  /** Best-effort read of the recipient Business number id, used only to pick which secret to check the signature against. */
  private phoneNumberIdFrom(rawBody: string): string | null {
    try {
      const parsed = JSON.parse(rawBody);
      return parsed?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
    } catch {
      return null;
    }
  }

  async handleWebhook(payload: any) {
    const { entry } = payload;

    for (const item of entry) {
      const { changes } = item;

      for (const change of changes) {
        const { value } = change;

        if (value?.messages) {
          // Meta names the *recipient* Business number in every payload, which
          // is what tells us whose account was messaged once several users have
          // each connected their own. Falls back to the platform account so
          // existing users on the platform bot keep working unchanged.
          const phoneNumberId = value.metadata?.phone_number_id;
          const own = phoneNumberId
            ? await this.channelCredentials.getByWhatsAppPhoneNumberId(phoneNumberId)
            : null;
          const creds: WhatsAppCreds = own
            ? { accessToken: own.token, phoneNumberId }
            : await this.platformCreds();

          for (const message of value.messages) {
            await this.processMessage(message, value.contacts?.[0], creds);
          }
          continue;
        }

        // Fields sent only for a number that is also on the WhatsApp Business
        // app (coexistence) - see WhatsAppBusinessConnectionService.
        switch (change.field) {
          case 'smb_message_echoes':
            await this.businessConnection.handleMessageEchoesWebhook(value);
            break;
          case 'history':
            await this.businessConnection.handleHistoryWebhook(value);
            break;
          case 'smb_app_state_sync':
            this.businessConnection.handleStateSyncWebhook(value);
            break;
          case 'account_update':
            await this.businessConnection.handleAccountUpdateWebhook(value);
            break;
        }
      }
    }

    return { status: 'ok' };
  }

  private async processMessage(message: any, contact: any, creds: WhatsAppCreds) {
    try {
      const { from, type, timestamp, id: externalId } = message;

      if (type === 'text') {
        const linkMatch = LINK_CODE_PATTERN.exec(message.text.body.trim());
        if (linkMatch) {
          await this.handleLinkCode(from, linkMatch[1], creds);
          return null;
        }
      }

      const channel = await this.findOrCreateChannel(from);
      if (!channel) {
        this.logger.warn(
          `Ignoring WhatsApp message from unlinked number ${from} - no account has linked it yet`,
        );
        await this.trySendMessage(
          from,
          "I don't recognize this number yet. Open Zoorzio, go to your Profile, and link your WhatsApp number first.",
          creds,
        );
        return null;
      }

      // Button taps (reminder actions, action confirmations) are deterministic
      // control input, not conversation - they're resolved directly rather
      // than being interpreted by the model.
      const tap = this.buttonTapFrom(message);
      if (tap) {
        // Recorded because a tap counts as the user messaging us, which reopens
        // the 24-hour window - and so a redelivered tap isn't acted on twice.
        const isNew = await this.recordInbound({
          channelId: channel.id,
          externalId,
          content: tap.title,
          type: 'TEXT',
          direction: 'INBOUND',
          metadata: { whatsappMessageId: externalId, timestamp, buttonId: tap.id },
        });
        if (!isNew) return null;

        const reply = await this.interactiveReplies.handle(channel.userId, tap.id);
        if (reply) await this.trySendMessage(from, reply, creds);
        return null;
      }

      let content = '';
      const metadata: any = {
        whatsappMessageId: externalId,
        timestamp,
      };

      switch (type) {
        case 'text':
          content = message.text.body;
          break;
        case 'image':
          content = message.image.caption || '[Image received]';
          metadata.imageId = message.image.id;
          break;
        case 'audio':
          content = '[Voice note received]';
          metadata.audioId = message.audio.id;
          metadata.isVoiceNote = true;
          break;
        case 'document':
          content = message.document.caption || '[Document received]';
          metadata.documentId = message.document.id;
          break;
        default:
          content = `[${type} message received]`;
      }

      const isNew = await this.recordInbound({
        channelId: channel.id,
        externalId,
        content,
        type: this.mapMessageType(type),
        direction: 'INBOUND',
        metadata,
      });

      // Meta redelivers any webhook it didn't see acknowledged. A repeat is
      // dropped here, before it can store a second memory or have the agent
      // act on the same instruction twice.
      if (!isNew) {
        this.logger.log(`Ignoring redelivered WhatsApp message ${externalId}`);
        return null;
      }

      const memory = await this.memoryService.create(channel.userId, {
        content,
        type: this.mapMemoryType(type),
        source: 'WHATSAPP',
        metadata: {
          ...metadata,
          senderPhone: from,
          senderName: contact?.profile?.name,
        },
        tags: ['whatsapp'],
      });

      // What the agent should actually reason about: the typed text, or the
      // transcript of a voice note (a voice note is a spoken instruction, so
      // it gets acted on exactly like a typed one).
      let agentInput: string | null = type === 'text' ? content : null;

      if (type === 'audio') {
        agentInput = await this.processVoiceNote(
          channel.userId,
          memory.id,
          message.audio.id,
          creds,
        );
      }

      if (type === 'image') {
        await this.processImage(
          channel.userId,
          memory.id,
          message.image.id,
          message.image.caption,
          creds,
        );
      }

      this.logger.log(`Processed WhatsApp message from ${from}`);

      if (agentInput?.trim()) {
        await this.runAgent(channel.id, channel.userId, from, agentInput, contact, creds);
      }

      return memory;
    } catch (error) {
      this.logger.error('Failed to process WhatsApp message', error);
      throw error;
    }
  }

  /**
   * Reads a button tap from either kind of button message. Reply buttons on a
   * normal message arrive as `interactive`; quick-reply buttons on a template
   * arrive as `button`, with the id we chose carried in `payload`.
   */
  private buttonTapFrom(message: any): { id: string; title: string } | null {
    if (message.type === 'interactive' && message.interactive?.button_reply?.id) {
      const { id, title } = message.interactive.button_reply;
      return { id, title: title || id };
    }

    if (message.type === 'button' && message.button?.payload) {
      return { id: message.button.payload, title: message.button.text || message.button.payload };
    }

    return null;
  }

  /**
   * Stores an inbound message, returning false if it was already stored. The
   * unique [channelId, externalId] constraint is what recognises a redelivered
   * webhook, so a conflict here means "already seen" rather than a failure.
   */
  private async recordInbound(data: Prisma.ChannelMessageUncheckedCreateInput): Promise<boolean> {
    try {
      await this.prisma.channelMessage.create({ data });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Runs the tool-calling agent over the conversation so far and sends its
   * reply back on the same thread.
   *
   * The agent is given only the conversation - never tokens, secrets, or
   * another user's data - and every tool it invokes is executed against
   * `userId`, which came from the verified channel link rather than anything
   * in the message.
   *
   * Failures are reported to the user as a plain apology instead of being
   * rethrown: the webhook has already stored the message, and Meta retries
   * any non-200, which would re-run the whole thing.
   */
  private async runAgent(
    channelId: string,
    userId: string,
    from: string,
    latestMessage: string,
    contact: any,
    creds: WhatsAppCreds,
  ): Promise<void> {
    try {
      const history = await buildAgentHistory(this.prisma, channelId, latestMessage);
      const reply = await this.chatService.reply(userId, history, contact?.profile?.name);

      if (reply?.trim()) {
        await this.sendMessage(userId, from, reply);
      }
    } catch (error) {
      this.logger.error(`Agent failed for user ${userId}`, error);
      await this.trySendMessage(
        from,
        "Something went wrong on my end and I couldn't finish that. Could you try again?",
        creds,
      );
    }
  }

  /**
   * Replays the recent thread so the agent can follow context across messages -
   * this is what lets "schedule a meeting with Ahmed" / "tomorrow at 4" work
   * as one request split over two messages.
   */

  private async handleLinkCode(from: string, code: string, creds: WhatsAppCreds) {
    const userId = await this.channelLinking.consumeWhatsAppLinkCode(code, from);
    if (userId) {
      this.logger.log(`Linked WhatsApp number ${from} to user ${userId}`);
      await this.trySendMessage(
        from,
        "You're linked! I'll remember what you send me here from now on.",
        creds,
      );
    } else {
      await this.trySendMessage(
        from,
        'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.',
        creds,
      );
    }
  }

  /** Best-effort reply for control-flow messages (link confirmations, unlinked-sender notices) - never throws. */
  private async trySendMessage(to: string, message: string, creds: WhatsAppCreds) {
    const { phoneNumberId, accessToken } = creds;
    if (!phoneNumberId || !accessToken) return;

    try {
      await firstValueFrom(
        this.http.post(
          `https://graph.facebook.com/${this.graphApiVersion}/${phoneNumberId}/messages`,
          { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
    } catch (error) {
      this.logger.error('Failed to send WhatsApp reply', error);
    }
  }

  /** Looks up the temporary CDN URL Meta stores a piece of media at, then downloads it. */
  private async downloadMedia(mediaId: string, creds: WhatsAppCreds): Promise<Buffer> {
    const headers = { Authorization: `Bearer ${creds.accessToken}` };

    const metaResponse = await firstValueFrom(
      this.http.get(`https://graph.facebook.com/${this.graphApiVersion}/${mediaId}`, { headers }),
    );
    const mediaUrl = metaResponse.data.url;

    const fileResponse = await firstValueFrom(
      this.http.get(mediaUrl, { headers, responseType: 'arraybuffer' }),
    );
    return Buffer.from(fileResponse.data);
  }

  /** Prisma overwrites the whole `metadata` JSON column on update, so merge by hand. */
  private async mergeMemoryMetadata(memoryId: string, patch: Record<string, unknown>) {
    const memory = await this.prisma.memory.findUnique({ where: { id: memoryId } });
    return { ...((memory?.metadata as Record<string, unknown>) || {}), ...patch };
  }

  /** Returns the transcript so the caller can act on a spoken instruction, or null if transcription failed. */
  private async processVoiceNote(
    userId: string,
    memoryId: string,
    audioId: string,
    creds: WhatsAppCreds,
  ): Promise<string | null> {
    try {
      const audioBuffer = await this.downloadMedia(audioId, creds);
      const transcript = await this.aiService.transcribeAudio(audioBuffer);
      const metadata = await this.mergeMemoryMetadata(memoryId, { transcriptionPending: false });

      await this.memoryService.update(userId, memoryId, { content: transcript, metadata });
      return transcript;
    } catch (error) {
      this.logger.error('Failed to process voice note', error);
      return null;
    }
  }

  private async processImage(
    userId: string,
    memoryId: string,
    imageId: string,
    caption: string | undefined,
    creds: WhatsAppCreds,
  ) {
    try {
      const headers = { Authorization: `Bearer ${creds.accessToken}` };
      const metaResponse = await firstValueFrom(
        this.http.get(`https://graph.facebook.com/${this.graphApiVersion}/${imageId}`, { headers }),
      );

      const { description, extractedText } = await this.aiService.describeImage(
        metaResponse.data.url,
        caption,
      );
      const content = [caption, description, extractedText].filter(Boolean).join('\n\n');
      const metadata = await this.mergeMemoryMetadata(memoryId, {
        ocrPending: false,
        imageDescription: description,
        extractedText,
      });

      await this.memoryService.update(userId, memoryId, {
        content: content || '[Image received]',
        metadata,
      });
    } catch (error) {
      this.logger.error('Failed to process image', error);
    }
  }

  async sendMessage(userId: string, to: string, message: string) {
    return this.postMessage(
      userId,
      to,
      { type: 'text', text: { body: message } },
      { content: message },
      'message',
    );
  }

  /**
   * Sends a message with up to three tappable reply buttons.
   *
   * Each button's `id` is chosen by the caller and comes straight back in the
   * webhook when tapped, so it carries everything needed to resolve the action
   * (e.g. `remind:<id>:snooze`) without parking state anywhere in between.
   * Ownership is still re-checked on the way back in - the id is a pointer,
   * not proof.
   *
   * Only deliverable inside the 24-hour customer service window; outside it,
   * use sendTemplate (see isWithinCustomerServiceWindow).
   */
  async sendButtons(userId: string, to: string, body: string, buttons: WhatsAppButton[]) {
    return this.postMessage(
      userId,
      to,
      {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body.slice(0, INTERACTIVE_BODY_LIMIT) },
          action: {
            buttons: buttons.slice(0, 3).map((button) => ({
              type: 'reply',
              reply: { id: button.id, title: button.title.slice(0, BUTTON_TITLE_LIMIT) },
            })),
          },
        },
      },
      { content: body, metadata: { interactive: true, buttons: buttons.map((b) => b.id) } },
      'interactive message',
    );
  }

  /**
   * Sends a pre-approved message template - the only kind of message WhatsApp
   * accepts outside the 24-hour customer service window.
   *
   * `quickReplyPayloads` fill the template's quick-reply buttons in order. A
   * tap comes back as a `button` message carrying that payload, so it can use
   * the same ids as sendButtons and land in the same handler.
   */
  async sendTemplate(
    userId: string,
    to: string,
    template: {
      name: string;
      language: string;
      bodyParameters?: string[];
      quickReplyPayloads?: string[];
    },
  ) {
    const bodyParameters = (template.bodyParameters ?? []).map(toTemplateParameter);
    const quickReplyPayloads = template.quickReplyPayloads ?? [];

    const components: Record<string, unknown>[] = [];
    if (bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters.map((text) => ({ type: 'text', text })),
      });
    }
    quickReplyPayloads.forEach((payload, index) => {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload }],
      });
    });

    return this.postMessage(
      userId,
      to,
      {
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          ...(components.length > 0 ? { components } : {}),
        },
      },
      {
        content: bodyParameters.join(' ') || `[template ${template.name}]`,
        metadata: { template: template.name, buttons: quickReplyPayloads },
      },
      'template',
    );
  }

  /**
   * Whether a free-form message (text or reply buttons) can still reach this
   * number - true if they have messaged us within the last 24 hours. Measured
   * from our own record of their last inbound message, button taps included.
   */
  async isWithinCustomerServiceWindow(userId: string, to: string): Promise<boolean> {
    const channel = await this.prisma.channel.findFirst({
      where: { userId, type: 'WHATSAPP', externalId: to },
    });
    if (!channel) return false;

    const lastInbound = await this.prisma.channelMessage.findFirst({
      where: { channelId: channel.id, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!lastInbound) return false;

    return Date.now() - lastInbound.createdAt.getTime() < CUSTOMER_SERVICE_WINDOW_MS;
  }

  /** Posts to the Graph messages endpoint, then records what was sent against the user's channel. */
  private async postMessage(
    userId: string,
    to: string,
    message: Record<string, unknown>,
    record: { content: string; metadata?: Record<string, unknown> },
    label: string,
  ) {
    const { phoneNumberId, accessToken } = await this.credsForUser(userId);

    let messageId = `local_${Date.now()}`;
    try {
      const response = await firstValueFrom(
        this.http.post(
          `https://graph.facebook.com/${this.graphApiVersion}/${phoneNumberId}/messages`,
          { messaging_product: 'whatsapp', to, ...message },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      messageId = response.data?.messages?.[0]?.id ?? messageId;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to send WhatsApp ${label}: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
      );
      throw error;
    }

    const channel = await this.prisma.channel.findFirst({
      where: { userId, type: 'WHATSAPP', externalId: to },
    });

    if (channel) {
      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: messageId,
          content: record.content,
          type: 'TEXT',
          direction: 'OUTBOUND',
          ...(record.metadata ? { metadata: record.metadata as Prisma.InputJsonObject } : {}),
        },
      });
    }

    return { success: true, messageId };
  }

  /**
   * Only returns a channel that a user has explicitly proven ownership of via
   * the LINK code flow (see handleLinkCode/ChannelLinkingService) - never
   * guesses or falls back to "the first user in the database", since that
   * would attribute one person's messages to a completely different account.
   */
  private async findOrCreateChannel(phoneNumber: string) {
    return this.prisma.channel.findFirst({
      where: { type: 'WHATSAPP', externalId: phoneNumber },
    });
  }

  private mapMessageType(whatsappType: string): any {
    const typeMap: Record<string, string> = {
      text: 'TEXT',
      image: 'IMAGE',
      audio: 'VOICE',
      video: 'VIDEO',
      document: 'DOCUMENT',
      location: 'LOCATION',
    };
    return typeMap[whatsappType] || 'TEXT';
  }

  private mapMemoryType(whatsappType: string): any {
    const typeMap: Record<string, string> = {
      text: 'MESSAGE',
      image: 'IMAGE',
      audio: 'VOICE_NOTE',
      video: 'MESSAGE',
      document: 'FILE',
    };
    return typeMap[whatsappType] || 'MESSAGE';
  }
}

/**
 * Meta rejects template parameters that contain newlines, tabs or long runs of
 * spaces, so multi-line reminder text is flattened onto one line.
 */
function toTemplateParameter(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' · ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, TEMPLATE_PARAMETER_LIMIT);
}
