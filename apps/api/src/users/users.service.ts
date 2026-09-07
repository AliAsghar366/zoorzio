import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        location: true,
        timezone: true,
        language: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(
    id: string,
    data: { name?: string; phone?: string; avatar?: string; location?: string; timezone?: string; language?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        location: true,
        timezone: true,
        language: true,
      },
    });
  }

  async updatePreferences(userId: string, preferences: any) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences,
      },
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.userPreferences.findUnique({
      where: { userId },
    });
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete - just mark as deleted
    // In production, we'd implement proper data deletion
    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true };
  }

  async getStats(userId: string) {
    const [memories, tasks, calendars, channels] = await Promise.all([
      this.prisma.memory.count({ where: { userId, isArchived: false } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.calendar.count({ where: { userId, isActive: true } }),
      this.prisma.channel.count({ where: { userId, isActive: true } }),
    ]);

    return {
      memories,
      tasks,
      calendars,
      channels,
    };
  }
}
