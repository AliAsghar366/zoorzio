import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { IntegrationsOAuthService } from './integrations-oauth.service';

describe('IntegrationsOAuthService', () => {
  let service: IntegrationsOAuthService;
  let config: Record<string, string>;
  let httpService: any;

  beforeEach(async () => {
    config = {
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      GITHUB_REDIRECT_URI: 'http://localhost:3005/api/integrations/github/callback',
      NOTION_CLIENT_ID: 'notion-id',
      NOTION_CLIENT_SECRET: 'notion-secret',
      NOTION_REDIRECT_URI: 'http://localhost:3005/api/integrations/notion/callback',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GOOGLE_WORKSPACE_REDIRECT_URI:
        'http://localhost:3005/api/integrations/google_workspace/callback',
      SLACK_CLIENT_ID: 'slack-id',
      SLACK_CLIENT_SECRET: 'slack-secret',
      SLACK_TEAM_REDIRECT_URI: 'http://localhost:3005/api/integrations/slack/callback',
    };
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsOAuthService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: HttpService, useValue: httpService },
        { provide: JwtService, useValue: new JwtService({ secret: 'test-secret' }) },
      ],
    }).compile();

    service = module.get(IntegrationsOAuthService);
  });

  describe('isConfigured / buildAuthUrl', () => {
    it('reports configured and builds a URL when credentials are set', () => {
      expect(service.isConfigured('github')).toBe(true);
      const url = service.buildAuthUrl('github', 'user-123');
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('gh-id');
      const state = parsed.searchParams.get('state')!;
      expect(service.verifyState(state)).toMatchObject({ userId: 'user-123', provider: 'github' });
    });

    it('throws when a provider is not configured', () => {
      config.GITHUB_CLIENT_ID = '';
      expect(service.isConfigured('github')).toBe(false);
      expect(() => service.buildAuthUrl('github', 'user-123')).toThrow(BadRequestException);
    });

    it('includes Notion-specific extra params (owner=user)', () => {
      const url = service.buildAuthUrl('notion', 'user-123');
      expect(new URL(url).searchParams.get('owner')).toBe('user');
    });

    it('requests offline access for Google Workspace (needs a refresh token)', () => {
      const url = service.buildAuthUrl('google_workspace', 'user-123');
      expect(new URL(url).searchParams.get('access_type')).toBe('offline');
    });
  });

  describe('verifyState', () => {
    it('rejects a garbage token', () => {
      expect(() => service.verifyState('not-a-jwt')).toThrow(BadRequestException);
    });
  });

  describe('exchangeCode', () => {
    it('exchanges a code for GitHub using body-based client auth', async () => {
      httpService.post.mockReturnValue(of({ data: { access_token: 'gh-token' } }));

      const result = await service.exchangeCode('github', 'the-code');

      expect(result.accessToken).toBe('gh-token');
      expect(result.refreshToken).toBe('');
      const [url, body, opts] = httpService.post.mock.calls[0];
      expect(url).toBe('https://github.com/login/oauth/access_token');
      expect(body).toContain('client_id=gh-id');
      expect(opts.headers.Authorization).toBeUndefined();
    });

    it('exchanges a code for Notion using HTTP Basic client auth', async () => {
      httpService.post.mockReturnValue(of({ data: { access_token: 'notion-token' } }));

      const result = await service.exchangeCode('notion', 'the-code');

      expect(result.accessToken).toBe('notion-token');
      const [url, body, opts] = httpService.post.mock.calls[0];
      expect(url).toBe('https://api.notion.com/v1/oauth/token');
      expect(body).not.toContain('client_secret');
      expect(opts.headers.Authorization).toBe(
        'Basic ' + Buffer.from('notion-id:notion-secret').toString('base64'),
      );
    });

    it('captures the refresh token for Google Workspace', async () => {
      httpService.post.mockReturnValue(
        of({ data: { access_token: 'g-token', refresh_token: 'g-refresh' } }),
      );

      const result = await service.exchangeCode('google_workspace', 'the-code');

      expect(result).toEqual(
        expect.objectContaining({ accessToken: 'g-token', refreshToken: 'g-refresh' }),
      );
    });

    it('treats a Slack ok:false response as a failure even on HTTP 200', async () => {
      httpService.post.mockReturnValue(of({ data: { ok: false, error: 'invalid_code' } }));

      await expect(service.exchangeCode('slack', 'bad-code')).rejects.toThrow(BadRequestException);
    });

    it('wraps a network failure in a friendly BadRequestException', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network error')));
      await expect(service.exchangeCode('github', 'the-code')).rejects.toThrow(BadRequestException);
    });

    it('throws when the provider response has no access token', async () => {
      httpService.post.mockReturnValue(of({ data: {} }));
      await expect(service.exchangeCode('github', 'the-code')).rejects.toThrow(BadRequestException);
    });

    it('captures expiresIn when the provider returns one', async () => {
      httpService.post.mockReturnValue(of({ data: { access_token: 'g-token', expires_in: 3599 } }));
      const result = await service.exchangeCode('google_workspace', 'the-code');
      expect(result.expiresIn).toBe(3599);
    });
  });

  describe('refreshGoogleToken', () => {
    it('exchanges a refresh token for a fresh access token', async () => {
      httpService.post.mockReturnValue(
        of({ data: { access_token: 'fresh-token', expires_in: 3600 } }),
      );

      const result = await service.refreshGoogleToken('g-refresh');

      expect(result).toEqual({ accessToken: 'fresh-token', expiresIn: 3600 });
      const [url, body] = httpService.post.mock.calls[0];
      expect(url).toBe('https://oauth2.googleapis.com/token');
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=g-refresh');
    });

    it('wraps a refresh failure in a friendly BadRequestException', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('invalid_grant')));
      await expect(service.refreshGoogleToken('bad-refresh')).rejects.toThrow(BadRequestException);
    });
  });
});
