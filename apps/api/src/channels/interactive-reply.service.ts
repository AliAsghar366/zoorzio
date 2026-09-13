import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { RemindersService } from '../reminders/reminders.service';
import { ChatService } from '../chat/chat.service';

/**
 * Button ids are the only state carried between sending an interactive message
 * and the user tapping it, so they encode which record the tap refers to.
 * WhatsApp allows 256 characters, and `<prefix>:<cuid>:<action>` is well
 * inside that.
 */
export const REMINDER_BUTTON_PREFIX = 'remind';
export const CONFIRM_BUTTON_PREFIX = 'confirm';

export function reminderButtonId(reminderId: string, action: 'done' | 'snooze' | 'stop'): string {
  return `${REMINDER_BUTTON_PREFIX}:${reminderId}:${action}`;
}

export function confirmButtonId(executionId: string, action: 'yes' | 'no'): string {
  return `${CONFIRM_BUTTON_PREFIX}:${executionId}:${action}`;
}

/**
 * Resolves a tapped button into a real action.
 *
 * Every handler re-checks that the referenced record belongs to the user whose
 * verified channel the tap arrived on. The id in a button payload says what
 * was meant, not who is entitled to it.
 */
@Injectable()
export class InteractiveReplyService {
  private readonly logger = new Logger(InteractiveReplyService.name);

  constructor(
    @Inject(forwardRef(() => RemindersService))
    private readonly reminders: RemindersService,
    @Inject(forwardRef(() => ChatService))
    private readonly chat: ChatService,
  ) {}

  /** Returns the message to send back, or null if the tap needs no reply. */
  async handle(userId: string, buttonId: string): Promise<string | null> {
    const [prefix, resourceId, action] = buttonId.split(':');

    if (!resourceId || !action) {
      this.logger.warn(`Ignoring malformed button id "${buttonId}"`);
      return null;
    }

    try {
      if (prefix === REMINDER_BUTTON_PREFIX) {
        return await this.handleReminderAction(userId, resourceId, action);
      }

      if (prefix === CONFIRM_BUTTON_PREFIX) {
        return await this.handleConfirmation(userId, resourceId, action);
      }
    } catch (error: any) {
      this.logger.error(`Button "${buttonId}" failed for user ${userId}: ${error?.message}`);
      return "Sorry, I couldn't do that just now.";
    }

    this.logger.warn(`Ignoring unknown button prefix "${prefix}"`);
    return null;
  }

  private async handleReminderAction(
    userId: string,
    reminderId: string,
    action: string,
  ): Promise<string | null> {
    switch (action) {
      case 'done':
        await this.reminders.completeFromReminderAction(userId, reminderId);
        return '✅ Marked as done.';

      case 'snooze': {
        const reminder = await this.reminders.snooze(userId, reminderId);
        return `👍 I'll remind you again at ${formatTime(reminder.scheduledAt)}.`;
      }

      case 'stop':
        await this.reminders.cancelFromReminderAction(userId, reminderId);
        return "🔕 Got it - I won't remind you about that again.";

      default:
        this.logger.warn(`Unknown reminder action "${action}"`);
        return null;
    }
  }

  private async handleConfirmation(
    userId: string,
    executionId: string,
    action: string,
  ): Promise<string | null> {
    if (action === 'no') {
      return this.chat.cancelPendingAction(userId, executionId);
    }

    if (action === 'yes') {
      return this.chat.runConfirmedAction(userId, executionId);
    }

    return null;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
