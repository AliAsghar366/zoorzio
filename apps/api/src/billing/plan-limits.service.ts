import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type LimitedResource = 'lists' | 'reminders' | 'memories' | 'tasks';

interface PlanLimits {
  lists: number;
  reminders: number;
  memories: number;
  tasks: number;
}

// Every paid plan (Starter, Pro, Ultimate) advertises "Unlimited memories,
// tasks & lists" on /pricing (see packages/database/prisma/seed.ts) - Pro and
// Ultimate differentiate on FEATURES (daily/weekly briefings, AI chat,
// calendar sync, email capture channel), not on quantity caps for these
// resources. So any active paid subscription is unlimited here; only users
// with no active subscription get a free-tier cap, which is what actually
// motivates upgrading to any paid plan.
const UNLIMITED: PlanLimits = { lists: Infinity, reminders: Infinity, memories: Infinity, tasks: Infinity };
const FREE_TIER_LIMITS: PlanLimits = { lists: 3, reminders: 5, memories: 10, tasks: 10 };

@Injectable()
export class PlanLimitsService {
  constructor(private prisma: PrismaService) {}

  private async getLimitsForUser(userId: string): Promise<PlanLimits> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    const hasPaidAccess =
      !!subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING');

    return hasPaidAccess ? UNLIMITED : FREE_TIER_LIMITS;
  }

  private countExisting(userId: string, resource: LimitedResource): Promise<number> {
    switch (resource) {
      case 'lists':
        return this.prisma.list.count({ where: { userId, isArchived: false } });
      case 'reminders':
        return this.prisma.reminder.count({ where: { userId, completedAt: null } });
      case 'memories':
        return this.prisma.memory.count({ where: { userId, isArchived: false } });
      case 'tasks':
        return this.prisma.task.count({ where: { userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
    }
  }

  /** Throws ForbiddenException if creating one more `resource` would exceed the user's plan limit. */
  async assertCanCreate(userId: string, resource: LimitedResource): Promise<void> {
    const limits = await this.getLimitsForUser(userId);
    const limit = limits[resource];
    if (limit === Infinity) return;

    const currentCount = await this.countExisting(userId, resource);

    if (currentCount >= limit) {
      throw new ForbiddenException(
        `You've reached the free-tier limit of ${limit} ${resource}. Upgrade your plan to create more.`,
      );
    }
  }
}
