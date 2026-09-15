import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should transform response', (done) => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/test',
          }),
        }),
      } as unknown as ExecutionContext;

      const callHandler = {
        handle: () => of({ data: 'test' }),
      } as CallHandler;

      const result$ = interceptor.intercept(context, callHandler);

      result$.subscribe({
        next: (value) => {
          expect(value).toHaveProperty('success', true);
          expect(value).toHaveProperty('data');
          expect(value).toHaveProperty('timestamp');
          expect(value).toHaveProperty('path', '/api/test');
          done();
        },
        error: done,
      });
    });
  });
});
