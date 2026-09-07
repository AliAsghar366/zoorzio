import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CronAuthGuard } from './cron-auth.guard';
import { RemindersService } from '../reminders/reminders.service';
import { BriefingService } from '../briefing/briefing.service';
import { AuditService } from '../security/audit.service';

/**
 * HTTP-triggered equivalents of the app's @Cron jobs, for hosts (Vercel
 * serverless) where there's no persistent process to run node-cron timers in
 * the background between requests. Wire these up to Vercel Cron Jobs (see
 * vercel.json) - Vercel invokes cron paths with a GET request and, when
 * CRON_SECRET is set on the project, an `Authorization: Bearer` header that
 * CronAuthGuard verifies.
 *
 * On a persistent host (Railway/Render/a VM) these endpoints are simply
 * unused - the original @Cron decorators in RemindersService/BriefingService/
 * AuditService keep running unchanged there (see AppModule's conditional
 * ScheduleModule.forRoot() - it's skipped on Vercel specifically so the two
 * triggering mechanisms never fire the same job twice).
 */
@Controller('cron')
@Public()
@UseGuards(CronAuthGuard)
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private remindersService: RemindersService,
    private briefingService: BriefingService,
    private auditService: AuditService,
  ) {}

  @Get('reminders')
  async triggerReminders() {
    await this.remindersService.processDueReminders();
    return { ok: true };
  }

  @Get('briefing/daily')
  async triggerDailyBriefing() {
    await this.briefingService.sendDailyBriefings();
    return { ok: true };
  }

  @Get('briefing/weekly')
  async triggerWeeklyBriefing() {
    await this.briefingService.sendWeeklyBriefings();
    return { ok: true };
  }

  @Get('audit-cleanup')
  async triggerAuditCleanup() {
    await this.auditService.purgeOldLogs();
    return { ok: true };
  }
}
