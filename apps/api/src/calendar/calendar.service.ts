import { randomUUID } from 'crypto';
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { AppleCalendarService } from './apple-calendar.service';
import { AIService } from '../ai/ai.service';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
    private outlookCalendar: OutlookCalendarService,
    private appleCalendar: AppleCalendarService,
    private aiService: AIService,
  ) {}

  async connectGoogleCalendar(userId: string, accessToken: string, refreshToken: string) {
    try {
      // Get calendar list from Google
      const calendars = await this.googleCalendar.listCalendars(accessToken);

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
          },
          create: {
            userId,
            provider: 'GOOGLE',
            externalId: calendar.id,
            name: calendar.summary,
            color: calendar.backgroundColor,
            metadata: {
              accessToken,
              refreshToken,
            },
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
          },
          create: {
            userId,
            provider: 'OUTLOOK',
            externalId: calendar.id,
            name: calendar.name,
            color: calendar.color,
            metadata: {
              accessToken,
              refreshToken,
            },
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
          },
          create: {
            userId,
            provider: 'APPLE',
            externalId: calendar.id,
            name: calendar.summary,
            color: calendar.backgroundColor,
            metadata: { username, appPassword },
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
        const metadata = calendar.metadata as any;
        if (!metadata?.username || !metadata?.appPassword) continue;
        const credentials = { username: metadata.username, appPassword: metadata.appPassword };

        const lastSync = calendar.lastSync || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const events = await this.appleCalendar.listEvents(credentials, calendar.externalId, lastSync);

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
        const accessToken = (calendar.metadata as any)?.accessToken;
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
        const accessToken = (calendar.metadata as any)?.accessToken;
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
        (calendar.metadata as any)?.accessToken,
        calendar.externalId,
        eventData,
      );
    } else if (calendar.provider === 'OUTLOOK') {
      externalEvent = await this.outlookCalendar.createEvent(
        (calendar.metadata as any)?.accessToken,
        calendar.externalId,
        eventData,
      );
    } else if (calendar.provider === 'APPLE') {
      const metadata = calendar.metadata as any;
      externalEvent = await this.appleCalendar.createEvent(
        { username: metadata?.username, appPassword: metadata?.appPassword },
        calendar.externalId,
        eventData,
      );
    } else {
      // LOCAL calendar - nothing to sync externally
      externalEvent = { id: randomUUID() };
    }

    // Store event locally
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
      },
    });
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
        (event.calendar.metadata as any)?.accessToken,
        event.calendar.externalId,
        event.externalId,
      );
    } else if (event.calendar.provider === 'OUTLOOK') {
      await this.outlookCalendar.deleteEvent(
        (event.calendar.metadata as any)?.accessToken,
        event.calendar.externalId,
        event.externalId,
      );
    } else if (event.calendar.provider === 'APPLE') {
      const metadata = event.calendar.metadata as any;
      await this.appleCalendar.deleteEvent(
        { username: metadata?.username, appPassword: metadata?.appPassword },
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

    return calendars.map(calendar => ({
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
