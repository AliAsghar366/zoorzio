import { Injectable, Logger } from '@nestjs/common';
import { createDAVClient, DAVCalendar } from 'tsdav';
import * as ical from 'node-ical';
import { randomUUID } from 'crypto';

const ICLOUD_SERVER_URL = 'https://caldav.icloud.com';

export interface AppleCredentials {
  username: string;
  appPassword: string;
}

/**
 * Apple/iCloud has no OAuth REST API for third-party calendar access -
 * CalDAV with an app-specific password (generated at appleid.apple.com) is
 * the only supported integration path. This mirrors the Google/Outlook
 * service interface (listCalendars/listEvents/createEvent/deleteEvent) so
 * CalendarService can treat all three providers uniformly.
 */
@Injectable()
export class AppleCalendarService {
  private readonly logger = new Logger(AppleCalendarService.name);

  private async client(credentials: AppleCredentials) {
    return createDAVClient({
      serverUrl: ICLOUD_SERVER_URL,
      credentials: { username: credentials.username, password: credentials.appPassword },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
  }

  async listCalendars(credentials: AppleCredentials): Promise<any[]> {
    try {
      const client = await this.client(credentials);
      const calendars = await client.fetchCalendars();
      return calendars.map((cal) => ({
        id: cal.url,
        summary: (cal.displayName as string) || 'iCloud Calendar',
        backgroundColor: (cal as any).calendarColor || '#7EA9E4',
      }));
    } catch (error) {
      this.handleError('listCalendars', error);
      throw error;
    }
  }

  async listEvents(credentials: AppleCredentials, calendarUrl: string, since: Date): Promise<any[]> {
    try {
      const client = await this.client(credentials);
      const objects = await client.fetchCalendarObjects({
        calendar: { url: calendarUrl } as DAVCalendar,
        timeRange: { start: since.toISOString(), end: '2100-01-01T00:00:00.000Z' },
      });

      const events: any[] = [];
      for (const obj of objects) {
        if (!obj.data) continue;
        const parsed = ical.sync.parseICS(obj.data);
        for (const key of Object.keys(parsed)) {
          const component = parsed[key];
          if (component.type !== 'VEVENT') continue;
          events.push({
            id: obj.url,
            etag: obj.etag,
            summary: component.summary,
            description: component.description,
            location: component.location,
            start: { dateTime: new Date(component.start as Date).toISOString() },
            end: { dateTime: new Date((component.end as Date) || component.start).toISOString() },
          });
        }
      }
      return events;
    } catch (error) {
      this.handleError('listEvents', error);
      throw error;
    }
  }

  async createEvent(credentials: AppleCredentials, calendarUrl: string, eventData: any): Promise<any> {
    try {
      const client = await this.client(credentials);
      const uid = randomUUID();
      const iCalString = this.buildIcs(uid, eventData);

      await client.createCalendarObject({
        calendar: { url: calendarUrl } as DAVCalendar,
        filename: `${uid}.ics`,
        iCalString,
      });

      return { id: `${calendarUrl}${calendarUrl.endsWith('/') ? '' : '/'}${uid}.ics` };
    } catch (error) {
      this.handleError('createEvent', error);
      throw error;
    }
  }

  async deleteEvent(credentials: AppleCredentials, _calendarUrl: string, eventUrl: string): Promise<void> {
    try {
      const client = await this.client(credentials);
      await client.deleteCalendarObject({ calendarObject: { url: eventUrl, etag: '' } });
    } catch (error) {
      this.handleError('deleteEvent', error);
      throw error;
    }
  }

  private buildIcs(uid: string, eventData: any): string {
    const toIcsDate = (value: string | Date) =>
      new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zoorzio//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(eventData.startTime)}`,
      `DTEND:${toIcsDate(eventData.endTime)}`,
      `SUMMARY:${escapeIcsText(eventData.title || '')}`,
      eventData.description ? `DESCRIPTION:${escapeIcsText(eventData.description)}` : '',
      eventData.location ? `LOCATION:${escapeIcsText(eventData.location)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
  }

  private handleError(operation: string, error: unknown) {
    this.logger.error(`Apple Calendar ${operation} failed: ${(error as Error)?.message}`);
  }
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
