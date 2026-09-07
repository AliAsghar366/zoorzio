import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { RateLimitService } from './rate-limit.service';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidatedApiKey {
  id: string;
  userId: string;
  name: string;
  permissions: Record<string, boolean>;
}

export interface ValidatedSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private encryptionService: EncryptionService,
    private rateLimitService: RateLimitService,
    private auditService: AuditService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // Encryption
  async encryptData(data: string): Promise<string> {
    return this.encryptionService.encrypt(data);
  }

  async decryptData(encryptedData: string): Promise<string> {
    return this.encryptionService.decrypt(encryptedData);
  }

  async hashPassword(password: string): Promise<string> {
    return this.encryptionService.hashPassword(password);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.encryptionService.verifyPassword(password, hash);
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    return this.rateLimitService.checkLimit(key, limit, windowMs);
  }

  async getRateLimitInfo(key: string): Promise<any> {
    return this.rateLimitService.getInfo(key);
  }

  // Audit logging
  async logAction(userId: string, action: string, resource: string, metadata?: any) {
    return this.auditService.log(userId, action, resource, metadata);
  }

  async getAuditLogs(userId: string, limit?: number, offset?: number) {
    return this.auditService.getLogs(userId, limit, offset);
  }

  // Security checks
  async validateApiKey(apiKey: string): Promise<ValidatedApiKey | null> {
    const keyHash = await this.encryptionService.hashApiKey(apiKey);

    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!record || !record.isActive) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    await this.prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      permissions: (record.permissions as Record<string, boolean>) || {},
    };
  }

  async validateSession(sessionToken: string): Promise<ValidatedSession | null> {
    const session = await this.prisma.session.findUnique({ where: { token: sessionToken } });
    if (!session) return null;
    if (session.expiresAt < new Date()) return null;

    return { id: session.id, userId: session.userId, expiresAt: session.expiresAt };
  }

  /**
   * Permission model: JWT-authenticated users act as themselves and are checked
   * for resource ownership by each service (e.g. MemoryService throws
   * ForbiddenException if memory.userId !== userId) — callers should skip this
   * check entirely for JWT sessions. API-key callers are scoped to whatever
   * boolean flags were granted on THAT SPECIFIC key (e.g. { read: true, write:
   * false }); a request must be checked against the key it actually
   * authenticated with, never against "any key this user owns" — otherwise a
   * leaked read-only key could piggyback on a separate, more privileged key.
   */
  async checkPermission(apiKeyId: string, action: 'read' | 'write'): Promise<boolean> {
    const key = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } });
    if (!key || !key.isActive) return false;

    const permissions = (key.permissions as Record<string, boolean>) || {};
    return permissions[action] === true;
  }

  // Input sanitization
  sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['";\\]/g, '') // Remove SQL injection attempts
      .trim();
  }

  /**
   * Opt-in IP allowlist: reads a comma-separated list from ADMIN_IP_ALLOWLIST.
   * When unset, every IP is allowed (no behavior change for deployments that
   * haven't configured one) — this is deliberately allow-by-default so it can
   * only ever tighten access when an operator explicitly opts in.
   */
  isAllowedIP(ip: string): boolean {
    const allowlist = this.configService
      .get<string>('ADMIN_IP_ALLOWLIST', '')
      .split(',')
      .map((entry: string) => entry.trim())
      .filter(Boolean);

    if (allowlist.length === 0) return true;
    return allowlist.includes(ip);
  }

  // Request validation
  validateRequest(request: any): boolean {
    // Check for common attack patterns
    const suspiciousPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL injection
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
      /\.\.\//g, // Path traversal
    ];

    const requestString = JSON.stringify(request);
    return !suspiciousPatterns.some(pattern => pattern.test(requestString));
  }
}
