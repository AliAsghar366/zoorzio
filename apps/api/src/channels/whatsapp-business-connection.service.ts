import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  MessageDirection,
  MessageType,
  Prisma,
  WhatsAppBusinessConnection,
  WhatsAppBusinessConnectionStatus,
} from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { graphApiVersion } from './whatsapp-graph';

/**
 * Meta offboards a coexistence number whose contacts and history sync weren't
 * requested within 24 hours of onboarding, so both syncs start as part of
 * connecting rather than waiting for someone to trigger them.
 */
const SYNC_DEADLINE_MS = 24 * 60 * 60 * 1000;

/** Error code in a `history` webhook when the business turned history sharing off in the app. */
const HISTORY_SHARING_DECLINED = 2593109;

export type SyncKind = 'contacts' | 'history';

export interface ConnectWhatsAppBusinessInput {
  code: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
}

interface ActiveCredentials {
  accessToken: string;
  phoneNumberId: string;
}

/**
 * Connects Zoorzio's own WhatsApp Business app number to Cloud API through
 * Embedded Signup ("coexistence"), so the number keeps working in the
 * WhatsApp Business app while Zoorzio sends and receives on it too.
 *
 * Only available to a Meta Tech Provider or Solution Partner, and only
 * reachable by platform admins.
 */
@Injectable()
export class WhatsAppBusinessConnectionService {
  private readonly logger = new Logger(WhatsAppBusinessConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get graphBase(): string {
    return `https://graph.facebook.com/${graphApiVersion(this.config)}`;
  }

  /** Credentials for the connected platform number, or null so callers fall back to environment configuration. */
  async getActiveCredentials(): Promise<ActiveCredentials | null> {
    const connection = await this.prisma.whatsAppBusinessConnection.findFirst({
      where: { status: WhatsAppBusinessConnectionStatus.ACTIVE },
      orderBy: { connectedAt: 'desc' },
    });
    if (!connection) return null;

    return {
      accessToken: await this.encryption.decrypt(connection.encryptedAccessToken),
      phoneNumberId: connection.phoneNumberId,
    };
  }

  async listConnections() {
    const connections = await this.prisma.whatsAppBusinessConnection.findMany({
      orderBy: { connectedAt: 'desc' },
    });
    return connections.map((connection) => this.toPublicView(connection));
  }

  /**
   * Finishes onboarding after the admin completes Embedded Signup in the
   * browser: exchange the code, subscribe to webhooks, confirm the number is
   * on the Business app, store the token encrypted, then start both syncs.
   *
   * The phone number is deliberately not registered - a coexistence number is
   * already registered by the WhatsApp Business app.
   */
  async connect(adminUserId: string, input: ConnectWhatsAppBusinessInput) {
    const appId = this.config.get<string>('WHATSAPP_APP_ID');
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appId || !appSecret) {
      throw new BadRequestException(
        'WHATSAPP_APP_ID and WHATSAPP_APP_SECRET must be configured before a number can be connected.',
      );
    }

    // The code expires about 30 seconds after signup finishes, so this is first.
    const accessToken = await this.exchangeCode(appId, appSecret, input.code);
    await this.subscribeToWebhooks(input.wabaId, accessToken);
    const phone = await this.getPhoneNumberStatus(input.phoneNumberId, accessToken);

    const encryptedAccessToken = await this.encryption.encrypt(accessToken);
    const now = new Date();
    const details = {
      wabaId: input.wabaId,
      businessId: input.businessId ?? null,
      displayPhoneNumber: phone.displayPhoneNumber,
      encryptedAccessToken,
      isOnBizApp: phone.isOnBizApp,
      platformType: phone.platformType,
      status: WhatsAppBusinessConnectionStatus.ACTIVE,
      connectedByUserId: adminUserId,
      connectedAt: now,
      disconnectedAt: null,
      disconnectReason: null,
      // A reconnection is a fresh onboarding with its own 24-hour window, so
      // any earlier sync state no longer applies.
      contactsSyncRequestId: null,
      contactsSyncStartedAt: null,
      historySyncRequestId: null,
      historySyncStartedAt: null,
      historySyncDeclined: false,
      historySyncProgress: null,
      lastSyncError: null,
    };

    const connection = await this.prisma.$transaction(async (tx) => {
      // Zoorzio sends from a single platform number, so connecting one retires
      // any other that was active.
      await tx.whatsAppBusinessConnection.updateMany({
        where: {
          status: WhatsAppBusinessConnectionStatus.ACTIVE,
          phoneNumberId: { not: input.phoneNumberId },
        },
        data: {
          status: WhatsAppBusinessConnectionStatus.DISCONNECTED,
          disconnectedAt: now,
          disconnectReason: 'REPLACED',
        },
      });

      return tx.whatsAppBusinessConnection.upsert({
        where: { phoneNumberId: input.phoneNumberId },
        create: { phoneNumberId: input.phoneNumberId, ...details },
        update: details,
      });
    });

    this.logger.log(
      `Connected WhatsApp Business number ${connection.phoneNumberId} (on Business app: ${phone.isOnBizApp})`,
    );

    if (phone.isOnBizApp) {
      await this.startSync(connection.id, 'contacts');
      await this.startSync(connection.id, 'history');
    }

    return this.toPublicView(await this.findById(connection.id));
  }

