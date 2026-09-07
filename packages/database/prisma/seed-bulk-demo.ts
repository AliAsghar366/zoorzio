// Creates 70 additional demo accounts (demo01@anchor.app .. demo70@anchor.app,
// all password Demo@1234) spread across plans/roles, for broad feature
// testing. Separate from seed.ts's 4 canonical named demo accounts
// (admin/starter/pro/ultimate@anchor.app) so re-running either script never
// touches the other's accounts. Idempotent: safe to re-run any number of
// times (upserts, resets password hash every run, wipes+recreates each
// account's demo content).
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@1234';
const CURRENT_PRIVACY_POLICY_VERSION = '1.0';
const TOTAL_ACCOUNTS = 70;

const CHANNEL_TYPES = ['WHATSAPP', 'TELEGRAM', 'EMAIL', 'SMS', 'DISCORD', 'SLACK', 'VOICE', 'WEB'] as const;
const MEMORY_TYPES = ['NOTE', 'TASK', 'REMINDER', 'EVENT', 'MESSAGE', 'VOICE_NOTE', 'EMAIL', 'LINK'] as const;
const FIRST_NAMES = [
  'Ahmed', 'Ayesha', 'Bilal', 'Sana', 'Usman', 'Hira', 'Hamza', 'Zara', 'Fahad', 'Mahnoor',
  'Omar', 'Iqra', 'Zain', 'Amna', 'Talha', 'Rabia', 'Saad', 'Noor', 'Kamran', 'Sadia',
  'Asad', 'Mehak', 'Danish', 'Laiba', 'Waqas', 'Fatima', 'Junaid', 'Anum', 'Shahzad', 'Komal',
];

function planForIndex(i: number): 'starter' | 'pro' | 'ultimate' | null {
  // Roughly: 3 admins (no plan), then cycle starter/pro/ultimate for the rest.
  if (i <= 3) return null;
  const cycle = (i - 4) % 3;
  return cycle === 0 ? 'starter' : cycle === 1 ? 'pro' : 'ultimate';
}

async function main() {
  console.log(`Seeding ${TOTAL_ACCOUNTS} bulk demo accounts...\n`);

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const plans = await prisma.plan.findMany({ where: { slug: { in: ['starter', 'pro', 'ultimate'] } } });
  const planBySlug = Object.fromEntries(plans.map((p) => [p.slug, p]));

  for (let i = 1; i <= TOTAL_ACCOUNTS; i++) {
    const email = `demo${String(i).padStart(2, '0')}@anchor.app`;
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} Demo${i}`;
    const isAdmin = i <= 3;
    const planSlug = planForIndex(i);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: isAdmin ? 'ADMIN' : 'USER',
        passwordHash,
        privacyAcceptedAt: new Date(),
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
      create: {
        email,
        passwordHash,
        name,
        role: isAdmin ? 'ADMIN' : 'USER',
        timezone: 'Asia/Karachi',
        language: 'en',
        privacyAcceptedAt: new Date(),
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
    });

    if (planSlug && planBySlug[planSlug]) {
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { planId: planBySlug[planSlug].id, status: 'ACTIVE' },
        create: { userId: user.id, planId: planBySlug[planSlug].id, status: 'ACTIVE' },
      });
    }

    // Wipe + recreate this account's demo content so reseeding never
    // duplicates (same lesson as seedRichDemoContent in seed.ts).
    await prisma.reminder.deleteMany({ where: { userId: user.id } });
    await prisma.task.deleteMany({ where: { userId: user.id } });
    await prisma.memory.deleteMany({ where: { userId: user.id } });
    await prisma.channel.deleteMany({ where: { userId: user.id } });

    const memoryType = MEMORY_TYPES[i % MEMORY_TYPES.length];
    const memory = await prisma.memory.create({
      data: {
        userId: user.id,
        content: `Demo memory #${i}: sample captured content for feature testing.`,
        summary: `Demo memory #${i}`,
        type: memoryType,
        source: 'NATIVE_APP',
        tags: ['demo', `batch-${Math.ceil(i / 10)}`],
      },
    });

    await prisma.task.create({
      data: {
        userId: user.id,
        memoryId: memory.id,
        title: `Demo task #${i}`,
        description: 'Sample task for cross-account feature testing.',
        status: i % 4 === 0 ? 'COMPLETED' : 'PENDING',
        priority: 'MEDIUM',
        dueDate: new Date(Date.now() + i * 60 * 60 * 1000),
        ...(i % 4 === 0 ? { completedAt: new Date() } : {}),
      },
    });

    const channelType = CHANNEL_TYPES[i % CHANNEL_TYPES.length];
    await prisma.channel.create({
      data: {
        userId: user.id,
        type: channelType,
        externalId: `demo-${channelType.toLowerCase()}-${i}`,
        name: `Demo ${channelType}`,
        isActive: true,
      },
    });

    if (i % 10 === 0) console.log(`  ...${i}/${TOTAL_ACCOUNTS} done`);
  }

  const total = await prisma.user.count({ where: { email: { startsWith: 'demo', endsWith: '@anchor.app' } } });
  console.log(`\nDone. ${total} bulk demo accounts exist (demo01..demo70@anchor.app, password: ${DEMO_PASSWORD}).`);
}

main()
  .catch((e) => {
    console.error('Bulk demo seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
