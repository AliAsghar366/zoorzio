import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

describe('FriendsController', () => {
  let controller: FriendsController;
  let service: any;

  beforeEach(async () => {
    service = {
      listFriends: jest.fn(),
      listIncomingRequests: jest.fn(),
      getQuota: jest.fn(),
      listReceivedReminders: jest.fn(),
      sendRequest: jest.fn(),
      respond: jest.fn(),
      remove: jest.fn(),
      sendFriendReminder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [{ provide: FriendsService, useValue: service }],
    }).compile();

    controller = module.get<FriendsController>(FriendsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should scope sendRequest to the caller', async () => {
    await controller.sendRequest({ user: { id: 'user1' } }, { targetEmail: 'friend@example.com' });
    expect(service.sendRequest).toHaveBeenCalledWith('user1', {
      targetEmail: 'friend@example.com',
    });
  });

  it('should scope accept to the caller and pass through the friendship id', async () => {
    await controller.accept({ user: { id: 'user1' } }, 'f1');
    expect(service.respond).toHaveBeenCalledWith('user1', 'f1', true);
  });

  it('should scope decline to the caller', async () => {
    await controller.decline({ user: { id: 'user1' } }, 'f1');
    expect(service.respond).toHaveBeenCalledWith('user1', 'f1', false);
  });

  it('should scope remind to the caller and target friend', async () => {
    await controller.remind({ user: { id: 'user1' } }, 'friend1', { message: 'hi' });
    expect(service.sendFriendReminder).toHaveBeenCalledWith('user1', 'friend1', { message: 'hi' });
  });

  it('should scope remove to the caller', async () => {
    await controller.remove({ user: { id: 'user1' } }, 'f1');
    expect(service.remove).toHaveBeenCalledWith('user1', 'f1');
  });

  it('should scope read endpoints to the caller', async () => {
    await controller.listFriends({ user: { id: 'user1' } });
    await controller.listRequests({ user: { id: 'user1' } });
    await controller.getQuota({ user: { id: 'user1' } });
    await controller.listReceivedReminders({ user: { id: 'user1' } });

    expect(service.listFriends).toHaveBeenCalledWith('user1');
    expect(service.listIncomingRequests).toHaveBeenCalledWith('user1');
    expect(service.getQuota).toHaveBeenCalledWith('user1');
    expect(service.listReceivedReminders).toHaveBeenCalledWith('user1');
  });
});
