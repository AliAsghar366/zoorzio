jest.mock('@whiskeysockets/baileys', () => ({
  DisconnectReason: { loggedOut: 401 },
  fetchLatestBaileysVersion: jest.fn(),
  makeWASocket: jest.fn(),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));
jest.mock('./whatsapp-unofficial-auth-store', () => ({ useDatabaseAuthState: jest.fn() }));
jest.mock('./agent-history', () => ({
  buildAgentHistory: jest.fn().mockResolvedValue([{ role: 'user', content: 'hi' }]),
}));

import { WhatsAppUnofficialService } from './whatsapp-unofficial.service';

/**
 * WhatsApp increasingly addresses senders by a private linked id
 * ("123456789@lid") rather than their phone number. The service used to strip
 * the domain and reply to "<digits>@s.whatsapp.net" - an address that does not
 * exist - so Baileys reported success and the reply vanished. A real handset
 * hit exactly this: messages arrived, no send error was recorded, and nothing
 * came back.
 */
describe('WhatsAppUnofficialService - sender addressing', () => {
  const LID_JID = '98765432101234@lid';
  const PHONE = '923166323926';
  const PHONE_JID = `${PHONE}@s.whatsapp.net`;

  let service: WhatsAppUnofficialService;
  let prisma: any;
  let sock: any;
  let channelLinking: any;
  let chatService: any;

  function incoming(key: Record<string, unknown>, text = 'hi') {
    return {
      key: { id: 'wamid-' + Math.random(), fromMe: false, ...key },
      message: { conversation: text },
      pushName: 'Tester',
    };
  }

  beforeEach(() => {
    prisma = {
      channel: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      channelMessage: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Pro Priya' }) },
    };
    channelLinking = { consumeWhatsAppLinkCode: jest.fn() };
    chatService = { reply: jest.fn().mockResolvedValue('Hello from Zoorzio') };

    service = new WhatsAppUnofficialService(
      prisma,
      {} as any,
      { create: jest.fn().mockResolvedValue({}) } as any,
      channelLinking,
      chatService,
      { hasPaidAccess: jest.fn().mockResolvedValue(true) } as any,
      { handle: jest.fn() } as any,
    );
    sock = { sendMessage: jest.fn().mockResolvedValue({ key: { id: 'out-1' } }) };
    (service as any).sock = sock;
    (service as any).recordInbound = jest.fn().mockResolvedValue(true);
    (service as any).matchPendingButton = jest.fn().mockResolvedValue(null);
  });

  const handle = (m: any) => (service as any).handleIncomingMessage(m);

  it('replies to the exact @lid address an unknown sender wrote from', async () => {
    await handle(incoming({ remoteJid: LID_JID }));

    expect(sock.sendMessage).toHaveBeenCalledTimes(1);
    expect(sock.sendMessage.mock.calls[0][0]).toBe(LID_JID);
    expect(sock.sendMessage.mock.calls[0][1].text).toMatch(/don't recognize this number/);
  });

  it('never rebuilds a private id into a phone-number address', async () => {
    await handle(incoming({ remoteJid: LID_JID }));

    expect(sock.sendMessage.mock.calls[0][0]).not.toBe('98765432101234@s.whatsapp.net');
  });

  it('still replies to the @lid address when WhatsApp also supplies the real number', async () => {
    await handle(incoming({ remoteJid: LID_JID, senderPn: PHONE_JID }));

    expect(sock.sendMessage.mock.calls[0][0]).toBe(LID_JID);
  });

  it('finds an account linked by phone number when the message arrives via @lid', async () => {
    prisma.channel.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.externalId?.in?.includes(PHONE)
          ? { id: 'ch1', userId: 'user1', externalId: PHONE, metadata: {} }
          : null,
      ),
    );

    await handle(incoming({ remoteJid: LID_JID, senderPn: PHONE_JID }));

    expect(chatService.reply).toHaveBeenCalled();
    const sentTo = sock.sendMessage.mock.calls.map((c: any[]) => c[0]);
    expect(sentTo).toContain(LID_JID);
  });

  it('links by the real phone number and saves where to reply', async () => {
    channelLinking.consumeWhatsAppLinkCode.mockResolvedValue('user1');
    prisma.channel.findFirst.mockResolvedValue({
      id: 'ch1',
      userId: 'user1',
      externalId: PHONE,
      metadata: {},
    });

    await handle(incoming({ remoteJid: LID_JID, senderPn: PHONE_JID }, 'LINK AK6Y62'));

    expect(channelLinking.consumeWhatsAppLinkCode).toHaveBeenCalledWith('AK6Y62', PHONE);
    expect(prisma.channel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch1' },
        data: { metadata: expect.objectContaining({ replyJid: LID_JID, phone: PHONE }) },
      }),
    );
  });

  it('greets a newly linked user by first name at the address they wrote from', async () => {
    channelLinking.consumeWhatsAppLinkCode.mockResolvedValue('user1');
    prisma.channel.findFirst.mockResolvedValue({
      id: 'ch1',
      userId: 'user1',
      externalId: PHONE,
      metadata: {},
    });

    await handle(incoming({ remoteJid: LID_JID, senderPn: PHONE_JID }, 'LINK AK6Y62'));

    const greeting = sock.sendMessage.mock.calls.find((c: any[]) =>
      /You're connected, Pro!/.test(c[1].text),
    );
    expect(greeting).toBeDefined();
    expect(greeting[0]).toBe(LID_JID);
  });

  it('delivers a later proactive message to the saved address, even after a restart', async () => {
    // Nothing in memory, as after a redeploy - only what was saved on the channel.
    (service as any).replyJids.clear();
    prisma.channel.findFirst.mockResolvedValue({
      id: 'ch1',
      userId: 'user1',
      externalId: PHONE,
      metadata: { replyJid: LID_JID },
    });

    await service.sendMessage('user1', PHONE, 'Reminder: call the accountant');

    expect(sock.sendMessage.mock.calls[0][0]).toBe(LID_JID);
  });

  it('falls back to the phone-number address when nothing better is known', async () => {
    await service.sendMessage('user1', PHONE, 'hello');

    expect(sock.sendMessage.mock.calls[0][0]).toBe(PHONE_JID);
  });

  it('ignores messages the linked phone sent itself', async () => {
    await handle(incoming({ remoteJid: LID_JID, fromMe: true }));

    expect(sock.sendMessage).not.toHaveBeenCalled();
  });
});
