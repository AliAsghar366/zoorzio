import * as crypto from 'crypto';

export function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function hashString(str: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(str).digest('hex');
}

export function hmacSign(data: string, secret: string, algorithm: string = 'sha256'): string {
  return crypto.createHmac(algorithm, secret).update(data).digest('hex');
}

export function hmacVerify(data: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean {
  const expectedSignature = hmacSign(data, secret, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
}

export function generateSalt(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

export function deriveKey(password: string, salt: string, iterations: number = 10000, keyLength: number = 64): string {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha512').toString('hex');
}

export function generateIV(length: number = 16): Buffer {
  return crypto.randomBytes(length);
}

export function encrypt_aes256(data: string, key: string, iv: Buffer): { encrypted: string; authTag: string } {
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, authTag };
}

export function decrypt_aes256(encryptedData: string, key: string, iv: Buffer, authTag: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = generateRandomString(32);
  const prefix = key.substring(0, 8);
  const hash = hashString(key);
  return { key, prefix, hash };
}

export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
