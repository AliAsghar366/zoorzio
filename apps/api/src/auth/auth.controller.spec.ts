import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RateLimitService } from '../security/rate-limit.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      validateUser: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        // RateLimitGuard is referenced via @UseGuards() metadata on several
        // routes; Nest resolves its dependencies when compiling the testing
        // module even though the guard never actually executes here.
        { provide: RateLimitService, useValue: { checkLimit: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        name: 'Test User',
        acceptedPrivacyPolicy: true,
      };
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };

      const expectedResponse = {
        user: { id: 'user123', email: registerDto.email },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto, req);

      expect(result).toEqual(expectedResponse);
      expect(authService.register).toHaveBeenCalledWith(
        registerDto,
        req.ip,
        req.headers['user-agent'],
      );
    });
  });

  describe('login', () => {
    it('should login user', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
      };

      const expectedResponse = {
        user: { id: 'user123', email: loginDto.email },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      authService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens', async () => {
      const req = {
        body: { refreshToken: 'refresh-token' },
      };

      const expectedResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshTokens.mockResolvedValue(expectedResponse);

      const result = await controller.refreshTokens(req);

      expect(result).toEqual(expectedResponse);
      expect(authService.refreshTokens).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('logout', () => {
    it('should logout user', async () => {
      const req = { user: { id: 'user123' } };
      const body = { refreshToken: 'refresh-token' };

      const expectedResponse = { success: true };

      authService.logout.mockResolvedValue(expectedResponse);

      const result = await controller.logout(req, body);

      expect(result).toEqual(expectedResponse);
      expect(authService.logout).toHaveBeenCalledWith('user123', 'refresh-token');
    });
  });

  describe('forgotPassword', () => {
    it('should delegate to the service', async () => {
      const dto = { email: 'test@example.com' };
      const expectedResponse = {
        message: "If that email is registered, we've sent password reset instructions.",
      };
      authService.forgotPassword.mockResolvedValue(expectedResponse);

      const result = await controller.forgotPassword(dto);

      expect(result).toEqual(expectedResponse);
      expect(authService.forgotPassword).toHaveBeenCalledWith(dto.email);
    });
  });

  describe('resetPassword', () => {
    it('should delegate to the service', async () => {
      const dto = { token: 'raw-token', newPassword: 'NewPassword123!' };
      authService.resetPassword.mockResolvedValue({ success: true });

      const result = await controller.resetPassword(dto);

      expect(result).toEqual({ success: true });
      expect(authService.resetPassword).toHaveBeenCalledWith(dto.token, dto.newPassword);
    });
  });

  describe('getMe', () => {
    it('should get current user', async () => {
      const req = {
        user: { id: 'user123' },
      };

      const expectedResponse = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      authService.validateUser.mockResolvedValue(expectedResponse);

      const result = await controller.getMe(req);

      expect(result).toEqual(expectedResponse);
      expect(authService.validateUser).toHaveBeenCalledWith('user123');
    });
  });
});
