import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../security/audit.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private authService: AuthService,
  ) {}

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscription: { include: { plan: true } },
        _count: { select: { memories: true, tasks: true, reminders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const [totalUsers, activeSubscriptions, totalMemories, totalTasks, totalReminders, planBreakdown] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.memory.count(),
        this.prisma.task.count(),
        this.prisma.reminder.count(),
        this.prisma.subscription.groupBy({
          by: ['planId'],
          where: { status: 'ACTIVE' },
          _count: true,
        }),
      ]);

    return {
      totalUsers,
      activeSubscriptions,
      totalMemories,
      totalTasks,
      totalReminders,
      planBreakdown,
    };
  }

  async getAuditLogs(limit = 100, offset = 0) {
    return this.auditService.getAllLogs(limit, offset);
  }

  async exportAuditLogsCsv(): Promise<string> {
    const logs = await this.auditService.getAllLogs(10000, 0);
    const header = 'When,User,Action,Resource,IP Address\n';
    const rows = logs.map((entry: any) => {
      const cells = [
        entry.createdAt?.toISOString?.() ?? entry.createdAt,
        entry.user?.email ?? '',
        entry.action,
        entry.resource,
        entry.ipAddress ?? '',
      ];
      return cells.map(csvEscape).join(',');
    });
    return header + rows.join('\n');
  }

  /** Comp/override a user's plan without touching Stripe. Omit planId to revert to the free tier. */
  async setUserPlan(adminUserId: string, userId: string, planId?: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!planId) {
      await this.prisma.subscription.deleteMany({ where: { userId } });
      await this.auditService.log(adminUserId, 'ADMIN_PLAN_OVERRIDE', 'subscription', {
        targetUserId: userId,
        planId: null,
      });
      return { success: true, subscription: null };
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found');
    }

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: { planId, status: 'ACTIVE' },
      create: { userId, planId, status: 'ACTIVE' },
      include: { plan: true },
    });

    await this.auditService.log(adminUserId, 'ADMIN_PLAN_OVERRIDE', 'subscription', {
      targetUserId: userId,
      planId,
      planSlug: plan.slug,
    });

    return { success: true, subscription };
  }

  async impersonate(adminUserId: string, targetUserId: string) {
    return this.authService.impersonate(adminUserId, targetUserId);
  }
}

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
