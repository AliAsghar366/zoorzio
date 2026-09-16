import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { SearchService } from '../search/search.service';
import { TasksService } from '../tasks/tasks.service';
import { RemindersService } from '../reminders/reminders.service';
import { ListsService } from '../lists/lists.service';
import { MemoryService } from '../memory/memory.service';
import { BoardsService } from '../boards/boards.service';
import { CalendarService } from '../calendar/calendar.service';
import { FriendsService } from '../friends/friends.service';
import { GamificationService } from '../gamification/gamification.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { GitHubApiService } from '../integrations/providers/github-api.service';
import { NotionApiService } from '../integrations/providers/notion-api.service';
import { GoogleWorkspaceApiService } from '../integrations/providers/google-workspace-api.service';
import { SlackTeamApiService } from '../integrations/providers/slack-team-api.service';
import { ChannelLinkingService } from '../channels/channel-linking.service';
import { confirmButtonId } from '../channels/interactive-reply.service';
import { ContactsService } from '../contacts/contacts.service';
import { ActionPolicyService } from '../security/action-policy.service';
import { ToolExecutionService } from './tool-execution.service';
import { UsersService } from '../users/users.service';
import { MemoryType, ChannelType } from '@anchor/database';
import { ChatMessageDto } from './dto/chat.dto';
import { TOOLS } from './tools';

/** How the conversation's own channel shows a yes/no question as tappable buttons. */
export interface ButtonPrompter {
  sendButtons(text: string, buttons: { id: string; title: string }[]): Promise<unknown>;
}

/**
 * Tools that change something outside Zoorzio. Only these get an execution
 * record - the idempotency guard and the confirmation gate both hang off it.
 * Read-only tools (listing tasks, searching memories) skip the ledger: there
 * is nothing to replay and nothing to confirm.
 */
const SIDE_EFFECTING_TOOLS = new Set([
  'create_calendar_event',
  'update_calendar_event',
  'delete_calendar_event',
  'send_gmail_message',
  'slack_send_message',
  'remind_friend',
  'send_friend_request',
]);

const AFFIRMATIVE =
  /^(yes|yep|yeah|y|ok|okay|sure|confirm|confirmed|do it|go ahead|please do|send it)\b/i;
