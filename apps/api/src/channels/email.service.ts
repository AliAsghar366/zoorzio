import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ChannelType } from '@anchor/database';

export interface SendEmailOptions {
  /**
   * Send using the user's own SendGrid key and verified sender, when they
   * have connected one. Off by default *on purpose*: system mail (password
   * resets, briefings) must always go out on the platform's own key, since
   * most users have no key of their own and a failed reset email locks
   * someone out of their account. Only user-initiated sends opt in.
   */
  preferUserCredential?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private readonly http: HttpService,
    private readonly channelCredentials: ChannelCredentialsService,
  ) {}

  async handleInboundEmail(emailData: any) {
    try {
      const { from, to, subject, text, html, attachments } = emailData;

      const channel = await this.findOrCreateChannel(from);

      let content = '';
      if (subject && text) {
        content = `Subject: ${subject}\n\n${text}`;
      } else if (subject) {
        content = subject;
      } else if (text) {
        content = text;
      }

      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: `email_${Date.now()}`,
          content,
          type: 'TEXT',
          direction: 'INBOUND',
          metadata: {
            from,
            to,
            subject,
            hasAttachments: attachments?.length > 0,
          },
        },
      });

      const memory = await this.memoryService.create(channel.userId, {
        content,
        type: 'EMAIL',
        source: 'EMAIL',
        metadata: {
          from,
          to,
          subject,
          receivedAt: new Date().toISOString(),
        },
        tags: ['email'],
      });

      if (attachments?.length > 0) {
        await this.recordAttachments(memory.id, attachments);
      }

      this.logger.log(`Processed email from ${from}`);
      return memory;
    } catch (error) {
      this.logger.error('Failed to process email', error);
      throw error;
    }
  }

  private async recordAttachments(memoryId: string, attachments: any[]) {
    try {
      const memory = await this.prisma.memory.findUnique({ where: { id: memoryId } });
      const existingMetadata = (memory?.metadata as Record<string, unknown>) || {};

      await this.prisma.memory.update({
        where: { id: memoryId },
        data: {
          metadata: {
            ...existingMetadata,
            attachments: attachments.map((attachment) => ({
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
            })),
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to record attachments', error);
    }
  }

  async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    options: SendEmailOptions = {},
  ) {
    let apiKey = this.configService.get('SENDGRID_API_KEY');
    let fromEmail = this.configService.get('EMAIL_FROM_ADDRESS', 'noreply@anchor.app');

    if (options.preferUserCredential) {
      const ownCredential = await this.channelCredentials.getDecryptedToken(
        userId,
        ChannelType.EMAIL,
      );
      if (ownCredential) {
        apiKey = ownCredential.token;
        // SendGrid rejects a "from" it hasn't verified, so only override the
        // sender when the user actually gave us their verified one.
        const ownFrom = (ownCredential.metadata as any)?.fromEmail;
        if (ownFrom) fromEmail = ownFrom;
      }
    }

    let messageId = `local_${Date.now()}`;
    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://api.sendgrid.com/v3/mail/send',
          {
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail },
            subject,
            content: [{ type: 'text/plain', value: body }],
          },
          { headers: { Authorization: `Bearer ${apiKey}` } },
        ),
      );
      messageId = response.headers?.['x-message-id'] ?? messageId;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to send email: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
      );
      throw error;
    }

    const channel = await this.prisma.channel.findFirst({
      where: { userId, type: 'EMAIL' },
    });

    if (channel) {
      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: messageId,
          content: `Subject: ${subject}\n\n${body}`,
          type: 'TEXT',
          direction: 'OUTBOUND',
          metadata: { to, subject },
        },
      });
    }

    return { success: true, messageId };
  }

  private async findOrCreateChannel(emailAddress: string) {
    let channel = await this.prisma.channel.findFirst({
      where: {
        type: 'EMAIL',
        externalId: emailAddress,
      },
    });

    if (!channel) {
      let user = await this.prisma.user.findFirst({
        where: { email: emailAddress },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: emailAddress,
            passwordHash: 'email_auth', // Placeholder
          },
        });
      }

      channel = await this.prisma.channel.create({
        data: {
          userId: user.id,
          type: 'EMAIL',
          externalId: emailAddress,
          name: emailAddress,
        },
      });
    }

    return channel;
  }
}
