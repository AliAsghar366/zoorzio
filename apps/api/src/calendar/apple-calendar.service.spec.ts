import { AppleCalendarService } from './apple-calendar.service';

const mockFetchCalendars = jest.fn();
const mockFetchCalendarObjects = jest.fn();
const mockCreateCalendarObject = jest.fn();
const mockDeleteCalendarObject = jest.fn();

jest.mock('tsdav', () => ({
  createDAVClient: jest.fn(async () => ({
    fetchCalendars: mockFetchCalendars,
    fetchCalendarObjects: mockFetchCalendarObjects,
    createCalendarObject: mockCreateCalendarObject,
    deleteCalendarObject: mockDeleteCalendarObject,
  })),
}));

describe('AppleCalendarService', () => {
  let service: AppleCalendarService;
  const credentials = { username: 'user@icloud.com', appPassword: 'app-specific-pass' };

  beforeEach(() => {
    service = new AppleCalendarService();
    jest.clearAllMocks();
  });

  describe('listCalendars', () => {
    it('should map DAV calendars into the shared calendar shape', async () => {
      mockFetchCalendars.mockResolvedValue([
        {
          url: 'https://caldav.icloud.com/123/calendars/home/',
          displayName: 'Home',
          calendarColor: '#7EA9E4',
        },
      ]);

      const result = await service.listCalendars(credentials);

      expect(result).toEqual([
        {
          id: 'https://caldav.icloud.com/123/calendars/home/',
          summary: 'Home',
          backgroundColor: '#7EA9E4',
        },
      ]);
    });
  });

  describe('listEvents', () => {
    it('should parse VEVENT components out of returned iCal data', async () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'UID:abc123',
        'DTSTAMP:20260101T000000Z',
        'DTSTART:20260101T100000Z',
        'DTEND:20260101T110000Z',
        'SUMMARY:Dentist appointment',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      mockFetchCalendarObjects.mockResolvedValue([
        {
          url: 'https://caldav.icloud.com/123/calendars/home/abc123.ics',
          etag: 'etag1',
          data: ics,
        },
      ]);

      const result = await service.listEvents(
        credentials,
        'https://caldav.icloud.com/123/calendars/home/',
        new Date('2026-01-01'),
      );

      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('Dentist appointment');
      expect(result[0].id).toBe('https://caldav.icloud.com/123/calendars/home/abc123.ics');
    });
  });

  describe('createEvent', () => {
    it('should build an ICS payload and create the calendar object', async () => {
      mockCreateCalendarObject.mockResolvedValue({ ok: true });

      const result = await service.createEvent(
        credentials,
        'https://caldav.icloud.com/123/calendars/home/',
        {
          title: 'Team sync',
          startTime: '2026-01-01T10:00:00.000Z',
          endTime: '2026-01-01T11:00:00.000Z',
        },
      );

      expect(mockCreateCalendarObject).toHaveBeenCalledWith(
        expect.objectContaining({
          calendar: { url: 'https://caldav.icloud.com/123/calendars/home/' },
          iCalString: expect.stringContaining('SUMMARY:Team sync'),
        }),
      );
      expect(result.id).toContain('.ics');
    });
  });

  describe('deleteEvent', () => {
    it('should delete the calendar object by URL', async () => {
      await service.deleteEvent(
        credentials,
        'https://caldav.icloud.com/123/calendars/home/',
        'https://caldav.icloud.com/123/calendars/home/abc123.ics',
      );

      expect(mockDeleteCalendarObject).toHaveBeenCalledWith({
        calendarObject: {
          url: 'https://caldav.icloud.com/123/calendars/home/abc123.ics',
          etag: '',
        },
      });
    });
  });
});
