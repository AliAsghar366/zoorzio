import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Reveal } from '@/components/site/Reveal';
import { StartLink } from '@/components/site/StartLink';

export const metadata: Metadata = {
  title: 'Security | Zoorzio',
  description: 'How Zoorzio protects your reminders, calendar, email and messages.',
};

// Only list things the code actually does. See apps/api/src/security and apps/api/src/channels.
const BADGES = [
  { label: 'AES-256-GCM encryption', color: '#4f7de0', bg: '#e3ecfb' },
  { label: 'Argon2 passwords', color: '#2f9a63', bg: '#e1f4e8' },
  { label: 'Signed webhooks', color: '#b0569d', bg: '#f8e3f1' },
  { label: 'Confirm before acting', color: '#d67a2c', bg: '#fcecdc' },
];

const LAYERS = [
  {
    icon: <Lock size={20} />,
    tint: '#e6ecfb',
    color: '#5c7be0',
    title: 'Encryption',
    text: 'The secrets that connect your accounts are encrypted before they reach the database.',
    items: [
      'AES-256-GCM for Google, GitHub, Notion and channel tokens',
      'HTTPS for connections to the app and API',
      'Passwords hashed with Argon2',
      'Encryption keys checked when the server starts',
    ],
  },
  {
    icon: <UserCheck size={20} />,
    tint: '#fbe3f1',
    color: '#d0529e',
    title: 'Account isolation',
    text: 'Every request is tied to one signed-in account, and only reaches that account’s data.',
    items: [
      'Reminders, lists and memories scoped to your account',
      'Short-lived access tokens with refresh',
      'Shared items only visible to people you choose',
      'Audit log for administrator actions',
    ],
  },
  {
    icon: <ShieldCheck size={20} />,
    tint: '#e0f3f7',
    color: '#2a9bb8',
    title: 'Verified channels',
    text: 'Messages from WhatsApp and Telegram are checked before the assistant sees them.',
    items: [
      'WhatsApp request signatures verified',
      'Telegram webhook secret required',
      'Constant-time comparison of secrets',
      'Only linked accounts can use the assistant',
    ],
  },
];

const STEPS = [
  {
    title: 'Verified delivery',
    text: 'A message from WhatsApp or Telegram must carry a valid signature or secret.',
  },
  {
    title: 'Linked account lookup',
    text: 'The sender must be linked to a Zoorzio account, or nothing runs.',
  },
  {
    title: 'Your data only',
    text: 'The assistant works with that account’s reminders, lists and connections - no one else’s.',
  },
  {
    title: 'Confirmed results',
    text: 'Risky actions can ask for a Yes first, and success is only reported once the service confirms it.',
  },
];

const NEVER = [
  'Sell your personal data',
  'Use advertising or tracking cookies',
  'Tell you something is done before it actually is',
];

