import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { CalendarOAuthService } from './calendar-oauth.service';

describe('CalendarOAuthService', () => {
  let service: CalendarOAuthService;
  let config: Record<string, string>;
  let httpService: any;

  beforeEach(async () => {
    config = {
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3005/api/calendar/google/callback',
      OUTLOOK_CLIENT_ID: 'outlook-client-id',
      OUTLOOK_CLIENT_SECRET: 'outlook-secret',
      OUTLOOK_REDIRECT_URI: 'http://localhost:3005/api/calendar/outlook/callback',
    };
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarOAuthService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: HttpService, useValue: httpService },
        { provide: JwtService, useValue: new JwtService({ secret: 'test-jwt-secret' }) },
      ],
    }).compile();

    service = module.get(CalendarOAuthService);
  });

  describe('isGoogleConfigured / isOutlookConfigured', () => {
    it('reports true when both client id and secret are set', () => {
      expect(service.isGoogleConfigured()).toBe(true);
      expect(service.isOutlookConfigured()).toBe(true);
    });

    it('reports false when credentials are missing', () => {
      config.GOOGLE_CLIENT_SECRET = '';
      config.OUTLOOK_CLIENT_ID = '';
      expect(service.isGoogleConfigured()).toBe(false);
      expect(service.isOutlookConfigured()).toBe(false);
    });
  });

  describe('buildGoogleAuthUrl', () => {
    it('builds a consent URL carrying a signed state for the given user', () => {
      const url = service.buildGoogleAuthUrl('user-123');
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe('google-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe(config.GOOGLE_REDIRECT_URI);
      expect(parsed.searchParams.get('scope')).toContain('calendar');
      expect(parsed.searchParams.get('access_type')).toBe('offline');
      const state = parsed.searchParams.get('state')!;
      expect(service.verifyState(state)).toMatchObject({ userId: 'user-123', provider: 'google' });
    });

    it('throws when Google is not configured', () => {
      config.GOOGLE_CLIENT_ID = '';
      expect(() => service.buildGoogleAuthUrl('user-123')).toThrow(BadRequestException);
    });
  });

  describe('buildOutlookAuthUrl', () => {
    it('builds a consent URL carrying a signed state for the given user', () => {
      const url = service.buildOutlookAuthUrl('user-456');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('client_id')).toBe('outlook-client-id');
      expect(parsed.searchParams.get('scope')).toContain('Calendars.ReadWrite');
      const state = parsed.searchParams.get('state')!;
      expect(service.verifyState(state)).toMatchObject({ userId: 'user-456', provider: 'outlook' });
    });

    it('throws when Outlook is not configured', () => {
      config.OUTLOOK_CLIENT_SECRET = '';
      expect(() => service.buildOutlookAuthUrl('user-456')).toThrow(BadRequestException);
    });
  });

  describe('verifyState', () => {
    it('rejects a garbage token', () => {
      expect(() => service.verifyState('not-a-real-jwt')).toThrow(BadRequestException);
    });

    it('rejects a state signed with a different secret (cannot be forged)', async () => {
      const otherModule = await Test.createTestingModule({
        providers: [
          CalendarOAuthService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => (key === 'JWT_SECRET' ? 'other-secret' : config[key]),
            },
          },
          { provide: HttpService, useValue: httpService },
          {
            provide: JwtService,
            useValue: new JwtService({ secret: 'a-completely-different-secret' }),
          },
        ],
      }).compile();
      const otherService = otherModule.get<CalendarOAuthService>(CalendarOAuthService);
      const forgedLookingState = otherService.buildGoogleAuthUrl('attacker');
      const state = new URL(forgedLookingState).searchParams.get('state')!;

      expect(() => service.verifyState(state)).toThrow(BadRequestException);
    });
  });

  describe('exchangeGoogleCode', () => {
    it('exchanges an authorization code for tokens', async () => {
      httpService.post.mockReturnValue(
        of({ data: { access_token: 'g-access', refresh_token: 'g-refresh' } }),
      );

      const result = await service.exchangeGoogleCode('the-code');

      expect(result).toEqual({ accessToken: 'g-access', refreshToken: 'g-refresh' });
      const [url, body] = httpService.post.mock.calls[0];
      expect(url).toBe('https://oauth2.googleapis.com/token');
      expect(body).toContain('code=the-code');
      expect(body).toContain('client_id=google-client-id');
    });

    it('defaults refreshToken to an empty string when Google omits it (re-consent)', async () => {
      httpService.post.mockReturnValue(of({ data: { access_token: 'g-access' } }));
      const result = await service.exchangeGoogleCode('the-code');
      expect(result).toEqual({ accessToken: 'g-access', refreshToken: '' });
    });

    it('wraps a failed exchange in a friendly BadRequestException', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network error')));
      await expect(service.exchangeGoogleCode('bad-code')).rejects.toThrow(BadRequestException);
    });
  });

  describe('exchangeOutlookCode', () => {
    it('exchanges an authorization code for tokens', async () => {
      httpService.post.mockReturnValue(
        of({ data: { access_token: 'o-access', refresh_token: 'o-refresh' } }),
      );

      const result = await service.exchangeOutlookCode('the-code');

      expect(result).toEqual({ accessToken: 'o-access', refreshToken: 'o-refresh' });
      const [url] = httpService.post.mock.calls[0];
      expect(url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
    });

    it('wraps a failed exchange in a friendly BadRequestException', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network error')));
      await expect(service.exchangeOutlookCode('bad-code')).rejects.toThrow(BadRequestException);
    });
  });
});
