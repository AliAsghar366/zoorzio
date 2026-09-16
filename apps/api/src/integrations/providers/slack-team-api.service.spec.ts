import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { SlackTeamApiService } from './slack-team-api.service';

describe('SlackTeamApiService', () => {
  let service: SlackTeamApiService;
  let httpService: any;

  beforeEach(async () => {
    httpService = { get: jest.fn(), post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SlackTeamApiService, { provide: HttpService, useValue: httpService }],
    }).compile();

    service = module.get(SlackTeamApiService);
  });

  describe('listChannels', () => {
    it('maps Slack channel fields to a clean shape', async () => {
      httpService.get.mockReturnValue(
        of({ data: { ok: true, channels: [{ id: 'C1', name: 'general', is_member: true }] } }),
      );

      const result = await service.listChannels('slack-token');

      expect(result).toEqual([{ id: 'C1', name: 'general', isMember: true }]);
      const [, opts] = httpService.get.mock.calls[0];
      expect(opts.headers.Authorization).toBe('Bearer slack-token');
    });

    it('treats an ok:false response as a failure even on HTTP 200', async () => {
      httpService.get.mockReturnValue(of({ data: { ok: false, error: 'invalid_auth' } }));
      await expect(service.listChannels('bad-token')).rejects.toThrow('invalid_auth');
    });
  });

  describe('postMessage', () => {
    it('posts to the given channel and returns the message timestamp', async () => {
      httpService.post.mockReturnValue(of({ data: { ok: true, ts: '123.45' } }));

      const result = await service.postMessage('slack-token', 'C1', 'hello team');

      expect(result).toEqual({ ts: '123.45' });
      const [url, body, opts] = httpService.post.mock.calls[0];
      expect(url).toBe('https://slack.com/api/chat.postMessage');
      expect(body).toEqual({ channel: 'C1', text: 'hello team' });
      expect(opts.headers.Authorization).toBe('Bearer slack-token');
    });

    it('throws a BadRequestException when Slack rejects the message (e.g. not_in_channel)', async () => {
      httpService.post.mockReturnValue(of({ data: { ok: false, error: 'not_in_channel' } }));
      await expect(service.postMessage('slack-token', 'C1', 'hi')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates network errors', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network error')));
      await expect(service.postMessage('slack-token', 'C1', 'hi')).rejects.toThrow('network error');
    });
  });
});