const NEGATIVE = /^(no|nope|n|cancel|don'?t|do not|stop|nevermind|never mind)\b/i;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private searchService: SearchService,
    private tasksService: TasksService,
    private remindersService: RemindersService,
    private listsService: ListsService,
    private memoryService: MemoryService,
    private boardsService: BoardsService,
    private calendarService: CalendarService,
    private friendsService: FriendsService,
    private gamificationService: GamificationService,
    private integrationsService: IntegrationsService,
    private githubApi: GitHubApiService,
    private notionApi: NotionApiService,
    private googleWorkspaceApi: GoogleWorkspaceApiService,
    private slackTeamApi: SlackTeamApiService,
    private channelLinking: ChannelLinkingService,
    private usersService: UsersService,
    private contactsService: ContactsService,
    private toolExecutions: ToolExecutionService,
    private actionPolicy: ActionPolicyService,
  ) {}

  /** `prompter` is passed by a messaging channel so confirmations become buttons in that conversation. */
  async reply(
    userId: string,
    messages: ChatMessageDto[],
    userName?: string,
    prompter?: ButtonPrompter,
  ): Promise<string> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

    // An answer to a question the user was asked ("Send this email? yes") is
    // resolved here rather than being handed to the model, so approving an
    // action is a deterministic step the model cannot fabricate or skip.
    const pendingReply = await this.resolvePendingConfirmation(userId, lastUserMessage?.content);
    if (pendingReply) return pendingReply;

    const context = await this.buildContext(userId, lastUserMessage?.content ?? '');

    const { reply, toolCalls } = await this.aiService.generateChatReply(
      messages,
      context,
      userName,
      TOOLS as unknown as Record<string, unknown>[],
    );

    if (toolCalls && toolCalls.length > 0) {
      const results = await Promise.all(
        toolCalls.map((call) => this.executeTool(userId, call.name, call.arguments, prompter)),
      );
      return results.join('\n');
    }

    return reply;
  }

  /** Turns a plain "yes"/"no" into the approval or cancellation of the action actually waiting. */
  private async resolvePendingConfirmation(
    userId: string,
    message?: string,
  ): Promise<string | null> {
    if (!message?.trim()) return null;

    const pending = await this.toolExecutions.findPendingConfirmation(userId);
    if (!pending) return null;

    const text = message.trim();
    if (AFFIRMATIVE.test(text)) return this.runConfirmedAction(userId, pending.id);
    if (NEGATIVE.test(text)) return this.cancelPendingAction(userId, pending.id);

    return null;
  }

  /**
   * Runs an action the user has now approved.
   *
   * Ownership is re-checked when the execution is claimed, and the claim is
   * atomic, so tapping "Yes" twice still only sends one email.
   */
  async runConfirmedAction(userId: string, executionId: string): Promise<string> {
    const execution = await this.toolExecutions.claimPendingConfirmation(userId, executionId);
    if (!execution) {
      return "That request isn't waiting for an answer any more.";
    }

    const handler = this.handlerFor(execution.toolName);
    if (!handler) return "I don't know how to do that yet.";

    try {
      const result = await handler.call(this, userId, execution.args as Record<string, any>);
      await this.toolExecutions.markSuccess(execution.id, result);
      return result;
    } catch (error: any) {
      this.logger.warn(
        `Confirmed tool "${execution.toolName}" failed for user ${userId}: ${error?.message}`,
      );
      await this.toolExecutions.markFailed(execution.id, error?.message ?? 'unknown error');
      return error?.message || "Sorry, I couldn't do that just now.";
    }
  }

  async cancelPendingAction(userId: string, executionId: string): Promise<string> {
    const execution = await this.toolExecutions.claimPendingConfirmation(userId, executionId);
    if (!execution) {
      return "That request isn't waiting for an answer any more.";
    }

    await this.toolExecutions.markCancelled(execution.id);
    return "Okay, I've left that alone.";
  }

  private async executeTool(
    userId: string,
    name: string,
    argsJson: string,
    prompter?: ButtonPrompter,
  ): Promise<string> {
    let args: Record<string, any>;
    try {
      args = JSON.parse(argsJson);
    } catch {
      return 'I got confused putting that together — could you rephrase?';
    }

    const handler = this.handlerFor(name);
    if (!handler) return "I don't know how to do that yet.";

    if (!SIDE_EFFECTING_TOOLS.has(name)) {
      try {
        return await handler.call(this, userId, args);
      } catch (error: any) {
        this.logger.warn(`Tool "${name}" failed for user ${userId}: ${error?.message}`);
        return error?.message || "Sorry, I couldn't do that just now.";
      }
    }

    const argsHash = this.toolExecutions.hashArgs(name, args);

    // If this exact action already succeeded moments ago, report that result
    // again instead of doing it twice. This is what stops a retried webhook or
    // a timed-out-but-successful API call from double-booking a meeting.
    const alreadyDone = await this.toolExecutions.findRecentSuccess(userId, name, argsHash);
    if (alreadyDone?.resultSummary) {
      this.logger.log(`Replaying idempotent result for ${name} (execution ${alreadyDone.id})`);
      return alreadyDone.resultSummary;
    }

    if (await this.actionPolicy.requiresConfirmation(userId, name)) {
      const execution = await this.toolExecutions.awaitConfirmation(userId, name, argsHash, args);
      return this.askForConfirmation(userId, name, args, execution.id, prompter);
    }

    const execution = await this.toolExecutions.start(userId, name, argsHash, args);
    try {
      const result = await handler.call(this, userId, args);
      await this.toolExecutions.markSuccess(execution.id, result);
      return result;
    } catch (error: any) {
      this.logger.warn(`Tool "${name}" failed for user ${userId}: ${error?.message}`);
      await this.toolExecutions.markFailed(execution.id, error?.message ?? 'unknown error');
      return error?.message || "Sorry, I couldn't do that just now.";
    }
  }

  /**
   * Asks the user to approve an action - as buttons on the channel the
   * conversation is actually happening on, when it has them; otherwise as a
   * question resolvePendingConfirmation picks up from their next message.
   */
  private async askForConfirmation(
    userId: string,
    toolName: string,
    args: Record<string, any>,
    executionId: string,
    prompter?: ButtonPrompter,
  ): Promise<string> {
    const question = describeAction(toolName, args);

    if (prompter) {
      try {
        await prompter.sendButtons(question, [
          { id: confirmButtonId(executionId, 'yes'), title: 'Yes, do it' },
          { id: confirmButtonId(executionId, 'no'), title: 'No, cancel' },
        ]);
        // The buttons are the message; returning empty avoids sending the same
        // question twice on the same thread.
        return '';
      } catch (error) {
        this.logger.warn(`Could not send confirmation buttons to user ${userId}`, error);
      }
    }

    return `${question}\n\nReply "yes" to go ahead, or "no" to cancel.`;
  }

  private handlerFor(name: string) {
    const handlers: Record<string, (userId: string, args: Record<string, any>) => Promise<string>> =
      {
        create_reminder: this.toolCreateReminder,
        list_reminders: this.toolListReminders,
        complete_reminder: this.toolCompleteReminder,
        delete_reminder: this.toolDeleteReminder,
        create_task: this.toolCreateTask,
        list_tasks: this.toolListTasks,
        complete_task: this.toolCompleteTask,
        delete_task: this.toolDeleteTask,
        create_board: this.toolCreateBoard,
        list_boards: this.toolListBoards,
        create_list_item: this.toolCreateListItem,
        list_lists: this.toolListLists,
        check_list_item: this.toolCheckListItem,
        delete_list: this.toolDeleteList,
        create_memory: this.toolCreateMemory,
        search_memories: this.toolSearchMemories,
        list_calendar_events: this.toolListCalendarEvents,
        create_calendar_event: this.toolCreateCalendarEvent,
        delete_calendar_event: this.toolDeleteCalendarEvent,
        send_friend_request: this.toolSendFriendRequest,
        list_friends: this.toolListFriends,
        list_friend_requests: this.toolListFriendRequests,
        respond_friend_request: this.toolRespondFriendRequest,
        remind_friend: this.toolRemindFriend,
        get_progress: this.toolGetProgress,
        list_integrations: this.toolListIntegrations,
        github_list_repos: this.toolGithubListRepos,
        github_list_issues: this.toolGithubListIssues,
        notion_search: this.toolNotionSearch,
        google_workspace_list_emails: this.toolGoogleWorkspaceListEmails,
        google_workspace_list_files: this.toolGoogleWorkspaceListFiles,
        slack_list_channels: this.toolSlackListChannels,
        slack_send_message: this.toolSlackSendMessage,
        list_linked_channels: this.toolListLinkedChannels,
        get_profile: this.toolGetProfile,
        update_notification_preference: this.toolUpdateNotificationPreference,
        snooze_reminder: this.toolSnoozeReminder,
        search_calendar_events: this.toolSearchCalendarEvents,
        update_calendar_event: this.toolUpdateCalendarEvent,
        find_contact: this.toolFindContact,
        save_contact: this.toolSaveContact,
        send_gmail_message: this.toolSendGmailMessage,
        search_gmail_messages: this.toolSearchGmailMessages,
        get_gmail_message: this.toolGetGmailMessage,
      };

    return handlers[name];
  }

  // ---- Reminders ----

  private async toolCreateReminder(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.title || !args.scheduled_at || Number.isNaN(Date.parse(args.scheduled_at))) {
      return 'I need a clear title and time to set that reminder.';
    }
    const reminder = await this.remindersService.create(userId, {
      title: args.title,
      scheduledAt: new Date(args.scheduled_at).toISOString(),
      message: args.message,
      recurrence: args.recurrence ? { freq: args.recurrence } : undefined,
    } as any);
    return `Done — I'll remind you to "${reminder.title}" on ${new Date(reminder.scheduledAt).toLocaleString()}.`;
  }

  private async toolListReminders(userId: string): Promise<string> {
    const reminders = await this.remindersService.findAll(userId, true);
    if (reminders.length === 0) return "You don't have any upcoming reminders.";
    return (
      `You have ${reminders.length} upcoming reminder(s):\n` +
      reminders
        .map((r: any) => `• ${r.title} — ${new Date(r.scheduledAt).toLocaleString()}`)
        .join('\n')
    );
  }

  private async toolCompleteReminder(userId: string, args: Record<string, any>): Promise<string> {
    const match = await this.findByTitle(
      await this.remindersService.findAll(userId, true),
      args.title,
    );
    if (!match) return `I couldn't find an upcoming reminder matching "${args.title}".`;
    await this.remindersService.complete(userId, match.id);
    return `Marked "${match.title}" as done.`;
  }

  private async toolDeleteReminder(userId: string, args: Record<string, any>): Promise<string> {
    const match = await this.findByTitle(await this.remindersService.findAll(userId), args.title);
    if (!match) return `I couldn't find a reminder matching "${args.title}".`;
    await this.remindersService.remove(userId, match.id);
    return `Deleted the reminder "${match.title}".`;
  }

  private async toolSnoozeReminder(userId: string, args: Record<string, any>): Promise<string> {
    const match = await this.findByTitle(
      await this.remindersService.findAll(userId, true),
      args.title,
    );
    if (!match) return `I couldn't find an active reminder matching "${args.title}".`;

    const minutes = typeof args.minutes === 'number' && args.minutes > 0 ? args.minutes : 60;
    const reminder = await this.remindersService.snooze(userId, match.id, minutes * 60 * 1000);

    return `👍 I'll remind you about "${reminder.title}" again at ${new Date(reminder.scheduledAt).toLocaleTimeString()}.`;
  }

  // ---- Tasks / Boards ----

  private async toolCreateTask(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.title) return 'I need a title to create that task.';
    let boardId: string | undefined;
    if (args.board_name) {
      boardId = await this.findOrCreateBoardId(userId, args.board_name);
    }
    const task = await this.tasksService.create(userId, {
      title: args.title,
      description: args.description,
      dueDate: args.due_date,
      priority: args.priority,
      boardId,
    } as any);
    return `Done — added "${task.title}" to your tasks${args.due_date ? ` (due ${new Date(args.due_date).toLocaleDateString()})` : ''}.`;
  }

  private async toolListTasks(userId: string, args: Record<string, any>): Promise<string> {
    const tasks = await this.tasksService.findAll(userId, args.status);
    if (tasks.length === 0) return "You don't have any tasks matching that.";
    return (
      `You have ${tasks.length} task(s):\n` +
      tasks
        .map(
          (t: any) =>
            `• ${t.title} [${t.priority}]${t.dueDate ? ` — due ${new Date(t.dueDate).toLocaleDateString()}` : ''}`,
        )
        .join('\n')
    );
  }

  private async toolCompleteTask(userId: string, args: Record<string, any>): Promise<string> {
    const match = await this.findByTitle(await this.tasksService.findAll(userId), args.title);
    if (!match) return `I couldn't find a task matching "${args.title}".`;
    await this.tasksService.completeTask(userId, match.id);
    return `Marked "${match.title}" as complete.`;
  }

  private async toolDeleteTask(userId: string, args: Record<string, any>): Promise<string> {
    const match = await this.findByTitle(await this.tasksService.findAll(userId), args.title);
    if (!match) return `I couldn't find a task matching "${args.title}".`;
    await this.tasksService.remove(userId, match.id);
    return `Deleted the task "${match.title}".`;
  }

  private async toolCreateBoard(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.name) return 'I need a name for the new board.';
    const board = await this.boardsService.create(userId, args.name);
    return `Created a new board called "${board.name}".`;
  }

  private async toolListBoards(userId: string): Promise<string> {
    const boards = await this.boardsService.list(userId);
    return (
      `You have ${boards.length} board(s):\n` +
      boards
        .map((b: any) => `• ${b.name} (${b._count.tasks} task${b._count.tasks === 1 ? '' : 's'})`)
        .join('\n')
    );
  }

  // ---- Lists ----

  private async toolCreateListItem(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.list_name || !args.content) return 'I need both a list name and what to add.';
    const lists = await this.listsService.findAll(userId);
    let list = lists.find((l) => l.name.toLowerCase() === args.list_name.toLowerCase());
    if (!list) {
      list = await this.listsService.create(userId, { name: args.list_name } as any);
    }
    await this.listsService.addItem(userId, list.id, { content: args.content } as any);
    return `Done — added "${args.content}" to your "${list.name}" list.`;
  }

  private async toolListLists(userId: string): Promise<string> {
    const lists = await this.listsService.findAll(userId);
    if (lists.length === 0) return "You don't have any lists yet.";
    return lists
      .map((l: any) => {
        const items = l.items?.length
          ? l.items.map((i: any) => `   ${i.isChecked ? '✓' : '○'} ${i.content}`).join('\n')
          : '   (empty)';
        return `${l.name}:\n${items}`;
      })
      .join('\n');
  }

  private async toolCheckListItem(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.list_name || !args.item_content) return 'I need both the list name and which item.';
    const lists = await this.listsService.findAll(userId);
    const list = lists.find((l) => l.name.toLowerCase().includes(args.list_name.toLowerCase()));
    if (!list) return `I couldn't find a list matching "${args.list_name}".`;
    const item = (list as any).items?.find((i: any) =>
      i.content.toLowerCase().includes(args.item_content.toLowerCase()),
    );
    if (!item) return `I couldn't find an item matching "${args.item_content}" on "${list.name}".`;
    const checked = args.checked !== false;
    await this.listsService.updateItem(userId, list.id, item.id, { isChecked: checked } as any);
    return `${checked ? 'Checked off' : 'Unchecked'} "${item.content}" on "${list.name}".`;
  }

  private async toolDeleteList(userId: string, args: Record<string, any>): Promise<string> {
    const lists = await this.listsService.findAll(userId);
    const list = lists.find((l) =>
      l.name.toLowerCase().includes((args.list_name || '').toLowerCase()),
    );
    if (!list) return `I couldn't find a list matching "${args.list_name}".`;
    await this.listsService.remove(userId, list.id);
    return `Deleted the list "${list.name}".`;
  }

  // ---- Memories ----

  private async toolCreateMemory(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.content) return "There's nothing there for me to remember.";
    await this.memoryService.create(userId, {
      content: args.content,
      type: MemoryType.NOTE,
      source: ChannelType.NATIVE_APP,
    } as any);
    return "Got it — I'll remember that.";
  }

  private async toolSearchMemories(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.query) return 'What would you like me to search for?';
    const results = await this.memoryService.search(userId, args.query, 5);
    if (!results || results.length === 0) return `I couldn't find anything about "${args.query}".`;
    return (
      `Here's what I found about "${args.query}":\n` +
      results.map((m: any) => `• ${m.summary || m.content}`).join('\n')
    );
  }

  // ---- Calendar ----

  private async toolListCalendarEvents(userId: string, args: Record<string, any>): Promise<string> {
    const start = args.start_date ? new Date(args.start_date) : new Date();
    const end = args.end_date
      ? new Date(args.end_date)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const events = await this.calendarService.getEvents(userId, start, end);
    if (events.length === 0) return "You don't have anything on your calendar in that window.";
    return (
      `You have ${events.length} event(s):\n` +
      events.map((e: any) => `• ${e.title} — ${new Date(e.startTime).toLocaleString()}`).join('\n')
    );
  }

  private async toolSearchCalendarEvents(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    const start = args.start_date ? new Date(args.start_date) : new Date();
    const end = args.end_date
      ? new Date(args.end_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const events = await this.calendarService.getEvents(userId, start, end);

    const query = (args.query || '').toLowerCase();
    const matches = events.filter(
      (e: any) =>
        e.title?.toLowerCase().includes(query) || e.description?.toLowerCase().includes(query),
    );

    if (matches.length === 0) return `I couldn't find any events matching "${args.query}".`;
    return (
      `Found ${matches.length} event(s) matching "${args.query}":\n` +
      matches.map((e: any) => `• ${e.title} — ${new Date(e.startTime).toLocaleString()}`).join('\n')
    );
  }

  /**
   * Creates the event on the user's real calendar. The confirmation quotes the
   * Meet link and attendee list that Google actually returned, so nothing is
   * claimed that didn't happen.
   */
  private async toolCreateCalendarEvent(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    if (!args.title || !args.start_time || !args.end_time)
      return 'I need a title, start time, and end time for that event.';

    const attendees = normalizeEmails(args.attendee_emails);
    // Prefer the user's connected Google calendar so the event lands somewhere
    // real (with Meet + invitations); fall back to the local one otherwise.
    const calendar = await this.calendarService.getPreferredCalendar(userId);

    const event = await this.calendarService.createEvent(userId, calendar.id, {
      title: args.title,
      startTime: args.start_time,
      endTime: args.end_time,
      description: args.description,
      location: args.location,
      attendees,
      withMeet: args.with_meet !== false,
    });

    const metadata = (event.metadata as Record<string, any>) || {};
    const lines = [
      `✅ Done — "${event.title}" is on your calendar for ${new Date(event.startTime).toLocaleString()}.`,
    ];
    if (metadata.meetLink) lines.push(`Google Meet: ${metadata.meetLink}`);
    // Only claim an invitation went out if the provider says it did. `attendees`
    // is what was asked for; metadata.attendees is what the calendar accepted.
    // A LOCAL calendar sends nothing, so reporting the requested list told users
    // an invite had been sent when none had - wrong in the worst way, because it
    // reads as success.
    const invited: string[] = Array.isArray(metadata.attendees) ? metadata.attendees : [];
    if (invited.length > 0) {
      lines.push(`Invited: ${invited.join(', ')}`);
    } else if (attendees.length > 0) {
      lines.push(
        `I couldn't send invitations or add a Meet link — that needs a connected ` +
          `Google or Outlook calendar. Connect one and I'll invite ${attendees.join(', ')}.`,
      );
    }

    return lines.join('\n');
  }

  private async toolUpdateCalendarEvent(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    const events = await this.calendarService.getEvents(userId);
    const match = events.find((e: any) =>
      e.title.toLowerCase().includes((args.title || '').toLowerCase()),
    );
    if (!match) return `I couldn't find a calendar event matching "${args.title}".`;

    const updated = await this.calendarService.updateEvent(userId, match.id, {
      title: args.new_title,
      description: args.description,
      location: args.location,
      startTime: args.start_time,
      endTime: args.end_time,
      attendees: args.attendee_emails ? normalizeEmails(args.attendee_emails) : undefined,
    });

    return `✅ Updated "${updated.title}" — now ${new Date(updated.startTime).toLocaleString()}.`;
  }

  private async toolDeleteCalendarEvent(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    const events = await this.calendarService.getEvents(userId);
    const match = events.find((e: any) =>
      e.title.toLowerCase().includes((args.title || '').toLowerCase()),
    );
    if (!match) return `I couldn't find a calendar event matching "${args.title}".`;
    await this.calendarService.deleteEvent(userId, match.id);
    return `✅ Cancelled the event "${match.title}".`;
  }

  // ---- Contacts ----

  /**
   * Reports every match rather than picking one. Acting on the wrong Ahmed
   * means a real invitation to the wrong person, so ambiguity is handed back
   * to the user as a question.
   */
  private async toolFindContact(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.name) return 'Who should I look up?';

    const matches = await this.contactsService.search(userId, args.name);

    if (matches.length === 0) {
      return `I don't have anyone called "${args.name}" in your contacts. What's their email address?`;
    }

    if (matches.length === 1) {
      const contact = matches[0];
      return `${contact.name}${contact.email ? ` — ${contact.email}` : ''}${contact.phone ? ` — ${contact.phone}` : ''}`;
    }

    return (
      `I found ${matches.length} contacts matching "${args.name}". Which one did you mean?\n` +
      matches
        .map((c) => `• ${c.name}${c.email ? ` (${c.email})` : ''}${c.phone ? ` (${c.phone})` : ''}`)
        .join('\n')
    );
  }

  private async toolSaveContact(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.name) return 'What is their name?';
    if (!args.email && !args.phone)
      return `I need an email address or phone number for ${args.name}.`;

    const contact = await this.contactsService.create(userId, {
      name: args.name,
      email: args.email,
      phone: args.phone,
    });

    return `Saved ${contact.name} to your contacts.`;
  }

  // ---- Gmail ----

  private async toolSendGmailMessage(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.to || !args.subject || !args.body) {
      return 'I need a recipient, a subject, and what to say.';
    }

    // Guard against the model inventing an address from a name it was given.
    if (!isEmailAddress(args.to)) {
      const matches = await this.contactsService.search(userId, args.to);
      const withEmail = matches.filter((c) => c.email);

      if (withEmail.length === 0) {
        return `I don't have an email address for "${args.to}". What should I send it to?`;
      }
      if (withEmail.length > 1) {
        return (
          `I found more than one match for "${args.to}" — which one?\n` +
          withEmail.map((c) => `• ${c.name} (${c.email})`).join('\n')
        );
      }
      args.to = withEmail[0].email;
    }

    const accessToken = await this.calendarService.getValidGoogleAccessToken(userId);
    const sent = await this.googleWorkspaceApi.sendEmail(accessToken, {
      to: args.to,
      subject: args.subject,
      body: args.body,
    });

    // Only said after Gmail returned an id for the sent message.
    this.logger.log(`Sent Gmail message ${sent.id} for user ${userId}`);
    return `✅ Email sent to ${args.to}.`;
  }

  private async toolSearchGmailMessages(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    if (!args.query) return 'What should I search your email for?';

    const accessToken = await this.calendarService.getValidGoogleAccessToken(userId);
    const messages = await this.googleWorkspaceApi.searchMessages(accessToken, args.query);

    if (messages.length === 0) return `No emails matched "${args.query}".`;
    return (
      `Found ${messages.length} email(s):\n` +
      messages.map((m) => `• ${m.subject} — ${m.from} (id: ${m.id})`).join('\n')
    );
  }

  private async toolGetGmailMessage(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.message_id) return 'Which email would you like me to read?';

    const accessToken = await this.calendarService.getValidGoogleAccessToken(userId);
    const message = await this.googleWorkspaceApi.getMessage(accessToken, args.message_id);

    return [
      `From: ${message.from}`,
      `Subject: ${message.subject}`,
      '',
      message.body.slice(0, 1500),
    ].join('\n');
  }

  // ---- Friends ----

  private async toolSendFriendRequest(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.email) return "What's their email address?";
    await this.friendsService.sendRequest(userId, { targetEmail: args.email } as any);
    return `Sent a friend request to ${args.email}.`;
  }

  private async toolListFriends(userId: string): Promise<string> {
    const friends = await this.friendsService.listFriends(userId);
    if (friends.length === 0) return "You don't have any friends added yet.";
    return (
      `You have ${friends.length} friend(s):\n` +
      friends.map((f: any) => `• ${f.friend.name || f.friend.email}`).join('\n')
    );
  }

  private async toolListFriendRequests(userId: string): Promise<string> {
    const requests = await this.friendsService.listIncomingRequests(userId);
    if (requests.length === 0) return "You don't have any pending friend requests.";
    return (
      `You have ${requests.length} pending request(s):\n` +
      requests.map((r: any) => `• ${r.requester.name || r.requester.email}`).join('\n')
    );
  }

  private async toolRespondFriendRequest(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    const requests = await this.friendsService.listIncomingRequests(userId);
    const match = requests.find(
      (r: any) =>
        r.requester.name?.toLowerCase().includes((args.from || '').toLowerCase()) ||
        r.requester.email.toLowerCase().includes((args.from || '').toLowerCase()),
    );
    if (!match) return `I couldn't find a pending request from "${args.from}".`;
    await this.friendsService.respond(userId, (match as any).id, !!args.accept);
    return args.accept
      ? `Accepted the friend request from ${(match as any).requester.name || (match as any).requester.email}.`
      : `Declined the friend request from ${(match as any).requester.name || (match as any).requester.email}.`;
  }

  private async toolRemindFriend(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.friend || !args.message)
      return 'I need to know which friend, and what to remind them about.';
    const friends = await this.friendsService.listFriends(userId);
    const match = friends.find(
      (f: any) =>
        f.friend.name?.toLowerCase().includes(args.friend.toLowerCase()) ||
        f.friend.email.toLowerCase().includes(args.friend.toLowerCase()),
    );
    if (!match) return `I couldn't find a friend matching "${args.friend}".`;
    await this.friendsService.sendFriendReminder(userId, (match as any).friend.id, {
      message: args.message,
    } as any);
    return `Sent a reminder to ${(match as any).friend.name || (match as any).friend.email}: "${args.message}"`;
  }

  // ---- Master Zoorzio ----

  private async toolGetProgress(userId: string): Promise<string> {
    const progress = await this.gamificationService.getProgress(userId);
    const next = progress.actions.filter((a: any) => !a.completed).slice(0, 3);
    let msg = `You've completed ${progress.completed}/${progress.total} Master Zoorzio achievements.`;
    if (next.length > 0) msg += `\nUp next: ${next.map((a: any) => a.title).join(', ')}`;
    return msg;
  }

  // ---- Integrations ----

  private async toolListIntegrations(userId: string): Promise<string> {
    const cards = await this.integrationsService.listForUser(userId);
    const connected = cards.filter((c) => c.isConnected);
    if (connected.length === 0) return "You don't have any integrations connected yet.";
    return `Connected: ${connected.map((c) => c.name).join(', ')}.`;
  }

  private async toolGithubListRepos(userId: string): Promise<string> {
    const token = await this.getIntegrationToken(userId, 'github', 'GitHub');
    const repos = await this.githubApi.listRepos(token);
    if (repos.length === 0) return 'No repositories found.';
    return (
      `Your repositories:\n` +
      repos
        .slice(0, 10)
        .map((r) => `• ${r.fullName} (${r.stars}★)`)
        .join('\n')
    );
  }

  private async toolGithubListIssues(userId: string): Promise<string> {
    const token = await this.getIntegrationToken(userId, 'github', 'GitHub');
    const issues = await this.githubApi.listAssignedIssues(token);
    if (issues.length === 0) return "You don't have any open issues assigned to you.";
    return (
      `Assigned to you:\n` +
      issues
        .slice(0, 10)
        .map((i) => `• ${i.repo} #${i.number}: ${i.title}`)
        .join('\n')
    );
  }

  private async toolNotionSearch(userId: string, args: Record<string, any>): Promise<string> {
    const token = await this.getIntegrationToken(userId, 'notion', 'Notion');
    const pages = await this.notionApi.searchPages(token, args.query);
    if (pages.length === 0) return 'Nothing found in Notion.';
    return (
      `Found in Notion:\n` +
      pages
        .slice(0, 10)
        .map((p) => `• ${p.title}`)
        .join('\n')
    );
  }

  private async toolGoogleWorkspaceListEmails(userId: string): Promise<string> {
    const token = await this.getIntegrationToken(userId, 'google_workspace', 'Google Workspace');
    const emails = await this.googleWorkspaceApi.listRecentEmails(token);
    if (emails.length === 0) return 'No recent emails.';
    return (
      `Recent emails:\n` +
      emails
        .slice(0, 10)
        .map((m) => `• ${m.subject} — ${m.from}`)
        .join('\n')
    );
  }

  private async toolGoogleWorkspaceListFiles(userId: string): Promise<string> {
    const token = await this.getIntegrationToken(userId, 'google_workspace', 'Google Workspace');
    const files = await this.googleWorkspaceApi.listRecentFiles(token);
    if (files.length === 0) return 'No recent files.';
    return (
      `Recent Drive files:\n` +
      files
        .slice(0, 10)
        .map((f) => `• ${f.name}`)
        .join('\n')
    );
  }

  private async toolSlackListChannels(userId: string): Promise<string> {
    const token = await this.getIntegrationToken(userId, 'slack', 'Slack');
    const channels = await this.slackTeamApi.listChannels(token);
    if (channels.length === 0) return 'No Slack channels found.';
    return `Channels:\n` + channels.map((c) => `• #${c.name}`).join('\n');
  }

  private async toolSlackSendMessage(userId: string, args: Record<string, any>): Promise<string> {
    if (!args.channel_name || !args.message) return 'I need a channel name and a message.';
    const token = await this.getIntegrationToken(userId, 'slack', 'Slack');
    const channels = await this.slackTeamApi.listChannels(token);
    const clean = args.channel_name.replace(/^#/, '').toLowerCase();
    const match = channels.find(
      (c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean),
    );
    if (!match) return `I couldn't find a Slack channel matching "${args.channel_name}".`;
    await this.slackTeamApi.postMessage(token, match.id, args.message);
    return `Sent your message to #${match.name}.`;
  }

  // ---- Messaging channels ----

  private async toolListLinkedChannels(userId: string): Promise<string> {
    const channels = await this.channelLinking.getLinkedChannels(userId);
    if (!channels || channels.length === 0)
      return "You don't have any messaging channels linked yet.";
    return `Linked channels: ${channels.map((c: any) => c.type).join(', ')}.`;
  }

  // ---- Profile ----

  private async toolGetProfile(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    return [
      `Name: ${user.name || '(not set)'}`,
      `Email: ${user.email}`,
      `Phone: ${user.phone || '(not set)'}`,
      `Language: ${user.language || 'en'}`,
    ].join('\n');
  }

  private static readonly CHANNEL_LABELS: Record<string, string> = {
    EMAIL: 'Email',
    WHATSAPP: 'WhatsApp',
    TELEGRAM: 'Telegram',
    SMS: 'SMS',
    DISCORD: 'Discord',
    SLACK: 'Slack',
  };

  private async toolUpdateNotificationPreference(
    userId: string,
    args: Record<string, any>,
  ): Promise<string> {
    if (!args.channel)
      return 'Which channel would you like — Email, WhatsApp, Telegram, SMS, Discord, or Slack?';
    await this.usersService.updatePreferences(userId, {
      notifications: { preferredChannel: args.channel },
    });
    return `Done — I'll notify you by ${ChatService.CHANNEL_LABELS[args.channel] || args.channel} from now on.`;
  }

  // ---- Shared helpers ----

  /** Case-insensitive substring match on `.title`, tolerant of typos/partial phrasing rather than requiring an exact match. */
  private async findByTitle<T extends { title: string }>(
    items: T[],
    query: string,
  ): Promise<T | undefined> {
    const q = (query || '').toLowerCase();
    return items.find((i) => i.title.toLowerCase().includes(q));
  }

  private async findOrCreateBoardId(userId: string, boardName: string): Promise<string> {
    const boards = await this.boardsService.list(userId);
    const match = boards.find((b: any) => b.name.toLowerCase().includes(boardName.toLowerCase()));
    if (match) return (match as any).id;
    const created = await this.boardsService.create(userId, boardName);
    return created.id;
  }

  /** Returns a usable access token, or throws a friendly "please connect X" error the outer catch will relay as-is. */
  private async getIntegrationToken(
    userId: string,
    provider: 'github' | 'notion' | 'google_workspace' | 'slack',
    label: string,
  ): Promise<string> {
    try {
      return await this.integrationsService.getValidAccessToken(userId, provider);
    } catch {
      throw new Error(
        `${label} isn't connected yet — connect it from the Integrations page first.`,
      );
    }
  }

  private async buildContext(userId: string, query: string): Promise<string> {
    const [memories, dueToday] = await Promise.all([
      query ? this.searchService.search(userId, query, 5) : Promise.resolve([]),
      this.tasksService.getTasksDueToday(userId),
    ]);

    const parts: string[] = [];
    if (memories.length > 0) {
      parts.push(
        'Relevant memories:\n' + memories.map((m: any) => `- ${m.summary || m.content}`).join('\n'),
      );
    }
    if (dueToday.length > 0) {
      parts.push('Tasks due today:\n' + dueToday.map((t: any) => `- ${t.title}`).join('\n'));
    }
    return parts.join('\n\n');
  }
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Keeps only things that are actually email addresses, so a bare name never reaches Google as an invitee. */
function normalizeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(isEmailAddress);
}

/** Plain-language description of a pending action, used when asking the user to approve it. */
function describeAction(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'delete_calendar_event':
      return `Cancel the event "${args.title}"? Attendees will be notified.`;
    case 'send_gmail_message':
      return `Send this email to ${args.to}?\n\nSubject: ${args.subject}\n\n${String(args.body ?? '').slice(0, 500)}`;
    case 'create_calendar_event':
      return `Schedule "${args.title}" for ${new Date(args.start_time).toLocaleString()}?`;
    case 'update_calendar_event':
      return `Change the event "${args.title}"?`;
    case 'slack_send_message':
      return `Post this to #${args.channel_name}?\n\n${args.message}`;
    case 'remind_friend':
      return `Send ${args.friend} this reminder?\n\n${args.message}`;
    default:
      return `Go ahead with ${toolName.replace(/_/g, ' ')}?`;
  }
}
