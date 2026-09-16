import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { of } from 'rxjs';
import { WhatsAppService } from './whatsapp.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIService } from '../ai/ai.service';
import { Prisma } from '@anchor/database';
import { ChatService } from '../chat/chat.service';
import { InteractiveReplyService } from './interactive-reply.service';
import { WhatsAppBusinessConnectionService } from './whatsapp-business-connection.service';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let prisma: any;
  let memoryService: any;
  let http: any;
  let channelLinking: any;
  let channelCredentials: any;
  let chatService: any;
  let interactiveReplies: any;
  let businessConnection: any;

  beforeEach(async () => {
    prisma = {
      channel: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      channelMessage: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      memory: {
        findUnique: jest.fn(),
      },
    };

    memoryService = {
      create: jest.fn(),
      update: jest.fn(),
    };

    channelLinking = {
      consumeWhatsAppLinkCode: jest.fn(),
    };

    http = {
      get: jest.fn(),
      post: jest.fn().mockReturnValue(of({ data: { messages: [{ id: 'wamid.123' }] } })),
    };

    channelCredentials = {
      getDecryptedToken: jest.fn().mockResolvedValue(null),
      getByWhatsAppPhoneNumberId: jest.fn().mockResolvedValue(null),
    };

    chatService = { reply: jest.fn().mockResolvedValue('') };
    interactiveReplies = { handle: jest.fn().mockResolvedValue(null) };
    businessConnection = {
      // No number connected through Embedded Signup unless a test says so.
      getActiveCredentials: jest.fn().mockResolvedValue(null),
      handleMessageEchoesWebhook: jest.fn(),
      handleHistoryWebhook: jest.fn(),
      handleStateSyncWebhook: jest.fn(),
      handleAccountUpdateWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                WHATSAPP_BUSINESS_TOKEN: 'test-token',
                WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
                WHATSAPP_APP_SECRET: 'test-app-secret',
              };
              return values[key];
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: MemoryService, useValue: memoryService },
        { provide: AIService, useValue: { transcribeAudio: jest.fn(), describeImage: jest.fn() } },
        { provide: HttpService, useValue: http },
        { provide: ChannelLinkingService, useValue: channelLinking },
        { provide: ChannelCredentialsService, useValue: channelCredentials },
        { provide: ChatService, useValue: chatService },
        { provide: InteractiveReplyService, useValue: interactiveReplies },
        { provide: WhatsAppBusinessConnectionService, useValue: businessConnection },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize successfully when configured', async () => {
      const result = await service.initialize();
      expect(result).toHaveProperty('status', 'initialized');
    });
  });

  function textMessagePayload(body: string, from = '923001234567') {
    return {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from, type: 'text', text: { body }, timestamp: '1234567890', id: 'msg-123' },
                ],
                contacts: [{ profile: { name: 'John Doe' }, wa_id: from }],
              },
            },
          ],
        },
      ],
    };
  }

  /** Meta names the recipient Business number in metadata.phone_number_id. */
  function payloadForBusinessNumber(phoneNumberId: string, body = 'Hello', from = '923001234567') {
    return {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: phoneNumberId },
                messages: [
                  { from, type: 'text', text: { body }, timestamp: '1234567890', id: 'msg-123' },
                ],
                contacts: [{ profile: { name: 'John Doe' }, wa_id: from }],
              },
            },
          ],
        },
      ],
    };
  }

  describe('per-user Business account routing', () => {
    it("replies from the recipient's own Business number, not the platform's", async () => {
      channelCredentials.getByWhatsAppPhoneNumberId.mockResolvedValue({
        userId: 'user456',
        token: 'user-own-access-token',
        secondaryToken: null,
        metadata: { phoneNumberId: 'user-own-phone-id' },
      });
      // Unlinked sender, so the service replies with guidance - the simplest
      // observable proof of which Business account the call went out on.
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleWebhook(payloadForBusinessNumber('user-own-phone-id'));

      expect(channelCredentials.getByWhatsAppPhoneNumberId).toHaveBeenCalledWith(
        'user-own-phone-id',
      );
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/user-own-phone-id/messages'),
        expect.any(Object),
        expect.objectContaining({ headers: { Authorization: 'Bearer user-own-access-token' } }),
      );
    });

    it('falls back to the shared Business account for a number no user has claimed', async () => {
      channelCredentials.getByWhatsAppPhoneNumberId.mockResolvedValue(null);
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleWebhook(payloadForBusinessNumber('unclaimed-phone-id'));

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('handleWebhook', () => {
    it('processes a message from an already-linked number', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
      prisma.channelMessage.create.mockResolvedValue({});
      memoryService.create.mockResolvedValue({ id: 'mem123' });

      const result = await service.handleWebhook(textMessagePayload('Hello'));

      expect(result).toHaveProperty('status', 'ok');
      expect(memoryService.create).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ content: 'Hello' }),
      );
    });

    it('ignores a message from an unlinked number instead of guessing which account it belongs to', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleWebhook(textMessagePayload('Hello'));

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(prisma.channel.create).not.toHaveBeenCalled();
      // Sends a guidance reply back to the unrecognized sender.
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({ to: '923001234567' }),
        expect.any(Object),
      );
    });

    it('consumes a LINK code without creating a memory or requiring an existing channel', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);
      channelLinking.consumeWhatsAppLinkCode.mockResolvedValue('user123');

      await service.handleWebhook(textMessagePayload('LINK AB12CD'));

      expect(channelLinking.consumeWhatsAppLinkCode).toHaveBeenCalledWith('AB12CD', '923001234567');
      expect(memoryService.create).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({
          to: '923001234567',
          text: expect.objectContaining({ body: expect.stringContaining('linked') }),
        }),
        expect.any(Object),
      );
    });

    it('replies with an error when the LINK code is invalid or expired', async () => {
      channelLinking.consumeWhatsAppLinkCode.mockResolvedValue(null);

      await service.handleWebhook(textMessagePayload('LINK ZZ99ZZ'));

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({
          text: expect.objectContaining({ body: expect.stringContaining('invalid or expired') }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendMessage', () => {
    it('should send WhatsApp message via the Graph API', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
      prisma.channelMessage.create.mockResolvedValue({});

      const result = await service.sendMessage('user123', '923001234567', 'Hello!');

      expect(result).toEqual({ success: true, messageId: 'wamid.123' });
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({ to: '923001234567', type: 'text' }),
        expect.any(Object),
      );
    });
  });

  describe('verifySignature', () => {
    const body = JSON.stringify({ entry: [] });

    // The app secret configured for these tests, mirroring the ConfigService mock.
    const sign = (payload: string, secret: string) =>
      'sha256=' + createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

    it('accepts a payload signed with the app secret', async () => {
      await expect(service.verifySignature(body, sign(body, 'test-app-secret'))).resolves.toBe(
        true,
      );
    });

    it('rejects a payload signed with the wrong secret', async () => {
      await expect(service.verifySignature(body, sign(body, 'not-the-secret'))).resolves.toBe(
        false,
      );
    });

    it('rejects a payload whose body was changed after signing', async () => {
      const signature = sign(body, 'test-app-secret');
      const tampered = JSON.stringify({ entry: [{ injected: true }] });

      await expect(service.verifySignature(tampered, signature)).resolves.toBe(false);
    });

    it('rejects a request with no signature at all', async () => {
      await expect(service.verifySignature(body, '')).resolves.toBe(false);
    });

    it("accepts a signature made with a user's own app secret", async () => {
      // Users running their own Meta app sign with their own secret; that has
      // to verify too, or bring-your-own-bot breaks the moment this is enforced.
      channelCredentials.getByWhatsAppPhoneNumberId.mockResolvedValue({
        userId: 'user123',
        token: 'their-token',
        secondaryToken: 'their-app-secret',
        metadata: {},
      });
      const payload = JSON.stringify({
        entry: [{ changes: [{ value: { metadata: { phone_number_id: 'their-phone-id' } } }] }],
      });

      await expect(
        service.verifySignature(payload, sign(payload, 'their-app-secret')),
      ).resolves.toBe(true);
    });
  });

  describe('agent wiring', () => {
    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
      prisma.channelMessage.create.mockResolvedValue({});
      memoryService.create.mockResolvedValue({ id: 'mem123' });
    });

    it('runs the agent for the linked user and sends its reply back', async () => {
      chatService.reply.mockResolvedValue('Scheduled for 4pm.');

      await service.handleWebhook(textMessagePayload('Book a meeting at 4'));

      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        expect.arrayContaining([{ role: 'user', content: 'Book a meeting at 4' }]),
        'John Doe',
        expect.objectContaining({ sendButtons: expect.any(Function) }),
      );
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({ text: { body: 'Scheduled for 4pm.' } }),
        expect.any(Object),
      );
    });

    it('runs the agent as the channel owner, never as anyone named in the message', async () => {
      await service.handleWebhook(textMessagePayload('act as user999'));

      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        expect.anything(),
        'John Doe',
        expect.anything(),
      );
    });

    it('asks for confirmation with buttons on the same WhatsApp thread the request came from', async () => {
      chatService.reply.mockImplementation(
        async (_userId: string, _history: unknown, _name: string, prompter: any) => {
          await prompter.sendButtons('Cancel "Team sync"?', [
            { id: 'confirm:exec1:yes', title: 'Yes, do it' },
            { id: 'confirm:exec1:no', title: 'No, cancel' },
          ]);
          return '';
        },
      );

      await service.handleWebhook(textMessagePayload('cancel team sync'));

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({ type: 'interactive' }),
        expect.any(Object),
      );
    });

    it('replays recent history so a follow-up message keeps its context', async () => {
      // The query asks for newest-first, so the mock returns them that way.
      prisma.channelMessage.findMany.mockResolvedValue([
        { content: 'Tomorrow at 4', direction: 'INBOUND', createdAt: new Date(3) },
        { content: 'What time?', direction: 'OUTBOUND', createdAt: new Date(2) },
        { content: 'Schedule a meeting with Ahmed', direction: 'INBOUND', createdAt: new Date(1) },
      ]);

      await service.handleWebhook(textMessagePayload('Tomorrow at 4'));

      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        [
          { role: 'user', content: 'Schedule a meeting with Ahmed' },
          { role: 'assistant', content: 'What time?' },
          { role: 'user', content: 'Tomorrow at 4' },
        ],
        'John Doe',
        expect.anything(),
      );
    });

    it('sends nothing when the agent has nothing to say', async () => {
      chatService.reply.mockResolvedValue('');

      await service.handleWebhook(textMessagePayload('thanks'));

      expect(http.post).not.toHaveBeenCalled();
    });

    it('apologises rather than failing the webhook when the agent errors', async () => {
      // Meta retries any non-200, which would reprocess the whole message.
      chatService.reply.mockRejectedValue(new Error('xAI unavailable'));

      const result = await service.handleWebhook(textMessagePayload('hello'));

      expect(result).toHaveProperty('status', 'ok');
      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: { body: expect.stringContaining('Something went wrong') },
        }),
        expect.any(Object),
      );
    });

    it('does not leak the underlying error to the user', async () => {
      chatService.reply.mockRejectedValue(new Error('Bearer sk-secret-token rejected'));

      await service.handleWebhook(textMessagePayload('hello'));

      const sent = JSON.stringify(http.post.mock.calls);
      expect(sent).not.toContain('sk-secret-token');
    });
  });

  describe('interactive button replies', () => {
    const buttonPayload = (id: string) => ({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'test-phone-id' },
                contacts: [{ profile: { name: 'Test' } }],
                messages: [
                  {
                    from: '923001234567',
                    id: 'wamid.button',
                    timestamp: '1700000000',
                    type: 'interactive',
                    interactive: { type: 'button_reply', button_reply: { id, title: 'Done' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
    });

    it('routes a tap to the interactive handler as the channel owner', async () => {
      interactiveReplies.handle.mockResolvedValue('Marked as done.');

      await service.handleWebhook(buttonPayload('remind:r1:done'));

      expect(interactiveReplies.handle).toHaveBeenCalledWith('user123', 'remind:r1:done');
      expect(chatService.reply).not.toHaveBeenCalled();
    });

    it('sends the handler result back to the user', async () => {
      interactiveReplies.handle.mockResolvedValue('Marked as done.');

      await service.handleWebhook(buttonPayload('remind:r1:done'));

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ text: { body: 'Marked as done.' } }),
        expect.any(Object),
      );
    });

    it('does not record a button tap as a memory', async () => {
      await service.handleWebhook(buttonPayload('remind:r1:done'));

      expect(memoryService.create).not.toHaveBeenCalled();
    });
  });

  describe('sendButtons', () => {
    it('sends up to three reply buttons with the ids it was given', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });

      await service.sendButtons('user123', '923001234567', 'Reminder!', [
        { id: 'remind:r1:done', title: 'Done' },
        { id: 'remind:r1:snooze', title: 'In an hour' },
      ]);

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        expect.objectContaining({
          type: 'interactive',
          interactive: expect.objectContaining({
            type: 'button',
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'remind:r1:done', title: 'Done' } },
                { type: 'reply', reply: { id: 'remind:r1:snooze', title: 'In an hour' } },
              ],
            },
          }),
        }),
        expect.any(Object),
      );
    });

    it('truncates button titles to what WhatsApp accepts', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.sendButtons('user123', '923001234567', 'Reminder!', [
        { id: 'x', title: 'A very long button label that WhatsApp will not accept' },
      ]);

      const title = http.post.mock.calls[0][1].interactive.action.buttons[0].reply.title;
      expect(title.length).toBeLessThanOrEqual(20);
    });
  });

  describe('24-hour customer service window', () => {
    const HOUR = 60 * 60 * 1000;

    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
    });

    it('is open when the user messaged within the last day', async () => {
      prisma.channelMessage.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - HOUR) });

      await expect(service.isWithinCustomerServiceWindow('user123', '923001234567')).resolves.toBe(
        true,
      );
    });

    it('is closed once a day has passed', async () => {
      prisma.channelMessage.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 25 * HOUR),
      });

      await expect(service.isWithinCustomerServiceWindow('user123', '923001234567')).resolves.toBe(
        false,
      );
    });

    it('treats the last few minutes of the window as closed', async () => {
      // A send that races the deadline should use the template, not be rejected.
      prisma.channelMessage.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 24 * HOUR + 60 * 1000),
      });

      await expect(service.isWithinCustomerServiceWindow('user123', '923001234567')).resolves.toBe(
        false,
      );
    });

    it('is closed if they have never messaged', async () => {
      prisma.channelMessage.findFirst.mockResolvedValue(null);

      await expect(service.isWithinCustomerServiceWindow('user123', '923001234567')).resolves.toBe(
        false,
      );
    });

    it('counts only messages from the user, not ones we sent', async () => {
      await service.isWithinCustomerServiceWindow('user123', '923001234567');

      expect(prisma.channelMessage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channelId: 'channel123', direction: 'INBOUND' },
        }),
      );
    });

    it('is closed for a number not linked to this user', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await expect(service.isWithinCustomerServiceWindow('user123', '923001234567')).resolves.toBe(
        false,
      );
      expect(prisma.channelMessage.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('sendTemplate', () => {
    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
    });

    it('sends the named template with its body text and quick-reply payloads', async () => {
      await service.sendTemplate('user123', '923001234567', {
        name: 'zoorzio_reminder',
        language: 'en',
        bodyParameters: ['Submit application'],
        quickReplyPayloads: ['remind:r1:done', 'remind:r1:snooze'],
      });

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/test-phone-id/messages'),
        {
          messaging_product: 'whatsapp',
          to: '923001234567',
          type: 'template',
          template: {
            name: 'zoorzio_reminder',
            language: { code: 'en' },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: 'Submit application' }] },
              {
                type: 'button',
                sub_type: 'quick_reply',
                index: '0',
                parameters: [{ type: 'payload', payload: 'remind:r1:done' }],
              },
              {
                type: 'button',
                sub_type: 'quick_reply',
                index: '1',
                parameters: [{ type: 'payload', payload: 'remind:r1:snooze' }],
              },
            ],
          },
        },
        expect.any(Object),
      );
    });

    it('flattens line breaks and spacing, which Meta rejects in template parameters', async () => {
      await service.sendTemplate('user123', '923001234567', {
        name: 'zoorzio_reminder',
        language: 'en',
        bodyParameters: ['Line one\nLine two\t\tend   spaced'],
      });

      const [body] = http.post.mock.calls[0][1].template.components;
      expect(body.parameters[0].text).toBe('Line one · Line two · end spaced');
    });

    it('records the send against the channel', async () => {
      await service.sendTemplate('user123', '923001234567', {
        name: 'zoorzio_reminder',
        language: 'en',
        bodyParameters: ['Submit application'],
        quickReplyPayloads: ['remind:r1:done'],
      });

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'channel123',
          direction: 'OUTBOUND',
          metadata: { template: 'zoorzio_reminder', buttons: ['remind:r1:done'] },
        }),
      });
    });
  });

  describe('template quick-reply taps', () => {
    const templateTap = (payload: string, id = 'wamid.tap') => ({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'test-phone-id' },
                contacts: [{ profile: { name: 'Test' } }],
                messages: [
                  {
                    from: '923001234567',
                    id,
                    timestamp: '1700000000',
                    type: 'button',
                    button: { payload, text: 'Done' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
    });

    it('routes a tap on a template button to the same handler as a reply button', async () => {
      await service.handleWebhook(templateTap('remind:r1:done'));

      expect(interactiveReplies.handle).toHaveBeenCalledWith('user123', 'remind:r1:done');
      expect(chatService.reply).not.toHaveBeenCalled();
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('records the tap, since it reopens the 24-hour window', async () => {
      await service.handleWebhook(templateTap('remind:r1:done'));

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'channel123',
          direction: 'INBOUND',
          metadata: expect.objectContaining({ buttonId: 'remind:r1:done' }),
        }),
      });
    });

    it('does not act on a redelivered tap a second time', async () => {
      prisma.channelMessage.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await service.handleWebhook(templateTap('remind:r1:done'));

      expect(interactiveReplies.handle).not.toHaveBeenCalled();
    });
  });

  describe('redelivered webhooks', () => {
    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
    });

    it('does not store a second memory or run the agent again', async () => {
      prisma.channelMessage.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      const result = await service.handleWebhook(textMessagePayload('Book a meeting at 4'));

      expect(result).toHaveProperty('status', 'ok');
      expect(memoryService.create).not.toHaveBeenCalled();
      expect(chatService.reply).not.toHaveBeenCalled();
    });

    it('still surfaces a database error that is not a duplicate', async () => {
      prisma.channelMessage.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.handleWebhook(textMessagePayload('hello'))).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('agent history', () => {
    it('leaves button taps out of the conversation the model sees', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });
      memoryService.create.mockResolvedValue({ id: 'mem123' });
      prisma.channelMessage.findMany.mockResolvedValue([
        { content: 'What next?', direction: 'INBOUND', metadata: {}, createdAt: new Date(3) },
        {
          content: 'Done',
          direction: 'INBOUND',
          metadata: { buttonId: 'remind:r1:done' },
          createdAt: new Date(2),
        },
        {
          content: 'Reminder: pay rent',
          direction: 'OUTBOUND',
          metadata: {},
          createdAt: new Date(1),
        },
      ]);

      await service.handleWebhook(textMessagePayload('What next?'));

      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        [
          { role: 'assistant', content: 'Reminder: pay rent' },
          { role: 'user', content: 'What next?' },
        ],
        'John Doe',
        expect.anything(),
      );
    });
  });

  describe('number connected through Embedded Signup', () => {
    it('sends from the connected number instead of the environment configuration', async () => {
      businessConnection.getActiveCredentials.mockResolvedValue({
        accessToken: 'signup-token',
        phoneNumberId: 'signup-phone-id',
      });
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });

      await service.sendMessage('user123', '923001234567', 'Hello!');

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/signup-phone-id/messages'),
        expect.any(Object),
        { headers: { Authorization: 'Bearer signup-token' } },
      );
    });

    it('still prefers a user’s own Business account over the platform number', async () => {
      businessConnection.getActiveCredentials.mockResolvedValue({
        accessToken: 'signup-token',
        phoneNumberId: 'signup-phone-id',
      });
      channelCredentials.getDecryptedToken.mockResolvedValue({
        token: 'own-token',
        metadata: { phoneNumberId: 'own-phone-id' },
      });

      await service.sendMessage('user123', '923001234567', 'Hello!');

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/own-phone-id/messages'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('coexistence webhook fields', () => {
    const change = (field: string, value: Record<string, unknown>) => ({
      entry: [{ changes: [{ field, value }] }],
    });

    it.each([
      ['smb_message_echoes', 'handleMessageEchoesWebhook'],
      ['history', 'handleHistoryWebhook'],
      ['smb_app_state_sync', 'handleStateSyncWebhook'],
      ['account_update', 'handleAccountUpdateWebhook'],
    ])('hands %s to the connection service', async (field, handler) => {
      const value = { metadata: { phone_number_id: 'test-phone-id' } };

      const result = await service.handleWebhook(change(field, value));

      expect(result).toEqual({ status: 'ok' });
      expect(businessConnection[handler]).toHaveBeenCalledWith(value);
      expect(chatService.reply).not.toHaveBeenCalled();
    });

    it('ignores a field it does not handle', async () => {
      await expect(
        service.handleWebhook(change('message_template_status_update', { event: 'APPROVED' })),
      ).resolves.toEqual({ status: 'ok' });
    });
  });
});
