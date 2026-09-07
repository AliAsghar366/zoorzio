import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { SearchService } from '../search/search.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { MemoryType, ChannelType, TaskPriority } from '@anchor/database';

const VALID_TASK_PRIORITIES = new Set(Object.values(TaskPriority));

function toTaskPriority(value: string | undefined): TaskPriority {
  const upper = value?.toUpperCase();
  return upper && VALID_TASK_PRIORITIES.has(upper as TaskPriority)
    ? (upper as TaskPriority)
    : TaskPriority.MEDIUM;
}

@Injectable()
export class MemoryService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private searchService: SearchService,
    private planLimits: PlanLimitsService,
  ) {}

  async createFromVoice(userId: string, audioBase64: string, tags?: string[]) {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const transcript = await this.aiService.transcribeAudio(audioBuffer);

    return this.create(userId, {
      content: transcript,
      type: MemoryType.VOICE_NOTE,
      source: ChannelType.NATIVE_APP,
      tags: tags || [],
    });
  }

  async create(userId: string, createMemoryDto: CreateMemoryDto) {
    await this.planLimits.assertCanCreate(userId, 'memories');

    const { content, type, source, metadata, tags } = createMemoryDto;

    // Generate summary using AI
    const summary = await this.aiService.generateSummary(content);

    // Generate embedding for semantic search
    const embedding = await this.aiService.generateEmbedding(content);

    const memory = await this.prisma.memory.create({
      data: {
        userId,
        content,
        summary,
        type: type as MemoryType,
        source: source as ChannelType,
        metadata: metadata || {},
        tags: tags || [],
      },
    });

    // Index for search (writes the embedding + full-text vector via raw SQL)
    await this.searchService.indexMemory({ id: memory.id, content: memory.content, embedding });

    // Create knowledge item for semantic search
    await this.prisma.knowledgeItem.create({
      data: {
        memoryId: memory.id,
        userId,
        content,
        type: 'memory',
        embedding,
      },
    });

    // Auto-generate tasks if content suggests action items
    await this.autoGenerateTasks(userId, memory);

    return memory;
  }

  async findAll(userId: string, query: QueryMemoryDto) {
    const { type, source, tags, limit = 20, offset = 0, search, isVerified } = query;

    // Build filter conditions
    const where: any = {
      userId,
      isArchived: false,
    };

    if (type) where.type = type;
    if (source) where.source = source;
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';

    // If search query provided, use semantic search
    if (search) {
      const searchResults = await this.searchService.search(userId, search, limit);
      const memoryIds = searchResults.map(r => r.id);
      
      return this.prisma.memory.findMany({
        where: {
          id: { in: memoryIds },
          ...where,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    }

    // Regular database query
    return this.prisma.memory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findOne(userId: string, id: string) {
    const memory = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!memory) {
      throw new NotFoundException('Memory not found');
    }

    if (memory.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Update access stats
    await this.prisma.memory.update({
      where: { id },
      data: {
        lastAccessed: new Date(),
        accessCount: { increment: 1 },
      },
    });

    return memory;
  }

  async update(userId: string, id: string, updateMemoryDto: UpdateMemoryDto) {
    const memory = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!memory) {
      throw new NotFoundException('Memory not found');
    }

    if (memory.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const { content, type, source, metadata, tags, isVerified } = updateMemoryDto;

    // Only regenerate the embedding if the content actually changed - it's
    // a paid AI call, and the vector column can't be touched by this
    // `update()` call itself (see the create() comment on Unsupported types).
    let embedding: number[] | undefined;
    if (content && content !== memory.content) {
      embedding = await this.aiService.generateEmbedding(content);
    }

    // Update memory
    const updated = await this.prisma.memory.update({
      where: { id },
      data: {
        content: content || undefined,
        type: type as MemoryType || undefined,
        source: source as ChannelType || undefined,
        metadata: metadata || undefined,
        tags: tags || undefined,
        isVerified: isVerified === undefined ? undefined : isVerified,
      },
    });

    // Update search index (writes the new embedding via raw SQL if regenerated)
    await this.searchService.updateMemory({ id: updated.id, content: updated.content, embedding });

    return updated;
  }

  async remove(userId: string, id: string) {
    const memory = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!memory) {
      throw new NotFoundException('Memory not found');
    }

    if (memory.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Soft delete - archive instead of delete
    await this.prisma.memory.update({
      where: { id },
      data: { isArchived: true },
    });

    // Remove from search index
    await this.searchService.removeMemory(id);

    return { success: true };
  }

  async search(userId: string, query: string, limit: number = 10) {
    return this.searchService.search(userId, query, limit);
  }

  async getRecentMemories(userId: string, limit: number = 10) {
    return this.prisma.memory.findMany({
      where: {
        userId,
        isArchived: false,
      },
      orderBy: { lastAccessed: 'desc' },
      take: limit,
    });
  }

  async getFrequentlyAccessed(userId: string, limit: number = 10) {
    return this.prisma.memory.findMany({
      where: {
        userId,
        isArchived: false,
      },
      orderBy: { accessCount: 'desc' },
      take: limit,
    });
  }

  async getMemoryStats(userId: string) {
    const [total, byType, bySource] = await Promise.all([
      this.prisma.memory.count({
        where: { userId, isArchived: false },
      }),
      this.prisma.memory.groupBy({
        by: ['type'],
        where: { userId, isArchived: false },
        _count: true,
      }),
      this.prisma.memory.groupBy({
        by: ['source'],
        where: { userId, isArchived: false },
        _count: true,
      }),
    ]);

    return {
      total,
      byType: byType.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {}),
      bySource: bySource.reduce<Record<string, number>>((acc, item) => {
        acc[item.source] = item._count;
        return acc;
      }, {}),
    };
  }

  private async autoGenerateTasks(userId: string, memory: any) {
    const lowerContent = memory.content.toLowerCase();
    const mentionsReminder = /\bremind(er|ers|ing)?\b/.test(lowerContent);
    const taskIndicators = ['todo', 'need to', 'must', 'should', 'deadline'];
    const mentionsTask = taskIndicators.some((indicator) => lowerContent.includes(indicator));

    if (!mentionsReminder && !mentionsTask) {
      return;
    }

    const taskDetails = await this.aiService.extractTask(memory.content);
    if (!taskDetails) {
      return;
    }

    // "Remind me to X at Y" should become an actual scheduled Reminder
    // (delivered back over WhatsApp/Telegram) rather than a plain Task,
    // as long as the AI could pin down a concrete due date/time.
    if (mentionsReminder && taskDetails.dueDate) {
      await this.prisma.reminder.create({
        data: {
          userId,
          memoryId: memory.id,
          title: taskDetails.title,
          message: taskDetails.description ?? undefined,
          scheduledAt: new Date(taskDetails.dueDate),
        },
      });
      return;
    }

    await this.prisma.task.create({
      data: {
        userId,
        memoryId: memory.id,
        title: taskDetails.title,
        description: taskDetails.description,
        dueDate: taskDetails.dueDate,
        priority: toTaskPriority(taskDetails.priority),
      },
    });
  }
}
