import { PrismaService } from '../prisma/prisma.service';

/** How much of the conversation is replayed to the model on each inbound message. */
export const AGENT_HISTORY_LIMIT = 15;

/**
 * Replays a channel's recent thread so the agent can follow context across
 * messages - this is what lets "schedule a meeting with Ahmed" / "tomorrow at
 * 4" work as one request split over two messages. Shared between every
 * WhatsApp transport (official Cloud API, the unofficial QR-linked one) so a
 * conversation reads identically regardless of which one delivered it.
 */
export async function buildAgentHistory(
  prisma: PrismaService,
  channelId: string,
  latestMessage: string,
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await prisma.channelMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: 'desc' },
    take: AGENT_HISTORY_LIMIT,
  });

  const history = rows
    .reverse()
    // Button taps are control input, not conversation, so the model never sees them.
    .filter((row) => row.content?.trim() && !(row.metadata as Record<string, unknown> | null)?.buttonId)
    .map((row) => ({
      role: (row.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: row.content.slice(0, 4000),
    }));

  // A voice note is stored as its placeholder ("[Voice note received]") and
  // only updated with the transcript afterwards, so the transcribed text is
  // substituted in rather than sending the model the placeholder.
  const last = history[history.length - 1];
  if (last?.role === 'user') {
    last.content = latestMessage.slice(0, 4000);
  } else {
    history.push({ role: 'user', content: latestMessage.slice(0, 4000) });
  }

  return history;
}
