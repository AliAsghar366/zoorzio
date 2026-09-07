import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChannelsController } from './channels.controller';
import { WhatsAppService } from './whatsapp.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { DiscordService } from './discord.service';
import { SlackService } from './slack.service';
import { ChannelLinkingService } from './channel-linking.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, MemoryModule, AIModule, HttpModule.register({ timeout: 15000 })],
  controllers: [ChannelsController],
  providers: [WhatsAppService, TelegramService, EmailService, SmsService, DiscordService, SlackService, ChannelLinkingService],
  exports: [WhatsAppService, TelegramService, EmailService, SmsService, DiscordService, SlackService, ChannelLinkingService],
})
export class ChannelsModule {}
