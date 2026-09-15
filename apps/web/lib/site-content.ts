// Copy for the public marketing site. Every capability listed here maps to
// something the API actually does today - keep it that way when editing.

export interface SiteFeature {
  slug: string;
  title: string;
  short: string;
  image: string;
  lead: string;
  body: string;
  pains: { tag: string; text: string }[];
  example: { user: string; bot: string };
  points: { title: string; text: string }[];
}

export const FEATURES: SiteFeature[] = [
  {
    slug: 'reminders',
    title: 'Reminders that ring',
    short: 'One-off or repeating, set in a sentence.',
    image: '/z/feat-unlimited-reminders.webp',
    lead: "Things slip because your head is full, not because you're careless.",
    body: 'Bills, appointments and tiny errands scatter across chats, notes and notifications. Tell Zoorzio once and it nudges you at the right moment, right inside the chat you already use.',
    pains: [
      { tag: 'Mental load', text: 'You keep a running list in your head all day.' },
      { tag: 'Scattered apps', text: 'Your alarms live in three different apps.' },
      { tag: 'Forgetting', text: 'You remember the payment the day after it was due.' },
      { tag: 'Friction', text: 'Setting a reminder takes more taps than it should.' },
      { tag: 'Forgetting', text: 'The birthday comes back to you at 11pm.' },
      { tag: 'Mental load', text: "You're never sure what you promised to do this week." },
    ],
    example: {
      user: 'Remind me to call the vet about Luna every Thursday at 3pm',
      bot: 'Done ✅ Every Thursday at 3:00 PM I’ll remind you to call the vet about Luna.',
    },
    points: [
      {
        title: 'Repeating schedules',
        text: 'Daily, weekly, monthly - whatever rhythm the task needs.',
      },
      {
        title: 'Snooze from the chat',
        text: 'Tap Done, In an hour, or Don’t remind me right on the reminder.',
      },
      {
        title: 'Delivered where you are',
        text: 'Reminders arrive in WhatsApp or Telegram, not another inbox.',
      },
    ],
  },
  {
    slug: 'everywhere',
    title: 'One memory, every chat',
    short: 'WhatsApp, Telegram and the web share one brain.',
    image: '/z/feat-memory-everywhere.webp',
    lead: 'Start a thought on your phone and finish it on your laptop.',
    body: 'Link WhatsApp, Telegram and the web app to the same account. Whatever you save in one place is there in the others, so you never have to remember where you said it.',
    pains: [
      { tag: 'Scattered apps', text: 'The note is in one chat and the deadline in another.' },
      { tag: 'Friction', text: 'You forward messages to yourself just to keep them.' },
      { tag: 'Forgetting', text: 'You know you wrote it down somewhere.' },
    ],
    example: {
      user: 'What did I save about the Lisbon apartment?',
      bot: 'You saved this on Telegram last Tuesday: “Lisbon flat - 2 bed, €1,400/month, viewing code 4471.”',
    },
    points: [
      {
        title: 'Linked channels',
        text: 'Connect each messaging app to one Zoorzio account in a minute.',
      },
      {
        title: 'Search by meaning',
        text: 'Ask the way you’d ask a person - no exact keywords needed.',
      },
      {
        title: 'Same answers everywhere',
        text: 'Your reminders, lists and memories follow you between channels.',
      },
    ],
  },
  {
    slug: 'calendar',
    title: 'Your calendar, by text',
    short: 'Create, move and check Google Calendar events.',
    image: '/z/feat-multi-calendar-integration.webp',
    lead: 'Stop opening your calendar to find out what today looks like.',
    body: 'Connect Google Calendar once. Then ask what’s coming up, book a slot, or cancel a meeting in plain words. Zoorzio only confirms once Google has actually saved the change.',
    pains: [
      { tag: 'Friction', text: 'Booking one meeting takes five taps and two screens.' },
      { tag: 'Mental load', text: 'You check your calendar again and again, just in case.' },
      { tag: 'Forgetting', text: 'The event is booked but you never set an alert.' },
    ],
    example: {
      user: 'Put lunch with Sam on Friday at 1pm',
      bot: 'Booked ✅ “Lunch with Sam” - Friday, 1:00-2:00 PM, on your Google Calendar.',
    },
    points: [
      {
        title: 'Create and cancel',
        text: 'Add, search and delete events without leaving the chat.',
      },
      {
        title: 'Asks first',
        text: 'Changes to your calendar can require a yes before they happen.',
      },
      { title: 'Verified results', text: 'Success is only reported after Google confirms it.' },
    ],
  },
  {
    slug: 'lists',
    title: 'Lists you can talk to',
    short: 'Groceries, packing, watchlists - add and tick off by chat.',
    image: '/z/feat-create-and-manage-lists.webp',
    lead: 'The list is always with you, because it lives in your chats.',
    body: 'Say “add oat milk to groceries” in the supermarket queue, or “what’s left to pack?” the night before a trip. Zoorzio keeps every list tidy and in one place.',
    pains: [
      {
        tag: 'Scattered apps',
        text: 'The shopping list is on a fridge you’re not standing in front of.',
      },
      { tag: 'Friction', text: 'Opening a list app is slower than forgetting the item.' },
      { tag: 'Forgetting', text: 'You get home and remember the one thing you went out for.' },
    ],
    example: {
      user: 'Add eggs, spinach and coffee to groceries',
      bot: 'Added to Groceries 🛒 eggs, spinach, coffee. That’s 7 items on the list.',
    },
    points: [
      {
        title: 'Any kind of list',
        text: 'Groceries, gifts, films, packing - create as many as you like.',
      },
      { title: 'Tick items off', text: 'Mark things done in chat or in the web app.' },
      { title: 'Always in sync', text: 'The same list on your phone and your laptop.' },
    ],
  },
  {
    slug: 'friends',
    title: 'Remind your people',
    short: 'Send a nudge to a friend on Zoorzio.',
    image: '/z/feat-firend-to-friend-reminder.webp',
    lead: 'Stop being the only one who remembers.',
    body: 'Add friends on Zoorzio and send them a reminder straight from your chat - the rent split, the dinner booking, the forms that are due. They get it in their own channel.',
    pains: [
      { tag: 'Mental load', text: 'You remember things on behalf of the whole house.' },
      { tag: 'Friction', text: 'Chasing someone feels like nagging.' },
      { tag: 'Forgetting', text: 'Everyone assumed someone else booked the table.' },
    ],
    example: {
      user: 'Remind Alex to send the rent money on Friday',
      bot: 'Sent 👋 Alex will get a reminder about the rent money on Friday.',
    },
    points: [
      {
        title: 'Friend requests',
        text: 'Connect with people by email and accept requests in the app.',
      },
      {
        title: 'Nudges by chat',
        text: 'Ask Zoorzio to remind a friend the same way you’d remind yourself.',
      },
      {
        title: 'They stay in control',
        text: 'Only accepted friends can send each other reminders.',
      },
    ],
  },
  {
    slug: 'memory',
    title: 'Long-term memory',
    short: 'Save anything once and ask for it months later.',
    image: '/z/feat-long-term-memory.webp',
    lead: 'Door codes, sizes, serial numbers - saved once, found in seconds.',
    body: 'Tell Zoorzio the things you always have to look up. When you need one, just ask. It searches by what you meant, not only the exact words you used.',
    pains: [
      { tag: 'Forgetting', text: 'You hunt for the door code on the doorstep.' },
      { tag: 'Scattered apps', text: 'Important details hide in screenshots and old chats.' },
      {
        tag: 'Mental load',
        text: 'You have the same conversation twice because nobody wrote it down.',
      },
    ],
    example: {
      user: "What's my passport number again?",
      bot: 'Your passport ends in …4812 and expires 3 March 2029. Want a reminder six months before?',
    },
    points: [
      {
        title: 'Save in a sentence',
        text: '“Remember that the wifi password is …” is all it takes.',
      },
      { title: 'Search by meaning', text: 'Ask naturally and get the right detail back.' },
      { title: 'Private to you', text: 'Your memories are only ever read for your own account.' },
    ],
  },
  {
    slug: 'briefing',
    title: 'Morning briefing',
    short: 'Your day, delivered at 7am. Your week, on Sundays.',
    image: '/z/feat-daily-briefing.webp',
    lead: 'Start the day already knowing what’s on it.',
    body: 'Every morning Zoorzio sends a short rundown of today’s reminders, tasks and events to your chat. On Sunday you get a look at the week ahead.',
    pains: [
      { tag: 'Mental load', text: 'Monday arrives and you have no idea what’s waiting.' },
      { tag: 'Friction', text: 'You open five apps before breakfast.' },
      { tag: 'Forgetting', text: 'The 9am meeting surprises you at 9:05.' },
    ],
    example: {
      user: 'What does my day look like?',
      bot: 'Good morning ☀️ 3 reminders, 2 tasks due and a 10:30 call with Priya. Nothing overdue.',
    },
    points: [
      { title: 'Daily at 7am', text: 'A calm summary of what today needs from you.' },
      { title: 'Weekly on Sunday', text: 'See the week ahead before it starts.' },
      {
        title: 'In your channel',
        text: 'Delivered to WhatsApp or Telegram, or by email if you prefer.',
      },
    ],
  },
  {
    slug: 'tasks',
    title: 'Tasks and boards',
    short: 'Projects organised on boards you can update by chat.',
    image: '/z/feat-task-tracker.webp',
    lead: 'Keep projects moving without keeping a spreadsheet.',
    body: 'Create boards for work, home or side projects. Add tasks from a chat message, mark them done on the go, and see everything laid out in the web app.',
    pains: [
      { tag: 'Scattered apps', text: 'The project plan is buried in a group chat.' },
      { tag: 'Friction', text: 'Updating the tracker is a task in itself.' },
      { tag: 'Mental load', text: 'You’re never sure what’s actually finished.' },
    ],
    example: {
      user: 'Add “send invoice to Marta” to the Freelance board',
      bot: 'Added to Freelance ✅ “Send invoice to Marta”. 4 open tasks on that board.',
    },
    points: [
      { title: 'Boards for anything', text: 'Separate work, home and personal projects.' },
      { title: 'Update by message', text: 'Create and complete tasks from any linked chat.' },
      { title: 'Full view on the web', text: 'See every board and task in the Zoorzio workspace.' },
    ],
  },
  {
    slug: 'gmail',
    title: 'Gmail in your chat',
    short: 'Search, read and send email without opening Gmail.',
    image: '/z/feat-automatic-mail-sorting.webp',
    lead: 'Find that email without scrolling through your inbox.',
    body: 'Connect Gmail and ask for what you need: the confirmation from the airline, the last message from your landlord. Zoorzio can draft and send replies too - and asks before anything goes out.',
    pains: [
      { tag: 'Friction', text: 'Finding one email means ten minutes of searching.' },
      { tag: 'Forgetting', text: 'The reply you meant to send is still in drafts.' },
      { tag: 'Mental load', text: 'Your inbox doubles as your to-do list.' },
    ],
    example: {
      user: 'Find the booking confirmation from the hotel in Porto',
      bot: 'Found it 📧 “Your stay at Casa Azul” - 12-15 Oct, confirmation #PX2291. Want me to add it to your calendar?',
    },
    points: [
      { title: 'Search and read', text: 'Pull up any email by asking for it.' },
      { title: 'Send with a yes', text: 'Outgoing email needs your confirmation first.' },
      {
        title: 'Revoke any time',
        text: 'Disconnect Gmail from your integrations page whenever you like.',
      },
    ],
  },
  {
    slug: 'integrations',
    title: 'Google, GitHub and Notion',
    short: 'Ask about your files, issues and pages.',
    image: '/z/feat-multi-calendar-integrations.webp',
    lead: 'Your tools answer in the same chat as everything else.',
    body: 'Connect Google Drive, GitHub, Notion and Slack. Ask for your open issues, a Notion page or a recent file, and get it back in a message.',
    pains: [
      { tag: 'Scattered apps', text: 'Every tool has its own tab, login and search bar.' },
      { tag: 'Friction', text: 'Checking one issue means opening a laptop.' },
      { tag: 'Mental load', text: 'You forget which app a document lives in.' },
    ],
    example: {
      user: 'What GitHub issues are open on the website repo?',
      bot: 'There are 3 open issues on website: #41 “Fix mobile nav”, #38 “Add pricing FAQ”, #35 “Image sizes”.',
    },
    points: [
      { title: 'Official connections', text: 'Each integration uses the provider’s own sign-in.' },
      { title: 'Read what you need', text: 'Files, issues, pages and channels on request.' },
      {
        title: 'Disconnect in one tap',
        text: 'Remove any integration from your account at any time.',
      },
    ],
  },
  {
    slug: 'control',
    title: 'You stay in control',
    short: 'Choose which actions need your yes first.',
    image: '/z/feat-full-control-dashboard.webp',
    lead: 'An assistant that asks before it acts.',
    body: 'For every kind of action - sending an email, deleting an event, messaging a friend - you decide whether Zoorzio just does it or asks you first with a Yes / No button.',
    pains: [
      { tag: 'Friction', text: 'Other assistants either do nothing or do too much.' },
      { tag: 'Mental load', text: 'You worry about what an AI might send on your behalf.' },
      { tag: 'Forgetting', text: 'You can’t tell afterwards what was actually done.' },
    ],
    example: {
      user: 'Delete the dentist appointment on Monday',
      bot: 'Delete “Dentist” on Monday at 9:00 AM? [Yes] [No]',
    },
    points: [
      { title: 'Per-action settings', text: 'Set each action to automatic or confirm-first.' },
      { title: 'One-tap confirmations', text: 'Approve or cancel straight from the chat.' },
      {
        title: 'Honest results',
        text: 'Zoorzio only says “done” after the change really happened.',
      },
    ],
  },
  {
    slug: 'sharing',
    title: 'Shared memory',
    short: 'Share lists and reminders with the people you plan with.',
    image: '/z/feat-shared-memory.webp',
    lead: 'Plan together without a group chat full of lost messages.',
    body: 'Share a list or a reminder with a partner, flatmate or colleague. Everyone sees the same up-to-date version, so nobody has to ask “did you get the milk?”.',
    pains: [
      { tag: 'Scattered apps', text: 'The household plan lives in five different chats.' },
      { tag: 'Mental load', text: 'You end up as the memory for everyone.' },
      { tag: 'Friction', text: 'Keeping a shared list up to date is a chore.' },
    ],
    example: {
      user: 'Share the Holiday packing list with Jordan',
      bot: 'Shared 🤝 Jordan can now see “Holiday packing”.',
    },
    points: [
      {
        title: 'Share lists and reminders',
        text: 'Give access to exactly what you want to share.',
      },
      { title: 'One version', text: 'Everyone sees the same items, always current.' },
      { title: 'See what’s shared', text: 'Find everything shared with you in one place.' },
    ],
  },
];

