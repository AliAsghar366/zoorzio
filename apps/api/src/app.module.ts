import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MemoryModule } from './memory/memory.module';
import { TasksModule } from './tasks/tasks.module';
import { ListsModule } from './lists/lists.module';
import { RemindersModule } from './reminders/reminders.module';
import { BriefingModule } from './briefing/briefing.module';
import { CalendarModule } from './calendar/calendar.module';
import { ChannelsModule } from './channels/channels.module';
import { ChatModule } from './chat/chat.module';
import { AIModule } from './ai/ai.module';
import { SearchModule } from './search/search.module';
import { SecurityModule } from './security/security.module';
import { HealthModule } from './health/health.module';
import { PlansModule } from './plans/plans.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { SharingModule } from './sharing/sharing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FriendsModule } from './friends/friends.module';
import { GamificationModule } from './gamification/gamification.module';
import { BoardsModule } from './boards/boards.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { CronModule } from './cron/cron.module';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtOrApiKeyGuard } from './auth/guards/jwt-or-api-key.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SuspiciousInputInterceptor } from './common/interceptors/suspicious-input.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Cron jobs (reminder delivery, daily briefings). @nestjs/schedule's
    // in-process timers never fire reliably on Vercel serverless functions
    // (frozen between invocations, no background process) and, on an
    // occasionally-warm instance, would risk double-firing reminders
    // alongside the Vercel Cron Jobs that hit /api/cron/* instead (see
    // CronModule) - so this is only registered on persistent hosts.
    ...(process.env.VERCEL ? [] : [ScheduleModule.forRoot()]),

    // Feature modules
    AuthModule,
    UsersModule,
    MemoryModule,
    TasksModule,
    ListsModule,
    RemindersModule,
    BriefingModule,
    CalendarModule,
    ChannelsModule,
    ChatModule,
    AIModule,
    SearchModule,
    SecurityModule,
    HealthModule,
    PlansModule,
    BillingModule,
    AdminModule,
    SharingModule,
    NotificationsModule,
    FriendsModule,
    GamificationModule,
    BoardsModule,
    IntegrationsModule,
    CronModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global auth guard: JWT bearer tokens (unchanged) or an `x-api-key`
    // header, scoped to that key's own read/write permissions. Routes opt out
    // with @Public() (see auth, health, and the WhatsApp/Telegram/email
    // webhook handlers in channels).
    {
      provide: APP_GUARD,
      useClass: JwtOrApiKeyGuard,
    },

    // Global role guard. Routes opt in with @Roles(UserRole.ADMIN) etc.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    // Global transform interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // Non-blocking SQLi/XSS/path-traversal detection, audit-logged only.
    {
      provide: APP_INTERCEPTOR,
      useClass: SuspiciousInputInterceptor,
    },

    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply middleware to all routes
    consumer
      .apply(RequestIdMiddleware, CorrelationIdMiddleware)
      .forRoutes('*');
  }
}
