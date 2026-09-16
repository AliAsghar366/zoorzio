import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { NotionApiService } from './notion-api.service';

describe('NotionApiService', () => {
  let service: NotionApiService;
  let httpService: any;

  beforeEach(async () => {
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotionApiService, { provide: HttpService, useValue: httpService }],
    }).compile();

    service = module.get(NotionApiService);
  });

  it('sends the query and sort params, authorized with the given token', async () => {
    httpService.post.mockReturnValue(of({ data: { results: [] } }));

    await service.searchPages('notion-token', 'roadmap');

    const [url, body, opts] = httpService.post.mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/search');
    expect(body).toMatchObject({ query: 'roadmap' });
    expect(opts.headers.Authorization).toBe('Bearer notion-token');
    expect(opts.headers['Notion-Version']).toBeTruthy();
  });

  it('omits the query field entirely when none is given (browse-all mode)', async () => {
    httpService.post.mockReturnValue(of({ data: { results: [] } }));
    await service.searchPages('notion-token');
    const [, body] = httpService.post.mock.calls[0];
    expect(body.query).toBeUndefined();
  });

  it('extracts the title from a page result via its title-type property', async () => {
    httpService.post.mockReturnValue(
      of({
        data: {
          results: [
            {
              id: 'p1',
              object: 'page',
              url: 'https://notion.so/p1',
              last_edited_time: '2026-01-01T00:00:00Z',
              properties: { Name: { type: 'title', title: [{ plain_text: 'Roadmap' }] } },
            },
          ],
        },
      }),
    );

    const result = await service.searchPages('notion-token');

    expect(result).toEqual([
      {
        id: 'p1',
        title: 'Roadmap',
        url: 'https://notion.so/p1',
        lastEditedAt: '2026-01-01T00:00:00Z',
        object: 'page',
      },
    ]);
  });

  it('extracts the title from a database result via its title array', async () => {
    httpService.post.mockReturnValue(
      of({
        data: {
          results: [
            {
              id: 'd1',
              object: 'database',
              url: 'https://notion.so/d1',
              last_edited_time: '2026-01-01T00:00:00Z',
              title: [{ plain_text: 'Tasks DB' }],
            },
          ],
        },
      }),
    );

    const result = await service.searchPages('notion-token');

    expect(result[0].title).toBe('Tasks DB');
  });

  it('propagates errors from the Notion API', async () => {
    httpService.post.mockReturnValue(throwError(() => new Error('401 Unauthorized')));
    await expect(service.searchPages('bad-token')).rejects.toThrow('401 Unauthorized');
  });
});
