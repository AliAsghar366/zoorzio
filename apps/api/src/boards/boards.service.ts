import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_BOARD_NAME = "Today's board";

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Every user needs at least one board to hold their tasks, but we never
   * want to force that as an onboarding step - the first board is created
   * lazily, the moment it's actually needed (creating a task, or opening
   * the Boards page for the first time).
   */
  async getOrCreateDefault(userId: string) {
    const existing = await this.prisma.board.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.board.create({ data: { userId, name: DEFAULT_BOARD_NAME } });
  }

  async list(userId: string) {
    const boards = await this.prisma.board.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });

    if (boards.length === 0) {
      const defaultBoard = await this.getOrCreateDefault(userId);
      return [{ ...defaultBoard, _count: { tasks: 0 } }];
    }

    return boards;
  }

  async findOne(userId: string, id: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: { tasks: { orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] } },
    });

    if (!board) throw new NotFoundException('Board not found');
    if (board.userId !== userId) throw new ForbiddenException('Access denied');

    return board;
  }

  async create(userId: string, name: string) {
    return this.prisma.board.create({ data: { userId, name } });
  }

  async rename(userId: string, id: string, name: string) {
    await this.assertOwnership(userId, id);
    return this.prisma.board.update({ where: { id }, data: { name } });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);
    // Tasks aren't deleted with their board (onDelete: SetNull) - they just
    // become unassigned and get picked up by the default board again.
    await this.prisma.board.delete({ where: { id } });
    return { success: true };
  }

  private async assertOwnership(userId: string, id: string) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException('Board not found');
    if (board.userId !== userId) throw new ForbiddenException('Access denied');
    return board;
  }
}
