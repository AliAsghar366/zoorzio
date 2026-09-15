import { Test, TestingModule } from '@nestjs/testing';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

describe('BoardsController', () => {
  let controller: BoardsController;
  let boardsService: any;

  beforeEach(async () => {
    boardsService = {
      list: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      rename: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardsController],
      providers: [{ provide: BoardsService, useValue: boardsService }],
    }).compile();

    controller = module.get(BoardsController);
  });

  it('scopes list to the caller', async () => {
    boardsService.list.mockResolvedValue([{ id: 'b1' }]);
    const result = await controller.list({ user: { id: 'user123' } });
    expect(result).toEqual([{ id: 'b1' }]);
    expect(boardsService.list).toHaveBeenCalledWith('user123');
  });

  it('scopes create to the caller', async () => {
    boardsService.create.mockResolvedValue({ id: 'b1', name: 'Trip' });
    const result = await controller.create({ user: { id: 'user123' } }, { name: 'Trip' });
    expect(result).toEqual({ id: 'b1', name: 'Trip' });
    expect(boardsService.create).toHaveBeenCalledWith('user123', 'Trip');
  });

  it('scopes findOne to the caller', async () => {
    boardsService.findOne.mockResolvedValue({ id: 'b1' });
    await controller.findOne({ user: { id: 'user123' } }, 'b1');
    expect(boardsService.findOne).toHaveBeenCalledWith('user123', 'b1');
  });

  it('scopes rename to the caller', async () => {
    boardsService.rename.mockResolvedValue({ id: 'b1', name: 'New' });
    await controller.rename({ user: { id: 'user123' } }, 'b1', { name: 'New' });
    expect(boardsService.rename).toHaveBeenCalledWith('user123', 'b1', 'New');
  });

  it('scopes remove to the caller', async () => {
    boardsService.remove.mockResolvedValue({ success: true });
    const result = await controller.remove({ user: { id: 'user123' } }, 'b1');
    expect(result).toEqual({ success: true });
    expect(boardsService.remove).toHaveBeenCalledWith('user123', 'b1');
  });
});
