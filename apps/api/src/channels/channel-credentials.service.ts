import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { ChannelType, ChannelCredentialStatus, Prisma } from '@anchor/database';
import { SaveChannelCredentialDto } from './dto/save-channel-credential.dto';

// Platforms whose inbound delivery is a webhook we register per user - these
// get a random, non-guessable routing key embedded in their webhook URL.
// Discord has no webhook (persistent gateway connection instead) and
// WhatsApp/Email route by a platform-supplied identifier instead, so neither
// needs one.
const WEBHOOK_ROUTED_TYPES = new Set<ChannelType>([ChannelType.TELEGRAM, ChannelType.SLACK]);

export interface ResolvedCredential {
  userId: string;
  token: string;
  secondaryToken: string | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class ChannelCredentialsService {
  private readonly logger = new Logger(ChannelCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The public webhook URL for a platform the user must configure by hand
   * (Slack). Telegram registers its own webhook via setWebhook, so it never
   * needs to surface one. The routing key is not a secret - knowing it lets
   * someone deliver a payload, but every such payload is still signature-
   * verified against the owner's signing secret before anything is processed.
   */
  private webhookUrlFor(type: ChannelType, routingKey: string | null): string | null {
    if (!routingKey || type !== ChannelType.SLACK) return null;
    // Better to surface nothing than a relative URL the user would paste into
    // Slack and then wonder why no events ever arrive.
    const base = this.config.get<string>('API_URL');
    if (!base) return null;
    return `${base}/channels/slack/events/${routingKey}`;
  }

  private generateRoutingKey(): string {
    return randomBytes(24).toString('hex');
  }

  async saveCredential(userId: string, type: ChannelType, dto: SaveChannelCredentialDto) {
    const encryptedToken = await this.encryption.encrypt(dto.token);
    const encryptedSecondaryToken = dto.secondaryToken
      ? await this.encryption.encrypt(dto.secondaryToken)
      : null;

    const metadata: Prisma.InputJsonValue = {
      ...(dto.fromEmail ? { fromEmail: dto.fromEmail } : {}),
      ...(dto.phoneNumberId ? { phoneNumberId: dto.phoneNumberId } : {}),
    };

    const existing = await this.prisma.channelCredential.findUnique({
      where: { userId_type: { userId, type } },
    });
    const webhookRoutingKey = WEBHOOK_ROUTED_TYPES.has(type)
      ? (existing?.webhookRoutingKey ?? this.generateRoutingKey())
      : null;

    const record = await this.prisma.channelCredential.upsert({
      where: { userId_type: { userId, type } },
      update: {
        encryptedToken,
        encryptedSecondaryToken,
        metadata,
        status: ChannelCredentialStatus.PENDING,
        lastError: null,
      },
      create: {
        userId,
        type,
        encryptedToken,
        encryptedSecondaryToken,
        webhookRoutingKey,
        metadata,
        status: ChannelCredentialStatus.PENDING,
      },
    });

    this.logger.log(`Saved ${type} credential for user ${userId}`);
    return this.toPublicView(record);
  }

  async list(userId: string) {
    const records = await this.prisma.channelCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toPublicView(r));
  }

  /** The non-secret view of one credential, or null if the user has none for that platform. */
  async getPublicCredential(userId: string, type: ChannelType) {
    const record = await this.prisma.channelCredential.findUnique({
      where: { userId_type: { userId, type } },
    });
    return record ? this.toPublicView(record) : null;
  }

  /** Returns the decrypted token for a user's own credential, or null if they haven't saved one. */
  async getDecryptedToken(userId: string, type: ChannelType): Promise<ResolvedCredential | null> {
    const record = await this.prisma.channelCredential.findUnique({
      where: { userId_type: { userId, type } },
    });
    if (
      !record ||
      record.status === ChannelCredentialStatus.INVALID ||
      record.status === ChannelCredentialStatus.DISCONNECTED
    ) {
      return null;
    }

    return {
      userId: record.userId,
      token: await this.encryption.decrypt(record.encryptedToken),
      secondaryToken: record.encryptedSecondaryToken
        ? await this.encryption.decrypt(record.encryptedSecondaryToken)
        : null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
    };
  }

  /** Resolves which user's credential an inbound webhook belongs to, using the opaque routing key embedded in its URL. */
  async getByRoutingKey(routingKey: string): Promise<ResolvedCredential | null> {
    const record = await this.prisma.channelCredential.findUnique({
      where: { webhookRoutingKey: routingKey },
    });
    if (!record) return null;

    return {
      userId: record.userId,
      token: await this.encryption.decrypt(record.encryptedToken),
      secondaryToken: record.encryptedSecondaryToken
        ? await this.encryption.decrypt(record.encryptedSecondaryToken)
        : null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Resolves a WhatsApp credential from the phone_number_id Meta puts in the
   * webhook payload. WhatsApp needs no synthetic routing key: the recipient
   * phone number id already identifies whose Business account was messaged,
   * and it's scoped to a single owner by the unique [userId, type] pair.
   */
  async getByWhatsAppPhoneNumberId(phoneNumberId: string): Promise<ResolvedCredential | null> {
    if (!phoneNumberId) return null;

    const record = await this.prisma.channelCredential.findFirst({
      where: {
        type: ChannelType.WHATSAPP,
        status: { notIn: [ChannelCredentialStatus.INVALID, ChannelCredentialStatus.DISCONNECTED] },
        metadata: { path: ['phoneNumberId'], equals: phoneNumberId },
      },
    });
    if (!record) return null;

    return {
      userId: record.userId,
      token: await this.encryption.decrypt(record.encryptedToken),
      secondaryToken: record.encryptedSecondaryToken
        ? await this.encryption.decrypt(record.encryptedSecondaryToken)
        : null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
    };
  }

  async markStatus(
    userId: string,
    type: ChannelType,
    status: ChannelCredentialStatus,
    error?: string,
  ) {
    await this.prisma.channelCredential.updateMany({
      where: { userId, type },
      data: {
        status,
        lastError: error ?? null,
        lastVerifiedAt: status === ChannelCredentialStatus.ACTIVE ? new Date() : undefined,
      },
    });
  }

  async testCredential(userId: string, type: ChannelType) {
    const resolved = await this.getDecryptedToken(userId, type);
    if (!resolved) throw new NotFoundException('No credential saved for this platform');

    try {
      await this.callVerificationEndpoint(type, resolved);
      await this.markStatus(userId, type, ChannelCredentialStatus.ACTIVE);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      await this.markStatus(userId, type, ChannelCredentialStatus.INVALID, message);
      return { success: false, error: message };
    }
  }

  private async callVerificationEndpoint(type: ChannelType, credential: ResolvedCredential) {
    switch (type) {
      case ChannelType.TELEGRAM:
        await firstValueFrom(
          this.http.get(`https://api.telegram.org/bot${credential.token}/getMe`),
        );
        return;
      case ChannelType.SLACK:
        await firstValueFrom(
          this.http.post(
            'https://slack.com/api/auth.test',
            {},
            { headers: { Authorization: `Bearer ${credential.token}` } },
          ),
        );
        return;
      case ChannelType.EMAIL:
        await firstValueFrom(
          this.http.get('https://api.sendgrid.com/v3/user/account', {
            headers: { Authorization: `Bearer ${credential.token}` },
          }),
        );
        return;
      case ChannelType.WHATSAPP: {
        const phoneNumberId = (credential.metadata as any)?.phoneNumberId;
        await firstValueFrom(
          this.http.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
            headers: { Authorization: `Bearer ${credential.token}` },
          }),
        );
        return;
      }
      case ChannelType.DISCORD:
        await firstValueFrom(
          this.http.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${credential.token}` },
          }),
        );
        return;
      default:
        throw new ForbiddenException(`Unsupported credential type: ${type}`);
    }
  }

  async removeCredential(userId: string, type: ChannelType) {
    const record = await this.prisma.channelCredential.findUnique({
      where: { userId_type: { userId, type } },
    });
    if (!record) throw new NotFoundException('No credential saved for this platform');

    await this.prisma.channelCredential.delete({ where: { id: record.id } });
    this.logger.log(`Removed ${type} credential for user ${userId}`);
    return { success: true };
  }

  private toPublicView(record: {
    type: ChannelType;
    status: ChannelCredentialStatus;
    metadata: unknown;
    webhookRoutingKey?: string | null;
    lastVerifiedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
  }) {
    return {
      type: record.type,
      status: record.status,
      metadata: record.metadata,
      webhookUrl: this.webhookUrlFor(record.type, record.webhookRoutingKey ?? null),
      lastVerifiedAt: record.lastVerifiedAt,
      lastError: record.lastError,
      createdAt: record.createdAt,
    };
  }
}
