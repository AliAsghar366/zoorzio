/**
 * Manual mock for the whole package - Jest applies this automatically to
 * every test in the project (per Jest's convention for a `__mocks__`
 * directory adjacent to node_modules), which is what's needed here: the real
 * package ships ESM output Jest's CommonJS transform can't parse, so without
 * this, any spec that transitively imports WhatsAppUnofficialService or
 * WhatsAppSenderService fails to even load, whether or not it touches
 * Baileys directly.
 *
 * Real application code (`node dist/main.js`) never sees this file - it only
 * exists under Jest's module resolution.
 */

export const makeWASocket = jest.fn();

export const fetchLatestBaileysVersion = jest.fn().mockResolvedValue({ version: [2, 3000, 0], isLatest: true });

// Real values from the library - code that branches on DisconnectReason.loggedOut needs the real number, not a stub.
export const DisconnectReason = {
  connectionClosed: 428,
  connectionLost: 408,
  connectionReplaced: 440,
  timedOut: 408,
  loggedOut: 401,
  badSession: 500,
  restartRequired: 515,
  multideviceMismatch: 411,
};

export const initAuthCreds = jest.fn(() => ({}) as any);

export const proto = {
  Message: {
    AppStateSyncKeyData: {
      fromObject: jest.fn((value: unknown) => value),
    },
  },
};

export type WASocket = any;
export type AuthenticationCreds = any;
export type SignalDataTypeMap = any;