  /**
   * Requests a contacts or chat-history sync. Meta accepts each only once per
   * onboarding and only within 24 hours of it, so both limits are enforced
   * here rather than letting Meta reject the call. A failed call is recorded on
   * the connection instead of thrown, so it can be retried.
   */
  async startSync(connectionId: string, kind: SyncKind) {
    const connection = await this.findById(connectionId);

    if (connection.status !== WhatsAppBusinessConnectionStatus.ACTIVE) {
      throw new BadRequestException('This number is no longer connected.');
    }
    if (!connection.isOnBizApp) {
      throw new BadRequestException(
        'Only a number connected from the WhatsApp Business app has contacts and history to sync.',
      );
    }

    const startedAt =
      kind === 'contacts' ? connection.contactsSyncStartedAt : connection.historySyncStartedAt;
    if (startedAt) {
      throw new BadRequestException(
        `The ${kind} sync has already been started - Meta allows it only once.`,
      );
    }
    if (Date.now() - connection.connectedAt.getTime() > SYNC_DEADLINE_MS) {
      throw new BadRequestException(
        'More than 24 hours have passed since this number was connected, so Meta no longer accepts the sync. Disconnect it from the WhatsApp Business app and connect it again.',
      );
    }

    const accessToken = await this.encryption.decrypt(connection.encryptedAccessToken);

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.graphBase}/${connection.phoneNumberId}/smb_app_data`,
          {
            messaging_product: 'whatsapp',
            sync_type: kind === 'contacts' ? 'smb_app_state_sync' : 'history',
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );

      const requestId: string | null = response.data?.request_id ?? null;
      const now = new Date();
      await this.prisma.whatsAppBusinessConnection.update({
        where: { id: connection.id },
        data:
          kind === 'contacts'
            ? { contactsSyncRequestId: requestId, contactsSyncStartedAt: now, lastSyncError: null }
            : { historySyncRequestId: requestId, historySyncStartedAt: now, lastSyncError: null },
      });
    } catch (error) {
      const reason = describeGraphError(error);
      this.logger.error(
        `WhatsApp ${kind} sync request failed for ${connection.phoneNumberId}: ${reason}`,
      );
      await this.prisma.whatsAppBusinessConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: `${kind} sync: ${reason}`.slice(0, 500) },
      });
    }

    return this.toPublicView(await this.findById(connection.id));
  }

  /** Chat history Meta delivers after a history sync, or its notice that the business declined to share it. */
  async handleHistoryWebhook(value: any): Promise<void> {
    const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;

    for (const chunk of value?.history ?? []) {
      if (chunk?.errors?.some((error: any) => error?.code === HISTORY_SHARING_DECLINED)) {
        if (phoneNumberId) {
          await this.prisma.whatsAppBusinessConnection.updateMany({
            where: { phoneNumberId },
            data: { historySyncDeclined: true },
          });
        }
        this.logger.warn(
          'The business declined to share chat history from the WhatsApp Business app.',
        );
        continue;
      }

      const progress = chunk?.metadata?.progress;
      if (phoneNumberId && typeof progress === 'number') {
        // Chunks can arrive out of order, so progress only ever moves forward.
        await this.prisma.whatsAppBusinessConnection.updateMany({
          where: {
            phoneNumberId,
            OR: [{ historySyncProgress: null }, { historySyncProgress: { lt: progress } }],
          },
          data: { historySyncProgress: progress },
        });
      }

      for (const thread of chunk?.threads ?? []) {
        await this.storeMessages(digits(thread?.id), thread?.messages ?? [], 'history');
      }
    }
  }

  /** Messages the business sent from the WhatsApp Business app itself, mirrored so the agent sees the whole conversation. */
  async handleMessageEchoesWebhook(value: any): Promise<void> {
    for (const echo of value?.message_echoes ?? []) {
      await this.storeMessages(digits(echo?.to), [echo], 'business_app_echo');
    }
  }

  /**
   * Contacts from the business's WhatsApp Business app. They belong to the
   * business rather than to any Zoorzio user, so they aren't copied into
   * anyone's address book - only acknowledged, which Meta requires.
   */
  handleStateSyncWebhook(value: any): void {
    const count = value?.state_sync?.length ?? 0;
    this.logger.log(`Received ${count} WhatsApp Business app contact update(s); not stored.`);
  }

  /** The number was disconnected from Zoorzio - by the business in the app, or by Meta. */
  async handleAccountUpdateWebhook(value: any): Promise<void> {
    if (value?.event !== 'PARTNER_REMOVED') return;

    const displayPhoneNumber = digits(value.phone_number);
    if (!displayPhoneNumber) return;

    const reason: string = value.disconnection_info?.reason ?? 'PARTNER_REMOVED';
    const result = await this.prisma.whatsAppBusinessConnection.updateMany({
      where: { status: WhatsAppBusinessConnectionStatus.ACTIVE, displayPhoneNumber },
      data: {
        status: WhatsAppBusinessConnectionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        disconnectReason: reason,
      },
    });

    if (result.count > 0) {
      this.logger.warn(
        `WhatsApp Business number ${displayPhoneNumber} was disconnected (${reason}).`,
      );
    }
  }

  /**
   * Stores messages against the Zoorzio user who linked this WhatsApp number.
   * A conversation with someone who hasn't linked an account has no owner to
   * attach it to, so it isn't kept at all.
   *
   * Original timestamps are preserved: the 24-hour window and the agent's
   * conversation order both depend on when a message was actually sent.
   */
  private async storeMessages(
    customerNumber: string,
    messages: any[],
    source: string,
  ): Promise<number> {
    if (!customerNumber || messages.length === 0) return 0;

    const channel = await this.prisma.channel.findFirst({
      where: { type: 'WHATSAPP', externalId: customerNumber },
    });
    if (!channel) return 0;

    const rows: Prisma.ChannelMessageCreateManyInput[] = messages
      .filter((message) => message?.id)
      .map((message) => ({
        channelId: channel.id,
        externalId: message.id,
        content: messageText(message),
        type: messageType(message.type),
        direction:
          digits(message.from) === customerNumber
            ? MessageDirection.INBOUND
            : MessageDirection.OUTBOUND,
        metadata: {
          source,
          whatsappMessageId: message.id,
          ...(message.history_context?.status ? { status: message.history_context.status } : {}),
        },
        createdAt: fromUnixSeconds(message.timestamp),
      }));

    if (rows.length === 0) return 0;

    // History chunks overlap and echoes can be redelivered; the unique
    // [channelId, externalId] constraint makes a repeat a no-op.
    const result = await this.prisma.channelMessage.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  }

  private async exchangeCode(appId: string, appSecret: string, code: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.graphBase}/oauth/access_token`, {
          params: { client_id: appId, client_secret: appSecret, code },
        }),
      );
      const accessToken = response.data?.access_token;
      if (!accessToken) throw new Error('Meta returned no access token');
      return accessToken;
    } catch (error) {
      this.logger.error(`WhatsApp signup code exchange failed: ${describeGraphError(error)}`);
      throw new BadRequestException(
        'Meta did not accept the signup code. It expires about 30 seconds after signup, so please connect again.',
      );
    }
  }

  private async subscribeToWebhooks(wabaId: string, accessToken: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.graphBase}/${wabaId}/subscribed_apps`,
          {},
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      if (response.data?.success !== true) throw new Error('Meta did not confirm the subscription');
    } catch (error) {
      const reason = describeGraphError(error);
      this.logger.error(`Subscribing to WABA ${wabaId} webhooks failed: ${reason}`);
      throw new BadRequestException(
        `Could not subscribe Zoorzio to this account's webhooks: ${reason}`,
      );
    }
  }

  private async getPhoneNumberStatus(phoneNumberId: string, accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.graphBase}/${phoneNumberId}`, {
          params: { fields: 'is_on_biz_app,platform_type,display_phone_number' },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return {
        isOnBizApp: response.data?.is_on_biz_app === true,
        platformType: (response.data?.platform_type as string | undefined) ?? null,
        displayPhoneNumber: digits(response.data?.display_phone_number) || null,
      };
    } catch (error) {
      const reason = describeGraphError(error);
      this.logger.error(`Reading phone number ${phoneNumberId} failed: ${reason}`);
      throw new BadRequestException(
        `Could not read the connected phone number from Meta: ${reason}`,
      );
    }
  }

  private async findById(id: string): Promise<WhatsAppBusinessConnection> {
    const connection = await this.prisma.whatsAppBusinessConnection.findUnique({ where: { id } });
    if (!connection) throw new NotFoundException('Connection not found');
    return connection;
  }

  /** Everything the admin page needs - never the token. */
  private toPublicView(connection: WhatsAppBusinessConnection) {
    return {
      id: connection.id,
      phoneNumberId: connection.phoneNumberId,
      wabaId: connection.wabaId,
      displayPhoneNumber: connection.displayPhoneNumber,
      isOnBizApp: connection.isOnBizApp,
      platformType: connection.platformType,
      status: connection.status,
      connectedAt: connection.connectedAt,
      disconnectedAt: connection.disconnectedAt,
      disconnectReason: connection.disconnectReason,
      syncDeadline: new Date(connection.connectedAt.getTime() + SYNC_DEADLINE_MS),
      contactsSync: {
        requestId: connection.contactsSyncRequestId,
        startedAt: connection.contactsSyncStartedAt,
      },
      historySync: {
        requestId: connection.historySyncRequestId,
        startedAt: connection.historySyncStartedAt,
        progress: connection.historySyncProgress,
        declined: connection.historySyncDeclined,
      },
      lastSyncError: connection.lastSyncError,
    };
  }
}

function digits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function fromUnixSeconds(timestamp: unknown): Date {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

function messageText(message: any): string {
  if (message.type === 'text') return message.text?.body ?? '';
  const caption = message.type ? message[message.type]?.caption : undefined;
  return caption || `[${message.type ?? 'unknown'} message]`;
}

function messageType(type: unknown): MessageType {
  const map: Record<string, MessageType> = {
    text: MessageType.TEXT,
    image: MessageType.IMAGE,
    audio: MessageType.VOICE,
    video: MessageType.VIDEO,
    document: MessageType.DOCUMENT,
    location: MessageType.LOCATION,
  };
  return (typeof type === 'string' && map[type]) || MessageType.TEXT;
}

/** Meta's own error message where there is one. Never includes the request, which carries the app secret. */
function describeGraphError(error: unknown): string {
  const axiosError = error as AxiosError<any>;
  return axiosError?.response?.data?.error?.message ?? axiosError?.message ?? 'unknown error';
}