export interface SiteChannel {
  slug: 'whatsapp' | 'telegram' | 'web';
  name: string;
  icon: string;
  cat: string;
  phone?: string;
  intro: string;
  steps: { title: string; text: string }[];
}

export const CHANNELS: SiteChannel[] = [
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    icon: '/z/icon-whatsapp.webp',
    cat: '/z/cap-whatsapp.webp',
    phone: '/z/phone-whatsapp.webp',
    intro:
      'Already on WhatsApp all day? Then Zoorzio is one more contact. Text it, send a voice note, and get reminders back in the same thread.',
    steps: [
      {
        title: 'Link your number',
        text: 'Create an account, tap Link WhatsApp and send the code we give you.',
      },
      {
        title: 'Talk like you normally do',
        text: 'Reminders, lists, calendar, email - just ask in a message or a voice note.',
      },
      {
        title: 'Get it back on time',
        text: 'Reminders and your morning briefing arrive right in the chat.',
      },
    ],
  },
  {
    slug: 'telegram',
    name: 'Telegram',
    icon: '/z/icon-telegram.webp',
    cat: '/z/cap-telegram.webp',
    phone: '/z/phone-telegram.webp',
    intro:
      'Live in Telegram? Zoorzio runs there as a bot with the full assistant: messages, voice notes, Yes / No confirmations and reminder buttons.',
    steps: [
      {
        title: 'Open the bot',
        text: 'Create an account and tap Link Telegram - it opens Zoorzio already linked to you.',
      },
      { title: 'Say what you need', text: 'Type or record it. Zoorzio works out the rest.' },
      {
        title: 'Tap to finish',
        text: 'Confirm actions and snooze reminders with buttons, right in the chat.',
      },
    ],
  },
  {
    slug: 'web',
    name: 'Web app',
    icon: '/z/channel-app.webp',
    cat: '/z/cap-app.webp',
    intro:
      'Prefer a big screen? The Zoorzio web app shows every reminder, list, board and memory, with the same assistant ready to chat.',
    steps: [
      { title: 'Sign in', text: 'Create a free account and open your Zoorzio portal.' },
      {
        title: 'See everything',
        text: 'Boards, lists, reminders, calendar and friends laid out in one place.',
      },
      {
        title: 'Chat on any device',
        text: 'Use the web chat, then carry on in WhatsApp or Telegram.',
      },
    ],
  },
];

