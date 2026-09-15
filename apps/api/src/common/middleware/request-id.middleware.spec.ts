import { Test, TestingModule } from '@nestjs/testing';
import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestIdMiddleware],
    }).compile();

    middleware = module.get<RequestIdMiddleware>(RequestIdMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should add request ID to request and response', () => {
      const req = {
        headers: {} as Record<string, string>,
      };
      const res = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req as any, res as any, next);

      expect(req.headers['x-request-id']).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
      expect(next).toHaveBeenCalled();
    });

    it('should use existing request ID if provided', () => {
      const existingId = 'existing-request-id';
      const req = {
        headers: { 'x-request-id': existingId } as Record<string, string>,
      };
      const res = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req as any, res as any, next);

      expect(req.headers['x-request-id']).toBe(existingId);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', existingId);
    });
  });
});
