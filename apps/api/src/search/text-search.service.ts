import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TextSearchService {
  private readonly logger = new Logger(TextSearchService.name);

  constructor(private prisma: PrismaService) {}

  async search(userId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      // Use PostgreSQL full-text search
      const results = await this.prisma.$queryRaw<any[]>`
        SELECT 
          id,
          content,
          summary,
          type,
          source,
          tags,
          ts_rank(
            to_tsvector('english', content || ' ' || COALESCE(summary, '')),
            plainto_tsquery('english', ${query})
          ) as rank
        FROM memories
        WHERE user_id = ${userId}
          AND is_archived = false
          AND to_tsvector('english', content || ' ' || COALESCE(summary, '')) @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
      `;

      return results;
    } catch (error) {
      this.logger.error('Text search failed', error);
      return [];
    }
  }

  async index(memory: any): Promise<void> {
    try {
      // Create search vector if not exists
      await this.prisma.$executeRaw`
        UPDATE memories
        SET search_vector = to_tsvector('english', content || ' ' || COALESCE(summary, ''))
        WHERE id = ${memory.id}
      `;

      this.logger.log(`Indexed memory for text search ${memory.id}`);
    } catch (error) {
      this.logger.error('Failed to index memory for text search', error);
    }
  }

  async update(memory: any): Promise<void> {
    try {
      // Update search vector
      await this.prisma.$executeRaw`
        UPDATE memories
        SET search_vector = to_tsvector('english', content || ' ' || COALESCE(summary, ''))
        WHERE id = ${memory.id}
      `;

      this.logger.log(`Updated text search index ${memory.id}`);
    } catch (error) {
      this.logger.error('Failed to update text search index', error);
    }
  }

  async remove(memoryId: string): Promise<void> {
    try {
      // Clear search vector
      await this.prisma.$executeRaw`
        UPDATE memories
        SET search_vector = NULL
        WHERE id = ${memoryId}
      `;

      this.logger.log(`Removed memory from text search index ${memoryId}`);
    } catch (error) {
      this.logger.error('Failed to remove memory from text search index', error);
    }
  }
}
