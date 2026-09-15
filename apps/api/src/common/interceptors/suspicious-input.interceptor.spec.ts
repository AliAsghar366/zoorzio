import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { SuspiciousInputInterceptor } from './suspicious-input.interceptor';
import { SecurityService } from '../../security/security.service';
import { AuditService } from '../../security/audit.service';

describe('SuspiciousInputInterceptor', () => {
  let interceptor: SuspiciousInputInterceptor;
  let securityService: any;
  let auditService: any;
  let next: CallHandler;

  function contextFor(request: any): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    securityService = { validateRequest: jest.fn() };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    next = { handle: jest.fn().mockReturnValue(of('result')) };
    interceptor = new SuspiciousInputInterceptor(securityService, auditService);
  });

  it('should pass the request through unchanged when input looks normal', (done) => {
    securityService.validateRequest.mockReturnValue(true);
    const request = {
      body: { title: 'Groceries' },
      query: {},
      params: {},
      method: 'POST',
      path: '/lists',
    };

    interceptor.intercept(contextFor(request), next).subscribe((value) => {
      expect(value).toBe('result');
      expect(auditService.log).not.toHaveBeenCalled();
      done();
    });
  });

  it('should audit-log suspicious input for an authenticated user without blocking the request', (done) => {
    securityService.validateRequest.mockReturnValue(false);
    const request = {
      body: { title: "'; DROP TABLE users; --" },
      query: {},
      params: {},
      method: 'POST',
      path: '/lists',
      ip: '203.0.113.5',
      user: { id: 'user1' },
    };

    interceptor.intercept(contextFor(request), next).subscribe((value) => {
      expect(value).toBe('result');
      expect(auditService.log).toHaveBeenCalledWith(
        'user1',
        'SUSPICIOUS_INPUT_DETECTED',
        '/lists',
        expect.objectContaining({ method: 'POST', ip: '203.0.113.5' }),
      );
      done();
    });
  });

  it('should not call AuditService for an unauthenticated suspicious request', (done) => {
    securityService.validateRequest.mockReturnValue(false);
    const request = {
      body: { email: "' OR 1=1 --" },
      query: {},
      params: {},
      method: 'POST',
      path: '/auth/login',
      ip: '203.0.113.5',
    };

    interceptor.intercept(contextFor(request), next).subscribe((value) => {
      expect(value).toBe('result');
      expect(auditService.log).not.toHaveBeenCalled();
      done();
    });
  });

  it('should skip validation entirely for requests with no body, query, or params', (done) => {
    const request = { body: undefined, query: {}, params: {}, method: 'GET', path: '/health' };

    interceptor.intercept(contextFor(request), next).subscribe((value) => {
      expect(value).toBe('result');
      expect(securityService.validateRequest).not.toHaveBeenCalled();
      done();
    });
  });
});
