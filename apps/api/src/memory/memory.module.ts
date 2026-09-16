import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { SearchModule } from '../search/search.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AIModule, SearchModule, BillingModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
