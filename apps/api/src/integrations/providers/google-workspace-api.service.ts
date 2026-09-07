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

  async listRecentFiles(accessToken: string): Promise<DriveFile[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${DRIVE_API}/files`, {
          headers: this.headers(accessToken),
          params: { pageSize: 15, orderBy: 'modifiedTime desc', fields: 'files(id,name,mimeType,webViewLink,modifiedTime)' },
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
