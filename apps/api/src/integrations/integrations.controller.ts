import { BadRequestException, Body, Controller, Get, Post, Delete, Param, Query, Request, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { IntegrationsOAuthService, IntegrationProvider } from './integrations-oauth.service';
import { GitHubApiService } from './providers/github-api.service';
import { NotionApiService } from './providers/notion-api.service';
import { GoogleWorkspaceApiService } from './providers/google-workspace-api.service';
import { SlackTeamApiService } from './providers/slack-team-api.service';
import { Public } from '../common/decorators/public.decorator';

const VALID_PROVIDERS: IntegrationProvider[] = ['github', 'notion', 'google_workspace', 'slack'];

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly oauthService: IntegrationsOAuthService,
    private readonly config: ConfigService,
    private readonly githubApi: GitHubApiService,
    private readonly notionApi: NotionApiService,
    private readonly googleWorkspaceApi: GoogleWorkspaceApiService,
    private readonly slackTeamApi: SlackTeamApiService,
  ) {}

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List available integrations and their connection status' })
  @ApiResponse({ status: 200, description: 'Integration cards' })
  list(@Request() req: any) {
    return this.integrationsService.listForUser(req.user.id);
  }

  @ApiBearerAuth()
  @Get(':provider/authorize')
  @ApiOperation({ summary: 'Get the consent-screen URL to connect a productivity integration' })
  @ApiResponse({ status: 200, description: 'Returns the URL to redirect the browser to' })
  authorize(@Request() req: any, @Param('provider') provider: string) {
    return { url: this.oauthService.buildAuthUrl(this.assertValidProvider(provider), req.user.id) };
  }

  @ApiBearerAuth()
  @Get('github/repos')
  @ApiOperation({ summary: "List the connected GitHub account's repositories" })
  async githubRepos(@Request() req: any) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'github');
    return this.runProviderCall('GitHub', () => this.githubApi.listRepos(token));
  }

  @ApiBearerAuth()
  @Get('github/issues')
  @ApiOperation({ summary: 'List open GitHub issues assigned to the connected account' })
  async githubIssues(@Request() req: any) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'github');
    return this.runProviderCall('GitHub', () => this.githubApi.listAssignedIssues(token));
  }

  @ApiBearerAuth()
  @Get('notion/search')
  @ApiOperation({ summary: 'Search Notion pages/databases shared with the Zoorzio integration' })
  async notionSearch(@Request() req: any, @Query('query') query?: string) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'notion');
    return this.runProviderCall('Notion', () => this.notionApi.searchPages(token, query));
  }

  @ApiBearerAuth()
  @Get('google-workspace/emails')
  @ApiOperation({ summary: 'List recent Gmail messages for the connected account' })
  async googleWorkspaceEmails(@Request() req: any) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'google_workspace');
    return this.runProviderCall('Google Workspace', () => this.googleWorkspaceApi.listRecentEmails(token));
  }

  @ApiBearerAuth()
  @Get('google-workspace/files')
  @ApiOperation({ summary: 'List recently modified Google Drive files for the connected account' })
  async googleWorkspaceFiles(@Request() req: any) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'google_workspace');
    return this.runProviderCall('Google Workspace', () => this.googleWorkspaceApi.listRecentFiles(token));
  }

  @ApiBearerAuth()
  @Get('slack/channels')
  @ApiOperation({ summary: 'List channels in the connected Slack workspace' })
  async slackChannels(@Request() req: any) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'slack');
    return this.runProviderCall('Slack', () => this.slackTeamApi.listChannels(token));
  }

  @ApiBearerAuth()
  @Post('slack/send')
  @ApiOperation({ summary: 'Post a message to a channel in the connected Slack workspace' })
  async slackSend(@Request() req: any, @Body() body: { channelId: string; message: string }) {
    const token = await this.integrationsService.getValidAccessToken(req.user.id, 'slack');
    return this.runProviderCall('Slack', () => this.slackTeamApi.postMessage(token, body.channelId, body.message));
  }

  /**
   * Provider APIs reject a stale/revoked token with their own 401/403 -
   * without this, that surfaces to the frontend as an opaque 500. Anything
   * else (rate limit, malformed request, etc.) passes through unchanged.
   */
  private async runProviderCall<T>(providerLabel: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        throw new BadRequestException(`Your ${providerLabel} connection has expired or was revoked. Please reconnect it.`);
      }
      throw error;
    }
  }

  @Public()
  @Get(':provider/callback')
  @ApiOperation({ summary: 'OAuth redirect target - exchanges the code and stores the connection' })
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const p = this.assertValidProvider(provider);

    if (error) {
      return res.redirect(`${frontendUrl}/integrations?provider=${p}&status=error&message=${encodeURIComponent(error)}`);
    }
    try {
      const { userId } = this.oauthService.verifyState(state);
      const tokens = await this.oauthService.exchangeCode(p, code);
      await this.integrationsService.connectOAuth(userId, p, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      return res.redirect(`${frontendUrl}/integrations?provider=${p}&status=connected`);
    } catch (err: any) {
      return res.redirect(
        `${frontendUrl}/integrations?provider=${p}&status=error&message=${encodeURIComponent(err?.message || 'Connection failed')}`,
      );
    }
  }

  @ApiBearerAuth()
  @Delete(':key')
  @ApiOperation({ summary: 'Disconnect an integration' })
  @ApiResponse({ status: 200, description: 'Integration disconnected' })
  disconnect(@Request() req: any, @Param('key') key: string) {
    return this.integrationsService.disconnect(req.user.id, key);
  }

  private assertValidProvider(provider: string): IntegrationProvider {
    if (!VALID_PROVIDERS.includes(provider as IntegrationProvider)) {
      throw new BadRequestException(`Unknown integration provider: ${provider}`);
    }
    return provider as IntegrationProvider;
  }
}
