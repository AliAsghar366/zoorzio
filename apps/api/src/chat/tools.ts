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
          scheduled_at: {
            type: 'string',
            description: 'ISO 8601 date-time the reminder should fire',
          },
          message: { type: 'string', description: 'Optional extra detail' },
          recurrence: {
            type: 'string',
            enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
            description: 'Omit for a one-off reminder',
          },
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
        properties: {
          title: {
            type: 'string',
            description: 'Title (or part of it) of the reminder to complete',
          },
        },
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
        properties: {
          title: { type: 'string', description: 'Title (or part of it) of the reminder to delete' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'snooze_reminder',
      description:
        'Push a reminder back so it fires again later - use this when the user says something like "remind me again in an hour".',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title (or part of it) of the reminder to snooze' },
          minutes: { type: 'number', description: 'How many minutes to wait. Defaults to 60.' },
        },
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
          board_name: {
            type: 'string',
            description: "Board to put it on - defaults to the user's default board if omitted",
          },
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
        properties: {
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        },
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
        properties: {
          title: { type: 'string', description: 'Title (or part of it) of the task to complete' },
        },
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
        properties: {
          title: { type: 'string', description: 'Title (or part of it) of the task to delete' },
        },
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
      description:
        "Add an item to one of the user's lists, creating the list if it doesn't exist yet.",
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
          item_content: {
            type: 'string',
            description: 'Text (or part of it) of the item to check off',
          },
          checked: {
            type: 'boolean',
            description: 'true to check it, false to uncheck - defaults to true',
          },
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
      description: "Search the user's saved memories/notes by keyword.",
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
      description:
        "List the user's calendar events in a date range (defaults to the next 7 days if not specified).",
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
      name: 'search_calendar_events',
      description:
        "Find calendar events matching some text (a person's name, a subject). Use this to locate an event before changing or cancelling it.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text to look for in event titles and descriptions',
          },
          start_date: { type: 'string', description: 'ISO 8601 date, optional' },
          end_date: { type: 'string', description: 'ISO 8601 date, optional' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description:
        "Create a calendar event. If the user's Google account is connected this creates a real Google Calendar event with a Google Meet link and emails invitations to any attendees. Only pass attendee_emails you actually know - use find_contact first to look up an email by name, and ask the user rather than guessing.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_time: { type: 'string', description: 'ISO 8601 date-time' },
          end_time: { type: 'string', description: 'ISO 8601 date-time' },
          description: { type: 'string' },
          location: { type: 'string' },
          attendee_emails: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses to invite. Omit if you do not have a real address.',
          },
          with_meet: {
            type: 'boolean',
            description: 'Whether to add a Google Meet link. Defaults to true.',
          },
        },
        required: ['title', 'start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description:
        'Change an existing calendar event (move it, rename it, add attendees), matched by its current title.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title (or part of it) of the event to change' },
          new_title: { type: 'string' },
          start_time: { type: 'string', description: 'New ISO 8601 start date-time' },
          end_time: { type: 'string', description: 'New ISO 8601 end date-time' },
          description: { type: 'string' },
          location: { type: 'string' },
          attendee_emails: { type: 'array', items: { type: 'string' } },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Cancel/delete a calendar event, matched by its title. Attendees are notified.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
  },

  // ---- Contacts ----
  {
    type: 'function',
    function: {
      name: 'find_contact',
      description:
        "Look up someone in the user's contacts by name to get their email or phone number. Always use this before emailing or inviting someone the user referred to by name only. If it reports more than one match, ask the user which one they meant instead of picking.",
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Name (or part of it) to look up' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_contact',
      description:
        "Save someone to the user's contacts so they can be found by name later. Use this when the user tells you a person's email or phone number.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },

  // ---- Gmail ----
  {
    type: 'function',
    function: {
      name: 'send_gmail_message',
      description:
        "Send an email from the user's connected Google account. `to` must be a real email address - use find_contact to resolve a name first, and ask the user if you cannot find one. Never invent an address.",
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Plain-text body of the email' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_gmail_messages',
      description:
        "Search the user's Gmail using Gmail's search syntax (e.g. 'from:ahmed newer_than:7d', 'subject:invoice is:unread').",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Gmail search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_gmail_message',
      description:
        'Read the full text of one email, using an id returned by search_gmail_messages.',
      parameters: {
        type: 'object',
        properties: { message_id: { type: 'string' } },
        required: ['message_id'],
      },
    },
  },

  // ---- Friends ----
  {
    type: 'function',
    function: {
      name: 'send_friend_request',
      description:
        "Send a friend request to someone by email so they can be added to the user's friends list.",
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
      description:
        "Accept or decline a pending friend request, matched by the requester's name or email.",
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Name or email of the person who sent the request' },
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
      description:
        "Send a reminder message to one of the user's friends, matched by name or email.",
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
      description:
        "Show the user's Master Zoorzio achievement progress (how many of the 21 actions they've completed).",
      parameters: { type: 'object', properties: {} },
    },
  },

  // ---- Integrations ----
  {
    type: 'function',
    function: {
      name: 'list_integrations',
      description:
        'Show which integrations (calendars, GitHub, Notion, Google Workspace, Slack) the user has connected.',
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
      description:
        'List open GitHub issues assigned to the user. Only works if GitHub is connected.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notion_search',
      description:
        "Search the user's Notion pages shared with the Zoorzio integration. Only works if Notion is connected.",
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
      description:
        "List the user's recent Gmail messages. Only works if Google Workspace is connected.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'google_workspace_list_files',
      description:
        "List the user's recently modified Google Drive files. Only works if Google Workspace is connected.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_list_channels',
      description:
        'List channels in the connected Slack workspace. Only works if a Slack team is connected.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slack_send_message',
      description:
        'Post a message to a channel in the connected Slack workspace, matched by channel name.',
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
      description:
        'List which messaging channels (WhatsApp, Telegram, SMS, Discord, Slack) the user has linked to their account.',
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
        properties: {
          channel: {
            type: 'string',
            enum: ['EMAIL', 'WHATSAPP', 'TELEGRAM', 'SMS', 'DISCORD', 'SLACK'],
          },
        },
        required: ['channel'],
      },
    },
  },
] as const;

