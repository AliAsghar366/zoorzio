import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { AppleCalendarService } from './apple-calendar.service';
import { AIService } from '../ai/ai.service';
import { EncryptionService } from '../security/encryption.service';
import { IntegrationsOAuthService } from '../integrations/integrations-oauth.service';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
    private outlookCalendar: OutlookCalendarService,
    private appleCalendar: AppleCalendarService,
    private aiService: AIService,
    private encryption: EncryptionService,
    private integrationsOAuth: IntegrationsOAuthService,
  ) {}

  private async readSecret(value: unknown): Promise<string | undefined> {
    return this.encryption.decryptIfEncrypted(value);
  }

  private async encryptSecret(value: string | undefined): Promise<string | undefined> {
    if (!value) return undefined;
    return this.encryption.encrypt(value);
  }

  /**
   * Returns a currently-valid Google access token for this user, refreshing it
   * first if it has expired. Google access tokens last an hour, so anything
   * acting on a user's behalf minutes or days after they connected (the
   * WhatsApp agent, a scheduled sync) has to be able to refresh.
   *
   * The same OAuth grant covers Calendar and Gmail (see GOOGLE_SCOPES in
   * CalendarOAuthService), so Gmail tools read their token from here too.
   */
  async getValidGoogleAccessToken(userId: string): Promise<string> {
    const calendar = await this.prisma.calendar.findFirst({
      where: { userId, provider: 'GOOGLE', isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!calendar) {
      throw new BadRequestException(
        "Google isn't connected yet - connect it from the Integrations page first.",
      );
    }

    return this.googleAccessTokenFor(calendar);
  }

  /**
   * Per-calendar-row variant of the above. A user's Google connection writes
   * one row per calendar in their account, all sharing the same grant, so a
   * refresh updates every one of them - otherwise acting on a second calendar
   * would keep using a token that already expired.
   */
  private async googleAccessTokenFor(calendar: {
    id: string;
    userId: string;
    metadata: unknown;
  }): Promise<string> {
    const metadata = (calendar.metadata as Record<string, unknown>) || {};
    const accessToken = await this.readSecret(metadata.accessToken);
    const refreshToken = await this.readSecret(metadata.refreshToken);
    const expiresAt = typeof metadata.expiresAt === 'string' ? new Date(metadata.expiresAt) : null;
    const isExpired = !expiresAt || expiresAt <= new Date();

    if (!isExpired && accessToken) return accessToken;

    if (!refreshToken) {
      // No refresh token (an older connection, or the user revoked offline
      // access). The existing access token is all there is - if it has expired
      // the API call will 401 and the user gets asked to reconnect.
      if (accessToken) return accessToken;
      throw new BadRequestException(
        'Your Google connection needs to be renewed - please reconnect Google from the Integrations page.',
      );
    }

    const refreshed = await this.integrationsOAuth.refreshGoogleToken(refreshToken);
    const encryptedAccess = await this.encryptSecret(refreshed.accessToken);
    const encryptedRefresh = await this.encryptSecret(refreshToken);
    const expiresAtIso = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

    const rows = await this.prisma.calendar.findMany({
      where: { userId: calendar.userId, provider: 'GOOGLE' },
    });
    await Promise.all(
      rows.map((row) =>
        this.prisma.calendar.update({
          where: { id: row.id },
          data: {
            metadata: {
              ...((row.metadata as Record<string, unknown>) || {}),
              accessToken: encryptedAccess,
              refreshToken: encryptedRefresh,
              expiresAt: expiresAtIso,
            },
          },
        }),
      ),
    );

    return refreshed.accessToken;
  }

  async connectGoogleCalendar(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn?: number,
  ) {
    try {
      // Get calendar list from Google
      const calendars = await this.googleCalendar.listCalendars(accessToken);

      const credentials = {
        accessToken: await this.encryptSecret(accessToken),
        refreshToken: await this.encryptSecret(refreshToken),
        expiresAt: new Date(Date.now() + (expiresIn ?? 3600) * 1000).toISOString(),
      };

      // Store each calendar
      for (const calendar of calendars) {
        await this.prisma.calendar.upsert({
          where: {
            userId_provider_externalId: {
              userId,
              provider: 'GOOGLE',
              externalId: calendar.id,
            },
          },
          update: {
            name: calendar.summary,
            color: calendar.backgroundColor,
            isActive: true,
            // Reconnecting issues a fresh grant, so the stored credentials on
            // an existing row have to be replaced, not left as they were.
            metadata: credentials,
          },
          create: {
            userId,
            provider: 'GOOGLE',
            externalId: calendar.id,
            name: calendar.summary,
            color: calendar.backgroundColor,
            metadata: credentials,
          },
        });
      }

      // Sync events
      await this.syncGoogleCalendar(userId);

      return { success: true, calendarsCount: calendars.length };
    } catch (error) {
      this.logger.error('Failed to connect Google Calendar', error);
      throw error;
    }
  }

  async connectOutlookCalendar(userId: string, accessToken: string, refreshToken: string) {
    try {
      // Get calendar list from Outlook
      const calendars = await this.outlookCalendar.listCalendars(accessToken);

      const credentials = {
        accessToken: await this.encryptSecret(accessToken),
        refreshToken: await this.encryptSecret(refreshToken),
      };

      // Store each calendar
      for (const calendar of calendars) {
        await this.prisma.calendar.upsert({
          where: {
            userId_provider_externalId: {
              userId,
              provider: 'OUTLOOK',
              externalId: calendar.id,
            },
          },
          update: {
            name: calendar.name,
            color: calendar.color,
            isActive: true,
            metadata: credentials,
          },
          create: {
            userId,
            provider: 'OUTLOOK',
            externalId: calendar.id,
            name: calendar.name,
            color: calendar.color,
            metadata: credentials,
          },
        });
      }

      // Sync events
      await this.syncOutlookCalendar(userId);

      return { success: true, calendarsCount: calendars.length };
    } catch (error) {
      this.logger.error('Failed to connect Outlook Calendar', error);
      throw error;
    }
  }

  async connectAppleCalendar(userId: string, username: string, appPassword: string) {
    try {
      const calendars = await this.appleCalendar.listCalendars({ username, appPassword });

      // An app-specific password is a long-lived credential, so it is encrypted
      // at rest exactly like the OAuth tokens above.
      const credentials = { username, appPassword: await this.encryptSecret(appPassword) };

      for (const calendar of calendars) {
        await this.prisma.calendar.upsert({
          where: {
            userId_provider_externalId: {
              userId,
              provider: 'APPLE',
              externalId: calendar.id,
            },
          },
          update: {
            name: calendar.summary,
            color: calendar.backgroundColor,
            isActive: true,
            metadata: credentials,
          },
          create: {
            userId,
            provider: 'APPLE',
            externalId: calendar.id,
            name: calendar.summary,
            color: calendar.backgroundColor,
            metadata: credentials,
          },
        });
      }

      await this.syncAppleCalendar(userId);

      return { success: true, calendarsCount: calendars.length };
    } catch (error) {
      this.logger.error('Failed to connect Apple Calendar', error);
      throw error;
    }
  }

  async syncAppleCalendar(userId: string) {
    const calendars = await this.prisma.calendar.findMany({
      where: { userId, provider: 'APPLE', isActive: true },
    });

    for (const calendar of calendars) {
      try {
        const credentials = await this.appleCredentialsFor(calendar);
        if (!credentials) continue;

        const lastSync = calendar.lastSync || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const events = await this.appleCalendar.listEvents(
          credentials,
          calendar.externalId,
          lastSync,
        );

        for (const event of events) {
          await this.prisma.calendarEvent.upsert({
            where: {
              calendarId_externalId: {
                calendarId: calendar.id,
                externalId: event.id,
              },
            },
            update: {
              title: event.summary,
              description: event.description,
              location: event.location,
              startTime: new Date(event.start.dateTime),
              endTime: new Date(event.end.dateTime),
              allDay: false,
            },
            create: {
              calendarId: calendar.id,
              externalId: event.id,
              title: event.summary,
              description: event.description,
              location: event.location,
              startTime: new Date(event.start.dateTime),
              endTime: new Date(event.end.dateTime),
              allDay: false,
            },
          });
        }

        await this.prisma.calendar.update({
          where: { id: calendar.id },
          data: { lastSync: new Date() },
        });

        this.logger.log(`Synced ${events.length} events for calendar ${calendar.id}`);
      } catch (error) {
        this.logger.error(`Failed to sync calendar ${calendar.id}`, error);
      }
    }
  }

  async syncGoogleCalendar(userId: string) {
    const calendars = await this.prisma.calendar.findMany({
      where: {
        userId,
        provider: 'GOOGLE',
        isActive: true,
      },
    });

    for (const calendar of calendars) {
      try {
        const accessToken = await this.googleAccessTokenFor(calendar);
        if (!accessToken) continue;

        // Get events since last sync
        const lastSync = calendar.lastSync || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const events = await this.googleCalendar.listEvents(
          accessToken,
          calendar.externalId,
          lastSync,
        );

        // Upsert events
        for (const event of events) {
          await this.prisma.calendarEvent.upsert({
            where: {
              calendarId_externalId: {
                calendarId: calendar.id,
                externalId: event.id,
              },
            },
            update: {
              title: event.summary,
              description: event.description,
              location: event.location,
              startTime: new Date(event.start.dateTime || event.start.date),
              endTime: new Date(event.end.dateTime || event.end.date),
              allDay: !!event.start.date,
            },
            create: {
              calendarId: calendar.id,
              externalId: event.id,
              title: event.summary,
              description: event.description,
              location: event.location,
              startTime: new Date(event.start.dateTime || event.start.date),
              endTime: new Date(event.end.dateTime || event.end.date),
              allDay: !!event.start.date,
            },
          });
        }

        // Update last sync time
        await this.prisma.calendar.update({
          where: { id: calendar.id },
          data: { lastSync: new Date() },
        });

        this.logger.log(`Synced ${events.length} events for calendar ${calendar.id}`);
      } catch (error) {
        this.logger.error(`Failed to sync calendar ${calendar.id}`, error);
      }
    }
  }

  async syncOutlookCalendar(userId: string) {
    const calendars = await this.prisma.calendar.findMany({
      where: {
        userId,
        provider: 'OUTLOOK',
        isActive: true,
      },
    });

    for (const calendar of calendars) {
      try {
        const accessToken = await this.readSecret((calendar.metadata as any)?.accessToken);
        if (!accessToken) continue;

        // Get events since last sync
        const lastSync = calendar.lastSync || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const events = await this.outlookCalendar.listEvents(
          accessToken,
          calendar.externalId,
          lastSync,
        );

        // Upsert events
        for (const event of events) {
          await this.prisma.calendarEvent.upsert({
            where: {
              calendarId_externalId: {
                calendarId: calendar.id,
                externalId: event.id,
              },
            },
            update: {
              title: event.subject,
              description: event.bodyPreview,
              location: event.location?.displayName,
              startTime: new Date(event.start.dateTime),
              endTime: new Date(event.end.dateTime),
              allDay: event.isAllDay,
            },
            create: {
              calendarId: calendar.id,
              externalId: event.id,
              title: event.subject,
              description: event.bodyPreview,
              location: event.location?.displayName,
              startTime: new Date(event.start.dateTime),
              endTime: new Date(event.end.dateTime),
              allDay: event.isAllDay,
            },
          });
        }

        // Update last sync time
        await this.prisma.calendar.update({
          where: { id: calendar.id },
          data: { lastSync: new Date() },
        });

        this.logger.log(`Synced ${events.length} events for calendar ${calendar.id}`);
      } catch (error) {
        this.logger.error(`Failed to sync calendar ${calendar.id}`, error);
      }
    }
  }

  async getEvents(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      calendar: { userId },
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = startDate;
      if (endDate) where.startTime.lte = endDate;
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        calendar: {
          select: {
            name: true,
            color: true,
            provider: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async getTodayEvents(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getEvents(userId, today, tomorrow);
  }

  async getUpcomingEvents(userId: string, days: number = 7) {
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    return this.getEvents(userId, now, future);
  }

  async createEvent(userId: string, calendarId: string, eventData: any) {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
    });

    if (!calendar) {
      throw new NotFoundException('Calendar not found');
    }

    if (calendar.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Create event in external calendar
    let externalEvent: any;

    if (calendar.provider === 'GOOGLE') {
      externalEvent = await this.googleCalendar.createEvent(
        await this.googleAccessTokenFor(calendar),
        calendar.externalId,
        eventData,
      );
    } else if (calendar.provider === 'OUTLOOK') {
      externalEvent = await this.outlookCalendar.createEvent(
        await this.requireSecret((calendar.metadata as any)?.accessToken, 'Outlook'),
        calendar.externalId,
        eventData,
      );
    } else if (calendar.provider === 'APPLE') {
      externalEvent = await this.appleCalendar.createEvent(
        await this.requireAppleCredentials(calendar),
        calendar.externalId,
        eventData,
      );
    } else {
      // LOCAL calendar - nothing to sync externally
      externalEvent = { id: randomUUID() };
    }

    // Store event locally. meetLink/attendees are kept so the confirmation sent
    // back to the user can quote the real, provider-issued values rather than
    // anything assembled locally.
    return this.prisma.calendarEvent.create({
      data: {
        calendarId,
        externalId: externalEvent.id,
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        allDay: eventData.allDay || false,
        metadata: {
          ...(externalEvent.hangoutLink ? { meetLink: externalEvent.hangoutLink } : {}),
          ...(externalEvent.htmlLink ? { htmlLink: externalEvent.htmlLink } : {}),
          ...(Array.isArray(externalEvent.attendees)
            ? { attendees: externalEvent.attendees.map((a: any) => a.email).filter(Boolean) }
            : {}),
        },
      },
    });
  }

  /**
   * Updates an event in the provider first, then locally - so a failure at the
   * provider leaves both sides unchanged rather than showing the user a local
   * change that never reached their real calendar.
   */
  async updateEvent(userId: string, eventId: string, changes: any) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { calendar: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.calendar.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    let externalEvent: any = {};

    if (event.calendar.provider === 'GOOGLE') {
      externalEvent = await this.googleCalendar.updateEvent(
        await this.googleAccessTokenFor(event.calendar),
        event.calendar.externalId,
        event.externalId,
        changes,
      );
    } else if (event.calendar.provider !== 'LOCAL') {
      // Outlook/Apple event editing isn't wired up yet - rather than silently
      // updating only the local copy (which would tell the user their real
      // calendar changed when it didn't), refuse.
      throw new BadRequestException(
        `Editing events on ${event.calendar.provider} calendars isn't supported yet - you can cancel and recreate it instead.`,
      );
    }

    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title: changes.title ?? undefined,
        description: changes.description ?? undefined,
        location: changes.location ?? undefined,
        startTime: changes.startTime ? new Date(changes.startTime) : undefined,
        endTime: changes.endTime ? new Date(changes.endTime) : undefined,
        ...(externalEvent.hangoutLink
          ? {
              metadata: {
                ...((event.metadata as Record<string, unknown>) || {}),
                meetLink: externalEvent.hangoutLink,
              },
            }
          : {}),
      },
    });
  }

  private async appleCredentialsFor(calendar: { metadata: unknown }) {
    const metadata = (calendar.metadata as Record<string, unknown>) || {};
    const appPassword = await this.readSecret(metadata.appPassword);
    if (!metadata.username || !appPassword) return null;
    return { username: metadata.username as string, appPassword };
  }

  /** Same as readSecret, but refuses to continue with no credential rather than calling a provider with `undefined`. */
  private async requireSecret(value: unknown, providerLabel: string): Promise<string> {
    const secret = await this.readSecret(value);
    if (!secret) {
      throw new BadRequestException(
        `Your ${providerLabel} connection is missing credentials - please reconnect it from the Integrations page.`,
      );
    }
    return secret;
  }

  private async requireAppleCredentials(calendar: { metadata: unknown }) {
    const credentials = await this.appleCredentialsFor(calendar);
    if (!credentials) {
      throw new BadRequestException(
        'Your Apple Calendar connection is missing credentials - please reconnect it from the Integrations page.',
      );
    }
    return credentials;
  }

  async deleteEvent(userId: string, eventId: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { calendar: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.calendar.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Delete from external calendar
    if (event.calendar.provider === 'GOOGLE') {
      await this.googleCalendar.deleteEvent(
        await this.googleAccessTokenFor(event.calendar),
        event.calendar.externalId,
        event.externalId,
      );
    } else if (event.calendar.provider === 'OUTLOOK') {
      await this.outlookCalendar.deleteEvent(
        await this.requireSecret((event.calendar.metadata as any)?.accessToken, 'Outlook'),
        event.calendar.externalId,
        event.externalId,
      );
    } else if (event.calendar.provider === 'APPLE') {
      await this.appleCalendar.deleteEvent(
        await this.requireAppleCredentials(event.calendar),
        event.calendar.externalId,
        event.externalId,
      );
    }

    // Delete locally
    await this.prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    return { success: true };
  }

  /**
   * The calendar a new event should land on: the user's connected Google
   * calendar if there is one, so the event is real and can carry a Meet link
   * and invitations, otherwise the local fallback.
   */
  async getPreferredCalendar(userId: string) {
    const google = await this.prisma.calendar.findFirst({
      where: { userId, provider: 'GOOGLE', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (google) return google;

    return this.getOrCreateDefaultCalendar(userId);
  }

  async getOrCreateDefaultCalendar(userId: string) {
    const existing = await this.prisma.calendar.findFirst({
      where: { userId, provider: 'LOCAL' },
    });
    if (existing) return existing;

    return this.prisma.calendar.create({
      data: {
        userId,
        provider: 'LOCAL',
        externalId: 'local',
        name: 'My Calendar',
      },
    });
  }

  async getCalendarHealth(userId: string) {
    await this.getOrCreateDefaultCalendar(userId);

    const calendars = await this.prisma.calendar.findMany({
      where: { userId },
    });

    return calendars.map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      provider: calendar.provider,
      isActive: calendar.isActive,
      lastSync: calendar.lastSync,
      syncHealth: this.calculateSyncHealth(calendar.lastSync),
    }));
  }

  private calculateSyncHealth(lastSync: Date | null): string {
    if (!lastSync) return 'never_synced';

    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync < 1) return 'healthy';
    if (hoursSinceSync < 24) return 'warning';
    return 'critical';
  }
}
