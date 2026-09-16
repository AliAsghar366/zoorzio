import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@anchor/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Test/dev helper. Deletes children before parents to respect foreign keys. */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    await this.auditLog.deleteMany();
    await this.channelMessage.deleteMany();
    await this.calendarEvent.deleteMany();
    await this.reminder.deleteMany();
    await this.knowledgeItem.deleteMany();
    await this.task.deleteMany();
    await this.memory.deleteMany();
    await this.calendar.deleteMany();
    await this.channel.deleteMany();
    await this.integration.deleteMany();
    await this.apiKey.deleteMany();
    await this.session.deleteMany();
    await this.userPreferences.deleteMany();
    await this.user.deleteMany();
  }
}
