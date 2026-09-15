import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

/**
 * `createParamDecorator()` returns a real TS `ParameterDecorator`
 * ((target, key, index) => void), not the underlying (data, ctx) factory -
 * so to unit test the factory logic we have to apply the decorator to a
 * throwaway class and pull the factory back out of Nest's reflected
 * route-args metadata, per Nest's own recommended testing pattern.
 */
function getParamDecoratorFactory(decorator: (...args: any[]) => any) {
  const Decorator = decorator as (...args: unknown[]) => ParameterDecorator;

  class TestDecorator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public test(@Decorator() value: unknown) {}
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  const factory = getParamDecoratorFactory(CurrentUser);

  it('should return user from request', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user123', email: 'test@example.com' },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, context);

    expect(result).toEqual({ id: 'user123', email: 'test@example.com' });
  });

  it('should return specific user property', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user123', email: 'test@example.com' },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory('id', context);

    expect(result).toBe('user123');
  });

  it('should return null if no user', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: null,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(undefined, context);

    expect(result).toBeNull();
  });
});
