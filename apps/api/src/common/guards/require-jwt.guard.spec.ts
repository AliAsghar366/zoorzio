import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequireJwtGuard } from './require-jwt.guard';

describe('RequireJwtGuard', () => {
  let guard: RequireJwtGuard;

  function contextWith(request: any): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new RequireJwtGuard();
  });

  it('should allow a plain JWT-authenticated request', () => {
    expect(guard.canActivate(contextWith({ user: { id: 'u1' } }))).toBe(true);
  });

  it('should reject a request authenticated via API key', () => {
    expect(() =>
      guard.canActivate(contextWith({ user: { id: 'u1' }, apiKey: { id: 'key1' } })),
    ).toThrow(ForbiddenException);
  });
});
