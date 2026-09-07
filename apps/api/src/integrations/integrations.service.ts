import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationType } from '@anchor/database';
import { IntegrationsOAuthService, type IntegrationProvider } from './integrations-oauth.service';

interface CatalogEntry {
  key: string;
  name: string;
  description: string;
  category: 'Active' | 'Documents' | 'Calendar' | 'Email' | 'Team Chat';
  provider?: IntegrationProvider;
}

const CATALOG: CatalogEntry[] = [
  {
    key: 'google_workspace',
    name: 'Connect Google Workspace',
    description: 'Connect your full suite of Google Workspace apps.',
    category: 'Documents',
    provider: 'google_workspace',
  },
  {
    key: 'google_calendar',
    name: 'Google Calendar',
    description: 'Manage your schedule and get reminders directly in chat.',
    category: 'Calendar',
  },
  {
    key: 'outlook_calendar',
    name: 'Outlook Calendar',
    description: 'Sync Outlook calendars and manage events from Zoorzio.',
    category: 'Calendar',
  },
  {
    key: 'github',
    name: 'GitHub',
    description: 'Code hosting for version control and collaboration with issues and PRs.',
    category: 'Documents',
    provider: 'github',
  },
  {
    key: 'notion',
    name: 'Notion',
    description: 'Centralizes notes, docs and tasks in one unified workspace.',
    category: 'Documents',
    provider: 'notion',
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Channel-based messaging so your whole team stays in sync.',
    category: 'Team Chat',
    provider: 'slack',
  },
];

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthService: IntegrationsOAuthService,
  ) {}

  /**
   * Returns a usable access token for this user's connection to `provider`,
   * transparently refreshing it first if it's Google (whose access tokens
   * expire hourly) and we're holding a refresh token from the original
   * connect. Other providers here (GitHub, Notion, Slack bot tokens) don't
   * expire, so there's nothing to refresh.
   */
  async getValidAccessToken(userId: string, provider: IntegrationProvider): Promise<string> {
    const type = this.integrationType(provider);
    const integration = await this.prisma.integration.findUnique({ where: { userId_type: { userId, type } } });
    if (!integration || !integration.isActive) {
      throw new BadRequestException(`${provider} is not connected.`);
    }

    const metadata = integration.metadata as { accessToken: string; refreshToken?: string; expiresAt?: string };

    if (provider === 'google_workspace' && metadata.refreshToken) {
      const isExpired = !metadata.expiresAt || new Date(metadata.expiresAt) <= new Date();
      if (isExpired) {
        const refreshed = await this.oauthService.refreshGoogleToken(metadata.refreshToken);
        const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: { metadata: { ...metadata, accessToken: refreshed.accessToken, expiresAt: newExpiresAt } },
        });
        return refreshed.accessToken;
      }
    }

    return metadata.accessToken;
  }

  async listForUser(userId: string) {
    const [integrations, calendars] = await Promise.all([
      this.prisma.integration.findMany({ where: { userId } }),
      this.prisma.calendar.findMany({ where: { userId, provider: { in: ['GOOGLE', 'OUTLOOK'] } } }),
    ]);

    const integrationByType = new Map(integrations.map((i) => [i.type, i]));
    const googleCalendar = calendars.find((c) => c.provider === 'GOOGLE');
    const outlookCalendar = calendars.find((c) => c.provider === 'OUTLOOK');

    return CATALOG.map((entry) => {
      if (entry.key === 'google_calendar') {
        return this.toCard(entry, !!googleCalendar, googleCalendar?.createdAt ?? null);
      }
      if (entry.key === 'outlook_calendar') {
        return this.toCard(entry, !!outlookCalendar, outlookCalendar?.createdAt ?? null);
      }
      const integration = integrationByType.get(this.integrationType(entry.provider!));
      return this.toCard(entry, !!integration, integration?.createdAt ?? null);
    });
  }

  private integrationType(provider: IntegrationProvider): IntegrationType {
    const map: Record<IntegrationProvider, IntegrationType> = {
      github: IntegrationType.GITHUB,
      notion: IntegrationType.NOTION,
      google_workspace: IntegrationType.GOOGLE_WORKSPACE,
      slack: IntegrationType.SLACK,
    };
    return map[provider];
  }

  private toCard(entry: CatalogEntry, isConnected: boolean, connectedAt: Date | null) {
    return {
      key: entry.key,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      isConnected,
      connectedAt,
    };
  }

  async connectOAuth(userId: string, provider: IntegrationProvider, accessToken: string, refreshToken: string, expiresIn?: number) {
    const type = this.integrationType(provider);
    const label = CATALOG.find((c) => c.provider === provider)?.name ?? provider;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
    const metadata = { accessToken, refreshToken, ...(expiresAt ? { expiresAt } : {}) };

    return this.prisma.integration.upsert({
      where: { userId_type: { userId, type } },
      update: { isActive: true, metadata },
      create: { userId, type, name: label, metadata },
    });
  }

  async disconnect(userId: string, key: string) {
    if (key === 'google_calendar') {
      await this.prisma.calendar.deleteMany({ where: { userId, provider: 'GOOGLE' } });
      return { success: true };
    }
    if (key === 'outlook_calendar') {
      await this.prisma.calendar.deleteMany({ where: { userId, provider: 'OUTLOOK' } });
      return { success: true };
    }

    const entry = CATALOG.find((c) => c.key === key);
    if (!entry?.provider) return { success: true };

    await this.prisma.integration.deleteMany({ where: { userId, type: this.integrationType(entry.provider) } });
    return { success: true };
  }
}
