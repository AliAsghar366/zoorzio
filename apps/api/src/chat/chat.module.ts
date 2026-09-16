import { forwardRef, Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ToolExecutionService } from './tool-execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { SecurityModule } from '../security/security.module';
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
    PrismaModule,
    AIModule,
    SearchModule,
    TasksModule,
    forwardRef(() => RemindersModule),
    ListsModule,
    MemoryModule,
    BoardsModule,
    CalendarModule,
    FriendsModule,
    GamificationModule,
    IntegrationsModule,
    ContactsModule,
    SecurityModule,
    // Circular: inbound WhatsApp/Telegram messages run the agent, and the agent
    // uses channel linking to answer questions about connected channels.
    forwardRef(() => ChannelsModule),
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ToolExecutionService],
  exports: [ChatService, ToolExecutionService],
})
export class ChatModule {}
