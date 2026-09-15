import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { timingSafeEqual } from 'crypto';
import { ChannelCredentialStatus, ChannelType, Prisma } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIService } from '../ai/ai.service';
import { ChatService } from '../chat/chat.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { InteractiveReplyService } from './interactive-reply.service';
import { buildAgentHistory } from './agent-history';

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;
const MAX_CALLBACK_DATA_BYTES = 64;
const ALLOWED_UPDATES = ['message', 'callback_query'];

export interface TelegramButton {
  id: string;
  title: string;
}

/**
 * Telegram transport for the Zoorzio assistant: linked users chat with a bot
 * and get the same agent, tools, confirmations and reminder buttons as on
 * WhatsApp. Runs on the official Bot API - either the shared platform bot
 * (TELEGRAM_BOT_TOKEN) or a user's own bot connected from their settings.
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private aiService: AIService,
    private readonly http: HttpService,
    private readonly channelLinking: ChannelLinkingService,
    private readonly channelCredentials: ChannelCredentialsService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => InteractiveReplyService))
    private readonly interactiveReplies: InteractiveReplyService,
  ) {}

  /** Falls back to the platform-wide shared bot when a user hasn't connected their own. */
  private get botToken(): string {
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  private get apiBaseUrl(): string {
    return this.configService.get<string>('API_URL') ?? '';
  }

  private get webhookSecret(): string {
    return this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
  }

  /** Re-points the shared bot at this server on every boot, so env vars + deploy is the whole setup. */
  onModuleInit() {
    if (!this.botToken || !this.apiBaseUrl || !this.webhookSecret) return;
    void this.registerSharedWebhook();
  }

  async registerSharedWebhook(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post(`${TELEGRAM_API}/bot${this.botToken}/setWebhook`, {
          url: `${this.apiBaseUrl}/channels/telegram/webhook`,
          secret_token: this.webhookSecret,
          allowed_updates: ALLOWED_UPDATES,
        }),
      );
      if (response.data?.ok) {
        this.logger.log('Registered the shared Telegram bot webhook');
      } else {
        this.logger.error(
          `Telegram rejected the shared bot webhook: ${response.data?.description}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to register the shared Telegram bot webhook: ${describeError(error)}`,
      );
    }
  }

  /**
   * The shared webhook URL is public, so the secret Telegram echoes back in
   * X-Telegram-Bot-Api-Secret-Token is the only proof a call came from
   * Telegram. Fails closed with no secret configured: an unverified update
   * would let anyone drive the agent as whichever linked user they name.
   */
  verifyWebhookSecret(received: string | undefined): boolean {
    const expected = this.webhookSecret;
    if (!expected || !received) return false;

    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Registers (or re-registers) a per-user webhook with Telegram right after the user saves their own bot token. */
  async registerWebhook(userId: string) {
    const credential = await this.channelCredentials.getDecryptedToken(
      userId,
      ChannelType.TELEGRAM,
    );
    if (!credential) return;

    const record = await this.prisma.channelCredential.findUnique({
      where: { userId_type: { userId, type: ChannelType.TELEGRAM } },
    });
    if (!record?.webhookRoutingKey) return;

    // Without a public base URL there is no valid address to hand Telegram, and
    // a half-registered bot would look connected while silently receiving
    // nothing - so say so plainly instead.
    if (!this.apiBaseUrl) {
      const message =
        'API_URL is not configured on this server, so Telegram has nowhere to deliver messages';
      this.logger.error(`Cannot register Telegram webhook for user ${userId}: ${message}`);
      await this.channelCredentials.markStatus(
        userId,
        ChannelType.TELEGRAM,
        ChannelCredentialStatus.INVALID,
        message,
      );
      return;
    }

    try {
      const webhookUrl = `${this.apiBaseUrl}/channels/telegram/webhook/${record.webhookRoutingKey}`;
      const response = await firstValueFrom(
        this.http.post(`${TELEGRAM_API}/bot${credential.token}/setWebhook`, {
          url: webhookUrl,
          allowed_updates: ALLOWED_UPDATES,
        }),
      );

      if (response.data?.ok) {
        const me = await firstValueFrom(
          this.http.get(`${TELEGRAM_API}/bot${credential.token}/getMe`),
        );
        await this.prisma.channelCredential.update({
          where: { userId_type: { userId, type: ChannelType.TELEGRAM } },
          data: {
            status: ChannelCredentialStatus.ACTIVE,
            lastVerifiedAt: new Date(),
            lastError: null,
            metadata: { botUsername: me.data?.result?.username ?? null },
          },
        });
      } else {
        await this.channelCredentials.markStatus(
          userId,
          ChannelType.TELEGRAM,
          ChannelCredentialStatus.INVALID,
          response.data?.description ?? 'setWebhook failed',
        );
      }
    } catch (error) {
      const message = describeError(error);
      this.logger.error(`Failed to register Telegram webhook for user ${userId}: ${message}`);
      await this.channelCredentials.markStatus(
        userId,
        ChannelType.TELEGRAM,
        ChannelCredentialStatus.INVALID,
        message,
      );
    }
  }

  /** Tears down the user's webhook registration with Telegram when they remove their credential. */
  async unregisterWebhook(userId: string) {
    const credential = await this.channelCredentials.getDecryptedToken(
      userId,
      ChannelType.TELEGRAM,
    );
    if (!credential) return;

    await this.tryCall(credential.token, 'deleteWebhook', {});
  }

  /**
   * Entry point for a per-user webhook. The 192-bit routing key in the URL is
   * the credential here: it's only ever given to Telegram via setWebhook.
   */
  async handleWebhookForRoutingKey(routingKey: string, payload: any) {
    const credential = await this.channelCredentials.getByRoutingKey(routingKey);
    if (!credential) {
      this.logger.warn(`Received Telegram webhook for unknown routing key`);
      return { status: 'ok' };
    }

    return this.handleWebhook(payload, credential.token);
  }

  async initialize() {
    const botToken = this.botToken;

    this.logger.log('Telegram service initialized');

    return {
      status: botToken ? 'initialized' : 'not configured',
      botToken: botToken ? 'configured' : 'not configured',
    };
  }

  /** botToken defaults to the shared platform bot; per-user webhooks pass in the resolved user's own token. */
  async handleWebhook(payload: any, botToken: string = this.botToken) {
    if (payload?.callback_query) {
      await this.processCallbackQuery(payload.callback_query, botToken);
    } else if (payload?.message) {
      await this.processMessage(payload.message, botToken);
    }

    return { status: 'ok' };
  }

  private async processMessage(message: any, botToken: string) {
    try {
      const { chat, from, text, date, message_id: externalId, photo, voice, document } = message;

      // One-to-one chats only. In a group, the agent's replies - tasks,
      // calendar, email - would be visible to everyone in it.
      if (chat?.type !== 'private' || !from) return null;

      if (text?.startsWith('/start')) {
        const token = text.slice('/start'.length).trim();
        if (token) {
          await this.handleStartToken(chat.id, token, from, botToken);
          return null;
        }
      }

      const channel = await this.findLinkedChannel(from);
      if (!channel) {
        this.logger.warn(
          `Ignoring Telegram message from unlinked chat ${from.id} - no account has linked it yet`,
        );
        await this.trySendMessage(
          chat.id,
          "I don't recognize you yet. Open Zoorzio, go to your Profile, and tap Connect Telegram to link this chat.",
          botToken,
        );
        return null;
      }

      if (text?.trim() === '/start') {
        await this.trySendMessage(
          chat.id,
          "You're already linked. Just tell me what you need - a task, a reminder, what's on your calendar.",
          botToken,
        );
        return null;
      }

      let content = '';
      const metadata: any = {
        telegramMessageId: externalId,
        chatId: chat.id,
        timestamp: date,
      };

      if (text) {
        content = text;
      } else if (photo) {
        content = '[Photo received]';
        metadata.photoId = photo[photo.length - 1].file_id;
      } else if (voice) {
        content = '[Voice note received]';
        metadata.voiceId = voice.file_id;
        metadata.isVoiceNote = true;
      } else if (document) {
        content = document.file_name || '[Document received]';
        metadata.documentId = document.file_id;
      } else {
        content = '[Unsupported message type]';
      }

      const isNew = await this.recordInbound({
        channelId: channel.id,
        externalId: externalId.toString(),
        content,
        type: this.mapMessageType(message),
        direction: 'INBOUND',
        metadata,
      });

      // Telegram redelivers any update it didn't get a 200 for. A repeat is
      // dropped here, before it can store a second memory or run the agent twice.
      if (!isNew) {
        this.logger.log(`Ignoring redelivered Telegram message ${externalId}`);
        return null;
      }

      const memory = await this.memoryService.create(channel.userId, {
        content,
        type: this.mapMemoryType(message),
        source: 'TELEGRAM',
        metadata: {
          ...metadata,
          senderId: from.id,
          senderName: [from.first_name, from.last_name].filter(Boolean).join(' '),
          username: from.username,
        },
        tags: ['telegram'],
      });

      // A voice note is a spoken instruction, so its transcript is acted on
      // exactly like typed text.
      let agentInput: string | null = text ?? null;

      if (voice) {
        agentInput = await this.processVoiceNote(
          channel.userId,
          memory.id,
          voice.file_id,
          botToken,
        );
      }

      if (photo) {
        await this.processImage(
          channel.userId,
          memory.id,
          photo[photo.length - 1].file_id,
          botToken,
        );
      }

      this.logger.log(`Processed Telegram message from ${from.id}`);

      if (agentInput?.trim()) {
        await this.runAgent(channel.id, channel.userId, chat.id, agentInput, from, botToken);
      }

      return memory;
    } catch (error) {
      this.logger.error(`Failed to process Telegram message: ${describeError(error)}`);
      throw error;
    }
  }

  /**
   * Runs the tool-calling agent over the conversation and replies on the same
   * chat, through the same bot that received the message.
   *
   * Every tool runs as `userId`, which comes from the verified channel link -
   * never from anything in the message. Failures become a plain apology rather
   * than an exception: the update is already stored, and a non-200 would make
   * Telegram redeliver it.
   */
  private async runAgent(
    channelId: string,
    userId: string,
    chatId: number,
    latestMessage: string,
    from: any,
    botToken: string,
  ): Promise<void> {
    try {
      await this.tryCall(botToken, 'sendChatAction', { chat_id: chatId, action: 'typing' });

      const history = await buildAgentHistory(this.prisma, channelId, latestMessage);
      const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username;

      const reply = await this.chatService.reply(userId, history, name, {
        sendButtons: (question, buttons) =>
          this.deliver(channelId, chatId, question, botToken, buttons),
      });

      if (reply?.trim()) {
        await this.deliver(channelId, chatId, reply, botToken);
      }
    } catch (error) {
      this.logger.error(`Agent failed for user ${userId}: ${describeError(error)}`);
      await this.trySendMessage(
        chatId,
        "Something went wrong on my end and I couldn't finish that. Could you try again?",
        botToken,
      );
    }
  }

  /**
   * A tap on an inline button - a reminder action or a yes/no confirmation.
   * Resolved deterministically, never shown to the model; InteractiveReplyService
   * re-checks that the record belongs to the user whose linked chat tapped it.
   */
  private async processCallbackQuery(query: any, botToken: string) {
    const { id: queryId, from, message, data } = query;

    // Clears the button's loading spinner whatever happens next.
    await this.tryCall(botToken, 'answerCallbackQuery', { callback_query_id: queryId });

    const chatId = message?.chat?.id;
    if (!from || !data || message?.chat?.type !== 'private' || chatId === undefined) return;

    const channel = await this.findLinkedChannel(from);
    if (!channel) return;

    const isNew = await this.recordInbound({
      channelId: channel.id,
      externalId: `callback:${queryId}`,
      content: buttonTitle(message, data),
      type: 'TEXT',
      direction: 'INBOUND',
      metadata: { telegramCallbackQueryId: queryId, buttonId: data },
    });
    if (!isNew) return;

    // Buttons are single-use, so a stale question can't be answered twice.
    await this.tryCall(botToken, 'editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: { inline_keyboard: [] },
    });

    const reply = await this.interactiveReplies.handle(channel.userId, data);
    if (reply) {
      await this.deliver(channel.id, chatId, reply, botToken);
    }
  }

  private async handleStartToken(chatId: number, token: string, from: any, botToken: string) {
    const displayName =
      [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username;
    const userId = await this.channelLinking.consumeTelegramLinkToken(
      token,
      chatId.toString(),
      displayName,
    );
    if (userId) {
      this.logger.log(`Linked Telegram chat ${chatId} to user ${userId}`);
      await this.trySendMessage(
        chatId,
        "You're linked! Tell me what you need - add a task, set a reminder, check your calendar - and I'll take care of it.",
        botToken,
      );
    } else {
      await this.trySendMessage(
        chatId,
        'That link is invalid or expired. Generate a new one from your Zoorzio Profile page.',
        botToken,
      );
    }
  }

  /**
   * Stores an inbound message, returning false if it was already stored. The
   * unique [channelId, externalId] constraint is what recognises a redelivered
   * update, so a conflict here means "already seen" rather than a failure.
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

  async sendMessage(userId: string, chatId: number, message: string) {
    const { botToken, channelId } = await this.resolveOutbound(userId, chatId);
    try {
      return await this.deliver(channelId, chatId, message, botToken);
    } catch (error) {
      this.logger.error(`Failed to send Telegram message: ${describeError(error)}`);
      throw error;
    }
  }

  async sendButtons(userId: string, chatId: number, text: string, buttons: TelegramButton[]) {
    const { botToken, channelId } = await this.resolveOutbound(userId, chatId);
    try {
      return await this.deliver(channelId, chatId, text, botToken, buttons);
    } catch (error) {
      this.logger.error(`Failed to send Telegram buttons: ${describeError(error)}`);
      throw error;
    }
  }

  private async resolveOutbound(userId: string, chatId: number) {
    const ownCredential = await this.channelCredentials.getDecryptedToken(
      userId,
      ChannelType.TELEGRAM,
    );
    const channel = await this.prisma.channel.findFirst({
      where: { userId, type: 'TELEGRAM', externalId: chatId.toString() },
    });

    return { botToken: ownCredential?.token || this.botToken, channelId: channel?.id ?? null };
  }

  /**
   * Sends text (split to Telegram's size limit, buttons on the last piece) and
   * records it on the thread, so the agent sees its own side of the
   * conversation next time.
   */
  private async deliver(
    channelId: string | null,
    chatId: number,
    text: string,
    botToken: string,
    buttons?: TelegramButton[],
  ): Promise<{ success: boolean; messageId: string }> {
    const replyMarkup = buttons?.length ? inlineKeyboard(buttons) : undefined;
    const chunks = splitMessage(text);

    let messageId = '';
    for (const [index, chunk] of chunks.entries()) {
      const isLast = index === chunks.length - 1;
      const response = await firstValueFrom(
        this.http.post(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: chunk,
          ...(isLast && replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      );
      messageId = response.data?.result?.message_id?.toString() ?? `local_${Date.now()}`;
    }

    if (channelId) {
      await this.prisma.channelMessage.create({
        data: {
          channelId,
          externalId: messageId,
          content: text,
          type: 'TEXT',
          direction: 'OUTBOUND',
          ...(buttons?.length ? { metadata: { buttons: buttons.map((b) => b.id) } } : {}),
        },
      });
    }

    return { success: true, messageId };
  }

  /** Best-effort reply for control-flow messages (link confirmations, unlinked-sender notices). */
  private async trySendMessage(chatId: number, text: string, botToken: string = this.botToken) {
    await this.tryCall(botToken, 'sendMessage', { chat_id: chatId, text });
  }

  /** Best-effort Bot API call for steps that must never fail the update - never throws. */
  private async tryCall(botToken: string, method: string, body: Record<string, unknown>) {
    if (!botToken) return;
    try {
      await firstValueFrom(this.http.post(`${TELEGRAM_API}/bot${botToken}/${method}`, body));
    } catch (error) {
      this.logger.warn(`Telegram ${method} failed: ${describeError(error)}`);
    }
  }

  /** Telegram requires a two-step lookup: fileId -> file_path -> download URL. */
  private async downloadFile(fileId: string, botToken: string): Promise<Buffer> {
    const fileInfo = await firstValueFrom(
      this.http.get(`${TELEGRAM_API}/bot${botToken}/getFile`, {
        params: { file_id: fileId },
      }),
    );
    const filePath = fileInfo.data.result.file_path;

    const fileResponse = await firstValueFrom(
      this.http.get(`${TELEGRAM_API}/file/bot${botToken}/${filePath}`, {
        responseType: 'arraybuffer',
      }),
    );
    return Buffer.from(fileResponse.data);
  }

  private async mergeMemoryMetadata(memoryId: string, patch: Record<string, unknown>) {
    const memory = await this.prisma.memory.findUnique({ where: { id: memoryId } });
    return { ...((memory?.metadata as Record<string, unknown>) || {}), ...patch };
  }

  /** Returns the transcript, or null if it couldn't be produced. */
  private async processVoiceNote(
    userId: string,
    memoryId: string,
    fileId: string,
    botToken: string,
  ): Promise<string | null> {
    try {
      const audioBuffer = await this.downloadFile(fileId, botToken);
      const transcript = await this.aiService.transcribeAudio(audioBuffer);
      const metadata = await this.mergeMemoryMetadata(memoryId, { transcriptionPending: false });

      await this.memoryService.update(userId, memoryId, { content: transcript, metadata });
      return transcript;
    } catch (error) {
      this.logger.error(`Failed to process voice note: ${describeError(error)}`);
      return null;
    }
  }

  private async processImage(userId: string, memoryId: string, fileId: string, botToken: string) {
    try {
      const fileInfo = await firstValueFrom(
        this.http.get(`${TELEGRAM_API}/bot${botToken}/getFile`, {
          params: { file_id: fileId },
        }),
      );
      const imageUrl = `${TELEGRAM_API}/file/bot${botToken}/${fileInfo.data.result.file_path}`;

      const { description, extractedText } = await this.aiService.describeImage(imageUrl);
      const content = [description, extractedText].filter(Boolean).join('\n\n');
      const metadata = await this.mergeMemoryMetadata(memoryId, {
        ocrPending: false,
        imageDescription: description,
        extractedText,
      });

      await this.memoryService.update(userId, memoryId, {
        content: content || '[Photo received]',
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to process image: ${describeError(error)}`);
    }
  }

  /**
   * Only returns a chat a user has proven ownership of via the /start deep
   * link - never auto-creates an account for a stranger's chat.
   */
  private async findLinkedChannel(from: any) {
    return this.prisma.channel.findFirst({
      where: { type: 'TELEGRAM', externalId: from.id.toString(), isActive: true },
    });
  }

  private mapMessageType(message: any): any {
    if (message.photo) return 'IMAGE';
    if (message.voice) return 'VOICE';
    if (message.video) return 'VIDEO';
    if (message.document) return 'DOCUMENT';
    if (message.location) return 'LOCATION';
    return 'TEXT';
  }

  private mapMemoryType(message: any): any {
    if (message.photo) return 'IMAGE';
    if (message.voice) return 'VOICE_NOTE';
    if (message.video) return 'MESSAGE';
    if (message.document) return 'FILE';
    return 'MESSAGE';
  }
}

/** Axios errors carry the request URL, which contains the bot token - so only status and description are logged. */
function describeError(error: unknown): string {
  const axiosError = error as AxiosError<{ description?: string }>;
  if (axiosError?.isAxiosError) {
    const status = axiosError.response?.status ?? 'network error';
    return `${status} ${axiosError.response?.data?.description ?? ''}`.trim();
  }
  return error instanceof Error ? error.message : 'unknown error';
}

/** Splits text into Telegram-sized pieces, breaking at a newline where possible. */
function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_MESSAGE_LENGTH) {
    const newline = rest.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    const cut = newline > 0 ? newline : MAX_MESSAGE_LENGTH;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  chunks.push(rest);
  return chunks;
}

/** One button per row - the labels are too long to sit side by side on a phone. */
function inlineKeyboard(buttons: TelegramButton[]) {
  for (const button of buttons) {
    if (Buffer.byteLength(button.id, 'utf8') > MAX_CALLBACK_DATA_BYTES) {
      throw new Error(
        `Button id "${button.id}" exceeds Telegram's ${MAX_CALLBACK_DATA_BYTES}-byte callback_data limit`,
      );
    }
  }
  return {
    inline_keyboard: buttons.map((button) => [{ text: button.title, callback_data: button.id }]),
  };
}

function buttonTitle(message: any, data: string): string {
  const rows: any[][] = message?.reply_markup?.inline_keyboard ?? [];
  return rows.flat().find((button) => button?.callback_data === data)?.text ?? data;
}
