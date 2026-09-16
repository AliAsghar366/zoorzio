import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEditedAt: string;
  object: 'page' | 'database';
}

@Injectable()
export class NotionApiService {
  private readonly logger = new Logger(NotionApiService.name);

  constructor(private readonly http: HttpService) {}

  private headers(accessToken: string) {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Searches pages/databases shared with the Zoorzio Notion integration.
   * Notion's model requires the user to explicitly share pages with the
   * integration from Notion itself - an empty result usually means nothing
   * has been shared yet, not that the connection is broken.
   */
  async searchPages(accessToken: string, query?: string): Promise<NotionPage[]> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${NOTION_API}/search`,
          {
            ...(query ? { query } : {}),
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 20,
          },
          { headers: this.headers(accessToken) },
        ),
      );
      return response.data.results.map((r: any) => ({
        id: r.id,
        title: this.extractTitle(r),
        url: r.url,
        lastEditedAt: r.last_edited_time,
        object: r.object,
      }));
    } catch (error) {
      this.logger.error('Failed to search Notion', error);
      throw error;
    }
  }

  private extractTitle(page: any): string {
    if (page.object === 'database') {
      return page.title?.map((t: any) => t.plain_text).join('') || 'Untitled database';
    }
    const props = page.properties || {};
    const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
    return titleProp?.title?.map((t: any) => t.plain_text).join('') || 'Untitled';
  }
}
