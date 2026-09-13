import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly http: HttpService) {}

  private authHeaders(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async listCalendars(accessToken: string): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
          headers: this.authHeaders(accessToken),
        }),
      );
      return response.data.items ?? [];
    } catch (error) {
      this.handleError('listCalendars', error);
      throw error;
    }
  }

  async listEvents(accessToken: string, calendarId: string, since: Date): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
          headers: this.authHeaders(accessToken),
          params: {
            updatedMin: since.toISOString(),
            singleEvents: true,
            orderBy: 'updated',
            maxResults: 250,
          },
        }),
      );
      return response.data.items ?? [];
    } catch (error) {
      this.handleError('listEvents', error);
      throw error;
    }
  }

  /**
   * Creates a real event on the user's Google Calendar.
   *
   * `attendees` are invited by Google itself (it sends the invitation emails),
   * and `withMeet` asks Google to mint a Meet conference - which requires the
   * conferenceDataVersion=1 query param, without which Google silently ignores
   * the conferenceData block and returns an event with no link.
   */
  async createEvent(accessToken: string, calendarId: string, eventData: any): Promise<any> {
    try {
      const attendees: string[] = Array.isArray(eventData.attendees) ? eventData.attendees : [];
      const wantsMeet = eventData.withMeet !== false;

      const response = await firstValueFrom(
        this.http.post(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            summary: eventData.title,
            description: eventData.description,
            location: eventData.location,
            start: eventData.allDay
              ? { date: toDateOnly(eventData.startTime) }
              : {
                  dateTime: new Date(eventData.startTime).toISOString(),
                  ...(eventData.timezone ? { timeZone: eventData.timezone } : {}),
                },
            end: eventData.allDay
              ? { date: toDateOnly(eventData.endTime) }
              : {
                  dateTime: new Date(eventData.endTime).toISOString(),
                  ...(eventData.timezone ? { timeZone: eventData.timezone } : {}),
                },
            ...(attendees.length > 0 ? { attendees: attendees.map((email) => ({ email })) } : {}),
            ...(wantsMeet
              ? {
                  conferenceData: {
                    createRequest: {
                      requestId: randomUUID(),
                      conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                  },
                }
              : {}),
          },
          {
            headers: this.authHeaders(accessToken),
            params: {
              ...(wantsMeet ? { conferenceDataVersion: 1 } : {}),
              ...(attendees.length > 0 ? { sendUpdates: 'all' } : {}),
            },
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.handleError('createEvent', error);
      throw error;
    }
  }

  /** Partial update - only the fields present in `changes` are sent to Google. */
  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    changes: any,
  ): Promise<any> {
    try {
      const attendees: string[] | undefined = Array.isArray(changes.attendees)
        ? changes.attendees
        : undefined;

      const body: Record<string, unknown> = {};
      if (changes.title !== undefined) body.summary = changes.title;
      if (changes.description !== undefined) body.description = changes.description;
      if (changes.location !== undefined) body.location = changes.location;
      if (changes.startTime !== undefined) {
        body.start = {
          dateTime: new Date(changes.startTime).toISOString(),
          ...(changes.timezone ? { timeZone: changes.timezone } : {}),
        };
      }
      if (changes.endTime !== undefined) {
        body.end = {
          dateTime: new Date(changes.endTime).toISOString(),
          ...(changes.timezone ? { timeZone: changes.timezone } : {}),
        };
      }
      if (attendees) body.attendees = attendees.map((email) => ({ email }));

      const response = await firstValueFrom(
        this.http.patch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          body,
          {
            headers: this.authHeaders(accessToken),
            ...(attendees ? { params: { sendUpdates: 'all' } } : {}),
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.handleError('updateEvent', error);
      throw error;
    }
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { headers: this.authHeaders(accessToken) },
        ),
      );
    } catch (error) {
      // Google returns 410 Gone for already-deleted events - treat as success
      if ((error as AxiosError)?.response?.status === 410) return;
      this.handleError('deleteEvent', error);
      throw error;
    }
  }

  private handleError(operation: string, error: unknown) {
    const axiosError = error as AxiosError;
    this.logger.error(
      `Google Calendar ${operation} failed: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
    );
  }
}

function toDateOnly(value: string | Date): string {
  return new Date(value).toISOString().split('T')[0];
}
