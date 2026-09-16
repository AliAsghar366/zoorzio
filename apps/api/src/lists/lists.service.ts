import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { CreateListItemDto, UpdateListItemDto } from './dto/list-item.dto';
import { ListType } from '@anchor/database';

@Injectable()
export class ListsService {
  constructor(
    private prisma: PrismaService,
    private planLimits: PlanLimitsService,
  ) {}

  async create(userId: string, dto: CreateListDto) {
    await this.planLimits.assertCanCreate(userId, 'lists');

    return this.prisma.list.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type || ListType.CUSTOM,
      },
      include: { items: true },
    });
  }

  async findAll(userId: string, includeArchived = false) {
    return this.prisma.list.findMany({
      where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOwnedList(userId: string, id: string) {
    const list = await this.prisma.list.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });

    if (!list || list.userId !== userId) {
      // NotFoundException (not Forbidden) for other users' lists, to avoid
      // leaking whether a given list id exists at all.
      throw new NotFoundException('List not found');
    }

    return list;
  }

  async findOne(userId: string, id: string) {
    return this.findOwnedList(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateListDto) {
    await this.findOwnedList(userId, id);

    return this.prisma.list.update({
      where: { id },
      data: dto,
      include: { items: { orderBy: { position: 'asc' } } },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedList(userId, id);
    await this.prisma.list.delete({ where: { id } });
    return { success: true };
  }

  async addItem(userId: string, listId: string, dto: CreateListItemDto) {
    const list = await this.findOwnedList(userId, listId);
    const position = list.items.length;

    return this.prisma.listItem.create({
      data: { listId, content: dto.content, position },
    });
  }

  private async findOwnedItem(userId: string, listId: string, itemId: string) {
    await this.findOwnedList(userId, listId);

    const item = await this.prisma.listItem.findUnique({ where: { id: itemId } });
    if (!item || item.listId !== listId) {
      throw new NotFoundException('List item not found');
    }

    return item;
  }

  async updateItem(userId: string, listId: string, itemId: string, dto: UpdateListItemDto) {
    await this.findOwnedItem(userId, listId, itemId);
    return this.prisma.listItem.update({ where: { id: itemId }, data: dto });
  }

  async removeItem(userId: string, listId: string, itemId: string) {
    await this.findOwnedItem(userId, listId, itemId);
    await this.prisma.listItem.delete({ where: { id: itemId } });
    return { success: true };
  }
}
