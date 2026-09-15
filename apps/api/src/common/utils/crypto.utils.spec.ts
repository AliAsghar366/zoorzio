import {
  generateRandomString,
  generateRandomNumber,
  generateRandomAlphanumeric,
  hashString,
  hmacSign,
  hmacVerify,
  generateSalt,
  deriveKey,
  generateIV,
  encrypt_aes256,
  decrypt_aes256,
  generateApiKey,
  generateToken,
  constantTimeCompare,
} from './crypto.utils';

describe('Crypto Utils', () => {
  describe('generateRandomString', () => {
    it('should generate random string of specified length', () => {
      const str = generateRandomString(16);
      expect(str.length).toBe(32); // hex encoding doubles length
    });

    it('should generate unique strings', () => {
      const str1 = generateRandomString(16);
      const str2 = generateRandomString(16);
      expect(str1).not.toBe(str2);
    });
  });

  describe('generateRandomNumber', () => {
    it('should generate number within range', () => {
      const num = generateRandomNumber(1, 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(10);
    });
  });

  describe('generateRandomAlphanumeric', () => {
    it('should generate alphanumeric string', () => {
      const str = generateRandomAlphanumeric(10);
      expect(str.length).toBe(10);
      expect(str).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('hashString', () => {
    it('should hash string', () => {
      const hash = hashString('test');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
    });

    it('should produce consistent hash', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('test');
      expect(hash1).toBe(hash2);
    });
  });

  describe('hmacSign', () => {
    it('should create HMAC signature', () => {
      const signature = hmacSign('data', 'secret');
      expect(signature).toBeDefined();
    });
  });

  describe('hmacVerify', () => {
    it('should verify correct signature', () => {
      const signature = hmacSign('data', 'secret');
      const result = hmacVerify('data', signature, 'secret');
      expect(result).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const signature = hmacSign('data', 'secret');
      const result = hmacVerify('different data', signature, 'secret');
      expect(result).toBe(false);
    });
  });

  describe('generateSalt', () => {
    it('should generate salt', () => {
      const salt = generateSalt();
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('deriveKey', () => {
    it('should derive key', () => {
      const key = deriveKey('password', 'salt');
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
  });

  describe('generateIV', () => {
    it('should generate IV', () => {
      const iv = generateIV();
      expect(iv).toBeDefined();
      expect(iv.length).toBe(16);
    });
  });

  describe('AES-256-GCM', () => {
    it('should encrypt and decrypt data', () => {
      const key = generateRandomString(32);
      const iv = generateIV();
      const data = 'sensitive data';

      const { encrypted, authTag } = encrypt_aes256(data, key, iv);
      const decrypted = decrypt_aes256(encrypted, key, iv, authTag);

      expect(decrypted).toBe(data);
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key', () => {
      const { key, prefix, hash } = generateApiKey();

      expect(key).toBeDefined();
      expect(prefix).toBeDefined();
      expect(hash).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes hex encoded
      expect(prefix.length).toBe(8);
    });
  });

  describe('generateToken', () => {
    it('should generate token', () => {
      const token = generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      const result = constantTimeCompare('test', 'test');
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = constantTimeCompare('test', 'different');
      expect(result).toBe(false);
    });

    it('should return false for different lengths', () => {
      const result = constantTimeCompare('test', 'testing');
      expect(result).toBe(false);
    });
  });
});
