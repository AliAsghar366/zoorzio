import { initAuthCreds, proto, type AuthenticationCreds, type SignalDataTypeMap } from '@whiskeysockets/baileys';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';

const CREDS_KEY = 'creds';

/**
 * Baileys' own `useMultiFileAuthState` writes the pairing credentials and
 * every Signal-protocol key it accumulates to individual files on disk. That
 * doesn't survive a Railway redeploy without a persistent volume, so this
 * reimplements the same shape - `{ state: { creds, keys }, saveCreds }` -
 * against `WhatsAppUnofficialAuthKey` rows instead, encrypted with the same
 * EncryptionService used everywhere else credentials are stored.
 *
 * Key rows are addressed by `"<type>:<id>"` (e.g. `"app-state-sync-key:abc"`);
 * the top-level creds blob lives under the fixed id `"creds"`.
 */
export async function useDatabaseAuthState(prisma: PrismaService, encryption: EncryptionService) {
  const readJson = async <T>(id: string): Promise<T | undefined> => {
    const row = await prisma.whatsAppUnofficialAuthKey.findUnique({ where: { id } });
    if (!row) return undefined;
    const json = await encryption.decrypt(row.encryptedValue);
    return JSON.parse(json, revive) as T;
  };

  const writeJson = async (id: string, value: unknown): Promise<void> => {
    const encryptedValue = await encryption.encrypt(JSON.stringify(value, replace));
    await prisma.whatsAppUnofficialAuthKey.upsert({
      where: { id },
      create: { id, encryptedValue },
      update: { encryptedValue },
    });
  };

  const deleteKey = async (id: string): Promise<void> => {
    await prisma.whatsAppUnofficialAuthKey.deleteMany({ where: { id } });
  };

  const creds: AuthenticationCreds = (await readJson(CREDS_KEY)) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: Record<string, SignalDataTypeMap[T]> = {};
          await Promise.all(
            ids.map(async (id) => {
              const value = await readJson<SignalDataTypeMap[T]>(`${type}:${id}`);
              if (value !== undefined) {
                // app-state-sync-key entries are protobuf messages, not plain
                // JSON - Baileys expects the real class instance back, not a
                // structurally-similar plain object, or signature checks fail.
                result[id] =
                  type === 'app-state-sync-key'
                    ? (proto.Message.AppStateSyncKeyData.fromObject(value as object) as unknown as SignalDataTypeMap[T])
                    : value;
              }
            }),
          );
          return result;
        },
        set: async (data: Partial<Record<keyof SignalDataTypeMap, Record<string, unknown>>>) => {
          const writes: Promise<void>[] = [];
          for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
            for (const id of Object.keys(data[type] ?? {})) {
              const value = data[type]![id];
              writes.push(value ? writeJson(`${type}:${id}`, value) : deleteKey(`${type}:${id}`));
            }
          }
          await Promise.all(writes);
        },
      },
    },
    saveCreds: () => writeJson(CREDS_KEY, creds),
    /** Removes every stored key, including the creds row - used on logout so a fresh QR is required next time. */
    clearAll: async () => {
      await prisma.whatsAppUnofficialAuthKey.deleteMany({});
    },
  };
}

/** Buffers survive JSON.stringify as {type:'Buffer',data:[...]} - restored back into real Buffers on the way in. */
function revive(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && (value as any).type === 'Buffer' && Array.isArray((value as any).data)) {
    return Buffer.from((value as any).data);
  }
  return value;
}

/** Baileys stores plenty of Uint8Array/Buffer fields (keys, signatures) that JSON.stringify would otherwise mangle. */
function replace(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { type: 'Buffer', data: Array.from(value) };
  }
  if (value && typeof value === 'object' && typeof (value as any).toJSON === 'function' && !(value instanceof Date)) {
    return (value as any).toJSON();
  }
  return value;
}
