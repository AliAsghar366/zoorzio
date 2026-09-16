import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { SmsService } from './sms.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';

describe('SmsService', () => {
  let service: SmsService;
  let prisma: any;
  let memoryService: any;
  let http: any;
  let channelLinking: any;

  beforeEach(async () => {
    prisma = {
      channel: { findFirst: jest.fn() },
      channelMessage: { create: jest.fn() },
    };
    memoryService = { create: jest.fn() };
    channelLinking = { consumeSmsLinkCode: jest.fn() };
    http = {
      post: jest.fn().mockReturnValue(of({ data: { sid: 'SM123' } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                TWILIO_ACCOUNT_SID: 'AC-test',
                TWILIO_AUTH_TOKEN: 'test-token',
                TWILIO_PHONE_NUMBER: '+15550000000',
              };
              return values[key];
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: MemoryService, useValue: memoryService },
        { provide: HttpService, useValue: http },
        { provide: ChannelLinkingService, useValue: channelLinking },
      ],
    }).compile();

    service = module.get(SmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('reports initialized when Twilio credentials are set', async () => {
      expect(await service.initialize()).toEqual({ status: 'initialized' });
    });
  });

  describe('handleWebhook', () => {
    it('processes a text from an already-linked number', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'user123' });

      await service.handleWebhook({ From: '+15551234567', Body: 'Hello', MessageSid: 'SM1' });

      expect(memoryService.create).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ content: 'Hello' }),
      );
    });

    it('ignores a text from an unlinked number and replies with guidance', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleWebhook({ From: '+15551234567', Body: 'Hello', MessageSid: 'SM1' });

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/Messages.json'),
        expect.stringContaining('To=%2B15551234567'),
        expect.any(Object),
      );
    });

    it('consumes a LINK code without creating a memory', async () => {
      channelLinking.consumeSmsLinkCode.mockResolvedValue('user123');

      await service.handleWebhook({ From: '+15551234567', Body: 'LINK AB12CD', MessageSid: 'SM1' });

      expect(channelLinking.consumeSmsLinkCode).toHaveBeenCalledWith('AB12CD', '+15551234567');
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('replies with an error for an invalid LINK code', async () => {
      channelLinking.consumeSmsLinkCode.mockResolvedValue(null);

      await service.handleWebhook({ From: '+15551234567', Body: 'LINK ZZ99ZZ', MessageSid: 'SM1' });

      const [, sentBody] = http.post.mock.calls[0];
      expect(decodeURIComponent(sentBody.replace(/\+/g, ' '))).toContain('invalid or expired');
    });
  });

  describe('sendMessage', () => {
    it('sends via the Twilio REST API and records the outbound message', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'user123' });

      const result = await service.sendMessage('user123', '+15551234567', 'Hi there');

      expect(result).toEqual({ success: true, messageId: 'SM123' });
      expect(http.post).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC-test/Messages.json',
        expect.stringContaining('Body=Hi+there'),
        expect.objectContaining({ auth: { username: 'AC-test', password: 'test-token' } }),
      );
      expect(prisma.channelMessage.create).toHaveBeenCalled();
    });
  });
});
