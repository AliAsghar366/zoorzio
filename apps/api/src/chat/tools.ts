/**
 * OpenAI/Grok "tools" function-calling schema. Every manual action a user can
 * take through the UI has a matching tool here, so the chat assistant can do
 * it too instead of just describing what it would do. Every execution in
 * ChatService is scoped to the authenticated userId - the LLM never supplies
 * or controls whose data it's touching.
 *
 * Deliberately NOT covered (and the system prompt tells the model to say so
 * instead of guessing): connecting a new OAuth integration/calendar, and
 * linking a new messaging channel. Both require a real browser redirect or
 * an out-of-band proof-of-ownership step that cannot happen inside a chat
 * reply - the model should point the user to the right page instead.
 */
export const TOOLS = [
  // ---- Reminders ----
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description: 'Create a reminder for the user at a specific date/time.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'What to remind the user about' },
          scheduled_at: { type: 'string', description: 'ISO 8601 date-time the reminder should fire' },
          message: { type: 'string', description: 'Optional extra detail' },
          recurrence: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], description: 'Omit for a one-off reminder' },
        },
        required: ['title', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description: "List the user's upcoming (not yet completed) reminders.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_reminder',
      description: 'Mark a reminder as done, matched by its title.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Title (or part of it) of the reminder to complete' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_reminder',
      description: 'Delete a reminder, matched by its title.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Title (or part of it) of the reminder to delete' } },
        required: ['title'],
      },
    },
  },

  // ---- Tasks / Boards ----
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task/to-do for the user, optionally on a named board.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          due_date: { type: 'string', description: 'ISO 8601 date, optional' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          board_name: { type: 'string', description: "Board to put it on - defaults to the user's default board if omitted" },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: "List the user's tasks, optionally filtered by status.",
      parameters: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed, matched by its title.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Title (or part of it) of the task to complete' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task, matched by its title.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Title (or part of it) of the task to delete' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_board',
      description: 'Create a new task board.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_boards',
      description: "List the user's task boards and how many tasks are on each.",
      parameters: { type: 'object', properties: {} },
    },
  },

  // ---- Lists ----
  {
    type: 'function',
    function: {
      name: 'create_list_item',
      description: "Add an item to one of the user's lists, creating the list if it doesn't exist yet.",
      parameters: {
        type: 'object',
        properties: {
          list_name: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['list_name', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_lists',
      description: "Show the user's lists and their items.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_list_item',
      description: 'Check or uncheck an item on a list.',
      parameters: {
        type: 'object',
        properties: {
          list_name: { type: 'string' },
          item_content: { type: 'string', description: 'Text (or part of it) of the item to check off' },
          checked: { type: 'boolean', description: 'true to check it, false to uncheck - defaults to true' },
        },
        required: ['list_name', 'item_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_list',
      description: 'Delete an entire list, matched by name.',
      parameters: {
        type: 'object',
        properties: { list_name: { type: 'string' } },
        required: ['list_name'],
      },
    },
  },

  // ---- Memories ----
  {
    type: 'function',
    function: {
      name: 'create_memory',
      description: 'Save a note or thought as a memory for later recall.',
      parameters: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memories',
      description: 'Search the user\'s saved memories/notes by keyword.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },

  // ---- Calendar ----
  {
    type: 'function',
    function: {
      name: 'list_calendar_events',
      description: "List the user's calendar events in a date range (defaults to the next 7 days if not specified).",
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO 8601 date, optional' },
          end_date: { type: 'string', description: 'ISO 8601 date, optional' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a calendar event. Works even if the user has no calendar connected - a personal calendar is created automatically the first time this is used.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_time: { type: 'string', description: 'ISO 8601 date-time' },
          end_time: { type: 'string', description: 'ISO 8601 date-time' },
          description: { type: 'string' },
        },
        required: ['title', 'start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Delete a calendar event, matched by its title.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
  },

  // ---- Friends ----
  {
    type: 'function',
    function: {
      name: 'send_friend_request',
      description: "Send a friend request to someone by email so they can be added to the user's friends list.",
      parameters: {
        type: 'object',
        properties: { email: { type: 'string' } },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_friends',
      description: "List the user's accepted friends.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_friend_requests',
      description: 'List pending incoming friend requests.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'respond_friend_request',
      description: 'Accept or decline a pending friend request, matched by the requester\'s name or email.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: "Name or email of the person who sent the request" },
          accept: { type: 'boolean' },
        },
        required: ['from', 'accept'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remind_friend',
      description: 'Send a reminder message to one of the user\'s friends, matched by name or email.',
      parameters: {
        type: 'object',
        properties: {
          friend: { type: 'string', description: 'Name or email of the friend to remind' },
          message: { type: 'string' },
        },
        required: ['friend', 'message'],
      },
    },
  },

  // ---- Master Zoorzio / progress ----
  {
    type: 'function',
    function: {
      name: 'get_progress',
      description: "Show the user's Master Zoorzio achievement progress (how many of the 21 actions they've completed).",
      parameters: { type: 'object', properties: {} },
    },
  },

  // ---- Integrations ----
  {
    type: 'function',
    function: {
      name: 'list_integrations',
      description: "Show which integrations (calendars, GitHub, Notion, Google Workspace, Slack) the user has connected.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_repos',
      description: "List the user's GitHub repositories. Only works if GitHub is connected.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_issues',
      description: 'List open GitHub issues assigned to the user. Only works if GitHub is connected.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notion_search',
      description: "Search the user's Notion pages shared with the Zoorzio integration. Only works if Notion is connected.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'google_workspace_list_emails',
      description: "List the user's recent Gmail messages. Only works if Google Workspace is connected.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'google_workspace_list_files',
      description: "List the user's recently modified Google Drive files. Only works if Google Workspace is connected.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_list_channels',
      description: 'List channels in the connected Slack workspace. Only works if a Slack team is connected.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_send_message',
      description: 'Post a message to a channel in the connected Slack workspace, matched by channel name.',
      parameters: {
        type: 'object',
        properties: {
          channel_name: { type: 'string', description: 'Channel name without the #' },
          message: { type: 'string' },
        },
        required: ['channel_name', 'message'],
      },
    },
  },

  // ---- Messaging channels ----
  {
    type: 'function',
    function: {
      name: 'list_linked_channels',
      description: 'List which messaging channels (WhatsApp, Telegram, SMS, Discord, Slack) the user has linked to their account.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ---- Profile / settings ----
  {
    type: 'function',
    function: {
      name: 'get_profile',
      description: "Show the user's profile details (name, email, phone, language, plan).",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_notification_preference',
      description: 'Change which channel Zoorzio should use to notify the user by default.',
      parameters: {
        type: 'object',
        properties: { channel: { type: 'string', enum: ['EMAIL', 'WHATSAPP', 'TELEGRAM', 'SMS', 'DISCORD', 'SLACK'] } },
        required: ['channel'],
      },
    },
  },
] as const;
