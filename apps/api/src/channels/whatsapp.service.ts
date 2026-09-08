import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIService } from '../ai/ai.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ChannelType } from '@anchor/database';

const GRAPH_API_VERSION = 'v19.0';
const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;

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
  ) {}

  /** The platform-wide Business account, used when a user hasn't brought their own. */
  private get sharedCreds(): WhatsAppCreds {
    return {
      accessToken: this.configService.get('WHATSAPP_BUSINESS_TOKEN') ?? '',
      phoneNumberId: this.configService.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
    };
  }

  /** Resolves the Business account a given user sends on - their own if connected. */
  private async credsForUser(userId: string): Promise<WhatsAppCreds> {
    const own = await this.channelCredentials.getDecryptedToken(userId, ChannelType.WHATSAPP);
    const ownPhoneNumberId = (own?.metadata as any)?.phoneNumberId;
    if (own && ownPhoneNumberId) {
      return { accessToken: own.token, phoneNumberId: ownPhoneNumberId };
    }
    return this.sharedCreds;
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

  async handleWebhook(payload: any) {
    const { entry } = payload;

    for (const item of entry) {
      const { changes } = item;

      for (const change of changes) {
        const { value } = change;

        if (value.messages) {
          // Meta names the *recipient* Business number in every payload, which
          // is what tells us whose account was messaged once several users have
          // each connected their own. Falls back to the shared account so
          // existing users on the platform bot keep working unchanged.
          const phoneNumberId = value.metadata?.phone_number_id;
          const own = phoneNumberId
            ? await this.channelCredentials.getByWhatsAppPhoneNumberId(phoneNumberId)
            : null;
          const creds: WhatsAppCreds = own
            ? { accessToken: own.token, phoneNumberId }
            : this.sharedCreds;

          for (const message of value.messages) {
            await this.processMessage(message, value.contacts?.[0], creds);
          }
        }
      }
    }

    return { status: 'ok' };
  }

  private async processMessage(
    message: any,
    contact: any,
    creds: WhatsAppCreds = this.sharedCreds,
  ) {
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

      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId,
          content,
          type: this.mapMessageType(type),
          direction: 'INBOUND',
          metadata,
        },
      });

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

      if (type === 'audio') {
        await this.processVoiceNote(channel.userId, memory.id, message.audio.id, creds);
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

      return memory;
    } catch (error) {
      this.logger.error('Failed to process WhatsApp message', error);
      throw error;
    }
  }

  private async handleLinkCode(
    from: string,
    code: string,
    creds: WhatsAppCreds = this.sharedCreds,
  ) {
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
  private async trySendMessage(
    to: string,
    message: string,
    creds: WhatsAppCreds = this.sharedCreds,
  ) {
    const { phoneNumberId, accessToken } = creds;
    if (!phoneNumberId || !accessToken) return;

    try {
      await firstValueFrom(
        this.http.post(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
          { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
    } catch (error) {
      this.logger.error('Failed to send WhatsApp reply', error);
    }
  }

  /** Looks up the temporary CDN URL Meta stores a piece of media at, then downloads it. */
  private async downloadMedia(
    mediaId: string,
    creds: WhatsAppCreds = this.sharedCreds,
  ): Promise<Buffer> {
    const headers = { Authorization: `Bearer ${creds.accessToken}` };

    const metaResponse = await firstValueFrom(
      this.http.get(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, { headers }),
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

  private async processVoiceNote(
    userId: string,
    memoryId: string,
    audioId: string,
    creds: WhatsAppCreds = this.sharedCreds,
  ) {
    try {
      const audioBuffer = await this.downloadMedia(audioId, creds);
      const transcript = await this.aiService.transcribeAudio(audioBuffer);
      const metadata = await this.mergeMemoryMetadata(memoryId, { transcriptionPending: false });

      await this.memoryService.update(userId, memoryId, { content: transcript, metadata });
    } catch (error) {
      this.logger.error('Failed to process voice note', error);
    }
  }

  private async processImage(
    userId: string,
    memoryId: string,
    imageId: string,
    caption?: string,
    creds: WhatsAppCreds = this.sharedCreds,
  ) {
    try {
      const headers = { Authorization: `Bearer ${creds.accessToken}` };
      const metaResponse = await firstValueFrom(
        this.http.get(`https://graph.facebook.com/${GRAPH_API_VERSION}/${imageId}`, { headers }),
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
    const { phoneNumberId, accessToken } = await this.credsForUser(userId);

    let messageId = `local_${Date.now()}`;
    try {
      const response = await firstValueFrom(
        this.http.post(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message },
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      messageId = response.data?.messages?.[0]?.id ?? messageId;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to send WhatsApp message: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
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
