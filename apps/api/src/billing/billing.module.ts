import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlanLimitsService } from './plan-limits.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PrismaModule, PlansModule],
  controllers: [BillingController],
  providers: [BillingService, PlanLimitsService],
  exports: [BillingService, PlanLimitsService],
})
export class BillingModule {}
