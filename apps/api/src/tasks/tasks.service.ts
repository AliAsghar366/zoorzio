import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { BoardsService } from '../boards/boards.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from '@anchor/database';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private planLimits: PlanLimitsService,
    private boardsService: BoardsService,
  ) {}

  async create(userId: string, createTaskDto: CreateTaskDto) {
    await this.planLimits.assertCanCreate(userId, 'tasks');

    const { title, description, dueDate, priority, memoryId, boardId } = createTaskDto;

    // If linked to memory, verify it exists
    if (memoryId) {
      const memory = await this.prisma.memory.findUnique({
        where: { id: memoryId },
      });

      if (!memory || memory.userId !== userId) {
        throw new NotFoundException('Memory not found');
      }
    }

    let resolvedBoardId = boardId;
    if (resolvedBoardId) {
      const board = await this.prisma.board.findUnique({ where: { id: resolvedBoardId } });
      if (!board || board.userId !== userId) {
        throw new NotFoundException('Board not found');
      }
    } else {
      resolvedBoardId = (await this.boardsService.getOrCreateDefault(userId)).id;
    }

    return this.prisma.task.create({
      data: {
        userId,
        memoryId,
        boardId: resolvedBoardId,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority || 'MEDIUM',
      },
    });
  }

  async findAll(userId: string, status?: string, limit: number = 50, boardId?: string) {
    const where: any = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    if (boardId) {
      where.boardId = boardId;
    }

    return this.prisma.task.findMany({
      where,
      include: {
        memory: {
          select: {
            id: true,
            content: true,
            summary: true,
          },
        },
        reminders: true,
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        memory: true,
        reminders: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return task;
  }

  async update(userId: string, id: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const { title, description, status, priority, dueDate, boardId } = updateTaskDto;

    if (boardId) {
      const board = await this.prisma.board.findUnique({ where: { id: boardId } });
      if (!board || board.userId !== userId) {
        throw new NotFoundException('Board not found');
      }
    }

    // If marking as completed, set completedAt
    const completedAt = status === 'COMPLETED' ? new Date() : undefined;

    return this.prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        status: status as any,
        priority: priority as any,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        boardId,
        completedAt,
      },
    });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return { success: true };
  }

  async getTasksDueToday(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.task.findMany({
      where: {
        userId,
        status: { not: 'COMPLETED' },
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { priority: 'desc' },
    });
  }

  async getOverdueTasks(userId: string) {
    return this.prisma.task.findMany({
      where: {
        userId,
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getTaskStats(userId: string) {
    const [total, completed, pending, overdue] = await Promise.all([
      this.prisma.task.count({
        where: { userId },
      }),
      this.prisma.task.count({
        where: { userId, status: 'COMPLETED' },
      }),
      this.prisma.task.count({
        where: { userId, status: { not: 'COMPLETED' } },
      }),
      this.prisma.task.count({
        where: {
          userId,
          status: { not: 'COMPLETED' },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      total,
      completed,
      pending,
      overdue,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  async suggestTasks(userId: string) {
    // Get recent memories without tasks
    const recentMemories = await this.prisma.memory.findMany({
      where: {
        userId,
        isArchived: false,
        tasks: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const suggestions = [];

    for (const memory of recentMemories) {
      const taskDetails = await this.aiService.extractTask(memory.content);
      if (taskDetails) {
        suggestions.push({
          memoryId: memory.id,
          memoryContent: memory.content.substring(0, 100),
          suggestedTask: taskDetails,
        });
      }
    }

    return suggestions;
  }

  async completeTask(userId: string, id: string) {
    return this.update(userId, id, { status: TaskStatus.COMPLETED });
  }

  async addReminder(userId: string, taskId: string, scheduledAt: Date) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.reminder.create({
      data: {
        userId,
        taskId,
        title: task.title,
        scheduledAt,
      },
    });
  }
}
