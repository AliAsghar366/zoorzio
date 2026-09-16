import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GoogleWorkspaceApiService } from './google-workspace-api.service';

describe('GoogleWorkspaceApiService', () => {
  let service: GoogleWorkspaceApiService;
  let httpService: any;

  beforeEach(async () => {
    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleWorkspaceApiService, { provide: HttpService, useValue: httpService }],
    }).compile();

    service = module.get(GoogleWorkspaceApiService);
  });

  describe('listRecentEmails', () => {
    it('lists message ids then fetches metadata for each, mapping Subject/From headers', async () => {
      httpService.get.mockImplementation((url: string) => {
        if (url.endsWith('/messages')) {
          return of({ data: { messages: [{ id: 'm1' }] } });
        }
        return of({
          data: {
            id: 'm1',
            snippet: 'Hey, quick question...',
            internalDate: '1735689600000',
            payload: {
              headers: [
                { name: 'Subject', value: 'Quick question' },
                { name: 'From', value: 'a@b.com' },
              ],
            },
          },
        });
      });

      const result = await service.listRecentEmails('g-token');

      expect(result).toEqual([
        {
          id: 'm1',
          subject: 'Quick question',
          from: 'a@b.com',
          snippet: 'Hey, quick question...',
          receivedAt: new Date(1735689600000).toISOString(),
        },
      ]);
    });

    it('falls back to "(no subject)" when the Subject header is missing', async () => {
      httpService.get.mockImplementation((url: string) =>
        url.endsWith('/messages')
          ? of({ data: { messages: [{ id: 'm1' }] } })
          : of({ data: { id: 'm1', snippet: '', internalDate: '0', payload: { headers: [] } } }),
      );

      const result = await service.listRecentEmails('g-token');
      expect(result[0].subject).toBe('(no subject)');
    });

    it('propagates errors from the Gmail API', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('401 Unauthorized')));
      await expect(service.listRecentEmails('bad-token')).rejects.toThrow('401 Unauthorized');
    });
  });

  describe('listRecentFiles', () => {
    it('maps Drive file fields to a clean shape', async () => {
      httpService.get.mockReturnValue(
        of({
          data: {
            files: [
              {
                id: 'f1',
                name: 'Roadmap.docx',
                mimeType: 'application/vnd.google-apps.document',
                webViewLink: 'https://drive.google.com/f1',
                modifiedTime: '2026-01-01T00:00:00Z',
              },
            ],
          },
        }),
      );

      const result = await service.listRecentFiles('g-token');

      expect(result).toEqual([
        {
          id: 'f1',
          name: 'Roadmap.docx',
          mimeType: 'application/vnd.google-apps.document',
          url: 'https://drive.google.com/f1',
          modifiedAt: '2026-01-01T00:00:00Z',
        },
      ]);
      const [url, opts] = httpService.get.mock.calls[0];
      expect(url).toBe('https://www.googleapis.com/drive/v3/files');
      expect(opts.headers.Authorization).toBe('Bearer g-token');
    });
  });
});
