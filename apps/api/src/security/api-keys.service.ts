import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private auditService: AuditService,
  ) {}

  /** Returns the raw key exactly once — only the hash is ever stored. */
  async create(userId: string, dto: CreateApiKeyDto) {
    const { key, hash, prefix } = await this.encryptionService.generateApiKey();

    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash: hash,
        prefix,
        permissions: { read: true, write: dto.write === true },
        expiresAt: dto.expiresInDays
          ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    await this.auditService.log(userId, 'API_KEY_CREATED', 'api_key', { name: dto.name, prefix });

    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      permissions: record.permissions,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      key, // shown once; the caller must copy it now
    };
  }

  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return keys;
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== userId) {
      throw new NotFoundException('API key not found');
    }
    if (!key.isActive) {
      throw new ForbiddenException('API key already revoked');
    }

    await this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    await this.auditService.log(userId, 'API_KEY_REVOKED', 'api_key', { name: key.name, prefix: key.prefix });

    return { success: true };
  }
}
