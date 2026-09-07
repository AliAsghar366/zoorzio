import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AIModule } from '../ai/ai.module';
import { SearchModule } from '../search/search.module';
import { TasksModule } from '../tasks/tasks.module';
import { RemindersModule } from '../reminders/reminders.module';
import { ListsModule } from '../lists/lists.module';
import { MemoryModule } from '../memory/memory.module';
import { BoardsModule } from '../boards/boards.module';
import { CalendarModule } from '../calendar/calendar.module';
import { FriendsModule } from '../friends/friends.module';
import { GamificationModule } from '../gamification/gamification.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AIModule,
    SearchModule,
    TasksModule,
    RemindersModule,
    ListsModule,
    MemoryModule,
    BoardsModule,
    CalendarModule,
    FriendsModule,
    GamificationModule,
    IntegrationsModule,
    ChannelsModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
