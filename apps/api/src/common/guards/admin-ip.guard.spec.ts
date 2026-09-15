import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminIpGuard } from './admin-ip.guard';
import { SecurityService } from '../../security/security.service';

describe('AdminIpGuard', () => {
  let guard: AdminIpGuard;
  let securityService: any;

  function contextWithIp(ip: string): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ ip }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    securityService = { isAllowedIP: jest.fn() } as unknown as SecurityService;
    guard = new AdminIpGuard(securityService);
  });

  it('should allow the request when the IP is allowed', () => {
    securityService.isAllowedIP.mockReturnValue(true);
    expect(guard.canActivate(contextWithIp('203.0.113.5'))).toBe(true);
  });

  it('should throw ForbiddenException when the IP is not allowed', () => {
    securityService.isAllowedIP.mockReturnValue(false);
    expect(() => guard.canActivate(contextWithIp('10.0.0.1'))).toThrow(ForbiddenException);
  });
});
