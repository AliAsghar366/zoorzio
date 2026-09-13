import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ToolExecutionStatus } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';

/**
 * How long a completed execution shields an identical repeat call.
 *
 * This exists for the case where an external API succeeded but the response
 * never made it back - a timeout after Google Calendar already created the
 * event. Retrying then would double-book. Ten minutes is long enough to cover
 * a retry storm, short enough that deliberately asking for the same thing
 * again later still works.
 */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Stable fingerprint of a call, so the same request produces the same hash regardless of key order. */
  hashArgs(toolName: string, args: Record<string, any>): string {
    return createHash('sha256')
      .update(`${toolName}:${stableStringify(args)}`)
      .digest('hex');
  }

  /** A recent, successful, identical call - whose recorded result should be replayed instead of acting again. */
  async findRecentSuccess(userId: string, toolName: string, argsHash: string) {
    return this.prisma.toolExecution.findFirst({
      where: {
        userId,
        toolName,
        argsHash,
        status: ToolExecutionStatus.SUCCESS,
        createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async start(userId: string, toolName: string, argsHash: string, args: Record<string, any>) {
    return this.prisma.toolExecution.create({
      data: { userId, toolName, argsHash, args, status: ToolExecutionStatus.EXECUTING },
    });
  }

  /** Parks a call that needs the user's go-ahead before it touches anything external. */
  async awaitConfirmation(
    userId: string,
    toolName: string,
    argsHash: string,
    args: Record<string, any>,
  ) {
    return this.prisma.toolExecution.create({
      data: { userId, toolName, argsHash, args, status: ToolExecutionStatus.AWAITING_CONFIRMATION },
    });
  }

  async markSuccess(id: string, resultSummary: string, externalResourceId?: string) {
    return this.prisma.toolExecution.update({
      where: { id },
      data: {
        status: ToolExecutionStatus.SUCCESS,
        resultSummary,
        externalResourceId,
        completedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    return this.prisma.toolExecution.update({
      where: { id },
      data: {
        status: ToolExecutionStatus.FAILED,
        // Truncated: provider errors can be long, and this is surfaced in the
        // UI rather than being a place to keep a full stack trace.
        errorMessage: errorMessage.slice(0, 500),
        completedAt: new Date(),
      },
    });
  }

  async markCancelled(id: string) {
    return this.prisma.toolExecution.update({
      where: { id },
      data: { status: ToolExecutionStatus.CANCELLED, completedAt: new Date() },
    });
  }

  /**
   * Loads a pending confirmation, but only if it belongs to `userId` and is
   * still awaiting an answer. Returns null otherwise - the execution id
   * travels through a WhatsApp button payload, so it is treated as a claim
   * about which action was meant, never as proof of who is asking.
   */
  async claimPendingConfirmation(userId: string, executionId: string) {
    const execution = await this.prisma.toolExecution.findUnique({ where: { id: executionId } });

    if (!execution || execution.userId !== userId) {
      this.logger.warn(
        `Rejected confirmation for execution ${executionId} - not owned by user ${userId}`,
      );
      return null;
    }

    if (execution.status !== ToolExecutionStatus.AWAITING_CONFIRMATION) return null;

    // Claim it atomically so a double-tap can't run the action twice.
    const claimed = await this.prisma.toolExecution.updateMany({
      where: { id: executionId, status: ToolExecutionStatus.AWAITING_CONFIRMATION },
      data: { status: ToolExecutionStatus.EXECUTING },
    });

    return claimed.count === 1 ? execution : null;
  }

  /**
   * The most recent action still waiting on the user, if it is recent enough
   * to still be what a bare "yes" refers to. Older ones are ignored rather
   * than being triggered by an unrelated reply much later.
   */
  async findPendingConfirmation(userId: string) {
    return this.prisma.toolExecution.findFirst({
      where: {
        userId,
        status: ToolExecutionStatus.AWAITING_CONFIRMATION,
        createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRecent(userId: string, limit = 20) {
    return this.prisma.toolExecution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        toolName: true,
        status: true,
        resultSummary: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }
}

/** JSON.stringify with object keys sorted, so `{a,b}` and `{b,a}` hash identically. */
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}
