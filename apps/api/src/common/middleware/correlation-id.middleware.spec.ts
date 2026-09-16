import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should add correlation ID to request and response', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: {} as Record<string, string>,
      };
      const res = {
        setHeader: jest.fn(),
        locals: {},
        on: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req as any, res as any, next);

      expect((req as any).correlationId).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', expect.any(String));
      expect(next).toHaveBeenCalled();
    });

    it('should use existing correlation ID if provided', () => {
      const existingId = 'existing-correlation-id';
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: { 'x-correlation-id': existingId } as Record<string, string>,
      };
      const res = {
        setHeader: jest.fn(),
        locals: {},
        on: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req as any, res as any, next);

      expect(req.headers['x-correlation-id']).toBe(existingId);
      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', existingId);
    });

    it('should use request ID if no correlation ID', () => {
      const requestId = 'request-id-123';
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: { 'x-request-id': requestId } as Record<string, string>,
      };
      const res = {
        setHeader: jest.fn(),
        locals: {},
        on: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req as any, res as any, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', requestId);
    });
  });
});
