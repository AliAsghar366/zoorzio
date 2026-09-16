import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption.service';
import { RateLimitService } from './rate-limit.service';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SecurityService', () => {
  let service: SecurityService;
  let encryption: any;
  let rateLimit: any;
  let audit: any;
  let prisma: any;
  let config: any;

  beforeEach(async () => {
    encryption = {
      encrypt: jest.fn().mockResolvedValue('encrypted'),
      decrypt: jest.fn().mockResolvedValue('decrypted'),
      hashPassword: jest.fn().mockResolvedValue('hashed'),
      verifyPassword: jest.fn().mockResolvedValue(true),
      hashApiKey: jest.fn().mockResolvedValue('hashed-api-key'),
    };

    rateLimit = {
      checkLimit: jest.fn().mockResolvedValue(true),
      getInfo: jest.fn().mockResolvedValue({ remaining: 100, resetTime: Date.now() }),
    };

    audit = {
      log: jest.fn(),
      getLogs: jest.fn().mockResolvedValue([]),
    };

    prisma = {
      apiKey: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
      },
    };

    config = { get: jest.fn().mockReturnValue('') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        { provide: EncryptionService, useValue: encryption },
        { provide: RateLimitService, useValue: rateLimit },
        { provide: AuditService, useValue: audit },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Encryption', () => {
    it('should encrypt data', async () => {
      const result = await service.encryptData('sensitive data');
      expect(result).toBe('encrypted');
      expect(encryption.encrypt).toHaveBeenCalledWith('sensitive data');
    });

    it('should decrypt data', async () => {
      const result = await service.decryptData('encrypted');
      expect(result).toBe('decrypted');
      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted');
    });

    it('should hash password', async () => {
      const result = await service.hashPassword('password123');
      expect(result).toBe('hashed');
      expect(encryption.hashPassword).toHaveBeenCalledWith('password123');
    });

    it('should verify password', async () => {
      const result = await service.verifyPassword('password123', 'hashed');
      expect(result).toBe(true);
      expect(encryption.verifyPassword).toHaveBeenCalledWith('password123', 'hashed');
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limit', async () => {
      const result = await service.checkRateLimit('key', 100, 60000);
      expect(result).toBe(true);
      expect(rateLimit.checkLimit).toHaveBeenCalledWith('key', 100, 60000);
    });

    it('should get rate limit info', async () => {
      const result = await service.getRateLimitInfo('key');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetTime');
    });
  });

  describe('Audit Logging', () => {
    it('should log action', async () => {
      await service.logAction('user123', 'LOGIN', 'auth', { ip: '127.0.0.1' });
      expect(audit.log).toHaveBeenCalledWith('user123', 'LOGIN', 'auth', { ip: '127.0.0.1' });
    });

    it('should get audit logs', async () => {
      const result = await service.getAuditLogs('user123');
      expect(result).toEqual([]);
      expect(audit.getLogs).toHaveBeenCalledWith('user123', undefined, undefined);
    });
  });

  describe('Input Sanitization', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = service.sanitizeInput(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should remove SQL injection attempts', () => {
      const input = "'; DROP TABLE users; --";
      const result = service.sanitizeInput(input);
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
    });

    it('should trim whitespace', () => {
      const input = '  hello  ';
      const result = service.sanitizeInput(input);
      expect(result).toBe('hello');
    });
  });

  // Security headers are handled by `helmet()` in main.ts (see git history for
  // the removed getSecurityHeaders() — it was dead, unused code that would
  // have duplicated/conflicted with helmet's already-correct configuration).

  describe('Request Validation', () => {
    it('should validate normal request', () => {
      const request = { email: 'test@example.com', name: 'John' };
      const result = service.validateRequest(request);
      expect(result).toBe(true);
    });

    it('should detect SQL injection', () => {
      const request = { query: "'; DROP TABLE users; --" };
      const result = service.validateRequest(request);
      expect(result).toBe(false);
    });

    it('should detect XSS attempts', () => {
      const request = { content: '<script>alert("xss")</script>' };
      const result = service.validateRequest(request);
      expect(result).toBe(false);
    });

    it('should detect path traversal', () => {
      const request = { path: '../../../etc/passwd' };
      const result = service.validateRequest(request);
      expect(result).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should return null for an unknown key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      const result = await service.validateApiKey('bad-key');
      expect(result).toBeNull();
    });

    it('should return null for an inactive key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: '1', isActive: false, permissions: {} });
      const result = await service.validateApiKey('some-key');
      expect(result).toBeNull();
    });

    it('should return null for an expired key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: '1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        permissions: {},
      });
      const result = await service.validateApiKey('some-key');
      expect(result).toBeNull();
    });

    it('should return the key details and record usage for a valid key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user123',
        name: 'Test Key',
        isActive: true,
        expiresAt: null,
        permissions: { read: true },
      });
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey('some-key');

      expect(result).toEqual({
        id: '1',
        userId: 'user123',
        name: 'Test Key',
        permissions: { read: true },
      });
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  describe('validateSession', () => {
    it('should return null for an unknown session', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      expect(await service.validateSession('token')).toBeNull();
    });

    it('should return null for an expired session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user123',
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await service.validateSession('token')).toBeNull();
    });

    it('should return session details for a valid session', async () => {
      const expiresAt = new Date(Date.now() + 100000);
      prisma.session.findUnique.mockResolvedValue({ id: '1', userId: 'user123', expiresAt });
      expect(await service.validateSession('token')).toEqual({
        id: '1',
        userId: 'user123',
        expiresAt,
      });
    });
  });

  describe('checkPermission', () => {
    it('should deny when the specific key used has no matching permission', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ isActive: true, permissions: { read: true } });
      expect(await service.checkPermission('key1', 'write')).toBe(false);
    });

    it('should allow when the specific key used grants the action', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        isActive: true,
        permissions: { read: true, write: true },
      });
      expect(await service.checkPermission('key1', 'write')).toBe(true);
    });

    it('should deny for a revoked key even if its stored permissions would allow it', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ isActive: false, permissions: { write: true } });
      expect(await service.checkPermission('key1', 'write')).toBe(false);
    });

    it('should deny for an unknown key id', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      expect(await service.checkPermission('missing-key', 'read')).toBe(false);
    });

    it('should not let a different, more privileged key grant permission for the key actually used', async () => {
      // Regression guard: this used to scan every key belonging to the user
      // (via apiKey.findMany) instead of the one key that authenticated the
      // request, so a leaked read-only key could ride on a separate
      // full-access key. checkPermission must resolve the exact key id only.
      prisma.apiKey.findUnique.mockResolvedValue({
        isActive: true,
        permissions: { read: true, write: false },
      });
      expect(await service.checkPermission('read-only-key', 'write')).toBe(false);
      expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
    });
  });

  describe('IP Validation', () => {
    it('should allow any IP when no allowlist is configured', () => {
      config.get.mockReturnValue('');
      expect(service.isAllowedIP('127.0.0.1')).toBe(true);
      expect(service.isAllowedIP('203.0.113.5')).toBe(true);
    });

    it('should allow only listed IPs once an allowlist is configured', () => {
      config.get.mockReturnValue('203.0.113.5, 198.51.100.9');
      expect(service.isAllowedIP('203.0.113.5')).toBe(true);
      expect(service.isAllowedIP('198.51.100.9')).toBe(true);
      expect(service.isAllowedIP('10.0.0.1')).toBe(false);
    });
  });
});
