import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarOAuthService } from './calendar-oauth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { AppleCalendarService } from './apple-calendar.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    AIModule,
    HttpModule.register({ timeout: 10000 }),
    // Separate short-lived signing keyed off the same JWT_SECRET, used only to
    // sign/verify the OAuth `state` param (see CalendarOAuthService) - the
    // provider callback is a plain browser redirect with no Authorization
    // header, so the signed state is what identifies the connecting user.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarOAuthService,
    GoogleCalendarService,
    OutlookCalendarService,
    AppleCalendarService,
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
