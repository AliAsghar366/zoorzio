import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../channels/email.service';
import { RateLimitService } from '../security/rate-limit.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let emailService: any;
  let rateLimitService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, fallback?: unknown) => fallback),
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    rateLimitService = {
      checkLimit: jest.fn().mockResolvedValue(true),
      reset: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: RateLimitService, useValue: rateLimitService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        name: 'Test User',
        acceptedPrivacyPolicy: true,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user123',
        email: registerDto.email,
        name: registerDto.name,
      });
      prisma.session.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should persist optional location and avatar when provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user123', email: 'test@example.com' });
      prisma.session.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'SecureP@ss123',
        location: 'Karachi, Pakistan',
        avatar: 'data:image/png;base64,abc123',
        acceptedPrivacyPolicy: true,
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          location: 'Karachi, Pakistan',
          avatar: 'data:image/png;base64,abc123',
        }),
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'Password123!',
          acceptedPrivacyPolicy: true,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
      };

      const hashedPassword = await argon2.hash(loginDto.password);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: loginDto.email,
        passwordHash: hashedPassword,
      });
      prisma.session.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await argon2.hash('correctpassword');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should check the account-level lockout keyed by email before verifying the password', async () => {
      const hashedPassword = await argon2.hash('SecureP@ss123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'Test@Example.com',
        passwordHash: hashedPassword,
      });
      prisma.session.create.mockResolvedValue({});

      await service.login({ email: 'Test@Example.com', password: 'SecureP@ss123' });

      expect(rateLimitService.checkLimit).toHaveBeenCalledWith(
        'login-account:test@example.com',
        10,
        60 * 60 * 1000,
      );
    });

    it('should reject with 429 once the account-level lockout is tripped, without checking the password', async () => {
      rateLimitService.checkLimit.mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        passwordHash: 'irrelevant',
      });

      expect.assertions(2);
      try {
        await service.login({ email: 'test@example.com', password: 'anything' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(429);
      }
    });

    it('should still lock out attempts against an email with no account, without revealing that', async () => {
      rateLimitService.checkLimit.mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'anything' }),
      ).rejects.toThrow(HttpException);
      // No audit entry can be written without a real userId, and none should be attempted.
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should reset the account-level counter after a successful login', async () => {
      const hashedPassword = await argon2.hash('SecureP@ss123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      });
      prisma.session.create.mockResolvedValue({});

      await service.login({ email: 'test@example.com', password: 'SecureP@ss123' });

      expect(rateLimitService.reset).toHaveBeenCalledWith('login-account:test@example.com');
    });

    it('should NOT reset the account-level counter after a failed password attempt', async () => {
      const hashedPassword = await argon2.hash('correctpassword');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(rateLimitService.reset).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout and delete session', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('user123', 'refresh-token');

      expect(result).toEqual({ success: true });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          token: 'refresh-token',
        },
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if exists', async () => {
      const expectedUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };
      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await service.validateUser('user123');

      expect(result).toEqual(expectedUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('nonexistent')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should create a reset token and email it when the user exists and email is configured', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user123', email: 'test@example.com' });
      configService.get.mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'SENDGRID_API_KEY') return 'sg-key';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return fallback;
      });

      const result = await service.forgotPassword('test@example.com');

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user123' }) }),
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'user123',
        'test@example.com',
        expect.any(String),
        expect.stringContaining('http://localhost:3000/reset-password?token='),
      );
      expect(result).toEqual({
        message: "If that email is registered, we've sent password reset instructions.",
      });
    });

    it('should not create a token or reveal whether the email exists when there is no matching user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@example.com');

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "If that email is registered, we've sent password reset instructions.",
      });
    });

    it('should not attempt to send an email when no email provider is configured', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user123', email: 'test@example.com' });
      configService.get.mockImplementation((key: string, fallback?: unknown) => fallback);

      await service.forgotPassword('test@example.com');

      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should update the password, mark the token used, and sign out all sessions', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset1',
        userId: 'user123',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.resetPassword('raw-token', 'NewPassword123!');

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'PASSWORD_RESET' }) }),
      );
    });

    it('should throw BadRequestException for an unknown token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset1',
        userId: 'user123',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('expired-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for an already-used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset1',
        userId: 'user123',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.resetPassword('used-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('impersonate', () => {
    it('should throw NotFoundException for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.impersonate('admin1', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('should refuse to impersonate another admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin2', email: 'a2@b.com', role: 'ADMIN' });
      await expect(service.impersonate('admin1', 'admin2')).rejects.toThrow(ForbiddenException);
    });

    it('should issue a 15-minute access-token-only session and audit-log it under the acting admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user1',
        email: 'user1@b.com',
        name: 'User One',
        role: 'USER',
      });

      const result = await service.impersonate('admin1', 'user1');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user1', email: 'user1@b.com', impersonatedBy: 'admin1' }),
        { expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenCalledTimes(1); // no refresh token issued
      expect(result).toEqual({
        accessToken: 'mock-token',
        user: { id: 'user1', email: 'user1@b.com', name: 'User One', role: 'USER' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin1',
            action: 'ADMIN_IMPERSONATION_STARTED',
            metadata: expect.objectContaining({ targetUserId: 'user1' }),
          }),
        }),
      );
    });
  });
});
