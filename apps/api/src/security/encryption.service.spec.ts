import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should encrypt data', async () => {
      const data = 'sensitive data';
      const result = await service.encrypt(data);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).not.toBe(data);
    });

    it('should produce different encrypted values for same input', async () => {
      const data = 'sensitive data';
      const result1 = await service.encrypt(data);
      const result2 = await service.encrypt(data);

      expect(result1).not.toBe(result2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data', async () => {
      const data = 'sensitive data';
      const encrypted = await service.encrypt(data);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(data);
    });
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      const password = 'SecureP@ss123';
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'SecureP@ss123';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecureP@ss123';
      const hash = await service.hashPassword(password);
      const result = await service.verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecureP@ss123';
      const hash = await service.hashPassword(password);
      const result = await service.verifyPassword('WrongPassword', hash);

      expect(result).toBe(false);
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key', async () => {
      const result = await service.generateApiKey();

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('prefix');
      expect(result).toHaveProperty('hash');
      expect(result.key).toBeDefined();
      expect(result.prefix).toBeDefined();
      expect(result.hash).toBeDefined();
    });

    it('should generate unique API keys', async () => {
      const result1 = await service.generateApiKey();
      const result2 = await service.generateApiKey();

      expect(result1.key).not.toBe(result2.key);
    });
  });

  describe('generateToken', () => {
    it('should generate token', () => {
      const token = service.generateToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('sign', () => {
    it('should sign data', () => {
      const data = 'test data';
      const signature = service.sign(data);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });
  });

  describe('verify', () => {
    it('should verify correct signature', () => {
      const data = 'test data';
      const signature = service.sign(data);
      const result = service.verify(data, signature);

      expect(result).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const data = 'test data';
      const signature = service.sign(data);
      const result = service.verify('different data', signature);

      expect(result).toBe(false);
    });
  });
});
