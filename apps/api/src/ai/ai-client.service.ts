import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * Thin HTTP client for the apps/ai FastAPI service, which is the single place
 * that actually talks to OpenAI. Keeping AI provider calls in one service
 * (instead of duplicated Node + Python implementations) avoids the two
 * copies drifting out of sync.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.baseUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${path}`, body, { timeout: 30000 }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `AI service ${path} failed: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
      );
      throw error;
    }
  }

  embeddings(text: string): Promise<{ embedding: number[]; model: string; usage: Record<string, number> }> {
    return this.post('/embeddings', { text });
  }

  summarize(content: string, maxLength = 200): Promise<{ summary: string; key_points: string[] }> {
    return this.post('/summarize', { content, max_length: maxLength });
  }

  extractTask(content: string): Promise<{
    title: string;
    description: string | null;
    due_date: string | null;
    priority: string;
  }> {
    return this.post('/extract-task', { content });
  }

  transcribe(
    audioBase64: string,
    filename: string,
    language = 'en',
  ): Promise<{ text: string; language: string; confidence: number; segments: unknown[] }> {
    return this.post('/transcribe', { audio_base64: audioBase64, filename, language });
  }

  sentiment(content: string): Promise<{ sentiment: string; confidence: number; emotions: string[] }> {
    return this.post('/sentiment', { content });
  }

  describeImage(imageUrl: string, caption?: string): Promise<{ description: string; extracted_text: string }> {
    return this.post('/describe-image', { image_url: imageUrl, caption });
  }

  categorize(content: string): Promise<{ categories: string[]; confidence: number }> {
    return this.post('/categorize', { content });
  }

  extractEntities(content: string): Promise<{
    people: string[];
    organizations: string[];
    locations: string[];
    dates: string[];
    amounts: string[];
  }> {
    return this.post('/extract-entities', { content });
  }

  suggestTags(content: string): Promise<{ tags: string[] }> {
    return this.post('/suggest-tags', { content });
  }

  chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context?: string,
    userName?: string,
    tools?: Record<string, unknown>[],
  ): Promise<{ reply: string; tool_calls?: { id: string; name: string; arguments: string }[] }> {
    return this.post('/chat', { messages, context, user_name: userName, tools });
  }
}