export default function SecurityPage() {
  return (
    <div className="zs-light">
      <section
        className="relative overflow-hidden pb-40 pt-[150px] text-white"
        style={{
          background: 'radial-gradient(ellipse at 70% 40%, #6b5236 0%, #2d2319 45%, #0f0b08 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,220,170,0.08) 0 2px, transparent 2px 90px), repeating-linear-gradient(180deg, rgba(255,220,170,0.08) 0 2px, transparent 2px 56px)',
          }}
        />
        <div className="zs-container relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
          <Reveal>
            <span className="zs-tag zs-tag--pink !bg-[#4a2340] !text-[#f59ad6]">
              Trust &amp; security
            </span>
            <h1 className="mt-5 text-[clamp(38px,4.6vw,64px)] font-semibold leading-[1.08]">
              We look after your data, so you don&apos;t have to
            </h1>
            <p className="mt-6 max-w-[620px] text-lg leading-relaxed text-white/90">
              From how your reminders are stored to how your calendar is changed, Zoorzio is built
              to keep your information yours. Here&apos;s what that looks like in practice.
            </p>
            <Link href="/privacy" className="zs-btn zs-btn--grad mt-8">
              Read our privacy policy <ArrowRight size={18} />
            </Link>
          </Reveal>
          <Image
            src="/z/cat-security.webp"
            alt="Zoorzio the cat wearing a guard’s cap"
            width={884}
            height={900}
            className="zs-float mx-auto w-[min(380px,80%)]"
            priority
          />
        </div>
      </section>

      <div className="zs-container relative -mt-24">
        <div className="zs-card-white flex flex-wrap justify-center gap-4">
          {BADGES.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-bold uppercase tracking-wide"
              style={{ color: badge.color, background: badge.bg }}
            >
              <CheckCircle2 size={18} /> {badge.label}
            </span>
          ))}
        </div>
      </div>

      <section className="zs-container py-28">
        <Reveal>
          <span className="zs-tag zs-tag--pink">Infrastructure</span>
          <h2 className="mt-5 text-[clamp(32px,3.6vw,52px)] font-semibold leading-tight">
            Security at every layer
          </h2>
          <p className="mt-4 max-w-[680px] text-lg text-[#444]">
            From the moment a message arrives to the moment a change is saved, each step has its own
            safeguards.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {LAYERS.map((layer, i) => (
            <Reveal key={layer.title} delay={i * 100}>
              <div className="zs-card-white h-full">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: layer.tint, color: layer.color }}
                >
                  {layer.icon}
                </span>
                <h3 className="mt-6 text-xl font-semibold">{layer.title}</h3>
                <p className="mt-3 text-[#444]">{layer.text}</p>
                <ul className="mt-6 space-y-3 text-[15px]">
                  {layer.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#5c7be0]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="zs-container grid gap-12 pb-28 md:grid-cols-2">
        <Reveal>
          <h2 className="text-[clamp(32px,3.6vw,52px)] font-semibold leading-tight">
            Checked at <span className="zs-grad-text">every step</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-[#444]">
            Nothing is trusted just because it arrived. Every message has to prove where it came
            from and who it belongs to before Zoorzio acts on it.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-[#444]">
            You also decide how much Zoorzio can do on its own. Each kind of action - sending an
            email, deleting an event, messaging a friend - can run automatically or wait for your
            Yes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {['Signature checks', 'Linked accounts', 'Per-user data', 'Confirm-first actions'].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#cfcfd6] px-4 py-2 text-[#555]"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="grid gap-4 rounded-[28px] bg-[#dfe9e8] p-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-5 rounded-2xl bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e6ecfb] text-lg font-semibold text-[#5c7be0]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[#444]">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="zs-container pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[40px] bg-[#2b1c52] px-8 py-14 text-center text-white shadow-[0_20px_60px_rgba(90,110,230,0.35)]">
            <Image
              src="/z/cat-security-2.webp"
              alt=""
              width={120}
              height={122}
              className="zs-float mx-auto w-[100px]"
            />
            <h2 className="mt-4 text-[clamp(30px,3.4vw,48px)] font-semibold">
              What we <span className="zs-grad-text">never</span> do
            </h2>
            <div className="mx-auto mt-10 grid max-w-[900px] gap-4 md:grid-cols-3">
              {NEVER.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 p-5 text-left"
                >
                  <XCircle size={24} className="shrink-0 text-[#f59ad6]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="zs-container pb-32">
        <Reveal>
          <span className="zs-tag zs-tag--pink">Your controls</span>
          <h2 className="mt-5 text-[clamp(32px,3.6vw,52px)] font-semibold leading-tight">
            You stay in charge of your data
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <UserCheck size={22} />,
              title: 'Action permissions',
              text: 'Choose which actions need your confirmation.',
            },
            {
              icon: <KeyRound size={22} />,
              title: 'Disconnect integrations',
              text: 'Remove Google, GitHub, Notion or Slack whenever you like.',
            },
            {
              icon: <ShieldCheck size={22} />,
              title: 'Unlink channels',
              text: 'Stop a WhatsApp or Telegram account from reaching Zoorzio.',
            },
            {
              icon: <Lock size={22} />,
              title: 'Your rights',
              text: 'See the privacy policy for access, export and deletion requests.',
            },
          ].map((control) => (
            <div key={control.title} className="zs-card-white">
              <span className="text-[#7d73d8]">{control.icon}</span>
              <h3 className="mt-4 text-lg font-semibold">{control.title}</h3>
              <p className="mt-2 text-[#444]">{control.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <StartLink className="zs-btn zs-btn--grad">
            Get started with Zoorzio <ArrowRight size={18} />
          </StartLink>
        </div>
      </section>
    </div>
  );
}
