import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelCredentialsService } from './channel-credentials.service';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: any;
  let memoryService: any;
  let http: any;
  let channelCredentials: any;

  beforeEach(async () => {
    channelCredentials = { getDecryptedToken: jest.fn().mockResolvedValue(null) };

    prisma = {
      channel: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      channelMessage: {
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      memory: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    memoryService = {
      create: jest.fn(),
    };

    http = {
      post: jest.fn().mockReturnValue(of({ headers: { 'x-message-id': 'sg-123' } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              if (key === 'SENDGRID_API_KEY') return 'test-key';
              return fallback;
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: MemoryService, useValue: memoryService },
        { provide: ChannelCredentialsService, useValue: channelCredentials },
        { provide: HttpService, useValue: http },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleInboundEmail', () => {
    it('should handle incoming email', async () => {
      const emailData = {
        from: 'sender@example.com',
        to: 'recipient@anchor.app',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        attachments: [],
      };

      prisma.channel.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user123' });
      prisma.channel.create.mockResolvedValue({ id: 'channel123', userId: 'user123' });
      prisma.channelMessage.create.mockResolvedValue({});
      memoryService.create.mockResolvedValue({ id: 'mem123' });

      const result = await service.handleInboundEmail(emailData);

      expect(result).toHaveProperty('id', 'mem123');
    });
  });

  describe('sendEmail', () => {
    it('should send email via SendGrid', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
      prisma.channelMessage.create.mockResolvedValue({});

      const result = await service.sendEmail(
        'user123',
        'recipient@example.com',
        'Test Subject',
        'Test Body',
      );

      expect(result).toEqual({ success: true, messageId: 'sg-123' });
      expect(http.post).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({ subject: 'Test Subject' }),
        expect.any(Object),
      );
    });

    // System mail (password resets, briefings) must never go out on a user's
    // personal key - most users have none, and a failed reset email would lock
    // someone out of their own account.
    it('uses the platform key by default, even when the user has their own', async () => {
      channelCredentials.getDecryptedToken.mockResolvedValue({
        userId: 'user123',
        token: 'user-own-sendgrid-key',
        secondaryToken: null,
        metadata: { fromEmail: 'me@mydomain.com' },
      });

      await service.sendEmail('user123', 'recipient@example.com', 'Reset your password', 'link');

      expect(channelCredentials.getDecryptedToken).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ from: { email: 'noreply@anchor.app' } }),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-key' } }),
      );
    });

    it("uses the user's own key and verified sender when the send opts in", async () => {
      channelCredentials.getDecryptedToken.mockResolvedValue({
        userId: 'user123',
        token: 'user-own-sendgrid-key',
        secondaryToken: null,
        metadata: { fromEmail: 'me@mydomain.com' },
      });

      await service.sendEmail('user123', 'recipient@example.com', 'Hi', 'Body', {
        preferUserCredential: true,
      });

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ from: { email: 'me@mydomain.com' } }),
        expect.objectContaining({ headers: { Authorization: 'Bearer user-own-sendgrid-key' } }),
      );
    });

    it('falls back to the platform key when the user opted in but has no key of their own', async () => {
      channelCredentials.getDecryptedToken.mockResolvedValue(null);

      await service.sendEmail('user123', 'recipient@example.com', 'Hi', 'Body', {
        preferUserCredential: true,
      });

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ from: { email: 'noreply@anchor.app' } }),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-key' } }),
      );
    });

    it("keeps the platform sender when the user's key has no verified sender recorded", async () => {
      channelCredentials.getDecryptedToken.mockResolvedValue({
        userId: 'user123',
        token: 'user-own-sendgrid-key',
        secondaryToken: null,
        metadata: {},
      });

      await service.sendEmail('user123', 'recipient@example.com', 'Hi', 'Body', {
        preferUserCredential: true,
      });

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ from: { email: 'noreply@anchor.app' } }),
        expect.objectContaining({ headers: { Authorization: 'Bearer user-own-sendgrid-key' } }),
      );
    });
  });
});
