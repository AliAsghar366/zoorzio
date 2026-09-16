import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AIService } from './ai.service';
import { AiClientService } from './ai-client.service';

@Module({
  imports: [ConfigModule, HttpModule.register({ timeout: 30000 })],
  controllers: [],
  providers: [AIService, AiClientService],
  exports: [AIService],
})
export class AIModule {}
