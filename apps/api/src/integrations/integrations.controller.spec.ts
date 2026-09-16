import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsOAuthService } from './integrations-oauth.service';
import { GitHubApiService } from './providers/github-api.service';
import { NotionApiService } from './providers/notion-api.service';
import { GoogleWorkspaceApiService } from './providers/google-workspace-api.service';
import { SlackTeamApiService } from './providers/slack-team-api.service';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  let integrationsService: any;
  let oauthService: any;
  let githubApi: any;
  let notionApi: any;
  let googleWorkspaceApi: any;
  let slackTeamApi: any;

  function mockResponse() {
    return { redirect: jest.fn() } as any;
  }

  beforeEach(async () => {
    integrationsService = {
      listForUser: jest.fn(),
      connectOAuth: jest.fn(),
      disconnect: jest.fn(),
      getValidAccessToken: jest.fn().mockResolvedValue('a-token'),
    };
    oauthService = {
      buildAuthUrl: jest.fn(),
      verifyState: jest.fn(),
      exchangeCode: jest.fn(),
    };
    githubApi = { listRepos: jest.fn(), listAssignedIssues: jest.fn() };
    notionApi = { searchPages: jest.fn() };
    googleWorkspaceApi = { listRecentEmails: jest.fn(), listRecentFiles: jest.fn() };
    slackTeamApi = { listChannels: jest.fn(), postMessage: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        { provide: IntegrationsService, useValue: integrationsService },
        { provide: IntegrationsOAuthService, useValue: oauthService },
        { provide: ConfigService, useValue: { get: () => 'http://localhost:3000' } },
        { provide: GitHubApiService, useValue: githubApi },
        { provide: NotionApiService, useValue: notionApi },
        { provide: GoogleWorkspaceApiService, useValue: googleWorkspaceApi },
        { provide: SlackTeamApiService, useValue: slackTeamApi },
      ],
    }).compile();

    controller = module.get(IntegrationsController);
  });

  it('scopes list to the caller', async () => {
    integrationsService.listForUser.mockResolvedValue([{ key: 'github' }]);
    const result = await controller.list({ user: { id: 'user123' } });
    expect(result).toEqual([{ key: 'github' }]);
    expect(integrationsService.listForUser).toHaveBeenCalledWith('user123');
  });

  describe('authorize', () => {
    it('returns the consent-screen URL for a valid provider', () => {
      oauthService.buildAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize?...');
      const result = controller.authorize({ user: { id: 'user123' } }, 'github');
      expect(result).toEqual({ url: 'https://github.com/login/oauth/authorize?...' });
      expect(oauthService.buildAuthUrl).toHaveBeenCalledWith('github', 'user123');
    });

    it('rejects an unknown provider', () => {
      expect(() => controller.authorize({ user: { id: 'user123' } }, 'myspace')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('callback', () => {
    it('connects the integration and redirects to a success URL', async () => {
      oauthService.verifyState.mockReturnValue({ userId: 'user123', provider: 'github' });
      oauthService.exchangeCode.mockResolvedValue({ accessToken: 'a', refreshToken: '' });
      const res = mockResponse();

      await controller.callback('github', 'the-code', 'the-state', undefined as any, res);

      expect(integrationsService.connectOAuth).toHaveBeenCalledWith(
        'user123',
        'github',
        'a',
        '',
        undefined,
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/integrations?provider=github&status=connected',
      );
    });

    it('redirects to an error URL when the user denies consent', async () => {
      const res = mockResponse();
      await controller.callback('github', undefined as any, undefined as any, 'access_denied', res);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/integrations?provider=github&status=error&message=access_denied',
      );
      expect(oauthService.exchangeCode).not.toHaveBeenCalled();
    });

    it('redirects to an error URL when the state is invalid', async () => {
      oauthService.verifyState.mockImplementation(() => {
        throw new Error('Invalid or expired connect link. Please try connecting again.');
      });
      const res = mockResponse();

      await controller.callback('github', 'the-code', 'bad-state', undefined as any, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining(
          'http://localhost:3000/integrations?provider=github&status=error&message=',
        ),
      );
      expect(integrationsService.connectOAuth).not.toHaveBeenCalled();
    });
  });

  describe('provider data endpoints', () => {
    it('lists GitHub repos using a token scoped to the caller', async () => {
      githubApi.listRepos.mockResolvedValue([{ id: 1, name: 'repo' }]);
      const result = await controller.githubRepos({ user: { id: 'user123' } });
      expect(result).toEqual([{ id: 1, name: 'repo' }]);
      expect(integrationsService.getValidAccessToken).toHaveBeenCalledWith('user123', 'github');
      expect(githubApi.listRepos).toHaveBeenCalledWith('a-token');
    });

    it('lists GitHub assigned issues', async () => {
      githubApi.listAssignedIssues.mockResolvedValue([{ id: 1, title: 'Fix bug' }]);
      const result = await controller.githubIssues({ user: { id: 'user123' } });
      expect(result).toEqual([{ id: 1, title: 'Fix bug' }]);
      expect(githubApi.listAssignedIssues).toHaveBeenCalledWith('a-token');
    });

    it('searches Notion with the query param', async () => {
      notionApi.searchPages.mockResolvedValue([{ id: 'p1' }]);
      const result = await controller.notionSearch({ user: { id: 'user123' } }, 'roadmap');
      expect(result).toEqual([{ id: 'p1' }]);
      expect(integrationsService.getValidAccessToken).toHaveBeenCalledWith('user123', 'notion');
      expect(notionApi.searchPages).toHaveBeenCalledWith('a-token', 'roadmap');
    });

    it('lists recent Gmail messages', async () => {
      googleWorkspaceApi.listRecentEmails.mockResolvedValue([{ id: 'e1' }]);
      const result = await controller.googleWorkspaceEmails({ user: { id: 'user123' } });
      expect(result).toEqual([{ id: 'e1' }]);
      expect(integrationsService.getValidAccessToken).toHaveBeenCalledWith(
        'user123',
        'google_workspace',
      );
    });

    it('lists recent Drive files', async () => {
      googleWorkspaceApi.listRecentFiles.mockResolvedValue([{ id: 'f1' }]);
      const result = await controller.googleWorkspaceFiles({ user: { id: 'user123' } });
      expect(result).toEqual([{ id: 'f1' }]);
    });

    it('lists Slack channels', async () => {
      slackTeamApi.listChannels.mockResolvedValue([{ id: 'c1', name: 'general' }]);
      const result = await controller.slackChannels({ user: { id: 'user123' } });
      expect(result).toEqual([{ id: 'c1', name: 'general' }]);
      expect(integrationsService.getValidAccessToken).toHaveBeenCalledWith('user123', 'slack');
    });

    it('posts a Slack message to the given channel', async () => {
      slackTeamApi.postMessage.mockResolvedValue({ ts: '123.45' });
      const result = await controller.slackSend(
        { user: { id: 'user123' } },
        { channelId: 'c1', message: 'hi' },
      );
      expect(result).toEqual({ ts: '123.45' });
      expect(slackTeamApi.postMessage).toHaveBeenCalledWith('a-token', 'c1', 'hi');
    });
  });

  it('scopes disconnect to the caller', async () => {
    integrationsService.disconnect.mockResolvedValue({ success: true });
    const result = await controller.disconnect({ user: { id: 'user123' } }, 'notion');
    expect(result).toEqual({ success: true });
    expect(integrationsService.disconnect).toHaveBeenCalledWith('user123', 'notion');
  });
});
