import { forwardRef, Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelsModule } from '../channels/channels.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // Reminders are delivered over the channels layer, whose button taps come
  // back here to complete/snooze/cancel them.
  imports: [PrismaModule, forwardRef(() => ChannelsModule), BillingModule, NotificationsModule],
  controllers: [RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