export const PERSONAS: { label: string; user: string; bot: string }[] = [
  {
    label: 'Founder',
    user: 'Remind me to follow up with the investor from Tuesday’s call tomorrow at 9',
    bot: 'Done ✅\nFollow up: investor from Tuesday\nTomorrow, 9:00 AM',
  },
  {
    label: 'Parent',
    user: 'School trip form is due Thursday - remind me Wednesday night',
    bot: 'Got it ✅\nSign the school trip form\nWednesday, 8:00 PM',
  },
  {
    label: 'Student',
    user: 'Add “finish chapter 4 notes” to my Exams board',
    bot: 'Added ✅\nExams board · “Finish chapter 4 notes”\n3 open tasks',
  },
  {
    label: 'Freelancer',
    user: 'Remind me to invoice Studio North on the 1st of every month',
    bot: 'Set ✅\nInvoice Studio North\n1st of every month, 9:00 AM',
  },
  {
    label: 'ADHD',
    user: 'I keep forgetting my meds. Nudge me every day at 8am',
    bot: 'On it ✅\nTake your meds\nEvery day, 8:00 AM - tap Done when you have',
  },
  {
    label: 'Remote worker',
    user: 'What’s on my calendar this afternoon?',
    bot: 'This afternoon 📅\n2:00 PM Design review\n4:30 PM 1:1 with Priya',
  },
  {
    label: 'Caregiver',
    user: 'Remember: Mum’s GP is Dr Osei, surgery number 020 7946 0321',
    bot: 'Saved 🧠\nMum’s GP - Dr Osei\n020 7946 0321',
  },
  {
    label: 'Traveller',
    user: 'Add passport, adapter and chargers to my packing list',
    bot: 'Added 🧳\nPacking: passport, adapter, chargers\n9 items on the list',
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is Zoorzio?',
    a: 'Zoorzio is an assistant that lives in the chat apps you already use. Tell it what to remember - reminders, lists, tasks, details - and it keeps track and hands things back when you need them.',
  },
  {
    q: 'Which apps does it work in?',
    a: 'WhatsApp, Telegram and the Zoorzio web app. Link as many as you like to one account and they all share the same memory.',
  },
  {
    q: 'Can reminders repeat?',
    a: 'Yes. Set one-off reminders or repeating ones - daily, weekly or monthly. When a reminder arrives you can mark it done or snooze it.',
  },
  {
    q: 'Does it work with Google Calendar and Gmail?',
    a: 'Yes. Connect your Google account once and you can create, find and cancel events, and search, read and send email - all from a chat.',
  },
  {
    q: 'Will it do things without asking me?',
    a: 'Only if you let it. You choose, per action, whether Zoorzio acts automatically or asks you first with a Yes / No button.',
  },
  {
    q: 'How is my data kept private?',
    a: 'Your data is only used to run your own account. Connected-account tokens are encrypted with AES-256-GCM, passwords are hashed with Argon2, and we do not sell your personal data.',
  },
  {
    q: 'What does it cost?',
    a: 'You can start free - a free account holds up to 5 active reminders, 3 lists, 10 memories and 10 tasks. Paid plans remove those limits and add features like briefings; see the pricing page for details.',
  },
];
