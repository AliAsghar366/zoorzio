import { Injectable, Logger } from '@nestjs/common';
import { AiClientService } from './ai-client.service';

export interface ExtractedTask {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
}

export interface SentimentResult {
  sentiment: string;
  confidence: number;
  emotions: string[];
}

export interface EntityExtractionResult {
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  amounts: string[];
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private readonly aiClient: AiClientService) {}

  async generateSummary(content: string): Promise<string> {
    try {
      const { summary } = await this.aiClient.summarize(content);
      return summary.trim();
    } catch (error) {
      this.logger.error('Failed to generate summary', error);
      return content.substring(0, 200);
    }
  }

  async generateEmbedding(content: string): Promise<number[]> {
    try {
      const { embedding } = await this.aiClient.embeddings(content);
      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      // Zero vector fallback keeps downstream pgvector queries well-formed
      // even if the AI service is temporarily unreachable.
      return new Array(1536).fill(0);
    }
  }

  async extractTask(content: string): Promise<ExtractedTask | null> {
    try {
      const result = await this.aiClient.extractTask(content);
      return {
        title: result.title,
        description: result.description,
        dueDate: result.due_date,
        priority: result.priority,
      };
    } catch (error) {
      this.logger.error('Failed to extract task', error);
      return null;
    }
  }

  async categorizeContent(content: string): Promise<string[]> {
    try {
      const { categories } = await this.aiClient.categorize(content);
      return categories.length > 0 ? categories : ['other'];
    } catch (error) {
      this.logger.error('Failed to categorize content', error);
      return ['other'];
    }
  }

  async extractEntities(content: string): Promise<EntityExtractionResult> {
    try {
      return await this.aiClient.extractEntities(content);
    } catch (error) {
      this.logger.error('Failed to extract entities', error);
      return { people: [], organizations: [], locations: [], dates: [], amounts: [] };
    }
  }

  async transcribeAudio(audioBuffer: Buffer, language: string = 'en'): Promise<string> {
    try {
      const { text } = await this.aiClient.transcribe(
        audioBuffer.toString('base64'),
        'audio.ogg',
        language,
      );
      return text;
    } catch (error) {
      this.logger.error('Failed to transcribe audio', error);
      return '[Transcription failed]';
    }
  }

  async describeImage(
    imageUrl: string,
    caption?: string,
  ): Promise<{ description: string; extractedText: string }> {
    try {
      const result = await this.aiClient.describeImage(imageUrl, caption);
      return { description: result.description, extractedText: result.extracted_text };
    } catch (error) {
      this.logger.error('Failed to describe image', error);
      return { description: '', extractedText: '' };
    }
  }

  async analyzeSentiment(content: string): Promise<SentimentResult> {
    try {
      return await this.aiClient.sentiment(content);
    } catch (error) {
      this.logger.error('Failed to analyze sentiment', error);
      return { sentiment: 'neutral', confidence: 0.5, emotions: [] };
    }
  }

  async suggestTags(content: string): Promise<string[]> {
    try {
      const { tags } = await this.aiClient.suggestTags(content);
      return tags;
    } catch (error) {
      this.logger.error('Failed to suggest tags', error);
      return [];
    }
  }

  async generateChatReply(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context?: string,
    userName?: string,
    tools?: Record<string, unknown>[],
  ): Promise<{ reply: string; toolCalls?: { id: string; name: string; arguments: string }[] }> {
    try {
      const { reply, tool_calls } = await this.aiClient.chat(messages, context, userName, tools);
      return { reply, toolCalls: tool_calls };
    } catch (error) {
      this.logger.error('Failed to generate chat reply', error);
      return { reply: chatFailureMessage(error) };
    }
  }
}

/**
 * What to tell the user when the model call fails.
 *
 * Every failure used to say "try again in a moment". When the cause is the
 * provider's rate limit - Groq's free tier stops at 200k tokens a day - a
 * moment later fails identically, for up to an hour, and the assistant reads
 * as broken rather than paused. Say which it is, and roughly when it returns
 * when the provider tells us.
 */
export function chatFailureMessage(error: unknown): string {
  const data = (error as any)?.response?.data;
  const detail = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  const status = (error as any)?.response?.status;

  const rateLimited = /rate limit|tokens per day|TPD|429/i.test(detail);
  if (rateLimited) {
    const wait = /try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(detail);
    let minutes = 0;
    if (wait) {
      minutes = (Number(wait[1] || 0) * 60) + Number(wait[2] || 0) + (Number(wait[3] || 0) > 0 ? 1 : 0);
    }
    const when = minutes > 0 ? ` It should be back in about ${minutes} minute${minutes === 1 ? '' : 's'}.` : '';
    return (
      "I've reached today's usage limit for my AI model, so I can't answer right now." + when +
      ' Nothing you sent was lost - your tasks, reminders and lists are all still there.'
    );
  }

  if (status === 503) {
    return "My AI model isn't configured on the server yet, so I can't answer. Please let the Zoorzio team know.";
  }

  return "Sorry, I'm having trouble responding right now. Please try again in a moment.";
}
