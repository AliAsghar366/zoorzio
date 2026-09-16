import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userPreferences: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      memory: {
        count: jest.fn(),
      },
      task: {
        count: jest.fn(),
      },
      calendar: {
        count: jest.fn(),
      },
      channel: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user if exists', async () => {
      const expectedUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await service.findById('user123');

      expect(result).toEqual(expectedUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updateData = { name: 'Updated Name' };
      const expectedUser = {
        id: 'user123',
        ...updateData,
      };

      prisma.user.findUnique.mockResolvedValue({ id: 'user123' });
      prisma.user.update.mockResolvedValue(expectedUser);

      const result = await service.update('user123', updateData);

      expect(result).toEqual(expectedUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return user statistics', async () => {
      prisma.memory.count.mockResolvedValue(100);
      prisma.task.count.mockResolvedValue(50);
      prisma.calendar.count.mockResolvedValue(3);
      prisma.channel.count.mockResolvedValue(5);

      const result = await service.getStats('user123');

      expect(result).toEqual({
        memories: 100,
        tasks: 50,
        calendars: 3,
        channels: 5,
      });
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user123' });
      prisma.user.delete.mockResolvedValue({});

      const result = await service.delete('user123');

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
