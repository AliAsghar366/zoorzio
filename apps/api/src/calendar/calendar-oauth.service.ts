import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
/**
 * One Google grant covers everything the assistant does on a user's behalf:
 * their calendar, plus sending and reading mail. Kept as a single consent
 * screen deliberately - splitting Gmail into its own connection would mean two
 * near-identical "Connect Google" buttons for what users think of as one
 * account. gmail.send is send-only; gmail.readonly is what makes searching and
 * reading a specific message possible.
 */
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const OUTLOOK_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const OUTLOOK_SCOPES = ['offline_access', 'Calendars.ReadWrite'];

interface OAuthState {
  userId: string;
  provider: 'google' | 'outlook';
}

interface ExchangedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires - stored so it can be refreshed before use rather than after a 401. */
  expiresIn?: number;
}

/**
 * Builds provider consent-screen URLs and exchanges authorization codes for
 * tokens. The `state` param carries a short-lived signed JWT (not the user's
 * own session token) identifying who's connecting, because the OAuth
 * callback is a plain browser redirect with no Authorization header.
 */
@Injectable()
export class CalendarOAuthService {
  private readonly logger = new Logger(CalendarOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly http: HttpService,
  ) {}

  isGoogleConfigured(): boolean {
    return !!(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET'));
  }

  isOutlookConfigured(): boolean {
    return !!(this.config.get('OUTLOOK_CLIENT_ID') && this.config.get('OUTLOOK_CLIENT_SECRET'));
  }

  private signState(state: OAuthState): string {
    return this.jwtService.sign(state, { expiresIn: '10m' });
  }

  verifyState(token: string): OAuthState {
    try {
      return this.jwtService.verify<OAuthState>(token);
    } catch {
      throw new BadRequestException(
        'Invalid or expired calendar-connect link. Please try connecting again.',
      );
    }
  }

  buildGoogleAuthUrl(userId: string): string {
    if (!this.isGoogleConfigured()) {
      throw new BadRequestException('Google Calendar is not configured on this server yet.');
    }
    const params = new URLSearchParams({
      client_id: this.config.get('GOOGLE_CLIENT_ID')!,
      redirect_uri: this.config.get('GOOGLE_REDIRECT_URI')!,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES.join(' '),
      state: this.signState({ userId, provider: 'google' }),
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  buildOutlookAuthUrl(userId: string): string {
    if (!this.isOutlookConfigured()) {
      throw new BadRequestException('Outlook Calendar is not configured on this server yet.');
    }
    const params = new URLSearchParams({
      client_id: this.config.get('OUTLOOK_CLIENT_ID')!,
      redirect_uri: this.config.get('OUTLOOK_REDIRECT_URI')!,
      response_type: 'code',
      response_mode: 'query',
      scope: OUTLOOK_SCOPES.join(' '),
      state: this.signState({ userId, provider: 'outlook' }),
    });
    return `${OUTLOOK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeGoogleCode(code: string): Promise<ExchangedTokens> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          GOOGLE_TOKEN_URL,
          new URLSearchParams({
            code,
            client_id: this.config.get('GOOGLE_CLIENT_ID')!,
            client_secret: this.config.get('GOOGLE_CLIENT_SECRET')!,
            redirect_uri: this.config.get('GOOGLE_REDIRECT_URI')!,
            grant_type: 'authorization_code',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token ?? '',
        expiresIn:
          typeof response.data.expires_in === 'number' ? response.data.expires_in : undefined,
      };
    } catch (error) {
      this.logger.error('Google token exchange failed', error);
      throw new BadRequestException('Failed to complete Google sign-in. Please try again.');
    }
  }

  async exchangeOutlookCode(code: string): Promise<ExchangedTokens> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          OUTLOOK_TOKEN_URL,
          new URLSearchParams({
            code,
            client_id: this.config.get('OUTLOOK_CLIENT_ID')!,
            client_secret: this.config.get('OUTLOOK_CLIENT_SECRET')!,
            redirect_uri: this.config.get('OUTLOOK_REDIRECT_URI')!,
            grant_type: 'authorization_code',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token ?? '',
      };
    } catch (error) {
      this.logger.error('Outlook token exchange failed', error);
      throw new BadRequestException('Failed to complete Outlook sign-in. Please try again.');
    }
  }
}
