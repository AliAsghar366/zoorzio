import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption.service';
import { RateLimitService } from './rate-limit.service';
import { AuditService } from './audit.service';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ActionPolicyService } from './action-policy.service';
import { ActionPermissionsController } from './action-permissions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ApiKeysController, ActionPermissionsController],
  providers: [
    SecurityService,
    EncryptionService,
    RateLimitService,
    AuditService,
    ApiKeysService,
    ActionPolicyService,
  ],
  exports: [
    SecurityService,
    EncryptionService,
    RateLimitService,
    AuditService,
    ApiKeysService,
    ActionPolicyService,
  ],
})
export class SecurityModule {}
