import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { DiscordService } from './discord.service';
import { SlackService } from './slack.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';

describe('ChannelsController', () => {
  let controller: ChannelsController;
  let whatsappService: any;
  let whatsappSender: any;
  let telegramService: any;
  let emailService: any;
  let smsService: any;
  let discordService: any;
  let slackService: any;
  let channelLinking: any;
  let channelCredentials: any;

  beforeEach(async () => {
    whatsappService = {
      handleWebhook: jest.fn(),
      verifySignature: jest.fn().mockResolvedValue(true),
      initialize: jest.fn(),
    };

    whatsappSender = {
      sendMessage: jest.fn(),
    };

    telegramService = {
      handleWebhook: jest.fn(),
      sendMessage: jest.fn(),
      initialize: jest.fn(),
      registerWebhook: jest.fn(),
      unregisterWebhook: jest.fn(),
      handleWebhookForRoutingKey: jest.fn(),
    };

    emailService = {
      handleInboundEmail: jest.fn(),
      sendEmail: jest.fn(),
    };

    smsService = {
      handleWebhook: jest.fn(),
      sendMessage: jest.fn(),
      initialize: jest.fn(),
    };

    discordService = {
      sendMessage: jest.fn(),
      initialize: jest.fn(),
      connectUserBot: jest.fn(),
      disconnectUserBot: jest.fn(),
    };

    slackService = {
      handleEvent: jest.fn(),
      verifySignature: jest.fn(),
      sendMessage: jest.fn(),
      initialize: jest.fn(),
      handleEventForRoutingKey: jest.fn(),
    };

    channelLinking = {
      getLinkedChannels: jest.fn(),
      unlinkChannel: jest.fn(),
      createWhatsAppLinkCode: jest.fn(),
      createTelegramLinkToken: jest.fn(),
      createSmsLinkCode: jest.fn(),
      createDiscordLinkCode: jest.fn(),
      createSlackLinkCode: jest.fn(),
    };

    channelCredentials = {
      list: jest.fn(),
      saveCredential: jest.fn(),
      testCredential: jest.fn(),
      removeCredential: jest.fn(),
      getPublicCredential: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        { provide: WhatsAppService, useValue: whatsappService },
        { provide: WhatsAppSenderService, useValue: whatsappSender },
        { provide: TelegramService, useValue: telegramService },
        { provide: EmailService, useValue: emailService },
        { provide: SmsService, useValue: smsService },
        { provide: DiscordService, useValue: discordService },
        { provide: SlackService, useValue: slackService },
        { provide: ChannelLinkingService, useValue: channelLinking },
        { provide: ChannelCredentialsService, useValue: channelCredentials },
      ],
    }).compile();

    controller = module.get<ChannelsController>(ChannelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /** Stands in for the RawBodyRequest Nest provides when rawBody is enabled. */
  const rawRequest = (payload: unknown) =>
    ({ rawBody: Buffer.from(JSON.stringify(payload), 'utf8') }) as any;

  describe('handleWhatsAppWebhook', () => {
    it('should handle WhatsApp webhook', async () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '923001234567',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const expectedResponse = { status: 'ok' };

      whatsappService.handleWebhook.mockResolvedValue(expectedResponse);

      const result = await controller.handleWhatsAppWebhook(
        rawRequest(payload),
        payload,
        'sha256=valid',
      );

      expect(result).toEqual(expectedResponse);
      expect(whatsappService.handleWebhook).toHaveBeenCalledWith(payload);
    });

    it('rejects a webhook whose signature does not verify', async () => {
      // The endpoint is public, so the signature is the only thing proving the
      // request came from Meta rather than from anyone who found the URL.
      whatsappService.verifySignature.mockResolvedValue(false);
      const payload = { entry: [] };

      await expect(
        controller.handleWhatsAppWebhook(rawRequest(payload), payload, 'sha256=forged'),
      ).rejects.toThrow(ForbiddenException);

      expect(whatsappService.handleWebhook).not.toHaveBeenCalled();
    });

    it('checks the signature against the raw body, not the parsed one', async () => {
      const payload = { entry: [{ id: '1' }] };
      const raw = rawRequest(payload);

      await controller.handleWhatsAppWebhook(raw, payload, 'sha256=valid');

      expect(whatsappService.verifySignature).toHaveBeenCalledWith(
        raw.rawBody.toString('utf8'),
        'sha256=valid',
      );
    });
  });

  describe('handleTelegramWebhook', () => {
    const payload = {
      message: {
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, first_name: 'John' },
        text: 'Hello',
      },
    };

    it('processes an update carrying the registered secret token', async () => {
      telegramService.verifyWebhookSecret = jest.fn().mockReturnValue(true);
      telegramService.handleWebhook.mockResolvedValue({ status: 'ok' });

      const result = await controller.handleTelegramWebhook('the-secret', payload);

      expect(result).toEqual({ status: 'ok' });
      expect(telegramService.verifyWebhookSecret).toHaveBeenCalledWith('the-secret');
      expect(telegramService.handleWebhook).toHaveBeenCalledWith(payload);
    });

    it('rejects an update without a valid secret before it can reach the agent', async () => {
      telegramService.verifyWebhookSecret = jest.fn().mockReturnValue(false);

      await expect(controller.handleTelegramWebhook(undefined, payload)).rejects.toThrow(
        ForbiddenException,
      );
      expect(telegramService.handleWebhook).not.toHaveBeenCalled();
    });
  });

  describe('sendWhatsAppMessage', () => {
    it('should send WhatsApp message as the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { to: '923001234567', message: 'Hello!' };

      const expectedResponse = {
        success: true,
        messageId: 'msg_1234567890',
      };

      whatsappSender.sendMessage.mockResolvedValue(expectedResponse);

      const result = await controller.sendWhatsAppMessage(req, body);

      expect(result).toEqual(expectedResponse);
      expect(whatsappSender.sendMessage).toHaveBeenCalledWith('user123', body.to, body.message);
    });
  });

  describe('sendTelegramMessage', () => {
    it('should send Telegram message as the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { chatId: 123456789, message: 'Hello!' };

      const expectedResponse = {
        success: true,
        messageId: 'msg_1234567890',
      };

      telegramService.sendMessage.mockResolvedValue(expectedResponse);

      const result = await controller.sendTelegramMessage(req, body);

      expect(result).toEqual(expectedResponse);
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        'user123',
        body.chatId,
        body.message,
      );
    });
  });

  describe('handleEmailWebhook', () => {
    it('should handle inbound email', async () => {
      const payload = { from: 'a@example.com', to: 'b@anchor.app', subject: 'Hi', text: 'Hello' };
      const expectedResponse = { id: 'mem123' };

      emailService.handleInboundEmail.mockResolvedValue(expectedResponse);

      const result = await controller.handleEmailWebhook(payload);

      expect(result).toEqual(expectedResponse);
      expect(emailService.handleInboundEmail).toHaveBeenCalledWith(payload);
    });
  });

  describe('sendEmail', () => {
    it('should send email as the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { to: 'b@example.com', subject: 'Hi', body: 'Hello' };
      const expectedResponse = { success: true, messageId: 'sg-123' };

      emailService.sendEmail.mockResolvedValue(expectedResponse);

      const result = await controller.sendEmail(req, body);

      expect(result).toEqual(expectedResponse);
      // Opts into the user's own SendGrid key - unlike system mail, which stays on the platform key.
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'user123',
        body.to,
        body.subject,
        body.body,
        {
          preferUserCredential: true,
        },
      );
    });
  });

  describe('getLinkedChannels', () => {
    it('returns the linked channels for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const expected = [{ id: 'chan1', type: 'WHATSAPP', externalId: '923001234567' }];
      channelLinking.getLinkedChannels.mockResolvedValue(expected);

      const result = await controller.getLinkedChannels(req);

      expect(result).toEqual(expected);
      expect(channelLinking.getLinkedChannels).toHaveBeenCalledWith('user123');
    });
  });

  describe('unlinkChannel', () => {
    it('unlinks a channel owned by the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      channelLinking.unlinkChannel.mockResolvedValue({ success: true });

      const result = await controller.unlinkChannel(req, 'chan1');

      expect(result).toEqual({ success: true });
      expect(channelLinking.unlinkChannel).toHaveBeenCalledWith('user123', 'chan1');
    });
  });

  describe('createWhatsAppLink', () => {
    it('generates a link code for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const expected = {
        code: 'AB12CD',
        waLink: 'https://wa.me/1234567890?text=LINK%20AB12CD',
        configured: true,
      };
      channelLinking.createWhatsAppLinkCode.mockResolvedValue(expected);

      const result = await controller.createWhatsAppLink(req);

      expect(result).toEqual(expected);
      expect(channelLinking.createWhatsAppLinkCode).toHaveBeenCalledWith('user123');
    });
  });

  describe('createTelegramLink', () => {
    it('generates a deep link for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const expected = { deepLink: 'https://t.me/zoorzio_bot?start=abc123', configured: true };
      channelLinking.createTelegramLinkToken.mockResolvedValue(expected);

      const result = await controller.createTelegramLink(req);

      expect(result).toEqual(expected);
      expect(channelLinking.createTelegramLinkToken).toHaveBeenCalledWith('user123');
    });
  });

  describe('createSmsLink', () => {
    it('generates a link code for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const expected = {
        code: 'AB12CD',
        smsLink: 'sms:+15551234567?body=LINK%20AB12CD',
        configured: true,
      };
      channelLinking.createSmsLinkCode.mockResolvedValue(expected);

      const result = await controller.createSmsLink(req);

      expect(result).toEqual(expected);
      expect(channelLinking.createSmsLinkCode).toHaveBeenCalledWith('user123');
    });
  });

  describe('createDiscordLink', () => {
    it('generates a link code for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      channelLinking.createDiscordLinkCode.mockResolvedValue({ code: 'AB12CD', configured: true });

      const result = await controller.createDiscordLink(req);

      expect(result).toEqual({ code: 'AB12CD', configured: true });
      expect(channelLinking.createDiscordLinkCode).toHaveBeenCalledWith('user123');
    });
  });

  describe('createSlackLink', () => {
    it('generates a link code for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      channelLinking.createSlackLinkCode.mockResolvedValue({ code: 'AB12CD', configured: true });

      const result = await controller.createSlackLink(req);

      expect(result).toEqual({ code: 'AB12CD', configured: true });
      expect(channelLinking.createSlackLinkCode).toHaveBeenCalledWith('user123');
    });
  });

  describe('handleSmsWebhook', () => {
    it('processes the webhook and replies with empty TwiML', async () => {
      const payload = { From: '+15551234567', Body: 'Hello', MessageSid: 'SM123' };
      const res = { set: jest.fn(), send: jest.fn() } as any;

      await controller.handleSmsWebhook(payload, res);

      expect(smsService.handleWebhook).toHaveBeenCalledWith(payload);
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/xml');
      expect(res.send).toHaveBeenCalledWith('<Response></Response>');
    });
  });

  describe('sendSms', () => {
    it('should send SMS as the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { to: '+15551234567', message: 'Hello!' };
      smsService.sendMessage.mockResolvedValue({ success: true, messageId: 'SM123' });

      const result = await controller.sendSms(req, body);

      expect(result).toEqual({ success: true, messageId: 'SM123' });
      expect(smsService.sendMessage).toHaveBeenCalledWith('user123', body.to, body.message);
    });
  });

  describe('sendDiscordMessage', () => {
    it('should send a Discord DM as the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { discordUserId: 'discord-42', message: 'Hello!' };
      discordService.sendMessage.mockResolvedValue({ success: true, messageId: 'd-1' });

      const result = await controller.sendDiscordMessage(req, body);

      expect(result).toEqual({ success: true, messageId: 'd-1' });
      expect(discordService.sendMessage).toHaveBeenCalledWith(
        'user123',
        body.discordUserId,
        body.message,
      );
    });
  });

  describe('handleSlackEvent', () => {
    it('passes the url_verification challenge through without requiring a valid signature', async () => {
      const payload = { type: 'url_verification', challenge: 'abc123' };
      slackService.handleEvent.mockResolvedValue({ challenge: 'abc123' });

      const result = await controller.handleSlackEvent(
        { rawBody: Buffer.from('') } as any,
        payload,
        '',
        '',
      );

      expect(result).toEqual({ challenge: 'abc123' });
      expect(slackService.verifySignature).not.toHaveBeenCalled();
    });

    it('rejects an event with an invalid signature', async () => {
      slackService.verifySignature.mockReturnValue(false);
      const req = { rawBody: Buffer.from('{"type":"event_callback"}') } as any;

      await expect(
        controller.handleSlackEvent(req, { type: 'event_callback' }, '123', 'bad-sig'),
      ).rejects.toThrow(ForbiddenException);
      expect(slackService.handleEvent).not.toHaveBeenCalled();
    });

    it('processes an event with a valid signature', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleEvent.mockResolvedValue({ ok: true });
      const payload = { type: 'event_callback' };
      const req = { rawBody: Buffer.from(JSON.stringify(payload)) } as any;

      const result = await controller.handleSlackEvent(req, payload, '123', 'good-sig');

      expect(result).toEqual({ ok: true });
      expect(slackService.verifySignature).toHaveBeenCalledWith(
        JSON.stringify(payload),
        '123',
        'good-sig',
      );
    });
  });

  describe('sendSlackMessage', () => {
    it('should send a Slack DM as the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { slackUserId: 'U123', message: 'Hello!' };
      slackService.sendMessage.mockResolvedValue({ success: true, messageId: '1234.5678' });

      const result = await controller.sendSlackMessage(req, body);

      expect(result).toEqual({ success: true, messageId: '1234.5678' });
      expect(slackService.sendMessage).toHaveBeenCalledWith(
        'user123',
        body.slackUserId,
        body.message,
      );
    });
  });

  describe('listCredentials', () => {
    it("lists the authenticated user's own saved credentials", async () => {
      const req = { user: { id: 'user123' } };
      const expected = [{ type: 'TELEGRAM', status: 'ACTIVE' }];
      channelCredentials.list.mockResolvedValue(expected);

      const result = await controller.listCredentials(req);

      expect(result).toEqual(expected);
      expect(channelCredentials.list).toHaveBeenCalledWith('user123');
    });
  });

  describe('saveCredential', () => {
    it('saves a credential and registers the Telegram webhook for the authenticated user', async () => {
      const req = { user: { id: 'user123' } };
      const dto = { token: 'my-own-bot-token' };
      const saved = { type: 'TELEGRAM', status: 'PENDING' };
      channelCredentials.saveCredential.mockResolvedValue(saved);

      const result = await controller.saveCredential(req, 'telegram', dto as any);

      expect(result).toEqual(saved);
      expect(channelCredentials.saveCredential).toHaveBeenCalledWith('user123', 'TELEGRAM', dto);
      expect(telegramService.registerWebhook).toHaveBeenCalledWith('user123');
    });

    it('does not attempt Telegram webhook registration for other platforms', async () => {
      const req = { user: { id: 'user123' } };
      channelCredentials.saveCredential.mockResolvedValue({ type: 'SLACK', status: 'PENDING' });

      await controller.saveCredential(req, 'slack', { token: 'xoxb-...' } as any);

      expect(telegramService.registerWebhook).not.toHaveBeenCalled();
    });

    it('opens the Discord Gateway connection when a Discord bot token is saved', async () => {
      const req = { user: { id: 'user123' } };
      channelCredentials.saveCredential.mockResolvedValue({ type: 'DISCORD', status: 'PENDING' });

      await controller.saveCredential(req, 'discord', { token: 'discord-bot-token' } as any);

      expect(discordService.connectUserBot).toHaveBeenCalledWith('user123');
      expect(telegramService.registerWebhook).not.toHaveBeenCalled();
    });

    it('returns the status the connection attempt produced, not the stale PENDING snapshot', async () => {
      const req = { user: { id: 'user123' } };
      channelCredentials.saveCredential.mockResolvedValue({ type: 'DISCORD', status: 'PENDING' });
      channelCredentials.getPublicCredential.mockResolvedValue({
        type: 'DISCORD',
        status: 'ACTIVE',
      });

      const result = await controller.saveCredential(req, 'discord', {
        token: 'discord-bot-token',
      } as any);

      expect(result).toEqual({ type: 'DISCORD', status: 'ACTIVE' });
    });

    it('rejects an unsupported platform', async () => {
      const req = { user: { id: 'user123' } };

      await expect(
        controller.saveCredential(req, 'myspace', { token: 'x' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('testCredential', () => {
    it("tests the authenticated user's credential for a platform", async () => {
      const req = { user: { id: 'user123' } };
      channelCredentials.testCredential.mockResolvedValue({ success: true });

      const result = await controller.testCredential(req, 'discord');

      expect(result).toEqual({ success: true });
      expect(channelCredentials.testCredential).toHaveBeenCalledWith('user123', 'DISCORD');
    });
  });

  describe('removeCredential', () => {
    it('unregisters the Telegram webhook before removing a Telegram credential', async () => {
      const req = { user: { id: 'user123' } };
      channelCredentials.removeCredential.mockResolvedValue({ success: true });

      const result = await controller.removeCredential(req, 'telegram');

      expect(result).toEqual({ success: true });
      expect(telegramService.unregisterWebhook).toHaveBeenCalledWith('user123');
      expect(channelCredentials.removeCredential).toHaveBeenCalledWith('user123', 'TELEGRAM');
    });
  });

  describe('removeCredential (Discord)', () => {
    it('closes the Gateway connection before deleting the credential', async () => {
      const req = { user: { id: 'user123' } };
      channelCredentials.removeCredential.mockResolvedValue({ success: true });

      await controller.removeCredential(req, 'discord');

      expect(discordService.disconnectUserBot).toHaveBeenCalledWith('user123');
      expect(channelCredentials.removeCredential).toHaveBeenCalledWith('user123', 'DISCORD');
    });
  });

  describe('handlePerUserTelegramWebhook', () => {
    it("routes the webhook payload through to the resolved user's bot", async () => {
      const payload = { message: { text: 'hi' } };
      telegramService.handleWebhookForRoutingKey.mockResolvedValue({ status: 'ok' });

      const result = await controller.handlePerUserTelegramWebhook('abc123routingkey', payload);

      expect(result).toEqual({ status: 'ok' });
      expect(telegramService.handleWebhookForRoutingKey).toHaveBeenCalledWith(
        'abc123routingkey',
        payload,
      );
    });
  });

  describe('handlePerUserSlackEvent', () => {
    it('passes the raw body and headers through for per-user signature verification', async () => {
      const payload = { type: 'event_callback' };
      const req = { rawBody: Buffer.from(JSON.stringify(payload)) } as any;
      slackService.handleEventForRoutingKey.mockResolvedValue({ ok: true });

      const result = await controller.handlePerUserSlackEvent('key1', req, payload, '123', 'sig');

      expect(result).toEqual({ ok: true });
      expect(slackService.handleEventForRoutingKey).toHaveBeenCalledWith(
        'key1',
        payload,
        JSON.stringify(payload),
        '123',
        'sig',
      );
    });

    it('turns an invalid-signature result into a 403 rather than returning it', async () => {
      const req = { rawBody: Buffer.from('{}') } as any;
      slackService.handleEventForRoutingKey.mockResolvedValue({ error: 'invalid_signature' });

      await expect(
        controller.handlePerUserSlackEvent('key1', req, {}, '123', 'bad-sig'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('healthCheck', () => {
    it('should return channels health', async () => {
      whatsappService.initialize.mockResolvedValue({ status: 'initialized' });
      telegramService.initialize.mockResolvedValue({ status: 'initialized' });
      smsService.initialize.mockResolvedValue({ status: 'not configured' });
      discordService.initialize.mockResolvedValue({ status: 'not configured' });
      slackService.initialize.mockResolvedValue({ status: 'not configured' });

      const result = await controller.healthCheck();

      expect(result).toEqual({
        whatsapp: 'initialized',
        telegram: 'initialized',
        sms: 'not configured',
        discord: 'not configured',
        slack: 'not configured',
      });
    });
  });
});
