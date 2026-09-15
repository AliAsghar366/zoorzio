import { Test, TestingModule } from '@nestjs/testing';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarOAuthService } from './calendar-oauth.service';
import { ConfigService } from '@nestjs/config';

describe('CalendarController', () => {
  let controller: CalendarController;
  let calendarService: any;
  let oauthService: any;
  let configService: any;

  beforeEach(async () => {
    calendarService = {
      connectGoogleCalendar: jest.fn(),
      connectOutlookCalendar: jest.fn(),
      syncGoogleCalendar: jest.fn(),
      syncOutlookCalendar: jest.fn(),
      getEvents: jest.fn(),
      getTodayEvents: jest.fn(),
      getUpcomingEvents: jest.fn(),
      getCalendarHealth: jest.fn(),
      createEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };
    oauthService = {
      buildGoogleAuthUrl: jest.fn(),
      buildOutlookAuthUrl: jest.fn(),
      verifyState: jest.fn(),
      exchangeGoogleCode: jest.fn(),
      exchangeOutlookCode: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [
        { provide: CalendarService, useValue: calendarService },
        { provide: CalendarOAuthService, useValue: oauthService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
  });

  function mockResponse() {
    return { redirect: jest.fn() } as any;
  }

  describe('googleAuthorize', () => {
    it('returns the consent-screen URL for the authenticated user', () => {
      oauthService.buildGoogleAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?...',
      );
      const result = controller.googleAuthorize({ user: { id: 'user123' } });
      expect(oauthService.buildGoogleAuthUrl).toHaveBeenCalledWith('user123');
      expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?...' });
    });
  });

  describe('googleCallback', () => {
    it('connects the calendar and redirects to a success URL on valid code+state', async () => {
      oauthService.verifyState.mockReturnValue({ userId: 'user123', provider: 'google' });
      oauthService.exchangeGoogleCode.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
      calendarService.connectGoogleCalendar.mockResolvedValue({ success: true, calendarsCount: 2 });
      const res = mockResponse();

      await controller.googleCallback('the-code', 'the-state', undefined as any, res);

      expect(oauthService.verifyState).toHaveBeenCalledWith('the-state');
      expect(oauthService.exchangeGoogleCode).toHaveBeenCalledWith('the-code');
      expect(calendarService.connectGoogleCalendar).toHaveBeenCalledWith(
        'user123',
        'a',
        'r',
        undefined,
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/calendar?provider=google&status=connected',
      );
    });

    it('redirects to an error URL when the user denies consent', async () => {
      const res = mockResponse();
      await controller.googleCallback(undefined as any, undefined as any, 'access_denied', res);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/calendar?provider=google&status=error&message=access_denied',
      );
      expect(oauthService.exchangeGoogleCode).not.toHaveBeenCalled();
    });

    it('redirects to an error URL when the state token is invalid', async () => {
      oauthService.verifyState.mockImplementation(() => {
        throw new Error('Invalid or expired calendar-connect link. Please try connecting again.');
      });
      const res = mockResponse();

      await controller.googleCallback('the-code', 'bad-state', undefined as any, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining(
          'http://localhost:3000/calendar?provider=google&status=error&message=',
        ),
      );
      expect(calendarService.connectGoogleCalendar).not.toHaveBeenCalled();
    });
  });

  describe('outlookAuthorize', () => {
    it('returns the consent-screen URL for the authenticated user', () => {
      oauthService.buildOutlookAuthUrl.mockReturnValue('https://login.microsoftonline.com/...');
      const result = controller.outlookAuthorize({ user: { id: 'user123' } });
      expect(oauthService.buildOutlookAuthUrl).toHaveBeenCalledWith('user123');
      expect(result).toEqual({ url: 'https://login.microsoftonline.com/...' });
    });
  });

  describe('outlookCallback', () => {
    it('connects the calendar and redirects to a success URL on valid code+state', async () => {
      oauthService.verifyState.mockReturnValue({ userId: 'user123', provider: 'outlook' });
      oauthService.exchangeOutlookCode.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
      calendarService.connectOutlookCalendar.mockResolvedValue({
        success: true,
        calendarsCount: 1,
      });
      const res = mockResponse();

      await controller.outlookCallback('the-code', 'the-state', undefined as any, res);

      expect(calendarService.connectOutlookCalendar).toHaveBeenCalledWith('user123', 'a', 'r');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/calendar?provider=outlook&status=connected',
      );
    });

    it('redirects to an error URL when the token exchange fails', async () => {
      oauthService.verifyState.mockReturnValue({ userId: 'user123', provider: 'outlook' });
      oauthService.exchangeOutlookCode.mockRejectedValue(
        new Error('Failed to complete Outlook sign-in. Please try again.'),
      );
      const res = mockResponse();

      await controller.outlookCallback('the-code', 'the-state', undefined as any, res);

      expect(calendarService.connectOutlookCalendar).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/calendar?provider=outlook&status=error&message=Failed%20to%20complete%20Outlook%20sign-in.%20Please%20try%20again.',
      );
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('connectGoogle', () => {
    it('should connect Google Calendar', async () => {
      const req = { user: { id: 'user123' } };
      const body = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const expectedResult = {
        success: true,
        calendarsCount: 3,
      };

      calendarService.connectGoogleCalendar.mockResolvedValue(expectedResult);

      const result = await controller.connectGoogle(req, body);

      expect(result).toEqual(expectedResult);
      expect(calendarService.connectGoogleCalendar).toHaveBeenCalledWith(
        'user123',
        body.accessToken,
        body.refreshToken,
      );
    });
  });

  describe('getEvents', () => {
    it('should return calendar events', async () => {
      const req = { user: { id: 'user123' } };
      const startDate = '2026-08-25';
      const endDate = '2026-08-31';

      const expectedEvents = [{ id: 'event1', title: 'Meeting', startTime: new Date() }];

      calendarService.getEvents.mockResolvedValue(expectedEvents);

      const result = await controller.getEvents(req, startDate, endDate);

      expect(result).toEqual(expectedEvents);
      expect(calendarService.getEvents).toHaveBeenCalledWith(
        'user123',
        new Date(startDate),
        new Date(endDate),
      );
    });
  });

  describe('getToday', () => {
    it('should return today events', async () => {
      const req = { user: { id: 'user123' } };

      const expectedEvents = [{ id: 'event1', title: 'Meeting', startTime: new Date() }];

      calendarService.getTodayEvents.mockResolvedValue(expectedEvents);

      const result = await controller.getToday(req);

      expect(result).toEqual(expectedEvents);
      expect(calendarService.getTodayEvents).toHaveBeenCalledWith('user123');
    });
  });

  describe('getUpcoming', () => {
    it('should return upcoming events', async () => {
      const req = { user: { id: 'user123' } };
      const days = 7;

      const expectedEvents = [{ id: 'event1', title: 'Meeting', startTime: new Date() }];

      calendarService.getUpcomingEvents.mockResolvedValue(expectedEvents);

      const result = await controller.getUpcoming(req, days);

      expect(result).toEqual(expectedEvents);
      expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith('user123', days);
    });
  });

  describe('getHealth', () => {
    it('should return calendar health', async () => {
      const req = { user: { id: 'user123' } };

      const expectedHealth = [
        {
          id: 'cal1',
          name: 'Work',
          provider: 'GOOGLE',
          syncHealth: 'healthy',
        },
      ];

      calendarService.getCalendarHealth.mockResolvedValue(expectedHealth);

      const result = await controller.getHealth(req);

      expect(result).toEqual(expectedHealth);
      expect(calendarService.getCalendarHealth).toHaveBeenCalledWith('user123');
    });
  });

  describe('createEvent', () => {
    it('should create a calendar event', async () => {
      const req = { user: { id: 'user123' } };
      const body = {
        calendarId: 'cal1',
        title: 'New Meeting',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      };

      const expectedEvent = {
        id: 'event1',
        ...body,
      };

      calendarService.createEvent.mockResolvedValue(expectedEvent);

      const result = await controller.createEvent(req, body);

      expect(result).toEqual(expectedEvent);
      expect(calendarService.createEvent).toHaveBeenCalledWith('user123', body.calendarId, body);
    });
  });

  describe('deleteEvent', () => {
    it('should delete a calendar event', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'event1';

      const expectedResponse = { success: true };

      calendarService.deleteEvent.mockResolvedValue(expectedResponse);

      const result = await controller.deleteEvent(req, id);

      expect(result).toEqual(expectedResponse);
      expect(calendarService.deleteEvent).toHaveBeenCalledWith('user123', id);
    });
  });
});
