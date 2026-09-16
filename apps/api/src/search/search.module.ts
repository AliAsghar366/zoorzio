import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { VectorSearchService } from './vector-search.service';
import { TextSearchService } from './text-search.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [],
  providers: [SearchService, VectorSearchService, TextSearchService],
  exports: [SearchService],
})
export class SearchModule {}
