import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { WhatsAppBusinessConnectionService } from './whatsapp-business-connection.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';

describe('WhatsAppBusinessConnectionService', () => {
  let service: WhatsAppBusinessConnectionService;
  let prisma: any;
  let http: any;
  let configValues: Record<string, string | undefined>;
  let storedConnection: any;

  const input = { code: 'the-code', phoneNumberId: '106540352242922', wabaId: '102290129340398' };

  const connection = (overrides: Record<string, unknown> = {}) => ({
    id: 'conn-1',
    phoneNumberId: '106540352242922',
    wabaId: '102290129340398',
    businessId: null,
    displayPhoneNumber: '447848472822',
    encryptedAccessToken: 'enc(business-token)',
    isOnBizApp: true,
    platformType: 'CLOUD_API',
    status: 'ACTIVE',
    contactsSyncRequestId: null,
    contactsSyncStartedAt: null,
    historySyncRequestId: null,
    historySyncStartedAt: null,
    historySyncDeclined: false,
    historySyncProgress: null,
    lastSyncError: null,
    connectedByUserId: 'admin-1',
    connectedAt: new Date(),
    disconnectedAt: null,
    disconnectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const postUrls = () => http.post.mock.calls.map((call: any[]) => call[0]);

  beforeEach(async () => {
    storedConnection = connection();
    configValues = { WHATSAPP_APP_ID: 'app-id', WHATSAPP_APP_SECRET: 'app-secret' };

    prisma = {
      whatsAppBusinessConnection: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(async () => storedConnection),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn(async () => storedConnection),
        update: jest.fn(async () => storedConnection),
      },
      channel: { findFirst: jest.fn().mockResolvedValue(null) },
      channelMessage: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (work: (tx: any) => Promise<unknown>) => work(prisma)),
    };

    http = {
      get: jest.fn((url: string) => {
        if (url.endsWith('/oauth/access_token'))
          return of({ data: { access_token: 'business-token' } });
        return of({
          data: {
            is_on_biz_app: true,
            platform_type: 'CLOUD_API',
            display_phone_number: '+44 7848 472822',
          },
        });
      }),
      post: jest.fn((url: string) => {
        if (url.endsWith('/subscribed_apps')) return of({ data: { success: true } });
        return of({ data: { messaging_product: 'whatsapp', request_id: 'req-1' } });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppBusinessConnectionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn(async (value: string) => `enc(${value})`),
            decrypt: jest.fn(async (value: string) => value.replace(/^enc\((.*)\)$/, '$1')),
          },
        },
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => configValues[key]) } },
      ],
    }).compile();

    service = module.get(WhatsAppBusinessConnectionService);
  });

  describe('connect', () => {
    it('exchanges the signup code using the app credentials', async () => {
      await service.connect('admin-1', input);

      expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/oauth/access_token'), {
        params: { client_id: 'app-id', client_secret: 'app-secret', code: 'the-code' },
      });
    });

    it("subscribes the app to the account's webhooks with the business token", async () => {
      await service.connect('admin-1', input);

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('/102290129340398/subscribed_apps'),
        {},
        { headers: { Authorization: 'Bearer business-token' } },
      );
    });

    it('stores the business token encrypted, never in plaintext', async () => {
      await service.connect('admin-1', input);

      const { create, update } = prisma.whatsAppBusinessConnection.upsert.mock.calls[0][0];
      expect(create.encryptedAccessToken).toBe('enc(business-token)');
      expect(update.encryptedAccessToken).toBe('enc(business-token)');
      expect(Object.values(create)).not.toContain('business-token');
    });

    it('stores the display number as digits only', async () => {
      await service.connect('admin-1', input);

      const { create } = prisma.whatsAppBusinessConnection.upsert.mock.calls[0][0];
      expect(create.displayPhoneNumber).toBe('447848472822');
    });

    it('starts the contacts and history syncs straight away', async () => {
      // Meta offboards the number if neither is requested within 24 hours.
      await service.connect('admin-1', input);

      const syncBodies = http.post.mock.calls
        .filter((call: any[]) => call[0].endsWith('/106540352242922/smb_app_data'))
        .map((call: any[]) => call[1]);
      expect(syncBodies).toEqual([
        { messaging_product: 'whatsapp', sync_type: 'smb_app_state_sync' },
        { messaging_product: 'whatsapp', sync_type: 'history' },
      ]);
    });

    it('does not register the phone number, which the Business app already has', async () => {
      await service.connect('admin-1', input);

      expect(postUrls().some((url: string) => url.includes('/register'))).toBe(false);
    });

    it('retires any other number that was active', async () => {
      await service.connect('admin-1', input);

      expect(prisma.whatsAppBusinessConnection.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', phoneNumberId: { not: '106540352242922' } },
        data: {
          status: 'DISCONNECTED',
          disconnectedAt: expect.any(Date),
          disconnectReason: 'REPLACED',
        },
      });
    });

    it('never returns the token to the caller', async () => {
      const result = await service.connect('admin-1', input);

      expect(JSON.stringify(result)).not.toContain('business-token');
    });

    it('stores nothing when Meta rejects the code', async () => {
      http.get.mockImplementation(() => throwError(() => new Error('code expired')));

      await expect(service.connect('admin-1', input)).rejects.toThrow(BadRequestException);
      expect(prisma.whatsAppBusinessConnection.upsert).not.toHaveBeenCalled();
      expect(http.post).not.toHaveBeenCalled();
    });

    it('refuses to start without the Meta app credentials configured', async () => {
      configValues.WHATSAPP_APP_ID = undefined;

      await expect(service.connect('admin-1', input)).rejects.toThrow(BadRequestException);
      expect(http.get).not.toHaveBeenCalled();
    });

    it('keeps the connection and records the error when a sync request fails', async () => {
      http.post.mockImplementation((url: string) =>
        url.endsWith('/subscribed_apps')
          ? of({ data: { success: true } })
          : throwError(() => ({
              response: { data: { error: { message: 'Temporarily unavailable' } } },
            })),
      );

      await expect(service.connect('admin-1', input)).resolves.toBeDefined();
      expect(prisma.whatsAppBusinessConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: { lastSyncError: 'contacts sync: Temporarily unavailable' },
      });
    });

    it('skips the syncs for a number that is not on the Business app', async () => {
      http.get.mockImplementation((url: string) =>
        url.endsWith('/oauth/access_token')
          ? of({ data: { access_token: 'business-token' } })
          : of({ data: { is_on_biz_app: false, platform_type: 'CLOUD_API' } }),
      );
      storedConnection = connection({ isOnBizApp: false });

      await service.connect('admin-1', input);

      expect(postUrls().some((url: string) => url.endsWith('/smb_app_data'))).toBe(false);
    });
  });

  describe('startSync', () => {
    it('refuses a sync that has already been started', async () => {
      storedConnection = connection({ historySyncStartedAt: new Date() });

      await expect(service.startSync('conn-1', 'history')).rejects.toThrow('only once');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('refuses once the 24-hour window has passed', async () => {
      storedConnection = connection({ connectedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });

      await expect(service.startSync('conn-1', 'contacts')).rejects.toThrow('24 hours');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('refuses for a number that is no longer connected', async () => {
      storedConnection = connection({ status: 'DISCONNECTED' });

      await expect(service.startSync('conn-1', 'contacts')).rejects.toThrow(BadRequestException);
    });

    it('records the request id Meta returns', async () => {
      await service.startSync('conn-1', 'history');

      expect(prisma.whatsAppBusinessConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: {
          historySyncRequestId: 'req-1',
          historySyncStartedAt: expect.any(Date),
          lastSyncError: null,
        },
      });
    });
  });

  describe('getActiveCredentials', () => {
    it('returns the decrypted token for the active number', async () => {
      prisma.whatsAppBusinessConnection.findFirst.mockResolvedValue(connection());

      await expect(service.getActiveCredentials()).resolves.toEqual({
        accessToken: 'business-token',
        phoneNumberId: '106540352242922',
      });
    });

    it('returns null when no number is connected', async () => {
      await expect(service.getActiveCredentials()).resolves.toBeNull();
    });
  });

  describe('history webhook', () => {
    const historyValue = (threadId: string) => ({
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
      history: [
        {
          metadata: { phase: 0, chunk_order: 1, progress: 55 },
          threads: [
            {
              id: threadId,
              messages: [
                {
                  from: '15550783881',
                  id: 'wamid.out',
                  timestamp: '1739230955',
                  type: 'text',
                  text: { body: 'Here is the info you asked for' },
                  history_context: { status: 'READ' },
                },
                {
                  from: threadId,
                  id: 'wamid.in',
                  timestamp: '1739230900',
                  type: 'text',
                  text: { body: 'Can you send the info?' },
                },
              ],
            },
          ],
        },
      ],
    });

    it("stores history against the linked user's channel with original timestamps and directions", async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel-1', userId: 'user-1' });

      await service.handleHistoryWebhook(historyValue('16505551234'));

      expect(prisma.channel.findFirst).toHaveBeenCalledWith({
        where: { type: 'WHATSAPP', externalId: '16505551234' },
      });
      expect(prisma.channelMessage.createMany).toHaveBeenCalledWith({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            channelId: 'channel-1',
            externalId: 'wamid.out',
            content: 'Here is the info you asked for',
            direction: 'OUTBOUND',
            createdAt: new Date(1739230955 * 1000),
          }),
          expect.objectContaining({
            externalId: 'wamid.in',
            direction: 'INBOUND',
            createdAt: new Date(1739230900 * 1000),
          }),
        ],
      });
    });

    it('keeps nothing for someone who has not linked a Zoorzio account', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleHistoryWebhook(historyValue('16505559999'));

      expect(prisma.channelMessage.createMany).not.toHaveBeenCalled();
    });

    it('only moves sync progress forward', async () => {
      await service.handleHistoryWebhook(historyValue('16505551234'));

      expect(prisma.whatsAppBusinessConnection.updateMany).toHaveBeenCalledWith({
        where: {
          phoneNumberId: '106540352242922',
          OR: [{ historySyncProgress: null }, { historySyncProgress: { lt: 55 } }],
        },
        data: { historySyncProgress: 55 },
      });
    });

    it('records that the business declined to share history', async () => {
      await service.handleHistoryWebhook({
        metadata: { phone_number_id: '106540352242922' },
        history: [{ errors: [{ code: 2593109, message: 'History sync is turned off' }] }],
      });

      expect(prisma.whatsAppBusinessConnection.updateMany).toHaveBeenCalledWith({
        where: { phoneNumberId: '106540352242922' },
        data: { historySyncDeclined: true },
      });
      expect(prisma.channelMessage.createMany).not.toHaveBeenCalled();
    });
  });

  describe('message echoes webhook', () => {
    it('mirrors a message sent from the Business app as outbound', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel-1', userId: 'user-1' });

      await service.handleMessageEchoesWebhook({
        message_echoes: [
          {
            from: '15550783881',
            to: '16505551234',
            id: 'wamid.echo',
            timestamp: '1700255121',
            type: 'text',
            text: { body: 'Sent from my phone' },
          },
        ],
      });

      expect(prisma.channelMessage.createMany).toHaveBeenCalledWith({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            channelId: 'channel-1',
            externalId: 'wamid.echo',
            content: 'Sent from my phone',
            direction: 'OUTBOUND',
            metadata: { source: 'business_app_echo', whatsappMessageId: 'wamid.echo' },
          }),
        ],
      });
    });
  });

  describe('contacts webhook', () => {
    it("does not copy the business's contacts into anyone's address book", () => {
      service.handleStateSyncWebhook({
        state_sync: [
          { type: 'contact', contact: { full_name: 'Pablo', phone_number: '16505551234' } },
        ],
      });

      expect(prisma.channelMessage.createMany).not.toHaveBeenCalled();
      expect(prisma.whatsAppBusinessConnection.update).not.toHaveBeenCalled();
    });
  });

  describe('account update webhook', () => {
    it('marks the number disconnected when the partner is removed', async () => {
      await service.handleAccountUpdateWebhook({
        phone_number: '15550783881',
        event: 'PARTNER_REMOVED',
        disconnection_info: { reason: 'PRIMARY_INACTIVITY', initiated_by: 'SYSTEM' },
      });

      expect(prisma.whatsAppBusinessConnection.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', displayPhoneNumber: '15550783881' },
        data: {
          status: 'DISCONNECTED',
          disconnectedAt: expect.any(Date),
          disconnectReason: 'PRIMARY_INACTIVITY',
        },
      });
    });

    it('ignores other account events', async () => {
      await service.handleAccountUpdateWebhook({
        phone_number: '15550783881',
        event: 'VERIFIED_ACCOUNT',
      });

      expect(prisma.whatsAppBusinessConnection.updateMany).not.toHaveBeenCalled();
    });
  });
});