/**
 * Providers validate the model's tool call against these schemas before we ever
 * see it. Models routinely send `null` for an optional argument they have
 * decided not to use - "no recurrence on this reminder" - and a schema saying
 * `type: 'string'` makes that a hard rejection, failing the whole turn. The
 * user then gets "I'm having trouble responding right now" instead of their
 * reminder.
 *
 * Observed on Groq: create_reminder with recurrence: null returned
 *   "parameters for tool create_reminder did not match schema:
 *    [`/recurrence`: expected string, but got null]"
 *
 * So every property that is not in `required` is widened to also accept null.
 * Optional already means "may be absent"; this makes it mean "may be absent or
 * explicitly empty", which is what the models actually do.
 */
export function allowNullOnOptionalParams<T>(tools: T): T {
  const clone = JSON.parse(JSON.stringify(tools));
  for (const tool of clone as any[]) {
    const params = tool?.function?.parameters;
    if (!params?.properties) continue;
    const required: string[] = Array.isArray(params.required) ? params.required : [];
    for (const [name, prop] of Object.entries<any>(params.properties)) {
      if (required.includes(name)) continue;
      if (typeof prop?.type === 'string') {
        prop.type = [prop.type, 'null'];
      }
      // An enum is validated separately from the type, so widening the type
      // alone still rejects null with "value must be one of ...". Both have to
      // allow it.
      if (Array.isArray(prop?.enum) && !prop.enum.includes(null)) {
        prop.enum = [...prop.enum, null];
      }
    }
  }
  return clone as T;
}
