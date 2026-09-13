import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');

    if (keyHex) {
      const key = Buffer.from(keyHex, 'hex');
      // Validate at boot rather than letting createCipheriv fail on the first
      // save. A truncated or non-hex value silently yields a short buffer, so
      // without this a bad key looks fine until a user tries to connect a bot.
      if (key.length !== this.keyLength) {
        throw new Error(
          `ENCRYPTION_KEY must be ${this.keyLength} bytes (${this.keyLength * 2} hex characters); ` +
            `the configured value decodes to ${key.length} bytes.`,
        );
      }
      this.encryptionKey = key;
      return;
    }

    // Refuse to boot in production rather than inventing a key. A generated key
    // changes on every restart, which would leave every stored credential
    // permanently undecryptable - silent data loss that only surfaces later.
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new Error(
        'ENCRYPTION_KEY must be set in production. Generate one with: ' +
          "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    this.encryptionKey = crypto.randomBytes(this.keyLength);
    this.logger.warn(
      'Using a generated encryption key - anything encrypted now becomes unreadable when this process restarts. Configure ENCRYPTION_KEY.',
    );
  }

  async encrypt(data: string): Promise<string> {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv, {
        authTagLength: this.tagLength,
      });

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw error;
    }
  }

  async decrypt(encryptedData: string): Promise<string> {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv, {
        authTagLength: this.tagLength,
      });
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw error;
    }
  }

  /**
   * True if `value` was produced by encrypt() - iv:authTag:ciphertext, all hex.
   * Provider credentials never take this shape (Google access tokens start
   * "ya29." and contain dots), so this reliably tells an encrypted value apart
   * from one stored before credentials were encrypted at rest.
   */
  isEncrypted(value: string): boolean {
    return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]*$/.test(value);
  }

  /**
   * Decrypts a stored credential, passing through values that predate
   * encryption instead of failing on them. Those get replaced with an
   * encrypted value the next time the connection is refreshed or reconnected,
   * so existing connections keep working through the transition.
   */
  async decryptIfEncrypted(value: unknown): Promise<string | undefined> {
    if (typeof value !== 'string' || !value) return undefined;
    if (!this.isEncrypted(value)) {
      this.logger.warn(
        'Read a credential that is still stored in plaintext; it will be encrypted on next write.',
      );
      return value;
    }
    return this.decrypt(value);
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    } catch (error) {
      this.logger.error('Password hashing failed', error);
      throw error;
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      this.logger.error('Password verification failed', error);
      return false;
    }
  }

  async generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
    const key = crypto.randomBytes(32).toString('hex');
    const hash = await this.hashApiKey(key);
    const prefix = key.substring(0, 8);

    return { key, hash, prefix };
  }

  async hashApiKey(key: string): Promise<string> {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async verifyApiKey(key: string, hash: string): Promise<boolean> {
    const keyHash = await this.hashApiKey(key);
    return this.constantTimeEquals(keyHash, hash);
  }

  /**
   * Compares two hex digests without leaking how far they matched. Length is
   * checked first because timingSafeEqual throws on mismatched buffers, which
   * would turn a malformed value into a 500 instead of a clean `false`.
   */
  private constantTimeEquals(aHex: string, bHex: string): boolean {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // Token generation
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // HMAC signing
  sign(data: string): string {
    return crypto.createHmac('sha256', this.encryptionKey).update(data).digest('hex');
  }

  verify(data: string, signature: string): boolean {
    return this.constantTimeEquals(signature, this.sign(data));
  }
}
