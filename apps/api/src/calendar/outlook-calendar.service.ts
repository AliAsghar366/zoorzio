import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class OutlookCalendarService {
  private readonly logger = new Logger(OutlookCalendarService.name);

  constructor(private readonly http: HttpService) {}

  private authHeaders(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async listCalendars(accessToken: string): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GRAPH_API}/me/calendars`, {
          headers: this.authHeaders(accessToken),
        }),
      );
      return (response.data.value ?? []).map((cal: any) => ({
        id: cal.id,
        name: cal.name,
        color: cal.hexColor || cal.color,
      }));
    } catch (error) {
      this.handleError('listCalendars', error);
      throw error;
    }
  }

  async listEvents(accessToken: string, calendarId: string, since: Date): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GRAPH_API}/me/calendars/${encodeURIComponent(calendarId)}/events`, {
          headers: {
            ...this.authHeaders(accessToken),
            Prefer: 'outlook.timezone="UTC"',
          },
          params: {
            $filter: `lastModifiedDateTime ge ${since.toISOString()}`,
            $top: 250,
            $orderby: 'lastModifiedDateTime',
          },
        }),
      );
      return response.data.value ?? [];
    } catch (error) {
      this.handleError('listEvents', error);
      throw error;
    }
  }

  async createEvent(accessToken: string, calendarId: string, eventData: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${GRAPH_API}/me/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            subject: eventData.title,
            body: { contentType: 'text', content: eventData.description ?? '' },
            location: { displayName: eventData.location ?? '' },
            isAllDay: !!eventData.allDay,
            start: { dateTime: new Date(eventData.startTime).toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(eventData.endTime).toISOString(), timeZone: 'UTC' },
          },
          { headers: this.authHeaders(accessToken) },
        ),
      );
      return response.data;
    } catch (error) {
      this.handleError('createEvent', error);
      throw error;
    }
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(
          `${GRAPH_API}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { headers: this.authHeaders(accessToken) },
        ),
      );
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) return;
      this.handleError('deleteEvent', error);
      throw error;
    }
  }

  private handleError(operation: string, error: unknown) {
    const axiosError = error as AxiosError;
    this.logger.error(
      `Outlook Calendar ${operation} failed: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
    );
  }
}
