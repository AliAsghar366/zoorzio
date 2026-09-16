import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GitHubApiService } from './github-api.service';

describe('GitHubApiService', () => {
  let service: GitHubApiService;
  let httpService: any;

  beforeEach(async () => {
    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubApiService, { provide: HttpService, useValue: httpService }],
    }).compile();

    service = module.get(GitHubApiService);
  });

  describe('listRepos', () => {
    it('maps GitHub repo fields to a clean shape, authorized with the given token', async () => {
      httpService.get.mockReturnValue(
        of({
          data: [
            {
              id: 1,
              name: 'anchor',
              full_name: 'zeesha/anchor',
              private: true,
              html_url: 'https://github.com/zeesha/anchor',
              stargazers_count: 3,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      );

      const result = await service.listRepos('gh-token');

      expect(result).toEqual([
        {
          id: 1,
          name: 'anchor',
          fullName: 'zeesha/anchor',
          private: true,
          url: 'https://github.com/zeesha/anchor',
          stars: 3,
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]);
      const [url, opts] = httpService.get.mock.calls[0];
      expect(url).toBe('https://api.github.com/user/repos');
      expect(opts.headers.Authorization).toBe('Bearer gh-token');
    });

    it('propagates errors from the GitHub API', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('401 Unauthorized')));
      await expect(service.listRepos('bad-token')).rejects.toThrow('401 Unauthorized');
    });
  });

  describe('listAssignedIssues', () => {
    it('maps issues and filters out pull requests', async () => {
      httpService.get.mockReturnValue(
        of({
          data: [
            {
              id: 10,
              title: 'Fix bug',
              number: 5,
              repository: { full_name: 'zeesha/anchor' },
              html_url: 'https://github.com/zeesha/anchor/issues/5',
              state: 'open',
              updated_at: '2026-01-02T00:00:00Z',
            },
            {
              id: 11,
              title: 'A PR, not an issue',
              pull_request: {},
              number: 6,
              repository: { full_name: 'zeesha/anchor' },
              html_url: 'x',
              state: 'open',
              updated_at: '2026-01-02T00:00:00Z',
            },
          ],
        }),
      );

      const result = await service.listAssignedIssues('gh-token');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 10,
        title: 'Fix bug',
        number: 5,
        repo: 'zeesha/anchor',
        url: 'https://github.com/zeesha/anchor/issues/5',
        state: 'open',
        updatedAt: '2026-01-02T00:00:00Z',
      });
    });
  });
});
