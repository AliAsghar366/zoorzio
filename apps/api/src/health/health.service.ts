import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async check() {
    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'anchor-api',
        version: '1.0.0',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'anchor-api',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async detailedCheck() {
    const checks = {
      database: false,
      memory: false,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      checks.database = false;
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    checks.memory = memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9;

    const allHealthy = checks.database && checks.memory;

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      service: 'anchor-api',
      version: '1.0.0',
    };
  }
}
