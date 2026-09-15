import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtOrApiKeyGuard } from './jwt-or-api-key.guard';

describe('JwtOrApiKeyGuard', () => {
  let guard: JwtOrApiKeyGuard;
  let reflector: Reflector;
  let jwtAuthGuard: any;
  let securityService: any;
  let prisma: any;

  function contextFor(headers: Record<string, string>, method = 'GET'): ExecutionContext {
    const request: any = { headers, method };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtAuthGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    securityService = { validateApiKey: jest.fn(), checkPermission: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new JwtOrApiKeyGuard(reflector, jwtAuthGuard, securityService, prisma);
  });

  it('should allow public routes without checking JWT or API key', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('should delegate to JwtAuthGuard when no x-api-key header is present', async () => {
    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    expect(jwtAuthGuard.canActivate).toHaveBeenCalled();
  });

  it('should reject an invalid API key', async () => {
    securityService.validateApiKey.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor({ 'x-api-key': 'bad' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow a read-scoped key on a GET request', async () => {
    securityService.validateApiKey.mockResolvedValue({
      id: 'key1',
      userId: 'u1',
      permissions: { read: true },
    });
    securityService.checkPermission.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'USER',
    });

    const context = contextFor({ 'x-api-key': 'validkey' }, 'GET');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(securityService.checkPermission).toHaveBeenCalledWith('key1', 'read');

    const request = context.switchToHttp().getRequest();
    expect(request.user).toEqual({ id: 'u1', email: 'a@b.com', name: 'A', role: 'USER' });
    expect(request.apiKey.id).toBe('key1');
  });

  it('should reject a read-only key attempting a write (POST) request', async () => {
    securityService.validateApiKey.mockResolvedValue({
      id: 'key1',
      userId: 'u1',
      permissions: { read: true, write: false },
    });
    securityService.checkPermission.mockResolvedValue(false);

    await expect(
      guard.canActivate(contextFor({ 'x-api-key': 'validkey' }, 'POST')),
    ).rejects.toThrow(ForbiddenException);
    expect(securityService.checkPermission).toHaveBeenCalledWith('key1', 'write');
  });

  it('should allow a write-scoped key on a POST request', async () => {
    securityService.validateApiKey.mockResolvedValue({
      id: 'key1',
      userId: 'u1',
      permissions: { read: true, write: true },
    });
    securityService.checkPermission.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'USER',
    });

    await expect(guard.canActivate(contextFor({ 'x-api-key': 'validkey' }, 'POST'))).resolves.toBe(
      true,
    );
  });

  it('should reject when the key is valid but its owning user no longer exists', async () => {
    securityService.validateApiKey.mockResolvedValue({
      id: 'key1',
      userId: 'ghost',
      permissions: { read: true },
    });
    securityService.checkPermission.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor({ 'x-api-key': 'validkey' }, 'GET'))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
