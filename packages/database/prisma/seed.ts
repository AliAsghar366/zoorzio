import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@1234';

// Keep in sync with CURRENT_PRIVACY_POLICY_VERSION in apps/api/src/auth/auth.service.ts.
const CURRENT_PRIVACY_POLICY_VERSION = '1.0';

async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function seedPlans() {
  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      priceCents: 600,
      features: [
        'Unlimited memories, tasks & lists',
        'One-off & recurring reminders',
        'WhatsApp + Telegram capture',
      ],
    },
    {
      slug: 'pro',
      name: 'Pro',
      priceCents: 1500,
      features: [
        'Everything in Starter',
        'Daily + weekly briefings',
        'Chat with Zoörzio (AI assistant)',
        'Google & Outlook calendar sync',
      ],
    },
    {
      slug: 'ultimate',
      name: 'Ultimate',
      priceCents: 2900,
      features: [
        'Everything in Pro',
        'Email capture channel',
        'Priority support',
        'Early access to new features',
      ],
    },
  ];

  const created: Record<string, { id: string }> = {};
  for (const plan of plans) {
    const record = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { name: plan.name, priceCents: plan.priceCents, features: plan.features },
      create: plan,
    });
    created[plan.slug] = record;
    console.log(`✅ Upserted plan: ${plan.name} ($${(plan.priceCents / 100).toFixed(2)}/mo)`);
  }
  return created;
}

async function seedDemoUser(options: {
  email: string;
  name: string;
  role?: 'USER' | 'ADMIN';
  planId?: string;
}) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: options.email },
    // Also reset passwordHash on every reseed - these are demo accounts with
    // a publicly documented password, so if anyone ever changes one (e.g.
    // testing the change-password flow) or a hash gets corrupted, running
    // the seed again is guaranteed to restore working login rather than
    // silently leaving the account broken.
    update: {
      role: options.role || 'USER',
      passwordHash,
      privacyAcceptedAt: new Date(),
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    },
    create: {
      email: options.email,
      passwordHash,
      name: options.name,
      role: options.role || 'USER',
      timezone: 'Asia/Karachi',
      language: 'en',
      privacyAcceptedAt: new Date(),
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    },
  });

  if (options.planId) {
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: { planId: options.planId, status: 'ACTIVE' },
      create: { userId: user.id, planId: options.planId, status: 'ACTIVE' },
    });
  }

  console.log(`✅ Created demo user: ${user.email} (${options.role || 'USER'})`);
  return user;
}

