import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

/**
 * Embeddings are stored as a plain Postgres `double precision[]` column
 * (Prisma `Float[]`) rather than a pgvector `vector` column, so this
 * environment doesn't depend on the pgvector extension being installed.
 * Similarity ranking is therefore computed in application code instead of
 * via a native `<=>` operator - fine at this dataset size, though it won't
 * scale to a large per-user memory count the way an ANN index would.
 */
@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
  ) {}

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(userId: string, queryEmbedding: number[], limit: number = 10): Promise<any[]> {
    try {
      const candidates = await this.prisma.memory.findMany({
        where: { userId, isArchived: false, NOT: { embedding: { isEmpty: true } } },
        select: { id: true, content: true, summary: true, type: true, source: true, tags: true, embedding: true },
      });

      return candidates
        .map((memory) => ({
          ...memory,
          similarity: this.cosineSimilarity(queryEmbedding, memory.embedding),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ embedding, ...rest }) => rest);
    } catch (error) {
      this.logger.error('Vector search failed', error);
      return [];
    }
  }

  async index(memory: { id: string; embedding?: number[] }): Promise<void> {
    try {
      if (!memory.embedding) {
        this.logger.warn('No embedding provided for memory indexing');
        return;
      }

      await this.prisma.memory.update({ where: { id: memory.id }, data: { embedding: memory.embedding } });
      this.logger.log(`Indexed memory ${memory.id}`);
    } catch (error) {
      this.logger.error('Failed to index memory', error);
    }
  }

  async update(memory: { id: string; embedding?: number[] }): Promise<void> {
    try {
      if (!memory.embedding) {
        // Content changed but the embedding didn't (e.g. metadata-only edit) -
        // nothing to do here, the text search index is refreshed separately.
        return;
      }

      await this.prisma.memory.update({ where: { id: memory.id }, data: { embedding: memory.embedding } });
      this.logger.log(`Updated memory index ${memory.id}`);
    } catch (error) {
      this.logger.error('Failed to update memory index', error);
    }
  }

  async remove(memoryId: string): Promise<void> {
    try {
      await this.prisma.memory.update({ where: { id: memoryId }, data: { embedding: [] } });
      this.logger.log(`Removed memory from index ${memoryId}`);
    } catch (error) {
      this.logger.error('Failed to remove memory from index', error);
    }
  }

  async rebuildIndex(userId: string): Promise<void> {
    try {
      const memories = await this.prisma.memory.findMany({
        where: { userId, isArchived: false, embedding: { isEmpty: true } },
        select: { id: true, content: true },
      });

      this.logger.log(`Rebuilding index for ${memories.length} memories`);

      for (const memory of memories) {
        const embedding = await this.aiService.generateEmbedding(memory.content);
        await this.prisma.memory.update({ where: { id: memory.id }, data: { embedding } });
      }

      this.logger.log(`Rebuilt index for ${memories.length} memories`);
    } catch (error) {
      this.logger.error('Failed to rebuild index', error);
    }
  }
}
