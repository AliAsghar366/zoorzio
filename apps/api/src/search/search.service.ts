import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VectorSearchService } from './vector-search.service';
import { TextSearchService } from './text-search.service';
import { AIService } from '../ai/ai.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private vectorSearch: VectorSearchService,
    private textSearch: TextSearchService,
    private aiService: AIService,
  ) {}

  async search(userId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // Perform both vector and text search
      const [vectorResults, textResults] = await Promise.all([
        this.vectorSearch.search(userId, queryEmbedding, limit),
        this.textSearch.search(userId, query, limit),
      ]);

      // Merge and rank results
      const mergedResults = this.mergeResults(vectorResults, textResults, limit);

      return mergedResults;
    } catch (error) {
      this.logger.error('Search failed', error);
      return [];
    }
  }

  async indexMemory(memory: any): Promise<void> {
    try {
      await this.vectorSearch.index(memory);
      await this.textSearch.index(memory);
    } catch (error) {
      this.logger.error('Failed to index memory', error);
    }
  }

  async updateMemory(memory: any): Promise<void> {
    try {
      await this.vectorSearch.update(memory);
      await this.textSearch.update(memory);
    } catch (error) {
      this.logger.error('Failed to update memory index', error);
    }
  }

  async removeMemory(memoryId: string): Promise<void> {
    try {
      await this.vectorSearch.remove(memoryId);
      await this.textSearch.remove(memoryId);
    } catch (error) {
      this.logger.error('Failed to remove memory from index', error);
    }
  }

  private mergeResults(vectorResults: any[], textResults: any[], limit: number): any[] {
    const scoreMap = new Map<string, number>();
    const recordMap = new Map<string, any>();

    // Score vector results
    vectorResults.forEach((result, index) => {
      const score = 1 - (index / vectorResults.length);
      scoreMap.set(result.id, (scoreMap.get(result.id) || 0) + score * 0.7);
      recordMap.set(result.id, result);
    });

    // Score text results
    textResults.forEach((result, index) => {
      const score = 1 - (index / textResults.length);
      scoreMap.set(result.id, (scoreMap.get(result.id) || 0) + score * 0.3);
      if (!recordMap.has(result.id)) recordMap.set(result.id, result);
    });

    // Sort by score and return top results, keeping the full record
    // (previously this dropped every field except id/score)
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({
        ...recordMap.get(id),
        id,
        score,
      }));
  }
}
