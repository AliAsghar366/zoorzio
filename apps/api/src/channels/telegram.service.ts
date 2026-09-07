import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIService } from '../ai/ai.service';
import { ChannelLinkingService } from './channel-linking.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private aiService: AIService,
    private readonly http: HttpService,
    private readonly channelLinking: ChannelLinkingService,
  ) {}

  private get botToken(): string {
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  async initialize() {
    try {
      const botToken = this.botToken;

      this.logger.log('Telegram service initialized');

      return {
        status: botToken ? 'initialized' : 'not configured',
        botToken: botToken ? 'configured' : 'not configured',
      };
    } catch (error) {
      this.logger.error('Failed to initialize Telegram service', error);
      throw error;
    }
  }

  async handleWebhook(payload: any) {
    const { message } = payload;

    if (message) {
      await this.processMessage(message);
    }

    return { status: 'ok' };
  }

  private async processMessage(message: any) {
    try {
      const { chat, from, text, date, message_id: externalId, photo, voice, document } = message;

      if (text?.startsWith('/start')) {
        const token = text.slice('/start'.length).trim();
        if (token) {
          await this.handleStartToken(chat.id, token, from);
          return null;
        }
      }

      const channel = await this.findOrCreateChannel(from);
      if (!channel) {
        this.logger.warn(`Ignoring Telegram message from unlinked chat ${from.id} - no account has linked it yet`);
        await this.trySendMessage(
          chat.id,
          "I don't recognize you yet. Open Zoorzio, go to your Profile, and tap Connect Telegram to link this chat.",
        );
        return null;
      }

      let content = '';
      let metadata: any = {
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

      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: externalId.toString(),
          content,
          type: this.mapMessageType(message),
          direction: 'INBOUND',
          metadata,
        },
      });

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

      if (voice) {
        await this.processVoiceNote(channel.userId, memory.id, voice.file_id);
      }

      if (photo) {
        await this.processImage(channel.userId, memory.id, photo[photo.length - 1].file_id);
      }

      this.logger.log(`Processed Telegram message from ${from.id}`);

      return memory;
    } catch (error) {
      this.logger.error('Failed to process Telegram message', error);
      throw error;
    }
  }

  private async handleStartToken(chatId: number, token: string, from: any) {
    const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username;
    const userId = await this.channelLinking.consumeTelegramLinkToken(token, chatId.toString(), displayName);
    if (userId) {
      this.logger.log(`Linked Telegram chat ${chatId} to user ${userId}`);
      await this.trySendMessage(chatId, "You're linked! I'll remember what you send me here from now on.");
    } else {
      await this.trySendMessage(chatId, 'That link is invalid or expired. Generate a new one from your Zoorzio Profile page.');
    }
  }

  /** Best-effort reply for control-flow messages (link confirmations, unlinked-sender notices) - never throws. */
  private async trySendMessage(chatId: number, text: string) {
    if (!this.botToken) return;
    try {
      await firstValueFrom(
        this.http.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, { chat_id: chatId, text }),
      );
    } catch (error) {
      this.logger.error('Failed to send Telegram reply', error);
    }
  }

  /** Telegram requires a two-step lookup: fileId -> file_path -> download URL. */
  private async downloadFile(fileId: string): Promise<Buffer> {
    const fileInfo = await firstValueFrom(
      this.http.get(`https://api.telegram.org/bot${this.botToken}/getFile`, {
        params: { file_id: fileId },
      }),
    );
    const filePath = fileInfo.data.result.file_path;

    const fileResponse = await firstValueFrom(
      this.http.get(`https://api.telegram.org/file/bot${this.botToken}/${filePath}`, {
        responseType: 'arraybuffer',
      }),
    );
    return Buffer.from(fileResponse.data);
  }

  private async mergeMemoryMetadata(memoryId: string, patch: Record<string, unknown>) {
    const memory = await this.prisma.memory.findUnique({ where: { id: memoryId } });
    return { ...((memory?.metadata as Record<string, unknown>) || {}), ...patch };
  }

  private async processVoiceNote(userId: string, memoryId: string, fileId: string) {
    try {
      const audioBuffer = await this.downloadFile(fileId);
      const transcript = await this.aiService.transcribeAudio(audioBuffer);
      const metadata = await this.mergeMemoryMetadata(memoryId, { transcriptionPending: false });

      await this.memoryService.update(userId, memoryId, { content: transcript, metadata });
    } catch (error) {
      this.logger.error('Failed to process voice note', error);
    }
  }

  private async processImage(userId: string, memoryId: string, fileId: string) {
    try {
      const fileInfo = await firstValueFrom(
        this.http.get(`https://api.telegram.org/bot${this.botToken}/getFile`, {
          params: { file_id: fileId },
        }),
      );
      const imageUrl = `https://api.telegram.org/file/bot${this.botToken}/${fileInfo.data.result.file_path}`;

      const { description, extractedText } = await this.aiService.describeImage(imageUrl);
      const content = [description, extractedText].filter(Boolean).join('\n\n');
      const metadata = await this.mergeMemoryMetadata(memoryId, {
        ocrPending: false,
        imageDescription: description,
        extractedText,
      });

      await this.memoryService.update(userId, memoryId, { content: content || '[Photo received]', metadata });
    } catch (error) {
      this.logger.error('Failed to process image', error);
    }
  }

  async sendMessage(userId: string, chatId: number, message: string) {
    let messageId = `local_${Date.now()}`;
    try {
      const response = await firstValueFrom(
        this.http.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          chat_id: chatId,
          text: message,
        }),
      );
      messageId = response.data?.result?.message_id?.toString() ?? messageId;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to send Telegram message: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
      );
      throw error;
    }

    const channel = await this.prisma.channel.findFirst({
      where: {
        userId,
        type: 'TELEGRAM',
        externalId: chatId.toString(),
      },
    });

    if (channel) {
      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: messageId,
          content: message,
          type: 'TEXT',
          direction: 'OUTBOUND',
        },
      });
    }

    return { success: true, messageId };
  }

  /**
   * Only returns a channel that a user has explicitly proven ownership of via
   * the /start deep-link flow (see handleStartToken/ChannelLinkingService) -
   * never auto-creates a disconnected synthetic account for a stranger's chat.
   */
  private async findOrCreateChannel(from: any) {
    return this.prisma.channel.findFirst({
      where: { type: 'TELEGRAM', externalId: from.id.toString() },
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
