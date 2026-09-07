import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { BoardsModule } from '../boards/boards.module';

@Module({
  imports: [PrismaModule, AIModule, BillingModule, BoardsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
