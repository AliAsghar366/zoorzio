import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronAuthGuard } from './cron-auth.guard';
import { RemindersModule } from '../reminders/reminders.module';
import { BriefingModule } from '../briefing/briefing.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [RemindersModule, BriefingModule, SecurityModule],
  controllers: [CronController],
  providers: [CronAuthGuard],
})
export class CronModule {}
