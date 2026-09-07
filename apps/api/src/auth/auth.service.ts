import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../channels/email.service';
import { RateLimitService } from '../security/rate-limit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenPayload } from './interfaces/token-payload.interface';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Bump this whenever the Privacy Policy content materially changes (see
// apps/web/app/privacy/page.tsx) - existing users keep whatever version they
// originally accepted (privacyPolicyVersion on User), so this only affects
// new registrations from that point on. Keep in sync with the same literal
// in packages/database/prisma/seed.ts.
const CURRENT_PRIVACY_POLICY_VERSION = '1.0';

// Per-account brute-force lockout, on top of the per-IP @RateLimit on the
// controller. The IP-based limit alone doesn't stop an attacker who spreads
// guesses against ONE account across many source IPs (botnet/rotating
// proxies) - each IP gets its own fresh budget. This counter is keyed by the
// target email instead, so it catches that case regardless of source IP.
const ACCOUNT_LOGIN_LIMIT = 10;
const ACCOUNT_LOGIN_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private rateLimitService: RateLimitService,
  ) {}

  async register(registerDto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const { email, password, name, phone, location, avatar } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with argon2
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create user. acceptedPrivacyPolicy is guaranteed `true` here - the
    // DTO's @Equals(true) validator rejects the request before it reaches
    // this service otherwise, so there's no path to an account existing
    // without recorded consent.
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        location,
        avatar,
        privacyAcceptedAt: new Date(),
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
    });

    // Immutable evidentiary record of consent, kept even if the User row's
    // own privacyAcceptedAt/privacyPolicyVersion is ever overwritten later
    // (e.g. by re-accepting an updated policy).
    await this.logAudit(
      user.id,
      'PRIVACY_POLICY_ACCEPTED',
      'user',
      { version: CURRENT_PRIVACY_POLICY_VERSION },
      ipAddress,
      userAgent,
    );

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const accountKey = `login-account:${email.toLowerCase()}`;

    const withinAccountLimit = await this.rateLimitService.checkLimit(
      accountKey,
      ACCOUNT_LOGIN_LIMIT,
      ACCOUNT_LOGIN_WINDOW_MS,
    );

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!withinAccountLimit) {
      if (user) {
        await this.logAudit(user.id, 'ACCOUNT_LOGIN_LOCKED', 'auth', { email });
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many failed attempts for this account. Try again later.',
          error: 'Account temporarily locked',
          retryAfter: Math.ceil(ACCOUNT_LOGIN_WINDOW_MS / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, password);

    if (!isPasswordValid) {
      // Log failed attempt
      await this.logAudit(user.id, 'LOGIN_FAILED', 'auth', { email });
      throw new UnauthorizedException('Invalid credentials');
    }

    // A real login succeeded - this account is no longer under suspicion.
    await this.rateLimitService.reset(accountKey);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.refreshToken);

    // Log successful login
    await this.logAudit(user.id, 'LOGIN_SUCCESS', 'auth', { email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Check if session exists and is valid
      const session = await this.prisma.session.findUnique({
        where: { token: refreshToken },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(payload.sub, payload.email);

      // Update session
      await this.prisma.session.update({
        where: { id: session.id },
        data: { token: tokens.refreshToken },
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    // Delete session
    await this.prisma.session.deleteMany({
      where: {
        userId,
        token: refreshToken,
      },
    });

    // Log logout
    await this.logAudit(userId, 'LOGOUT', 'auth', {});

    return { success: true };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        timezone: true,
        language: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Always resolves with the same generic message regardless of whether the
   * email is registered, to avoid leaking which emails have Zoorzio accounts.
   */
  async forgotPassword(email: string) {
    const genericResponse = {
      message: "If that email is registered, we've sent password reset instructions.",
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    if (this.configService.get('SENDGRID_API_KEY')) {
      try {
        await this.emailService.sendEmail(
          user.id,
          user.email,
          'Reset your Zoorzio password',
          `We received a request to reset your password. This link expires in 30 minutes:\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
        );
      } catch (error) {
        this.logger.error('Failed to send password reset email', error);
      }
    } else {
      // No email provider configured yet - log the link so the flow is still
      // testable end-to-end (same "demo mode" pattern as Stripe billing).
      this.logger.warn(`SENDGRID_API_KEY not configured - password reset link for ${email}: ${resetLink}`);
    }

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      // Reset means "I may have lost control of this account" - sign it out everywhere.
      this.prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    await this.logAudit(resetToken.userId, 'PASSWORD_RESET', 'auth', {});

    return { success: true };
  }

  /**
   * Admin support tool: issues a short-lived (15m), access-token-only session
   * for the target user, with no refresh token — the admin must explicitly
   * re-impersonate after it expires rather than holding a renewable session.
   * Blocked against other admins so one admin can never silently act as
   * another. Every use is audit-logged under the ACTING admin's id.
   */
  async impersonate(adminUserId: string, targetUserId: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.role === 'ADMIN') {
      throw new ForbiddenException('Cannot impersonate another admin');
    }

    const payload: TokenPayload = { sub: targetUser.id, email: targetUser.email };
    const accessToken = await this.jwtService.signAsync(
      { ...payload, impersonatedBy: adminUserId },
      { expiresIn: '15m' },
    );

    await this.logAudit(adminUserId, 'ADMIN_IMPERSONATION_STARTED', 'auth', {
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
    });

    return {
      accessToken,
      user: { id: targetUser.id, email: targetUser.email, name: targetUser.name, role: targetUser.role },
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload: TokenPayload = {
      sub: userId,
      email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async createSession(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  private async logAudit(
    userId: string,
    action: string,
    resource: string,
    metadata: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        metadata,
        ipAddress,
        userAgent,
      },
    });
  }
}
