import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  modifiedAt: string;
}

@Injectable()
export class GoogleWorkspaceApiService {
  private readonly logger = new Logger(GoogleWorkspaceApiService.name);

  constructor(private readonly http: HttpService) {}

  private headers(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async listRecentEmails(accessToken: string): Promise<GmailMessage[]> {
    try {
      const listResponse = await firstValueFrom(
        this.http.get(`${GMAIL_API}/users/me/messages`, {
          headers: this.headers(accessToken),
          params: { maxResults: 10 },
        }),
      );
      const ids: string[] = (listResponse.data.messages || []).map((m: any) => m.id);

      const messages = await Promise.all(
        ids.map((id) =>
          firstValueFrom(
            this.http.get(`${GMAIL_API}/users/me/messages/${id}`, {
              headers: this.headers(accessToken),
              params: { format: 'metadata', metadataHeaders: ['Subject', 'From'] },
            }),
          ),
        ),
      );

      return messages.map(({ data }) => {
        const headers = data.payload?.headers || [];
        const find = (name: string) => headers.find((h: any) => h.name === name)?.value || '';
        return {
          id: data.id,
          subject: find('Subject') || '(no subject)',
          from: find('From'),
          snippet: data.snippet || '',
          receivedAt: new Date(Number(data.internalDate)).toISOString(),
        };
      });
    } catch (error) {
      this.logger.error('Failed to list Gmail messages', error);
      throw error;
    }
  }

  /**
   * Sends a real email from the user's Gmail account and returns Gmail's own
   * message id. Anything reported to the user as "sent" is only said after
   * this resolves.
   *
   * Gmail takes a raw RFC 2822 message, base64url-encoded. Subject is
   * RFC 2047-encoded so non-ASCII subjects don't arrive mangled.
   */
  async sendEmail(
    accessToken: string,
    { to, subject, body }: { to: string; subject: string; body: string },
  ): Promise<{ id: string; threadId: string }> {
    const mime = [
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n');

    const raw = Buffer.from(mime, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${GMAIL_API}/users/me/messages/send`,
          { raw },
          { headers: this.headers(accessToken) },
        ),
      );
      return { id: response.data.id, threadId: response.data.threadId };
    } catch (error) {
      this.logger.error('Failed to send Gmail message', error);
      throw error;
    }
  }

  /** Searches the user's mailbox using Gmail's own query syntax (e.g. `from:ahmed newer_than:7d`). */
  async searchMessages(
    accessToken: string,
    query: string,
    maxResults = 10,
  ): Promise<GmailMessage[]> {
    try {
      const listResponse = await firstValueFrom(
        this.http.get(`${GMAIL_API}/users/me/messages`, {
          headers: this.headers(accessToken),
          params: { q: query, maxResults },
        }),
      );

      const ids: string[] = (listResponse.data.messages || []).map((m: any) => m.id);
      return this.hydrateMessages(accessToken, ids);
    } catch (error) {
      this.logger.error('Failed to search Gmail messages', error);
      throw error;
    }
  }

  /** Full message including its plain-text body, for when the user asks what an email actually says. */
  async getMessage(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessage & { body: string }> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GMAIL_API}/users/me/messages/${encodeURIComponent(messageId)}`, {
          headers: this.headers(accessToken),
          params: { format: 'full' },
        }),
      );

      const { data } = response;
      const headers = data.payload?.headers || [];
      const find = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

      return {
        id: data.id,
        subject: find('Subject') || '(no subject)',
        from: find('From'),
        snippet: data.snippet || '',
        receivedAt: new Date(Number(data.internalDate)).toISOString(),
        body: extractPlainTextBody(data.payload) || data.snippet || '',
      };
    } catch (error) {
      this.logger.error('Failed to fetch Gmail message', error);
      throw error;
    }
  }

  /** Gmail's list endpoint returns ids only, so each message is fetched for its headers. */
  private async hydrateMessages(accessToken: string, ids: string[]): Promise<GmailMessage[]> {
    const messages = await Promise.all(
      ids.map((id) =>
        firstValueFrom(
          this.http.get(`${GMAIL_API}/users/me/messages/${id}`, {
            headers: this.headers(accessToken),
            params: { format: 'metadata', metadataHeaders: ['Subject', 'From'] },
          }),
        ),
      ),
    );

    return messages.map(({ data }) => {
      const headers = data.payload?.headers || [];
      const find = (name: string) => headers.find((h: any) => h.name === name)?.value || '';
      return {
        id: data.id,
        subject: find('Subject') || '(no subject)',
        from: find('From'),
        snippet: data.snippet || '',
        receivedAt: new Date(Number(data.internalDate)).toISOString(),
      };
    });
  }

  async listRecentFiles(accessToken: string): Promise<DriveFile[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${DRIVE_API}/files`, {
          headers: this.headers(accessToken),
          params: {
            pageSize: 15,
            orderBy: 'modifiedTime desc',
            fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
          },
        }),
      );
      return response.data.files.map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        url: f.webViewLink,
        modifiedAt: f.modifiedTime,
      }));
    } catch (error) {
      this.logger.error('Failed to list Drive files', error);
      throw error;
    }
  }
}

/** RFC 2047 encoded-word, so subjects with non-ASCII characters survive the transport. */
function encodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

/**
 * Walks a Gmail payload for the text/plain part. Multipart messages nest
 * (multipart/alternative inside multipart/mixed), so this recurses rather than
 * only checking the top level.
 */
function extractPlainTextBody(payload: any): string {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }

  for (const part of payload.parts || []) {
    const found = extractPlainTextBody(part);
    if (found) return found;
  }

  return '';
}
