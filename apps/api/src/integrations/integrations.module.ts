import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsOAuthService } from './integrations-oauth.service';
import { GitHubApiService } from './providers/github-api.service';
import { NotionApiService } from './providers/notion-api.service';
import { GoogleWorkspaceApiService } from './providers/google-workspace-api.service';
import { SlackTeamApiService } from './providers/slack-team-api.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    PrismaModule,
    // EncryptionService - OAuth tokens are encrypted at rest.
    SecurityModule,
    HttpModule.register({ timeout: 10000 }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationsOAuthService,
    GitHubApiService,
    NotionApiService,
    GoogleWorkspaceApiService,
    SlackTeamApiService,
  ],
  exports: [
    IntegrationsService,
    // Exported for CalendarModule, whose Google connection refreshes through
    // the same client credentials rather than duplicating the refresh call.
    IntegrationsOAuthService,
    GitHubApiService,
    NotionApiService,
    GoogleWorkspaceApiService,
    SlackTeamApiService,
  ],
})
export class IntegrationsModule {}
