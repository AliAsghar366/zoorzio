import { Injectable } from '@nestjs/common';
import { ActionPermissionMode } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tools whose effects reach outside Zoorzio and can't simply be undone, so
 * they are worth a confirmation step by default. Everything absent from this
 * map is AUTO: creating a reminder or a task is cheap to reverse, and asking
 * before every one of those would make the assistant tedious to use.
 *
 * This map, not the model, decides. The model proposes a tool call; whether it
 * runs unattended is settled here and can be overridden per user, so a prompt
 * injected into a message can never talk its way past a confirmation.
 */
const DEFAULT_POLICY: Record<string, ActionPermissionMode> = {
  delete_calendar_event: ActionPermissionMode.CONFIRM,
  send_gmail_message: ActionPermissionMode.AUTO,
  create_calendar_event: ActionPermissionMode.AUTO,
  update_calendar_event: ActionPermissionMode.AUTO,
};

/** Tools users can meaningfully set a policy for - the ones with real-world side effects. */
export const CONFIGURABLE_TOOLS: { name: string; label: string; description: string }[] = [
  {
    name: 'create_calendar_event',
    label: 'Create calendar events',
    description: 'Schedule a meeting, optionally inviting people and adding a Google Meet link.',
  },
  {
    name: 'update_calendar_event',
    label: 'Change calendar events',
    description: 'Move or edit an event that is already on your calendar.',
  },
  {
    name: 'delete_calendar_event',
    label: 'Cancel calendar events',
    description: 'Remove an event from your calendar and notify any attendees.',
  },
  {
    name: 'send_gmail_message',
    label: 'Send email',
    description: 'Send an email from your connected Gmail account.',
  },
  {
    name: 'slack_send_message',
    label: 'Post to Slack',
    description: 'Post a message to a channel in your connected Slack workspace.',
  },
  {
    name: 'remind_friend',
    label: 'Remind a friend',
    description: 'Send one of your friends a reminder.',
  },
];

@Injectable()
export class ActionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /** AUTO to run immediately, CONFIRM to ask the user first. */
  async getMode(userId: string, toolName: string): Promise<ActionPermissionMode> {
    const override = await this.prisma.actionPermission.findUnique({
      where: { userId_toolName: { userId, toolName } },
    });

    return override?.mode ?? DEFAULT_POLICY[toolName] ?? ActionPermissionMode.AUTO;
  }

  async requiresConfirmation(userId: string, toolName: string): Promise<boolean> {
    return (await this.getMode(userId, toolName)) === ActionPermissionMode.CONFIRM;
  }

  /** The full configurable set with each tool's effective mode, for the settings UI. */
  async listForUser(userId: string) {
    const overrides = await this.prisma.actionPermission.findMany({ where: { userId } });
    const byTool = new Map(overrides.map((o) => [o.toolName, o.mode]));

    return CONFIGURABLE_TOOLS.map((tool) => ({
      ...tool,
      mode: byTool.get(tool.name) ?? DEFAULT_POLICY[tool.name] ?? ActionPermissionMode.AUTO,
      isDefault: !byTool.has(tool.name),
    }));
  }

  async setMode(userId: string, toolName: string, mode: ActionPermissionMode) {
    if (!CONFIGURABLE_TOOLS.some((tool) => tool.name === toolName)) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    await this.prisma.actionPermission.upsert({
      where: { userId_toolName: { userId, toolName } },
      update: { mode },
      create: { userId, toolName, mode },
    });

    return { toolName, mode };
  }
}
