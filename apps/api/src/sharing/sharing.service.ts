import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateShareDto } from './dto/create-share.dto';
import { NotificationType, ShareResourceType } from '@anchor/database';

@Injectable()
export class SharingService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async assertOwnsResource(ownerId: string, resourceType: ShareResourceType, resourceId: string) {
    if (resourceType === 'LIST') {
      const list = await this.prisma.list.findUnique({ where: { id: resourceId } });
      if (!list || list.userId !== ownerId) throw new NotFoundException('List not found');
    } else {
      const reminder = await this.prisma.reminder.findUnique({ where: { id: resourceId } });
      if (!reminder || reminder.userId !== ownerId) throw new NotFoundException('Reminder not found');
    }
  }

  async share(ownerId: string, dto: CreateShareDto) {
    await this.assertOwnsResource(ownerId, dto.resourceType, dto.resourceId);

    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.targetEmail } });
    if (!targetUser) {
      throw new NotFoundException('No Zoorzio user found with that email');
    }
    if (targetUser.id === ownerId) {
      throw new BadRequestException('You cannot share a resource with yourself');
    }

    const share = await this.prisma.share.upsert({
      where: {
        resourceType_resourceId_sharedWithId: {
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          sharedWithId: targetUser.id,
        },
      },
      update: { permission: dto.permission || 'VIEW' },
      create: {
        ownerId,
        sharedWithId: targetUser.id,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        permission: dto.permission || 'VIEW',
      },
      include: { sharedWith: { select: { id: true, email: true, name: true } } },
    });

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { email: true, name: true } });
    await this.notificationsService.create(
      targetUser.id,
      NotificationType.SHARED_WITH_YOU,
      `${owner?.name || owner?.email} shared a ${dto.resourceType.toLowerCase()} with you`,
      `You now have ${(dto.permission || 'VIEW').toLowerCase()} access.`,
      dto.resourceType,
      dto.resourceId,
    );

    return share;
  }

  async listSharesForResource(ownerId: string, resourceType: ShareResourceType, resourceId: string) {
    await this.assertOwnsResource(ownerId, resourceType, resourceId);

    return this.prisma.share.findMany({
      where: { resourceType, resourceId, ownerId },
      include: { sharedWith: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(ownerId: string, shareId: string) {
    const share = await this.prisma.share.findUnique({ where: { id: shareId } });
    if (!share || share.ownerId !== ownerId) {
      throw new NotFoundException('Share not found');
    }
    await this.prisma.share.delete({ where: { id: shareId } });
    return { success: true };
  }

  async listSharedWithMe(userId: string, resourceType?: ShareResourceType) {
    const shares = await this.prisma.share.findMany({
      where: { sharedWithId: userId, ...(resourceType ? { resourceType } : {}) },
      include: { owner: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const lists = shares.filter((s) => s.resourceType === 'LIST');
    const reminders = shares.filter((s) => s.resourceType === 'REMINDER');

    const [listRecords, reminderRecords] = await Promise.all([
      lists.length
        ? this.prisma.list.findMany({
            where: { id: { in: lists.map((s) => s.resourceId) } },
            include: { items: { orderBy: { position: 'asc' } } },
          })
        : Promise.resolve([]),
      reminders.length
        ? this.prisma.reminder.findMany({ where: { id: { in: reminders.map((s) => s.resourceId) } } })
        : Promise.resolve([]),
    ]);

    const listById = new Map(listRecords.map((l) => [l.id, l]));
    const reminderById = new Map(reminderRecords.map((r) => [r.id, r]));

    return shares
      .map((share) => {
        const resource =
          share.resourceType === 'LIST' ? listById.get(share.resourceId) : reminderById.get(share.resourceId);
        if (!resource) return null;
        return {
          shareId: share.id,
          resourceType: share.resourceType,
          permission: share.permission,
          owner: share.owner,
          resource,
        };
      })
      .filter(Boolean);
  }
}
