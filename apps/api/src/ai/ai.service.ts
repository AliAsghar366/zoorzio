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

  async describeImage(imageUrl: string, caption?: string): Promise<{ description: string; extractedText: string }> {
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
      return { reply: "Sorry, I'm having trouble responding right now. Please try again in a moment." };
    }
  }
}
