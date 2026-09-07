import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async log(
    userId: string,
    action: string,
    resource: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          metadata: metadata || {},
          ipAddress,
          userAgent,
        },
      });

      this.logger.log(`Audit: ${action} on ${resource} by user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
    }
  }

  async getLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      this.logger.error('Failed to fetch audit logs', error);
      return [];
    }
  }

  /** Platform-wide view across every user - for admin use only. */
  async getAllLogs(limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { email: true, name: true } } },
      });
    } catch (error) {
      this.logger.error('Failed to fetch platform-wide audit logs', error);
      return [];
    }
  }

  async getLogsByAction(
    userId: string,
    action: string,
    limit: number = 100,
  ): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          action,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to fetch audit logs by action', error);
      return [];
    }
  }

  async getLogsByResource(
    userId: string,
    resource: string,
    limit: number = 100,
  ): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          resource,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to fetch audit logs by resource', error);
      return [];
    }
  }

  async getLogsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
  ): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to fetch audit logs by date range', error);
      return [];
    }
  }

  async getSecurityEvents(userId: string, limit: number = 50): Promise<any[]> {
    const securityActions = [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'PASSWORD_CHANGED',
      'API_KEY_CREATED',
      'API_KEY_REVOKED',
      'SESSION_REVOKED',
      'PERMISSION_CHANGED',
    ];

    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          action: { in: securityActions },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to fetch security events', error);
      return [];
    }
  }

  async getFailedLogins(userId: string, hours: number = 24): Promise<any[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
          action: 'LOGIN_FAILED',
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Failed to fetch failed logins', error);
      return [];
    }
  }

  async getActiveSessions(userId: string): Promise<any[]> {
    try {
      return await this.prisma.session.findMany({
        where: {
          userId,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Failed to fetch active sessions', error);
      return [];
    }
  }

  /** Runs daily: deletes audit log entries older than AUDIT_LOG_RETENTION_DAYS (default 365). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldLogs(): Promise<void> {
    const retentionDays = Number(this.configService.get('AUDIT_LOG_RETENTION_DAYS', '365'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const result = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      if (result.count > 0) {
        this.logger.log(`Purged ${result.count} audit log entries older than ${retentionDays} days`);
      }
    } catch (error) {
      this.logger.error('Failed to purge old audit logs', error);
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    try {
      await this.prisma.session.deleteMany({
        where: { userId },
      });

      await this.log(userId, 'SESSION_REVOKED', 'auth', {
        reason: 'All sessions revoked',
      });
    } catch (error) {
      this.logger.error('Failed to revoke sessions', error);
    }
  }
}
