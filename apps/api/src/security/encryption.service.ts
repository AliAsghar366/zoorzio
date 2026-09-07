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
    const keyHex = this.configService.get('ENCRYPTION_KEY');
    if (keyHex) {
      this.encryptionKey = Buffer.from(keyHex, 'hex');
    } else {
      // Generate a key for development (in production, use KMS)
      this.encryptionKey = crypto.randomBytes(this.keyLength);
      this.logger.warn('Using generated encryption key - configure ENCRYPTION_KEY in production');
    }
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
    return keyHash === hash;
  }

  // Token generation
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // HMAC signing
  sign(data: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(data)
      .digest('hex');
  }

  verify(data: string, signature: string): boolean {
    const expectedSignature = this.sign(data);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }
}
