import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: any;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      unreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list notifications scoped to the caller with parsed query params', async () => {
    service.findAll.mockResolvedValue([]);
    await controller.findAll({ user: { id: 'user1' } }, 'true', '10', '5');
    expect(service.findAll).toHaveBeenCalledWith('user1', true, 10, 5);
  });

  it('should default unreadOnly to false when not provided', async () => {
    service.findAll.mockResolvedValue([]);
    await controller.findAll({ user: { id: 'user1' } });
    expect(service.findAll).toHaveBeenCalledWith('user1', false, undefined, undefined);
  });

  it('should get the unread count for the caller', async () => {
    service.unreadCount.mockResolvedValue(2);
    await controller.unreadCount({ user: { id: 'user1' } });
    expect(service.unreadCount).toHaveBeenCalledWith('user1');
  });

  it('should mark a single notification as read for the caller', async () => {
    service.markAsRead.mockResolvedValue({ id: 'n1', isRead: true });
    await controller.markAsRead({ user: { id: 'user1' } }, 'n1');
    expect(service.markAsRead).toHaveBeenCalledWith('user1', 'n1');
  });

  it('should mark all notifications as read for the caller', async () => {
    service.markAllAsRead.mockResolvedValue({ count: 3 });
    await controller.markAllAsRead({ user: { id: 'user1' } });
    expect(service.markAllAsRead).toHaveBeenCalledWith('user1');
  });
});
