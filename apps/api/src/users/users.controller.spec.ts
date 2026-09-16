import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: any;

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      update: jest.fn(),
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
      getStats: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: { id: 'user123' } };

      const expectedProfile = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      usersService.findById.mockResolvedValue(expectedProfile);

      const result = await controller.getProfile(req);

      expect(result).toEqual(expectedProfile);
      expect(usersService.findById).toHaveBeenCalledWith('user123');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const req = { user: { id: 'user123' } };
      const body = {
        name: 'Updated Name',
        phone: '+923007654321',
      };

      const expectedProfile = {
        id: 'user123',
        ...body,
      };

      usersService.update.mockResolvedValue(expectedProfile);

      const result = await controller.updateProfile(req, body);

      expect(result).toEqual(expectedProfile);
      expect(usersService.update).toHaveBeenCalledWith('user123', body);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const req = { user: { id: 'user123' } };

      const expectedPreferences = {
        aiTone: 'professional',
        notifications: { email: true, push: true },
      };

      usersService.getPreferences.mockResolvedValue(expectedPreferences);

      const result = await controller.getPreferences(req);

      expect(result).toEqual(expectedPreferences);
      expect(usersService.getPreferences).toHaveBeenCalledWith('user123');
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const req = { user: { id: 'user123' } };
      const body = {
        aiTone: 'friendly',
        notifications: { email: true, push: false },
      };

      const expectedPreferences = {
        aiTone: 'friendly',
        notifications: { email: true, push: false },
      };

      usersService.updatePreferences.mockResolvedValue(expectedPreferences);

      const result = await controller.updatePreferences(req, body);

      expect(result).toEqual(expectedPreferences);
      expect(usersService.updatePreferences).toHaveBeenCalledWith('user123', body);
    });
  });

  describe('getStats', () => {
    it('should return user stats', async () => {
      const req = { user: { id: 'user123' } };

      const expectedStats = {
        memories: 150,
        tasks: 50,
        calendars: 3,
        channels: 5,
      };

      usersService.getStats.mockResolvedValue(expectedStats);

      const result = await controller.getStats(req);

      expect(result).toEqual(expectedStats);
      expect(usersService.getStats).toHaveBeenCalledWith('user123');
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account', async () => {
      const req = { user: { id: 'user123' } };

      const expectedResponse = { success: true };

      usersService.delete.mockResolvedValue(expectedResponse);

      const result = await controller.deleteAccount(req);

      expect(result).toEqual(expectedResponse);
      expect(usersService.delete).toHaveBeenCalledWith('user123');
    });
  });
});
