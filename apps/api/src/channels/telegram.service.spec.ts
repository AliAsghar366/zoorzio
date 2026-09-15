import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { Prisma } from '@anchor/database';
import { TelegramService } from './telegram.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { InteractiveReplyService } from './interactive-reply.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIService } from '../ai/ai.service';
import { ChatService } from '../chat/chat.service';

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('TelegramService', () => {
  let service: TelegramService;
  let prisma: any;
  let memoryService: any;
  let aiService: any;
  let http: any;
  let channelLinking: any;
  let chatService: any;
  let interactiveReplies: any;
  let config: Record<string, string | undefined>;

  const linkedChannel = { id: 'channel123', userId: 'user123' };

  beforeEach(async () => {
    config = { TELEGRAM_BOT_TOKEN: 'test-bot-token', TELEGRAM_WEBHOOK_SECRET: 's3cret-token' };

    prisma = {
      channel: { findFirst: jest.fn(), create: jest.fn() },
      channelMessage: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      memory: { findUnique: jest.fn().mockResolvedValue({ metadata: {} }) },
    };
    memoryService = { create: jest.fn().mockResolvedValue({ id: 'mem123' }), update: jest.fn() };
    aiService = { transcribeAudio: jest.fn(), describeImage: jest.fn() };
    channelLinking = { consumeTelegramLinkToken: jest.fn() };
    chatService = { reply: jest.fn().mockResolvedValue('') };
    interactiveReplies = { handle: jest.fn().mockResolvedValue(null) };
    http = {
      get: jest.fn(),
      post: jest.fn().mockReturnValue(of({ data: { ok: true, result: { message_id: 987 } } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => config[key]) } },
        { provide: PrismaService, useValue: prisma },
        { provide: MemoryService, useValue: memoryService },
        { provide: AIService, useValue: aiService },
        { provide: HttpService, useValue: http },
        { provide: ChannelLinkingService, useValue: channelLinking },
        {
          provide: ChannelCredentialsService,
          useValue: { getDecryptedToken: jest.fn().mockResolvedValue(null) },
        },
        { provide: ChatService, useValue: chatService },
        { provide: InteractiveReplyService, useValue: interactiveReplies },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  function textMessagePayload(text: string, chatType = 'private') {
    return {
      message: {
        chat: { id: 123456789, type: chatType },
        from: { id: 123456789, first_name: 'John', last_name: 'Doe', username: 'johndoe' },
        text,
        date: 1234567890,
        message_id: 123,
      },
    };
  }

  function callbackPayload(data: string) {
    return {
      callback_query: {
        id: 'cbq-1',
        from: { id: 123456789, first_name: 'John' },
        data,
        message: {
          message_id: 55,
          chat: { id: 123456789, type: 'private' },
          reply_markup: { inline_keyboard: [[{ text: 'Done', callback_data: data }]] },
        },
      },
    };
  }

  const postsTo = (method: string) =>
    http.post.mock.calls.filter(([url]: [string]) => url.endsWith(`/bottest-bot-token/${method}`));

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize successfully when configured', async () => {
      const result = await service.initialize();
      expect(result).toHaveProperty('status', 'initialized');
    });
  });

  describe('verifyWebhookSecret', () => {
    it('accepts the configured secret', () => {
      expect(service.verifyWebhookSecret('s3cret-token')).toBe(true);
    });

    it('rejects a wrong or missing secret', () => {
      expect(service.verifyWebhookSecret('s3cret-tokeX')).toBe(false);
      expect(service.verifyWebhookSecret('short')).toBe(false);
      expect(service.verifyWebhookSecret(undefined)).toBe(false);
    });

    it('fails closed when no secret is configured, rather than accepting everything', () => {
      config.TELEGRAM_WEBHOOK_SECRET = undefined;
      expect(service.verifyWebhookSecret('')).toBe(false);
      expect(service.verifyWebhookSecret('anything')).toBe(false);
    });
  });

  describe('linking', () => {
    it('replies with instructions to an unlinked chat instead of creating an account', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleWebhook(textMessagePayload('Hello'));

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(chatService.reply).not.toHaveBeenCalled();
      expect(prisma.channel.create).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/bottest-bot-token/sendMessage'),
        expect.objectContaining({ chat_id: 123456789 }),
      );
    });

    it('consumes a /start deep-link token and links the chat to the account that generated it', async () => {
      channelLinking.consumeTelegramLinkToken.mockResolvedValue('user123');

      await service.handleWebhook(textMessagePayload('/start abc123token'));

      expect(channelLinking.consumeTelegramLinkToken).toHaveBeenCalledWith(
        'abc123token',
        '123456789',
        'John Doe',
      );
      expect(chatService.reply).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/bottest-bot-token/sendMessage'),
        expect.objectContaining({ text: expect.stringContaining('linked') }),
      );
    });

    it('replies with an error when the /start token is invalid or expired', async () => {
      channelLinking.consumeTelegramLinkToken.mockResolvedValue(null);

      await service.handleWebhook(textMessagePayload('/start bad-token'));

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/bottest-bot-token/sendMessage'),
        expect.objectContaining({ text: expect.stringContaining('invalid or expired') }),
      );
    });
  });

  describe('agent', () => {
    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue(linkedChannel);
    });

    it("runs the agent on a linked user's message and replies on the same chat", async () => {
      chatService.reply.mockResolvedValue('Done - I will remind you at 5pm.');

      await service.handleWebhook(textMessagePayload('Remind me to call mom at 5'));

      expect(memoryService.create).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ content: 'Remind me to call mom at 5', source: 'TELEGRAM' }),
      );
      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        [{ role: 'user', content: 'Remind me to call mom at 5' }],
        'John Doe',
        expect.objectContaining({ sendButtons: expect.any(Function) }),
      );
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/bottest-bot-token/sendMessage'),
        { chat_id: 123456789, text: 'Done - I will remind you at 5pm.' },
      );
    });

    it('records the reply so the next turn has the conversation', async () => {
      chatService.reply.mockResolvedValue('Added.');

      await service.handleWebhook(textMessagePayload('add milk to groceries'));

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'channel123',
          content: 'Added.',
          direction: 'OUTBOUND',
        }),
      });
    });

    it('replays recent history so a follow-up keeps its context', async () => {
      prisma.channelMessage.findMany.mockResolvedValue([
        { content: 'tomorrow at 4', direction: 'INBOUND', metadata: {} },
        { content: 'When should I book it?', direction: 'OUTBOUND', metadata: {} },
        { content: 'Book a meeting with Ahmed', direction: 'INBOUND', metadata: {} },
      ]);

      await service.handleWebhook(textMessagePayload('tomorrow at 4'));

      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        [
          { role: 'user', content: 'Book a meeting with Ahmed' },
          { role: 'assistant', content: 'When should I book it?' },
          { role: 'user', content: 'tomorrow at 4' },
        ],
        'John Doe',
        expect.anything(),
      );
    });

    it('shows a typing indicator while the agent works', async () => {
      await service.handleWebhook(textMessagePayload('what is on today'));

      expect(postsTo('sendChatAction')).toEqual([
        [expect.any(String), { chat_id: 123456789, action: 'typing' }],
      ]);
    });

    it('does not act twice on an update Telegram redelivers', async () => {
      prisma.channelMessage.create.mockRejectedValueOnce(duplicate());

      await service.handleWebhook(textMessagePayload('delete my dentist event'));

      expect(chatService.reply).not.toHaveBeenCalled();
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('ignores group chats, where replies would expose private data to others', async () => {
      await service.handleWebhook(textMessagePayload('what are my tasks', 'group'));

      expect(prisma.channel.findFirst).not.toHaveBeenCalled();
      expect(chatService.reply).not.toHaveBeenCalled();
      expect(http.post).not.toHaveBeenCalled();
    });

    it("acts on a voice note's transcript like a typed message", async () => {
      http.get
        .mockReturnValueOnce(of({ data: { result: { file_path: 'voice/file_1.oga' } } }))
        .mockReturnValueOnce(of({ data: new ArrayBuffer(8) }));
      aiService.transcribeAudio.mockResolvedValue('Book the dentist for Friday');

      await service.handleWebhook({
        message: {
          chat: { id: 123456789, type: 'private' },
          from: { id: 123456789, first_name: 'John' },
          voice: { file_id: 'voice-file' },
          date: 1234567890,
          message_id: 124,
        },
      });

      expect(chatService.reply).toHaveBeenCalledWith(
        'user123',
        [{ role: 'user', content: 'Book the dentist for Friday' }],
        'John',
        expect.anything(),
      );
    });

    it('apologises instead of throwing when the agent fails, so Telegram does not redeliver', async () => {
      chatService.reply.mockRejectedValue(new Error('model unavailable'));

      const result = await service.handleWebhook(textMessagePayload('hello'));

      expect(result).toEqual({ status: 'ok' });
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({ text: expect.stringContaining('Something went wrong') }),
      );
    });

    it('renders a confirmation as inline Yes/No buttons, sending nothing else alongside', async () => {
      chatService.reply.mockImplementation(
        async (_u: string, _h: unknown, _n: string, prompter: any) => {
          await prompter.sendButtons('Cancel "Team sync" on Friday?', [
            { id: 'confirm:exec1:yes', title: 'Yes, do it' },
            { id: 'confirm:exec1:no', title: 'No, cancel' },
          ]);
          return '';
        },
      );

      await service.handleWebhook(textMessagePayload('cancel team sync'));

      expect(postsTo('sendMessage')).toEqual([
        [
          expect.any(String),
          {
            chat_id: 123456789,
            text: 'Cancel "Team sync" on Friday?',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Yes, do it', callback_data: 'confirm:exec1:yes' }],
                [{ text: 'No, cancel', callback_data: 'confirm:exec1:no' }],
              ],
            },
          },
        ],
      ]);
    });
  });

  describe('button taps', () => {
    beforeEach(() => {
      prisma.channel.findFirst.mockResolvedValue(linkedChannel);
    });

    it('resolves the tap for the linked user, removes the buttons, and replies', async () => {
      interactiveReplies.handle.mockResolvedValue('✅ Marked as done.');

      await service.handleWebhook(callbackPayload('remind:r1:done'));

      expect(postsTo('answerCallbackQuery')).toHaveLength(1);
      expect(interactiveReplies.handle).toHaveBeenCalledWith('user123', 'remind:r1:done');
      expect(postsTo('editMessageReplyMarkup')).toEqual([
        [
          expect.any(String),
          { chat_id: 123456789, message_id: 55, reply_markup: { inline_keyboard: [] } },
        ],
      ]);
      expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/sendMessage'), {
        chat_id: 123456789,
        text: '✅ Marked as done.',
      });
      expect(chatService.reply).not.toHaveBeenCalled();
    });

    it('records the tap as control input the model never sees', async () => {
      await service.handleWebhook(callbackPayload('confirm:exec1:yes'));

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalId: 'callback:cbq-1',
          metadata: expect.objectContaining({ buttonId: 'confirm:exec1:yes' }),
        }),
      });
    });

    it('does not run a redelivered tap twice', async () => {
      prisma.channelMessage.create.mockRejectedValueOnce(duplicate());

      await service.handleWebhook(callbackPayload('confirm:exec1:yes'));

      expect(interactiveReplies.handle).not.toHaveBeenCalled();
    });

    it('ignores a tap from an unlinked chat', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleWebhook(callbackPayload('confirm:exec1:yes'));

      expect(interactiveReplies.handle).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send Telegram message via the Bot API', async () => {
      prisma.channel.findFirst.mockResolvedValue(linkedChannel);

      const result = await service.sendMessage('user123', 123456789, 'Hello!');

      expect(result).toEqual({ success: true, messageId: '987' });
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/bottest-bot-token/sendMessage'),
        expect.objectContaining({ chat_id: 123456789, text: 'Hello!' }),
      );
    });

    it("splits a reply longer than Telegram's 4096-character limit", async () => {
      prisma.channel.findFirst.mockResolvedValue(linkedChannel);

      await service.sendMessage('user123', 123456789, 'x'.repeat(5000));

      const texts = postsTo('sendMessage').map(([, body]: [string, any]) => body.text);
      expect(texts.map((t: string) => t.length)).toEqual([4096, 904]);
    });
  });

  describe('sendButtons', () => {
    it("refuses a button id over Telegram's 64-byte callback limit before sending anything", async () => {
      prisma.channel.findFirst.mockResolvedValue(linkedChannel);

      await expect(
        service.sendButtons('user123', 123456789, 'Pick one', [{ id: 'x'.repeat(65), title: 'X' }]),
      ).rejects.toThrow('64-byte');
      expect(http.post).not.toHaveBeenCalled();
    });
  });
});
