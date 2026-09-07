import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationType } from '@anchor/database';

export type IntegrationProvider = 'github' | 'notion' | 'google_workspace' | 'slack';

interface ProviderConfig {
  type: IntegrationType;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv: string;
  extraAuthParams?: Record<string, string>;
  tokenAuth: 'body' | 'basic';
  accessTokenField: string;
  refreshTokenField?: string;
}

const PROVIDERS: Record<IntegrationProvider, ProviderConfig> = {
  github: {
    type: IntegrationType.GITHUB,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'repo read:user',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    redirectUriEnv: 'GITHUB_REDIRECT_URI',
    tokenAuth: 'body',
    accessTokenField: 'access_token',
  },
  notion: {
    type: IntegrationType.NOTION,
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scope: '',
    clientIdEnv: 'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
    redirectUriEnv: 'NOTION_REDIRECT_URI',
    extraAuthParams: { owner: 'user', response_type: 'code' },
    tokenAuth: 'basic',
    accessTokenField: 'access_token',
  },
  google_workspace: {
    type: IntegrationType.GOOGLE_WORKSPACE,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    redirectUriEnv: 'GOOGLE_WORKSPACE_REDIRECT_URI',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    tokenAuth: 'body',
    accessTokenField: 'access_token',
    refreshTokenField: 'refresh_token',
  },
  slack: {
    type: IntegrationType.SLACK,
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scope: 'channels:read chat:write',
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    redirectUriEnv: 'SLACK_TEAM_REDIRECT_URI',
    tokenAuth: 'body',
    accessTokenField: 'access_token',
  },
};

interface OAuthState {
  userId: string;
  provider: IntegrationProvider;
}

/**
 * Generic OAuth2 authorization-code flow for the "connect a productivity
 * tool" integrations hub (GitHub, Notion, Google Workspace, team Slack) -
 * distinct from ChannelLinkingService/CalendarOAuthService, which cover
 * personal messaging channels and calendar sync respectively. Each provider
 * differs only in a handful of details (token-exchange auth style, response
 * field names), captured in the PROVIDERS config above.
 */
@Injectable()
export class IntegrationsOAuthService {
  private readonly logger = new Logger(IntegrationsOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly http: HttpService,
  ) {}

  private cfg(provider: IntegrationProvider): ProviderConfig {
    return PROVIDERS[provider];
  }

  isConfigured(provider: IntegrationProvider): boolean {
    const cfg = this.cfg(provider);
    return !!(this.config.get(cfg.clientIdEnv) && this.config.get(cfg.clientSecretEnv));
  }

  buildAuthUrl(provider: IntegrationProvider, userId: string): string {
    const cfg = this.cfg(provider);
    if (!this.isConfigured(provider)) {
      throw new BadRequestException(`${provider} is not configured on this server yet.`);
    }

    const state = this.jwtService.sign({ userId, provider } as OAuthState, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: this.config.get(cfg.clientIdEnv)!,
      redirect_uri: this.config.get(cfg.redirectUriEnv)!,
      response_type: 'code',
      state,
      ...(cfg.scope ? { scope: cfg.scope } : {}),
      ...(cfg.extraAuthParams || {}),
    });
    return `${cfg.authUrl}?${params.toString()}`;
  }

  verifyState(token: string): OAuthState {
    try {
      return this.jwtService.verify<OAuthState>(token);
    } catch {
      throw new BadRequestException('Invalid or expired connect link. Please try connecting again.');
    }
  }

  async exchangeCode(provider: IntegrationProvider, code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn?: number; raw: any }> {
    const cfg = this.cfg(provider);
    const clientId = this.config.get<string>(cfg.clientIdEnv)!;
    const clientSecret = this.config.get<string>(cfg.clientSecretEnv)!;
    const redirectUri = this.config.get<string>(cfg.redirectUriEnv)!;

    const body: Record<string, string> = { grant_type: 'authorization_code', code, redirect_uri: redirectUri };
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    if (cfg.tokenAuth === 'basic') {
      headers.Authorization = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    } else {
      body.client_id = clientId;
      body.client_secret = clientSecret;
    }

    try {
      const response = await firstValueFrom(
        this.http.post(cfg.tokenUrl, new URLSearchParams(body).toString(), { headers }),
      );

      if (response.data?.ok === false) {
        throw new Error(response.data.error || 'provider returned ok:false');
      }

      const accessToken = response.data[cfg.accessTokenField];
      if (!accessToken) {
        throw new Error('No access token in provider response');
      }

      return {
        accessToken,
        refreshToken: cfg.refreshTokenField ? response.data[cfg.refreshTokenField] || '' : '',
        expiresIn: typeof response.data.expires_in === 'number' ? response.data.expires_in : undefined,
        raw: response.data,
      };
    } catch (error) {
      this.logger.error(`${provider} token exchange failed`, error);
      throw new BadRequestException(`Failed to complete ${provider} connection. Please try again.`);
    }
  }

  /** Google access tokens expire hourly; exchanges the stored refresh token for a fresh one. */
  async refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const cfg = this.cfg('google_workspace');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.get<string>(cfg.clientIdEnv)!,
      client_secret: this.config.get<string>(cfg.clientSecretEnv)!,
    });

    try {
      const response = await firstValueFrom(
        this.http.post(cfg.tokenUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        }),
      );
      return { accessToken: response.data.access_token, expiresIn: response.data.expires_in ?? 3600 };
    } catch (error) {
      this.logger.error('Google token refresh failed', error);
      throw new BadRequestException('Your Google Workspace connection expired. Please reconnect it.');
    }
  }
}
