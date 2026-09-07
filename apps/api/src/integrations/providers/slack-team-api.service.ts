import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const SLACK_API = 'https://slack.com/api';

export interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
}

@Injectable()
export class SlackTeamApiService {
  private readonly logger = new Logger(SlackTeamApiService.name);

  constructor(private readonly http: HttpService) {}

  private headers(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async listChannels(accessToken: string): Promise<SlackChannel[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${SLACK_API}/conversations.list`, {
          headers: this.headers(accessToken),
          params: { types: 'public_channel,private_channel', limit: 100 },
        }),
      );
      if (response.data.ok === false) {
        throw new BadRequestException(response.data.error || 'Slack returned ok:false');
      }
      return response.data.channels.map((c: any) => ({ id: c.id, name: c.name, isMember: c.is_member }));
    } catch (error) {
      this.logger.error('Failed to list Slack channels', error);
      throw error;
    }
  }

  async postMessage(accessToken: string, channelId: string, text: string): Promise<{ ts: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${SLACK_API}/chat.postMessage`,
          { channel: channelId, text },
          { headers: this.headers(accessToken) },
        ),
      );
      if (response.data.ok === false) {
        throw new BadRequestException(response.data.error || 'Slack rejected the message');
      }
      return { ts: response.data.ts };
    } catch (error) {
      this.logger.error('Failed to post Slack message', error);
      throw error;
    }
  }
}
