import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log request and response', (done) => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            url: '/api/test',
            ip: '127.0.0.1',
            headers: { 'user-agent': 'test-agent' },
            user: { id: 'user123' },
          }),
          getResponse: () => ({
            statusCode: 200,
            setHeader: jest.fn(),
            get: jest.fn().mockReturnValue('100'),
          }),
        }),
      } as unknown as ExecutionContext;

      const callHandler = {
        handle: () => of({ data: 'test' }),
      } as CallHandler;

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (value) => {
          expect(value).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });
  });
});
