import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChannelsController } from './channels.controller';
import { WhatsAppService } from './whatsapp.service';
import { InteractiveReplyService } from './interactive-reply.service';
import { WhatsAppBusinessConnectionService } from './whatsapp-business-connection.service';
import { WhatsAppBusinessController } from './whatsapp-business.controller';
import { WhatsAppUnofficialService } from './whatsapp-unofficial.service';
import { WhatsAppUnofficialController } from './whatsapp-unofficial.controller';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { DiscordService } from './discord.service';
import { SlackService } from './slack.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { AIModule } from '../ai/ai.module';
import { SecurityModule } from '../security/security.module';
import { ChatModule } from '../chat/chat.module';
import { RemindersModule } from '../reminders/reminders.module';

@Module({
  imports: [
    PrismaModule,
    MemoryModule,
    AIModule,
    SecurityModule,
    // Inbound messages are handed to the agent, and button taps resolve
    // reminders - both of which depend back on this module.
    forwardRef(() => ChatModule),
    forwardRef(() => RemindersModule),
    HttpModule.register({ timeout: 15000 }),
  ],
  controllers: [ChannelsController, WhatsAppBusinessController, WhatsAppUnofficialController],
  providers: [
    WhatsAppService,
    WhatsAppBusinessConnectionService,
    WhatsAppUnofficialService,
    WhatsAppSenderService,
    InteractiveReplyService,
    TelegramService,
    EmailService,
    SmsService,
    DiscordService,
    SlackService,
    ChannelLinkingService,
    ChannelCredentialsService,
  ],
  exports: [
    WhatsAppService,
    WhatsAppUnofficialService,
    WhatsAppSenderService,
    InteractiveReplyService,
    TelegramService,
    EmailService,
    SmsService,
    DiscordService,
    SlackService,
    ChannelLinkingService,
    ChannelCredentialsService,
  ],
})
export class ChannelsModule {}