async function seedRichDemoContent(userId: string) {
  // This function used to create memories/tasks/lists/etc. with plain
  // .create() calls, which duplicated all of this demo content every single
  // time the seed script ran a second time (no natural unique key to upsert
  // against). Wiping this user's demo content first makes the whole function
  // safe to re-run any number of times - required for "reseed to fix a
  // broken demo account" to actually work instead of piling up duplicates.
  await prisma.reminder.deleteMany({ where: { userId } });
  await prisma.listItem.deleteMany({ where: { list: { userId } } });
  await prisma.list.deleteMany({ where: { userId } });
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.memory.deleteMany({ where: { userId } });
  await prisma.channel.deleteMany({ where: { userId } });
  await prisma.apiKey.deleteMany({ where: { userId } });

  await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      aiTone: 'professional',
      notifications: { email: true, push: true, sms: false },
      privacy: { profileVisibility: 'private', dataSharing: false },
    },
  });

  const memories = [
    {
      userId,
      content: 'Meeting with John at 3pm tomorrow about the new project roadmap',
      summary: 'Meeting with John about project roadmap',
      type: 'MESSAGE' as const,
      source: 'WHATSAPP' as const,
      tags: ['meeting', 'work', 'project'],
      metadata: { sender: 'John Doe', phone: '+923007654321' },
    },
    {
      userId,
      content: 'Buy groceries: milk, eggs, bread, butter, tomatoes, onions',
      summary: 'Grocery shopping list',
      type: 'NOTE' as const,
      source: 'NATIVE_APP' as const,
      tags: ['shopping', 'personal', 'groceries'],
      metadata: {},
    },
    {
      userId,
      content: 'Call dentist to schedule appointment for next week. Remember to ask about the sensitivity issue.',
      summary: 'Schedule dentist appointment',
      type: 'TASK' as const,
      source: 'VOICE' as const,
      tags: ['health', 'appointment', 'dentist'],
      metadata: { isVoiceNote: true },
    },
    {
      userId,
      content: 'Project deadline is Friday. Need to complete the API integration and write tests.',
      summary: 'Project deadline reminder',
      type: 'EMAIL' as const,
      source: 'EMAIL' as const,
      tags: ['work', 'deadline', 'project'],
      metadata: { from: 'manager@company.com', subject: 'Project Deadline' },
    },
    {
      userId,
      content: 'Recipe for chicken curry: 1kg chicken, 2 onions, 3 tomatoes, ginger garlic paste, turmeric, red chili powder, garam masala, salt to taste.',
      summary: 'Chicken curry recipe',
      type: 'NOTE' as const,
      source: 'WHATSAPP' as const,
      tags: ['recipe', 'food', 'cooking'],
      metadata: { sender: 'Mom' },
    },
  ];

  for (const memory of memories) {
    const created = await prisma.memory.create({ data: memory });
    console.log(`   ✅ Memory: ${created.content.substring(0, 50)}...`);
  }

  const tasks = [
    {
      userId,
      title: 'Buy groceries',
      description: 'Milk, eggs, bread, butter, tomatoes, onions',
      status: 'PENDING' as const,
      priority: 'MEDIUM' as const,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      userId,
      title: 'Call dentist',
      description: 'Schedule appointment for next week',
      status: 'PENDING' as const,
      priority: 'HIGH' as const,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      userId,
      title: 'Complete API integration',
      description: 'Finish WhatsApp and Telegram bot integration',
      status: 'IN_PROGRESS' as const,
      priority: 'URGENT' as const,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      userId,
      title: 'Write unit tests',
      description: 'Write tests for memory and task services',
      status: 'PENDING' as const,
      priority: 'HIGH' as const,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      userId,
      title: 'Review PR #42',
      description: 'Review pull request for calendar sync feature',
      status: 'COMPLETED' as const,
      priority: 'MEDIUM' as const,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const task of tasks) {
    const created = await prisma.task.create({ data: task });
    console.log(`   ✅ Task: ${created.title}`);
  }

  const reminderTasks = await prisma.task.findMany({
    where: { userId, status: { not: 'COMPLETED' }, dueDate: { not: null } },
  });

  for (const task of reminderTasks) {
    if (task.dueDate) {
      const reminderDate = new Date(task.dueDate);
      reminderDate.setHours(reminderDate.getHours() - 1);

      await prisma.reminder.create({
        data: {
          userId,
          taskId: task.id,
          title: `Reminder: ${task.title}`,
          message: `Don't forget: ${task.description || task.title}`,
          scheduledAt: reminderDate,
        },
      });
      console.log(`   ✅ Reminder for: ${task.title}`);
    }
  }

  const shoppingList = await prisma.list.create({
    data: { userId, name: 'Weekly groceries', type: 'SHOPPING' },
  });
  await prisma.listItem.createMany({
    data: [
      { listId: shoppingList.id, content: 'Milk', position: 0 },
      { listId: shoppingList.id, content: 'Eggs', position: 1 },
      { listId: shoppingList.id, content: 'Bread', position: 2, isChecked: true },
    ],
  });
  console.log('   ✅ List: Weekly groceries (3 items)');

  await prisma.channel.create({
    data: {
      userId,
      type: 'WHATSAPP',
      externalId: '+923001234567',
      name: 'Demo WhatsApp',
      isActive: true,
      metadata: { phoneNumbers: ['+923001234567'] },
    },
  });
  console.log('   ✅ Channel: Demo WhatsApp');

  await prisma.apiKey.create({
    data: {
      userId,
      name: 'Demo API Key',
      keyHash: 'demo-hash-value',
      prefix: 'ak_demo_',
      permissions: { read: true, write: true, delete: false },
      isActive: true,
    },
  });
  console.log('   ✅ API key created');
}

async function main() {
  console.log('🌱 Seeding database...\n');

  const plans = await seedPlans();

  console.log('\n👤 Creating demo accounts (all use password: ' + DEMO_PASSWORD + ')\n');

  await seedDemoUser({ email: 'admin@anchor.app', name: 'Anchor Admin', role: 'ADMIN' });
  await seedDemoUser({ email: 'starter@anchor.app', name: 'Starter Sam', planId: plans.starter.id });
  const proUser = await seedDemoUser({ email: 'pro@anchor.app', name: 'Pro Priya', planId: plans.pro.id });
  await seedDemoUser({ email: 'ultimate@anchor.app', name: 'Ultimate Uzair', planId: plans.ultimate.id });

  console.log(`\n📦 Seeding demo content for pro@anchor.app...`);
  await seedRichDemoContent(proUser.id);

  const stats = {
    users: await prisma.user.count(),
    plans: await prisma.plan.count(),
    subscriptions: await prisma.subscription.count(),
    memories: await prisma.memory.count(),
    tasks: await prisma.task.count(),
    reminders: await prisma.reminder.count(),
    lists: await prisma.list.count(),
    channels: await prisma.channel.count(),
    apiKeys: await prisma.apiKey.count(),
  };

  console.log('\n📊 Seed Summary:');
  console.log(`   Users: ${stats.users}`);
  console.log(`   Plans: ${stats.plans}`);
  console.log(`   Subscriptions: ${stats.subscriptions}`);
  console.log(`   Memories: ${stats.memories}`);
  console.log(`   Tasks: ${stats.tasks}`);
  console.log(`   Reminders: ${stats.reminders}`);
  console.log(`   Lists: ${stats.lists}`);
  console.log(`   Channels: ${stats.channels}`);
  console.log(`   API Keys: ${stats.apiKeys}`);
  console.log('\n🎉 Seeding completed! Demo logins (password: ' + DEMO_PASSWORD + '):');
  console.log('   admin@anchor.app     (admin access)');
  console.log('   starter@anchor.app   (Starter plan)');
  console.log('   pro@anchor.app       (Pro plan, full demo data)');
  console.log('   ultimate@anchor.app  (Ultimate plan)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
