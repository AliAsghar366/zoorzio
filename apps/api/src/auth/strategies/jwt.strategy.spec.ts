import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user if exists', async () => {
      const payload = {
        sub: 'user123',
        email: 'test@example.com',
      };

      const expectedUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(expectedUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = {
        sub: 'nonexistent',
        email: 'test@example.com',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
