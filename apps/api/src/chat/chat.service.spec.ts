import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
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
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { ToolExecutionService } from './tool-execution.service';
import { ActionPolicyService } from '../security/action-policy.service';

describe('ChatService', () => {
  let service: ChatService;
  let aiService: any;
  let searchService: any;
  let tasksService: any;
  let remindersService: any;
  let listsService: any;
  let memoryService: any;
  let boardsService: any;
  let calendarService: any;
  let friendsService: any;
  let gamificationService: any;
  let integrationsService: any;
  let githubApi: any;
  let notionApi: any;
  let googleWorkspaceApi: any;
  let slackTeamApi: any;
  let channelLinking: any;
  let usersService: any;
  let prisma: any;
  let contactsService: any;
  let toolExecutions: any;
  let actionPolicy: any;

  const call = (name: string, args: Record<string, any>) => ({
    id: 'call1',
    name,
    arguments: JSON.stringify(args),
  });

  const reply = (toolCalls: any[]) =>
    aiService.generateChatReply.mockResolvedValue({ reply: '', toolCalls });

  beforeEach(async () => {
    aiService = { generateChatReply: jest.fn() };
    searchService = { search: jest.fn().mockResolvedValue([]) };
    tasksService = {
      getTasksDueToday: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      completeTask: jest.fn(),
      remove: jest.fn(),
    };
    remindersService = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      complete: jest.fn(),
      remove: jest.fn(),
    };
    listsService = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      remove: jest.fn(),
    };
    memoryService = { create: jest.fn(), search: jest.fn().mockResolvedValue([]) };
    boardsService = { list: jest.fn().mockResolvedValue([]), create: jest.fn() };
    calendarService = {
      getEvents: jest.fn().mockResolvedValue([]),
      getOrCreateDefaultCalendar: jest.fn(),
      getPreferredCalendar: jest.fn().mockResolvedValue({ id: 'cal1' }),
      getValidGoogleAccessToken: jest.fn().mockResolvedValue('google-token'),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };
    friendsService = {
      sendRequest: jest.fn(),
      listFriends: jest.fn().mockResolvedValue([]),
      listIncomingRequests: jest.fn().mockResolvedValue([]),
      respond: jest.fn(),
      sendFriendReminder: jest.fn(),
    };
    gamificationService = { getProgress: jest.fn() };
    integrationsService = { listForUser: jest.fn(), getValidAccessToken: jest.fn() };
    githubApi = { listRepos: jest.fn(), listAssignedIssues: jest.fn() };
    notionApi = { searchPages: jest.fn() };
    googleWorkspaceApi = {
      listRecentEmails: jest.fn(),
      listRecentFiles: jest.fn(),
      sendEmail: jest.fn().mockResolvedValue({ id: 'gmail-1', threadId: 't1' }),
      searchMessages: jest.fn().mockResolvedValue([]),
      getMessage: jest.fn(),
    };
    slackTeamApi = { listChannels: jest.fn(), postMessage: jest.fn() };
    channelLinking = { getLinkedChannels: jest.fn() };
    usersService = { findById: jest.fn(), updatePreferences: jest.fn() };
    prisma = {
      channel: { findFirst: jest.fn().mockResolvedValue(null) },
      // buildContext reads the user's timezone so relative times resolve correctly
      user: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    };
    contactsService = { search: jest.fn().mockResolvedValue([]), create: jest.fn() };

    // Default posture: nothing needs confirming and nothing has run before, so
    // the existing tests exercise the plain execution path. Individual tests
    // opt into the confirmation or replay behaviour.
    actionPolicy = { requiresConfirmation: jest.fn().mockResolvedValue(false) };
    toolExecutions = {
      hashArgs: jest.fn().mockReturnValue('hash'),
      findRecentSuccess: jest.fn().mockResolvedValue(null),
      findPendingConfirmation: jest.fn().mockResolvedValue(null),
      claimPendingConfirmation: jest.fn().mockResolvedValue(null),
      start: jest.fn().mockResolvedValue({ id: 'exec1' }),
      awaitConfirmation: jest.fn().mockResolvedValue({ id: 'exec1' }),
      markSuccess: jest.fn(),
      markFailed: jest.fn(),
      markCancelled: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: AIService, useValue: aiService },
        { provide: SearchService, useValue: searchService },
        { provide: TasksService, useValue: tasksService },
        { provide: RemindersService, useValue: remindersService },
        { provide: ListsService, useValue: listsService },
        { provide: MemoryService, useValue: memoryService },
        { provide: BoardsService, useValue: boardsService },
        { provide: CalendarService, useValue: calendarService },
        { provide: FriendsService, useValue: friendsService },
        { provide: GamificationService, useValue: gamificationService },
        { provide: IntegrationsService, useValue: integrationsService },
        { provide: GitHubApiService, useValue: githubApi },
        { provide: NotionApiService, useValue: notionApi },
        { provide: GoogleWorkspaceApiService, useValue: googleWorkspaceApi },
        { provide: SlackTeamApiService, useValue: slackTeamApi },
        { provide: ChannelLinkingService, useValue: channelLinking },
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contactsService },
        { provide: ToolExecutionService, useValue: toolExecutions },
        { provide: ActionPolicyService, useValue: actionPolicy },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reply - context building', () => {
    it('builds context from relevant memories and tasks due today, then asks the AI for a reply', async () => {
      searchService.search.mockResolvedValue([{ summary: 'Dentist appointment next week' }]);
      tasksService.getTasksDueToday.mockResolvedValue([{ title: 'Pay rent' }]);
      aiService.generateChatReply.mockResolvedValue({
        reply: 'You have a dentist appointment coming up.',
      });

      const messages = [{ role: 'user' as const, content: 'What do I have going on?' }];
      const result = await service.reply('user1', messages, 'Zeesha');

      expect(searchService.search).toHaveBeenCalledWith('user1', 'What do I have going on?', 5);
      expect(aiService.generateChatReply).toHaveBeenCalledWith(
        messages,
        expect.stringContaining('Dentist appointment next week'),
        'Zeesha',
        expect.any(Array),
      );
      expect(aiService.generateChatReply).toHaveBeenCalledWith(
        messages,
        expect.stringContaining('Pay rent'),
        'Zeesha',
        expect.any(Array),
      );
      expect(result).toBe('You have a dentist appointment coming up.');
    });

    it('skips the memory search when there is no user message yet', async () => {
      aiService.generateChatReply.mockResolvedValue({ reply: 'Hi there!' });
      await service.reply('user1', [{ role: 'assistant', content: 'Hello' }]);
      expect(searchService.search).not.toHaveBeenCalled();
    });

    it('rejects off-topic questions with the exact scope message the model was instructed to return', async () => {
      aiService.generateChatReply.mockResolvedValue({
        reply: 'This is completely out of our scope, please refer to a local LLM.',
      });
      const result = await service.reply('user1', [
        { role: 'user', content: "What's the capital of France?" },
      ]);
      expect(result).toBe('This is completely out of our scope, please refer to a local LLM.');
    });

    it('passes the full expanded tool list to the AI on every call', async () => {
      aiService.generateChatReply.mockResolvedValue({ reply: 'hi' });
      await service.reply('user1', [{ role: 'user', content: 'hi' }]);
      const toolsArg = aiService.generateChatReply.mock.calls[0][3];
      const names = toolsArg.map((t: any) => t.function.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'create_reminder',
          'list_tasks',
          'create_board',
          'remind_friend',
          'github_list_repos',
          'slack_send_message',
        ]),
      );
    });
  });

  describe('tool calls - reminders', () => {
    it('creates a reminder with message and recurrence', async () => {
      reply([
        call('create_reminder', {
          title: 'Call mom',
          scheduled_at: '2026-09-01T09:00:00.000Z',
          message: 'ask about weekend',
          recurrence: 'WEEKLY',
        }),
      ]);
      remindersService.create.mockResolvedValue({
        title: 'Call mom',
        scheduledAt: '2026-09-01T09:00:00.000Z',
      });

      const result = await service.reply('user1', [
        { role: 'user', content: 'remind me to call mom every week' },
      ]);

      expect(remindersService.create).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          title: 'Call mom',
          message: 'ask about weekend',
          recurrence: { freq: 'WEEKLY' },
        }),
      );
      expect(result).toContain('Call mom');
    });

    it('lists upcoming reminders', async () => {
      reply([call('list_reminders', {})]);
      remindersService.findAll.mockResolvedValue([
        { title: 'Call mom', scheduledAt: '2026-09-05T09:00:00.000Z' },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'what are my reminders' },
      ]);
      expect(remindersService.findAll).toHaveBeenCalledWith('user1', true);
      expect(result).toContain('Call mom');
    });

    it('completes a reminder matched by a partial, differently-cased title', async () => {
      reply([call('complete_reminder', { title: 'call mom' })]);
      remindersService.findAll.mockResolvedValue([{ id: 'r1', title: 'Call Mom about dinner' }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'mark call mom as done' },
      ]);
      expect(remindersService.complete).toHaveBeenCalledWith('user1', 'r1');
      expect(result).toContain('Call Mom about dinner');
    });

    it('reports clearly when no reminder matches for completion', async () => {
      reply([call('complete_reminder', { title: 'nonexistent' })]);
      remindersService.findAll.mockResolvedValue([]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'complete nonexistent' },
      ]);
      expect(remindersService.complete).not.toHaveBeenCalled();
      expect(result).toContain("couldn't find");
    });

    it('deletes a reminder matched by title', async () => {
      reply([call('delete_reminder', { title: 'Call mom' })]);
      remindersService.findAll.mockResolvedValue([{ id: 'r1', title: 'Call mom' }]);
      await service.reply('user1', [{ role: 'user', content: 'delete the call mom reminder' }]);
      expect(remindersService.remove).toHaveBeenCalledWith('user1', 'r1');
    });
  });

  describe('tool calls - tasks & boards', () => {
    it('creates a task with priority and due date', async () => {
      reply([call('create_task', { title: 'Buy milk', priority: 'HIGH', due_date: '2026-09-05' })]);
      tasksService.create.mockResolvedValue({ title: 'Buy milk' });
      const result = await service.reply('user1', [
        { role: 'user', content: 'add an urgent task to buy milk' },
      ]);
      expect(tasksService.create).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ title: 'Buy milk', priority: 'HIGH' }),
      );
      expect(result).toContain('Buy milk');
    });

    it('resolves a board by name and creates the task on it', async () => {
      reply([call('create_task', { title: 'Design mockups', board_name: 'design' })]);
      boardsService.list.mockResolvedValue([
        { id: 'b1', name: 'Design Work', _count: { tasks: 2 } },
      ]);
      tasksService.create.mockResolvedValue({ title: 'Design mockups' });

      await service.reply('user1', [
        { role: 'user', content: 'add design mockups to my design board' },
      ]);

      expect(tasksService.create).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ boardId: 'b1' }),
      );
      expect(boardsService.create).not.toHaveBeenCalled();
    });

    it('creates a new board when no board matches the given name', async () => {
      reply([call('create_task', { title: 'Plan trip', board_name: 'Travel' })]);
      boardsService.list.mockResolvedValue([]);
      boardsService.create.mockResolvedValue({ id: 'b2', name: 'Travel' });
      tasksService.create.mockResolvedValue({ title: 'Plan trip' });

      await service.reply('user1', [{ role: 'user', content: 'add plan trip to my travel board' }]);

      expect(boardsService.create).toHaveBeenCalledWith('user1', 'Travel');
      expect(tasksService.create).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ boardId: 'b2' }),
      );
    });

    it('lists tasks with an optional status filter', async () => {
      reply([call('list_tasks', { status: 'PENDING' })]);
      tasksService.findAll.mockResolvedValue([{ title: 'Buy milk', priority: 'MEDIUM' }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'what tasks do I have left' },
      ]);
      expect(tasksService.findAll).toHaveBeenCalledWith('user1', 'PENDING');
      expect(result).toContain('Buy milk');
    });

    it('completes a task matched by title', async () => {
      reply([call('complete_task', { title: 'milk' })]);
      tasksService.findAll.mockResolvedValue([{ id: 't1', title: 'Buy milk' }]);
      await service.reply('user1', [{ role: 'user', content: 'mark buy milk done' }]);
      expect(tasksService.completeTask).toHaveBeenCalledWith('user1', 't1');
    });

    it('deletes a task matched by title', async () => {
      reply([call('delete_task', { title: 'milk' })]);
      tasksService.findAll.mockResolvedValue([{ id: 't1', title: 'Buy milk' }]);
      await service.reply('user1', [{ role: 'user', content: 'delete the milk task' }]);
      expect(tasksService.remove).toHaveBeenCalledWith('user1', 't1');
    });

    it('creates a board directly', async () => {
      reply([call('create_board', { name: 'Q4 Goals' })]);
      boardsService.create.mockResolvedValue({ name: 'Q4 Goals' });
      const result = await service.reply('user1', [
        { role: 'user', content: 'make a new board called Q4 Goals' },
      ]);
      expect(result).toContain('Q4 Goals');
    });

    it('lists boards with their task counts', async () => {
      reply([call('list_boards', {})]);
      boardsService.list.mockResolvedValue([{ name: "Today's board", _count: { tasks: 3 } }]);
      const result = await service.reply('user1', [{ role: 'user', content: 'show my boards' }]);
      expect(result).toContain("Today's board");
      expect(result).toContain('3');
    });
  });

  describe('tool calls - lists', () => {
    it('reuses an existing list by name (case-insensitive) instead of creating a duplicate', async () => {
      reply([call('create_list_item', { list_name: 'groceries', content: 'Eggs' })]);
      listsService.findAll.mockResolvedValue([{ id: 'list1', name: 'Groceries' }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'add eggs to my groceries list' },
      ]);
      expect(listsService.create).not.toHaveBeenCalled();
      expect(listsService.addItem).toHaveBeenCalledWith(
        'user1',
        'list1',
        expect.objectContaining({ content: 'Eggs' }),
      );
      expect(result).toContain('Eggs');
    });

    it('creates a new list when none matches', async () => {
      reply([call('create_list_item', { list_name: 'Books to read', content: 'Dune' })]);
      listsService.findAll.mockResolvedValue([]);
      listsService.create.mockResolvedValue({ id: 'list2', name: 'Books to read' });
      await service.reply('user1', [
        { role: 'user', content: 'add Dune to my books to read list' },
      ]);
      expect(listsService.create).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ name: 'Books to read' }),
      );
      expect(listsService.addItem).toHaveBeenCalledWith(
        'user1',
        'list2',
        expect.objectContaining({ content: 'Dune' }),
      );
    });

    it('lists all lists with their items', async () => {
      reply([call('list_lists', {})]);
      listsService.findAll.mockResolvedValue([
        { name: 'Groceries', items: [{ content: 'Eggs', isChecked: false }] },
      ]);
      const result = await service.reply('user1', [{ role: 'user', content: 'show my lists' }]);
      expect(result).toContain('Groceries');
      expect(result).toContain('Eggs');
    });

    it('checks off a list item matched by partial content', async () => {
      reply([call('check_list_item', { list_name: 'groceries', item_content: 'eggs' })]);
      listsService.findAll.mockResolvedValue([
        {
          id: 'l1',
          name: 'Groceries',
          items: [{ id: 'i1', content: 'Free-range eggs', isChecked: false }],
        },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'check off eggs on groceries' },
      ]);
      expect(listsService.updateItem).toHaveBeenCalledWith('user1', 'l1', 'i1', {
        isChecked: true,
      });
      expect(result).toContain('Checked off');
    });

    it('deletes a list matched by name', async () => {
      reply([call('delete_list', { list_name: 'Groceries' })]);
      listsService.findAll.mockResolvedValue([{ id: 'l1', name: 'Groceries' }]);
      await service.reply('user1', [{ role: 'user', content: 'delete my groceries list' }]);
      expect(listsService.remove).toHaveBeenCalledWith('user1', 'l1');
    });
  });

  describe('tool calls - memories', () => {
    it('saves a memory via tool call', async () => {
      reply([call('create_memory', { content: 'Parking spot is B12' })]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'remember that my parking spot is B12' },
      ]);
      expect(memoryService.create).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ content: 'Parking spot is B12' }),
      );
      expect(result).toContain("I'll remember");
    });

    it('searches memories and reports nothing found gracefully', async () => {
      reply([call('search_memories', { query: 'wifi password' })]);
      memoryService.search.mockResolvedValue([]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'what was the wifi password again' },
      ]);
      expect(result).toContain("couldn't find");
    });
  });

  describe('tool calls - calendar', () => {
    it('lists calendar events in the default 7-day window', async () => {
      reply([call('list_calendar_events', {})]);
      calendarService.getEvents.mockResolvedValue([
        { title: 'Dentist', startTime: '2026-09-03T10:00:00.000Z' },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: "what's on my calendar" },
      ]);
      expect(result).toContain('Dentist');
    });

    it('creates a calendar event on the best available calendar', async () => {
      reply([
        call('create_calendar_event', {
          title: 'Team sync',
          start_time: '2026-09-03T10:00:00.000Z',
          end_time: '2026-09-03T10:30:00.000Z',
        }),
      ]);
      calendarService.getPreferredCalendar.mockResolvedValue({ id: 'cal1' });
      calendarService.createEvent.mockResolvedValue({
        title: 'Team sync',
        startTime: '2026-09-03T10:00:00.000Z',
        metadata: {},
      });

      const result = await service.reply('user1', [
        { role: 'user', content: 'schedule a team sync for Sept 3rd' },
      ]);

      expect(calendarService.createEvent).toHaveBeenCalledWith(
        'user1',
        'cal1',
        expect.objectContaining({ title: 'Team sync' }),
      );
      expect(result).toContain('Team sync');
    });

    it('deletes a calendar event matched by title', async () => {
      reply([call('delete_calendar_event', { title: 'Team sync' })]);
      calendarService.getEvents.mockResolvedValue([{ id: 'e1', title: 'Team sync' }]);
      await service.reply('user1', [{ role: 'user', content: 'cancel the team sync event' }]);
      expect(calendarService.deleteEvent).toHaveBeenCalledWith('user1', 'e1');
    });
  });

  describe('tool calls - friends', () => {
    it('sends a friend request by email', async () => {
      reply([call('send_friend_request', { email: 'sam@example.com' })]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'add sam@example.com as a friend' },
      ]);
      expect(friendsService.sendRequest).toHaveBeenCalledWith('user1', {
        targetEmail: 'sam@example.com',
      });
      expect(result).toContain('sam@example.com');
    });

    it('lists friends', async () => {
      reply([call('list_friends', {})]);
      friendsService.listFriends.mockResolvedValue([
        { friend: { name: 'Sam', email: 'sam@example.com' } },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'who are my friends' },
      ]);
      expect(result).toContain('Sam');
    });

    it('accepts a pending friend request matched by requester name', async () => {
      reply([call('respond_friend_request', { from: 'sam', accept: true })]);
      friendsService.listIncomingRequests.mockResolvedValue([
        { id: 'fr1', requester: { name: 'Sam', email: 'sam@example.com' } },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'accept the friend request from sam' },
      ]);
      expect(friendsService.respond).toHaveBeenCalledWith('user1', 'fr1', true);
      expect(result).toContain('Accepted');
    });

    it('sends a reminder to a friend matched by name', async () => {
      reply([call('remind_friend', { friend: 'sam', message: 'submit the report' })]);
      friendsService.listFriends.mockResolvedValue([
        { friend: { id: 'u2', name: 'Sam', email: 'sam@example.com' } },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'remind sam to submit the report' },
      ]);
      expect(friendsService.sendFriendReminder).toHaveBeenCalledWith('user1', 'u2', {
        message: 'submit the report',
      });
      expect(result).toContain('submit the report');
    });
  });

  describe('tool calls - Master Zoorzio progress', () => {
    it('reports achievement progress with a few upcoming ones', async () => {
      reply([call('get_progress', {})]);
      gamificationService.getProgress.mockResolvedValue({
        completed: 5,
        total: 21,
        actions: [
          { title: 'Done one', completed: true },
          { title: 'Next one', completed: false },
        ],
      });
      const result = await service.reply('user1', [
        { role: 'user', content: 'how am I doing on master zoorzio' },
      ]);
      expect(result).toContain('5/21');
      expect(result).toContain('Next one');
    });
  });

  describe('tool calls - integrations', () => {
    it('lists connected integrations', async () => {
      reply([call('list_integrations', {})]);
      integrationsService.listForUser.mockResolvedValue([
        { name: 'GitHub', isConnected: true },
        { name: 'Notion', isConnected: false },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'what integrations do I have connected' },
      ]);
      expect(result).toContain('GitHub');
      expect(result).not.toContain('Notion');
    });

    it('lists GitHub repos when connected', async () => {
      reply([call('github_list_repos', {})]);
      integrationsService.getValidAccessToken.mockResolvedValue('gh-token');
      githubApi.listRepos.mockResolvedValue([{ fullName: 'me/repo', stars: 4 }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'show my github repos' },
      ]);
      expect(githubApi.listRepos).toHaveBeenCalledWith('gh-token');
      expect(result).toContain('me/repo');
    });

    it('tells the user to connect GitHub instead of failing when it is not connected', async () => {
      reply([call('github_list_repos', {})]);
      integrationsService.getValidAccessToken.mockRejectedValue(
        new Error('github is not connected.'),
      );
      const result = await service.reply('user1', [
        { role: 'user', content: 'show my github repos' },
      ]);
      expect(githubApi.listRepos).not.toHaveBeenCalled();
      expect(result.toLowerCase()).toContain('connect');
    });

    it('searches Notion when connected', async () => {
      reply([call('notion_search', { query: 'roadmap' })]);
      integrationsService.getValidAccessToken.mockResolvedValue('notion-token');
      notionApi.searchPages.mockResolvedValue([{ title: 'Q4 Roadmap' }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'find my roadmap doc in notion' },
      ]);
      expect(notionApi.searchPages).toHaveBeenCalledWith('notion-token', 'roadmap');
      expect(result).toContain('Q4 Roadmap');
    });

    it('lists recent Gmail messages when Google Workspace is connected', async () => {
      reply([call('google_workspace_list_emails', {})]);
      integrationsService.getValidAccessToken.mockResolvedValue('g-token');
      googleWorkspaceApi.listRecentEmails.mockResolvedValue([
        { subject: 'Invoice', from: 'billing@x.com' },
      ]);
      const result = await service.reply('user1', [{ role: 'user', content: 'any new emails' }]);
      expect(result).toContain('Invoice');
    });

    it('lists recent Drive files when Google Workspace is connected', async () => {
      reply([call('google_workspace_list_files', {})]);
      integrationsService.getValidAccessToken.mockResolvedValue('g-token');
      googleWorkspaceApi.listRecentFiles.mockResolvedValue([{ name: 'Roadmap.docx' }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'my recent drive files' },
      ]);
      expect(result).toContain('Roadmap.docx');
    });

    it('lists Slack channels when connected', async () => {
      reply([call('slack_list_channels', {})]);
      integrationsService.getValidAccessToken.mockResolvedValue('slack-token');
      slackTeamApi.listChannels.mockResolvedValue([{ id: 'C1', name: 'general' }]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'what slack channels do we have' },
      ]);
      expect(result).toContain('general');
    });

    it('resolves a Slack channel by name and posts the message', async () => {
      reply([call('slack_send_message', { channel_name: '#general', message: 'standup at 10' })]);
      integrationsService.getValidAccessToken.mockResolvedValue('slack-token');
      slackTeamApi.listChannels.mockResolvedValue([{ id: 'C1', name: 'general' }]);
      slackTeamApi.postMessage.mockResolvedValue({ ts: '1.1' });

      const result = await service.reply('user1', [
        { role: 'user', content: 'tell #general standup at 10' },
      ]);

      expect(slackTeamApi.postMessage).toHaveBeenCalledWith('slack-token', 'C1', 'standup at 10');
      expect(result).toContain('#general');
    });
  });

  describe('tool calls - channels & profile', () => {
    it('lists linked messaging channels', async () => {
      reply([call('list_linked_channels', {})]);
      channelLinking.getLinkedChannels.mockResolvedValue([
        { type: 'WHATSAPP' },
        { type: 'TELEGRAM' },
      ]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'what channels do I have linked' },
      ]);
      expect(result).toContain('WHATSAPP');
      expect(result).toContain('TELEGRAM');
    });

    it('reports profile details', async () => {
      reply([call('get_profile', {})]);
      usersService.findById.mockResolvedValue({
        name: 'Zeesha',
        email: 'z@x.com',
        phone: '+1555',
        language: 'en',
      });
      const result = await service.reply('user1', [
        { role: 'user', content: 'what are my account details' },
      ]);
      expect(result).toContain('Zeesha');
      expect(result).toContain('z@x.com');
    });

    it('updates the preferred notification channel', async () => {
      reply([call('update_notification_preference', { channel: 'WHATSAPP' })]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'notify me on whatsapp from now on' },
      ]);
      expect(usersService.updatePreferences).toHaveBeenCalledWith('user1', {
        notifications: { preferredChannel: 'WHATSAPP' },
      });
      expect(result).toContain('WhatsApp');
    });
  });

  describe('safety', () => {
    it('turns a plan-limit rejection into a friendly message instead of throwing', async () => {
      reply([
        call('create_reminder', { title: 'Call mom', scheduled_at: '2026-09-01T09:00:00.000Z' }),
      ]);
      remindersService.create.mockRejectedValue(
        new Error("You've reached the free-tier limit of 5 reminders."),
      );
      const result = await service.reply('user1', [
        { role: 'user', content: 'remind me to call mom' },
      ]);
      expect(result).toContain('free-tier limit');
    });

    it('never lets the model control which user a tool call acts on', async () => {
      reply([
        call('create_reminder', {
          title: 'Call mom',
          scheduled_at: '2026-09-01T09:00:00.000Z',
          userId: 'someone-elses-id',
        }),
      ]);
      remindersService.create.mockResolvedValue({
        title: 'Call mom',
        scheduledAt: '2026-09-01T09:00:00.000Z',
      });
      await service.reply('victim-user', [{ role: 'user', content: 'remind me to call mom' }]);
      expect(remindersService.create).toHaveBeenCalledWith('victim-user', expect.anything());
    });

    it('returns a graceful message for a completely unknown tool name rather than throwing', async () => {
      reply([call('delete_everything', {})]);
      const result = await service.reply('user1', [
        { role: 'user', content: 'do something weird' },
      ]);
      expect(result).toContain("don't know how to do that");
    });
  });

  describe('real-world actions', () => {
    describe('calendar', () => {
      it('reports the Meet link and attendees Google actually returned', async () => {
        reply([
          call('create_calendar_event', {
            title: 'Meeting with Ahmed',
            start_time: '2026-09-03T16:00:00.000Z',
            end_time: '2026-09-03T17:00:00.000Z',
            attendee_emails: ['ahmed@example.com'],
          }),
        ]);
        calendarService.createEvent.mockResolvedValue({
          title: 'Meeting with Ahmed',
          startTime: '2026-09-03T16:00:00.000Z',
          metadata: { meetLink: 'https://meet.google.com/abc-defg-hij' },
        });

        const result = await service.reply('user1', [
          { role: 'user', content: 'meeting with ahmed tomorrow at 4' },
        ]);

        expect(calendarService.createEvent).toHaveBeenCalledWith(
          'user1',
          'cal1',
          expect.objectContaining({ attendees: ['ahmed@example.com'] }),
        );
        expect(result).toContain('https://meet.google.com/abc-defg-hij');
        expect(result).toContain('ahmed@example.com');
      });

      it('claims no Meet link when Google did not issue one', async () => {
        reply([
          call('create_calendar_event', {
            title: 'Solo focus time',
            start_time: '2026-09-03T16:00:00.000Z',
            end_time: '2026-09-03T17:00:00.000Z',
          }),
        ]);
        calendarService.createEvent.mockResolvedValue({
          title: 'Solo focus time',
          startTime: '2026-09-03T16:00:00.000Z',
          metadata: {},
        });

        const result = await service.reply('user1', [{ role: 'user', content: 'block an hour' }]);

        expect(result).not.toContain('meet.google.com');
      });

      it('drops a bare name so it is never sent to Google as an invitee', async () => {
        reply([
          call('create_calendar_event', {
            title: 'Sync',
            start_time: '2026-09-03T16:00:00.000Z',
            end_time: '2026-09-03T17:00:00.000Z',
            attendee_emails: ['Ahmed', 'ahmed@example.com'],
          }),
        ]);
        calendarService.createEvent.mockResolvedValue({
          title: 'Sync',
          startTime: '2026-09-03T16:00:00.000Z',
          metadata: {},
        });

        await service.reply('user1', [{ role: 'user', content: 'sync with ahmed' }]);

        expect(calendarService.createEvent).toHaveBeenCalledWith(
          'user1',
          'cal1',
          expect.objectContaining({ attendees: ['ahmed@example.com'] }),
        );
      });
    });

    describe('gmail', () => {
      it('sends the email and only then reports it as sent', async () => {
        reply([
          call('send_gmail_message', {
            to: 'ahmed@example.com',
            subject: 'Running late',
            body: 'I will join at 4.',
          }),
        ]);

        const result = await service.reply('user1', [
          { role: 'user', content: 'email ahmed that I will be late' },
        ]);

        expect(googleWorkspaceApi.sendEmail).toHaveBeenCalledWith('google-token', {
          to: 'ahmed@example.com',
          subject: 'Running late',
          body: 'I will join at 4.',
        });
        expect(result).toContain('ahmed@example.com');
      });

      it('does not report success when Gmail rejects the send', async () => {
        reply([
          call('send_gmail_message', {
            to: 'ahmed@example.com',
            subject: 'Hi',
            body: 'Hello',
          }),
        ]);
        googleWorkspaceApi.sendEmail.mockRejectedValue(new Error('Gmail quota exceeded'));

        const result = await service.reply('user1', [{ role: 'user', content: 'email ahmed' }]);

        expect(result).not.toContain('Email sent');
        expect(toolExecutions.markFailed).toHaveBeenCalled();
      });

      it('resolves a name through contacts rather than inventing an address', async () => {
        reply([call('send_gmail_message', { to: 'Ahmed', subject: 'Hi', body: 'Hello' })]);
        contactsService.search.mockResolvedValue([
          { id: 'c1', name: 'Ahmed Khan', email: 'ahmed@example.com' },
        ]);

        await service.reply('user1', [{ role: 'user', content: 'email ahmed' }]);

        expect(googleWorkspaceApi.sendEmail).toHaveBeenCalledWith(
          'google-token',
          expect.objectContaining({ to: 'ahmed@example.com' }),
        );
      });

      it('asks which person is meant instead of emailing one of two matches', async () => {
        reply([call('send_gmail_message', { to: 'Ahmed', subject: 'Hi', body: 'Hello' })]);
        contactsService.search.mockResolvedValue([
          { id: 'c1', name: 'Ahmed Khan', email: 'ahmed.k@example.com' },
          { id: 'c2', name: 'Ahmed Ali', email: 'ahmed.a@example.com' },
        ]);

        const result = await service.reply('user1', [{ role: 'user', content: 'email ahmed' }]);

        expect(googleWorkspaceApi.sendEmail).not.toHaveBeenCalled();
        expect(result).toContain('Ahmed Khan');
        expect(result).toContain('Ahmed Ali');
      });

      it('asks for an address when the contact is unknown', async () => {
        reply([call('send_gmail_message', { to: 'Nobody', subject: 'Hi', body: 'Hello' })]);
        contactsService.search.mockResolvedValue([]);

        const result = await service.reply('user1', [{ role: 'user', content: 'email nobody' }]);

        expect(googleWorkspaceApi.sendEmail).not.toHaveBeenCalled();
        expect(result).toContain('Nobody');
      });
    });

    describe('contacts', () => {
      it('lists every match so the model has to ask', async () => {
        reply([call('find_contact', { name: 'Ahmed' })]);
        contactsService.search.mockResolvedValue([
          { id: 'c1', name: 'Ahmed Khan', email: 'ahmed.k@example.com' },
          { id: 'c2', name: 'Ahmed Ali', email: 'ahmed.a@example.com' },
        ]);

        const result = await service.reply('user1', [{ role: 'user', content: 'who is ahmed' }]);

        expect(result).toContain('Ahmed Khan');
        expect(result).toContain('Ahmed Ali');
      });
    });
  });

  describe('idempotency', () => {
    it('replays a recent identical action instead of doing it twice', async () => {
      // Stands in for the case where Google succeeded but the response was lost:
      // a retry must not create a second event.
      reply([
        call('create_calendar_event', {
          title: 'Team sync',
          start_time: '2026-09-03T10:00:00.000Z',
          end_time: '2026-09-03T10:30:00.000Z',
        }),
      ]);
      toolExecutions.findRecentSuccess.mockResolvedValue({
        id: 'exec-earlier',
        resultSummary: 'Already scheduled Team sync.',
      });

      const result = await service.reply('user1', [
        { role: 'user', content: 'schedule team sync' },
      ]);

      expect(calendarService.createEvent).not.toHaveBeenCalled();
      expect(result).toBe('Already scheduled Team sync.');
    });

    it('does not put read-only tools through the execution ledger', async () => {
      reply([call('list_reminders', {})]);

      await service.reply('user1', [{ role: 'user', content: 'what are my reminders' }]);

      expect(toolExecutions.start).not.toHaveBeenCalled();
    });
  });

  describe('action confirmation', () => {
    it('holds a confirm-required action instead of running it', async () => {
      actionPolicy.requiresConfirmation.mockResolvedValue(true);
      reply([call('delete_calendar_event', { title: 'Team sync' })]);
      calendarService.getEvents.mockResolvedValue([{ id: 'e1', title: 'Team sync' }]);

      await service.reply('user1', [{ role: 'user', content: 'cancel team sync' }]);

      expect(calendarService.deleteEvent).not.toHaveBeenCalled();
      expect(toolExecutions.awaitConfirmation).toHaveBeenCalled();
    });

    it('offers Yes/No buttons on the channel the conversation is happening on', async () => {
      actionPolicy.requiresConfirmation.mockResolvedValue(true);
      reply([call('delete_calendar_event', { title: 'Team sync' })]);
      const prompter = { sendButtons: jest.fn().mockResolvedValue(undefined) };

      const result = await service.reply(
        'user1',
        [{ role: 'user', content: 'cancel team sync' }],
        undefined,
        prompter,
      );

      expect(prompter.sendButtons).toHaveBeenCalledWith(expect.any(String), [
        { id: 'confirm:exec1:yes', title: 'Yes, do it' },
        { id: 'confirm:exec1:no', title: 'No, cancel' },
      ]);
      // The buttons are the message - no duplicate question alongside them.
      expect(result).toBe('');
    });

    it('asks in words when the conversation has no buttons (e.g. web chat)', async () => {
      actionPolicy.requiresConfirmation.mockResolvedValue(true);
      reply([call('delete_calendar_event', { title: 'Team sync' })]);

      const result = await service.reply('user1', [{ role: 'user', content: 'cancel team sync' }]);

      expect(result.toLowerCase()).toContain('yes');
    });

    it('falls back to asking in words if the buttons fail to send', async () => {
      actionPolicy.requiresConfirmation.mockResolvedValue(true);
      reply([call('delete_calendar_event', { title: 'Team sync' })]);
      const prompter = { sendButtons: jest.fn().mockRejectedValue(new Error('chat not found')) };

      const result = await service.reply(
        'user1',
        [{ role: 'user', content: 'cancel team sync' }],
        undefined,
        prompter,
      );

      expect(result.toLowerCase()).toContain('yes');
    });

    it('runs the held action once the user approves', async () => {
      toolExecutions.claimPendingConfirmation.mockResolvedValue({
        id: 'exec1',
        toolName: 'delete_calendar_event',
        args: { title: 'Team sync' },
      });
      calendarService.getEvents.mockResolvedValue([{ id: 'e1', title: 'Team sync' }]);

      const result = await service.runConfirmedAction('user1', 'exec1');

      expect(calendarService.deleteEvent).toHaveBeenCalledWith('user1', 'e1');
      expect(toolExecutions.markSuccess).toHaveBeenCalled();
      expect(result).toContain('Team sync');
    });

    it('does nothing when the user declines', async () => {
      toolExecutions.claimPendingConfirmation.mockResolvedValue({
        id: 'exec1',
        toolName: 'delete_calendar_event',
        args: { title: 'Team sync' },
      });

      await service.cancelPendingAction('user1', 'exec1');

      expect(calendarService.deleteEvent).not.toHaveBeenCalled();
      expect(toolExecutions.markCancelled).toHaveBeenCalledWith('exec1');
    });

    it("will not run an action that isn't the caller's to approve", async () => {
      // claimPendingConfirmation returns null for another user's execution.
      toolExecutions.claimPendingConfirmation.mockResolvedValue(null);

      const result = await service.runConfirmedAction('user1', 'someone-elses-exec');

      expect(calendarService.deleteEvent).not.toHaveBeenCalled();
      expect(result).toContain("isn't waiting");
    });

    it('treats a plain "yes" as approval of the action that is waiting', async () => {
      toolExecutions.findPendingConfirmation.mockResolvedValue({ id: 'exec1' });
      toolExecutions.claimPendingConfirmation.mockResolvedValue({
        id: 'exec1',
        toolName: 'delete_calendar_event',
        args: { title: 'Team sync' },
      });
      calendarService.getEvents.mockResolvedValue([{ id: 'e1', title: 'Team sync' }]);

      await service.reply('user1', [{ role: 'user', content: 'yes' }]);

      expect(calendarService.deleteEvent).toHaveBeenCalledWith('user1', 'e1');
      // Resolved without consulting the model at all.
      expect(aiService.generateChatReply).not.toHaveBeenCalled();
    });

    it('treats "no" as declining it', async () => {
      toolExecutions.findPendingConfirmation.mockResolvedValue({ id: 'exec1' });
      toolExecutions.claimPendingConfirmation.mockResolvedValue({
        id: 'exec1',
        toolName: 'delete_calendar_event',
        args: { title: 'Team sync' },
      });

      await service.reply('user1', [{ role: 'user', content: 'no' }]);

      expect(toolExecutions.markCancelled).toHaveBeenCalled();
    });

    it('lets an unrelated message through to the model', async () => {
      toolExecutions.findPendingConfirmation.mockResolvedValue({ id: 'exec1' });
      aiService.generateChatReply.mockResolvedValue({ reply: 'Sure.' });

      await service.reply('user1', [{ role: 'user', content: 'what are my tasks?' }]);

      expect(toolExecutions.claimPendingConfirmation).not.toHaveBeenCalled();
      expect(aiService.generateChatReply).toHaveBeenCalled();
    });
  });
});
