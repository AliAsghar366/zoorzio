import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let service: any;

  beforeEach(async () => {
    service = { create: jest.fn(), list: jest.fn(), revoke: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [{ provide: ApiKeysService, useValue: service }],
    }).compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a key scoped to the caller', async () => {
    service.create.mockResolvedValue({ id: 'key1', key: 'raw' });
    const result = await controller.create({ user: { id: 'user1' } }, { name: 'My key' });
    expect(service.create).toHaveBeenCalledWith('user1', { name: 'My key' });
    expect(result).toEqual({ id: 'key1', key: 'raw' });
  });

  it('should list keys scoped to the caller', async () => {
    service.list.mockResolvedValue([]);
    await controller.list({ user: { id: 'user1' } });
    expect(service.list).toHaveBeenCalledWith('user1');
  });

  it('should revoke a key scoped to the caller', async () => {
    service.revoke.mockResolvedValue({ success: true });
    await controller.revoke({ user: { id: 'user1' } }, 'key1');
    expect(service.revoke).toHaveBeenCalledWith('user1', 'key1');
  });
});
