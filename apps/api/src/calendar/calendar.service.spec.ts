import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { AppleCalendarService } from './apple-calendar.service';
import { AIService } from '../ai/ai.service';
import { EncryptionService } from '../security/encryption.service';
import { IntegrationsOAuthService } from '../integrations/integrations-oauth.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CalendarService', () => {
  let service: CalendarService;
  let prisma: any;
  let googleCalendar: any;
  let outlookCalendar: any;
  let appleCalendar: any;
  let ai: any;
  let encryption: any;
  let integrationsOAuth: any;

  beforeEach(async () => {
    prisma = {
      calendar: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      calendarEvent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    googleCalendar = {
      listCalendars: jest.fn().mockResolvedValue([]),
      listEvents: jest.fn().mockResolvedValue([]),
      createEvent: jest.fn().mockResolvedValue({ id: 'google-event-1' }),
      deleteEvent: jest.fn(),
    };

    outlookCalendar = {
      listCalendars: jest.fn().mockResolvedValue([]),
      listEvents: jest.fn().mockResolvedValue([]),
      createEvent: jest.fn().mockResolvedValue({ id: 'outlook-event-1' }),
      deleteEvent: jest.fn(),
    };

    appleCalendar = {
      listCalendars: jest.fn().mockResolvedValue([]),
      listEvents: jest.fn().mockResolvedValue([]),
      createEvent: jest.fn().mockResolvedValue({ id: 'apple-event-1' }),
      deleteEvent: jest.fn(),
    };

    ai = {
      generateSummary: jest.fn(),
    };

    // Reversible stand-in for real AES, so a test can tell an encrypted value
    // from a plaintext one. decryptIfEncrypted mirrors the real service in
    // passing through values written before encryption existed.
    encryption = {
      encrypt: jest.fn(async (value: string) => `enc(${value})`),
      decryptIfEncrypted: jest.fn(async (value: unknown) => {
        if (typeof value !== 'string' || !value) return undefined;
        const match = /^enc\((.*)\)$/.exec(value);
        return match ? match[1] : value;
      }),
    };

    integrationsOAuth = {
      refreshGoogleToken: jest
        .fn()
        .mockResolvedValue({ accessToken: 'refreshed', expiresIn: 3600 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleCalendarService, useValue: googleCalendar },
        { provide: OutlookCalendarService, useValue: outlookCalendar },
        { provide: AppleCalendarService, useValue: appleCalendar },
        { provide: AIService, useValue: ai },
        { provide: EncryptionService, useValue: encryption },
        { provide: IntegrationsOAuthService, useValue: integrationsOAuth },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('connectGoogleCalendar', () => {
    it('should connect Google Calendar', async () => {
      const userId = 'user123';
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      googleCalendar.listCalendars.mockResolvedValue([
        { id: 'cal1', summary: 'Primary', backgroundColor: '#4285f4' },
      ]);
      prisma.calendar.findMany.mockResolvedValue([]);

      const result = await service.connectGoogleCalendar(userId, accessToken, refreshToken);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('calendarsCount', 1);
      expect(prisma.calendar.upsert).toHaveBeenCalled();
    });
  });

  describe('connectOutlookCalendar', () => {
    it('should connect Outlook Calendar', async () => {
      const userId = 'user123';
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      outlookCalendar.listCalendars.mockResolvedValue([
        { id: 'cal1', name: 'Primary', color: '#0078d4' },
      ]);
      prisma.calendar.findMany.mockResolvedValue([]);

      const result = await service.connectOutlookCalendar(userId, accessToken, refreshToken);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('calendarsCount', 1);
    });
  });

  describe('connectAppleCalendar', () => {
    it('should connect Apple Calendar via CalDAV credentials', async () => {
      const userId = 'user123';

      appleCalendar.listCalendars.mockResolvedValue([
        {
          id: 'https://caldav.icloud.com/123/calendars/home/',
          summary: 'Home',
          backgroundColor: '#7EA9E4',
        },
      ]);
      prisma.calendar.findMany.mockResolvedValue([]);

      const result = await service.connectAppleCalendar(
        userId,
        'user@icloud.com',
        'app-specific-pass',
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('calendarsCount', 1);
      expect(appleCalendar.listCalendars).toHaveBeenCalledWith({
        username: 'user@icloud.com',
        appPassword: 'app-specific-pass',
      });
      expect(prisma.calendar.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            provider: 'APPLE',
            metadata: { username: 'user@icloud.com', appPassword: 'enc(app-specific-pass)' },
          }),
        }),
      );
    });
  });

  describe('getEvents', () => {
    it('should return calendar events', async () => {
      const userId = 'user123';
      const expectedEvents = [{ id: 'event1', title: 'Meeting', startTime: new Date() }];

      prisma.calendarEvent.findMany.mockResolvedValue(expectedEvents);

      const result = await service.getEvents(userId);

      expect(result).toEqual(expectedEvents);
    });

    it('should filter by date range', async () => {
      const userId = 'user123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prisma.calendarEvent.findMany.mockResolvedValue([]);

      await service.getEvents(userId, startDate, endDate);

      expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });
  });

  describe('getTodayEvents', () => {
    it("should return today's events", async () => {
      const userId = 'user123';
      prisma.calendarEvent.findMany.mockResolvedValue([]);

      await service.getTodayEvents(userId);

      expect(prisma.calendarEvent.findMany).toHaveBeenCalled();
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return upcoming events', async () => {
      const userId = 'user123';
      const days = 7;
      prisma.calendarEvent.findMany.mockResolvedValue([]);

      await service.getUpcomingEvents(userId, days);

      expect(prisma.calendarEvent.findMany).toHaveBeenCalled();
    });
  });

  describe('createEvent', () => {
    it('should create event in Google Calendar', async () => {
      const userId = 'user123';
      const calendarId = 'cal1';
      const eventData = {
        title: 'Meeting',
        startTime: new Date(),
        endTime: new Date(),
      };

      prisma.calendar.findUnique.mockResolvedValue({
        id: calendarId,
        userId,
        provider: 'GOOGLE',
        metadata: { accessToken: 'token' },
      });
      prisma.calendarEvent.create.mockResolvedValue({ id: 'event123', calendarId, ...eventData });

      const result = await service.createEvent(userId, calendarId, eventData);

      expect(result).toHaveProperty('id');
      expect(googleCalendar.createEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException if calendar not found', async () => {
      prisma.calendar.findUnique.mockResolvedValue(null);

      await expect(
        service.createEvent('user123', 'nonexistent', {
          title: 'Meeting',
          startTime: new Date(),
          endTime: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create event in Apple Calendar', async () => {
      const userId = 'user123';
      const calendarId = 'cal1';
      const eventData = { title: 'Meeting', startTime: new Date(), endTime: new Date() };

      prisma.calendar.findUnique.mockResolvedValue({
        id: calendarId,
        userId,
        provider: 'APPLE',
        externalId: 'https://caldav.icloud.com/123/calendars/home/',
        metadata: { username: 'user@icloud.com', appPassword: 'app-pass' },
      });
      prisma.calendarEvent.create.mockResolvedValue({ id: 'event123', calendarId, ...eventData });

      const result = await service.createEvent(userId, calendarId, eventData);

      expect(result).toHaveProperty('id');
      expect(appleCalendar.createEvent).toHaveBeenCalledWith(
        { username: 'user@icloud.com', appPassword: 'app-pass' },
        'https://caldav.icloud.com/123/calendars/home/',
        eventData,
      );
    });

    it('should throw ForbiddenException if calendar belongs to another user', async () => {
      prisma.calendar.findUnique.mockResolvedValue({
        id: 'cal1',
        userId: 'other-user',
        provider: 'GOOGLE',
      });

      await expect(
        service.createEvent('user123', 'cal1', {
          title: 'Meeting',
          startTime: new Date(),
          endTime: new Date(),
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a manual event on a LOCAL calendar without calling any external provider', async () => {
      const userId = 'user123';
      const calendarId = 'local-cal';
      const eventData = { title: 'Manual event', startTime: new Date(), endTime: new Date() };

      prisma.calendar.findUnique.mockResolvedValue({
        id: calendarId,
        userId,
        provider: 'LOCAL',
        externalId: 'local',
        metadata: {},
      });
      prisma.calendarEvent.create.mockResolvedValue({ id: 'event123', calendarId, ...eventData });

      const result = await service.createEvent(userId, calendarId, eventData);

      expect(result).toHaveProperty('id');
      expect(googleCalendar.createEvent).not.toHaveBeenCalled();
      expect(outlookCalendar.createEvent).not.toHaveBeenCalled();
      expect(appleCalendar.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateDefaultCalendar', () => {
    it('should return the existing LOCAL calendar if one exists', async () => {
      const existing = { id: 'cal1', userId: 'user123', provider: 'LOCAL', name: 'My Calendar' };
      prisma.calendar.findFirst.mockResolvedValue(existing);

      const result = await service.getOrCreateDefaultCalendar('user123');

      expect(result).toEqual(existing);
      expect(prisma.calendar.create).not.toHaveBeenCalled();
    });

    it('should create a LOCAL calendar if none exists yet', async () => {
      prisma.calendar.findFirst.mockResolvedValue(null);
      const created = { id: 'cal2', userId: 'user123', provider: 'LOCAL', name: 'My Calendar' };
      prisma.calendar.create.mockResolvedValue(created);

      const result = await service.getOrCreateDefaultCalendar('user123');

      expect(result).toEqual(created);
      expect(prisma.calendar.create).toHaveBeenCalledWith({
        data: { userId: 'user123', provider: 'LOCAL', externalId: 'local', name: 'My Calendar' },
      });
    });
  });

  describe('deleteEvent', () => {
    it('should delete event', async () => {
      const userId = 'user123';
      const eventId = 'event1';

      prisma.calendarEvent.findUnique.mockResolvedValue({
        id: eventId,
        calendar: {
          userId,
          provider: 'GOOGLE',
          metadata: { accessToken: 'token' },
          externalId: 'google-cal-id',
        },
      });

      const result = await service.deleteEvent(userId, eventId);

      expect(result).toEqual({ success: true });
      expect(googleCalendar.deleteEvent).toHaveBeenCalled();
      expect(prisma.calendarEvent.delete).toHaveBeenCalled();
    });

    it('should delete event from Apple Calendar', async () => {
      const userId = 'user123';
      const eventId = 'event1';

      prisma.calendarEvent.findUnique.mockResolvedValue({
        id: eventId,
        externalId: 'https://caldav.icloud.com/123/calendars/home/abc.ics',
        calendar: {
          userId,
          provider: 'APPLE',
          metadata: { username: 'user@icloud.com', appPassword: 'app-pass' },
          externalId: 'https://caldav.icloud.com/123/calendars/home/',
        },
      });

      const result = await service.deleteEvent(userId, eventId);

      expect(result).toEqual({ success: true });
      expect(appleCalendar.deleteEvent).toHaveBeenCalledWith(
        { username: 'user@icloud.com', appPassword: 'app-pass' },
        'https://caldav.icloud.com/123/calendars/home/',
        'https://caldav.icloud.com/123/calendars/home/abc.ics',
      );
    });
  });

  describe('getCalendarHealth', () => {
    it('should return calendar health status', async () => {
      const userId = 'user123';
      const calendars = [
        {
          id: 'cal1',
          name: 'Primary',
          provider: 'GOOGLE',
          isActive: true,
          lastSync: new Date(),
        },
      ];

      prisma.calendar.findFirst.mockResolvedValue({ id: 'local1', userId, provider: 'LOCAL' });
      prisma.calendar.findMany.mockResolvedValue(calendars);

      const result = await service.getCalendarHealth(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('syncHealth');
    });

    it('should lazily create a LOCAL calendar so manual events are always possible', async () => {
      const userId = 'user123';
      prisma.calendar.findFirst.mockResolvedValue(null);
      prisma.calendar.create.mockResolvedValue({
        id: 'local1',
        userId,
        provider: 'LOCAL',
        name: 'My Calendar',
      });
      prisma.calendar.findMany.mockResolvedValue([
        {
          id: 'local1',
          userId,
          provider: 'LOCAL',
          name: 'My Calendar',
          isActive: true,
          lastSync: null,
        },
      ]);

      const result = await service.getCalendarHealth(userId);

      expect(prisma.calendar.create).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('LOCAL');
    });
  });
});
