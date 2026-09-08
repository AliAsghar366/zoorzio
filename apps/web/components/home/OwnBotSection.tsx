'use client';

import { motion } from 'framer-motion';
import { Send, Hash, Slack, Mail, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const PLATFORMS = [
  { icon: Send, label: 'Telegram', hint: 'via @BotFather', color: '#229ED9' },
  { icon: Hash, label: 'Discord', hint: 'via Developer Portal', color: '#5865F2' },
  { icon: Slack, label: 'Slack', hint: 'in your workspace', color: '#E01E5A' },
  { icon: Mail, label: 'SendGrid', hint: 'your own API key', color: '#F43F5E' },
];

const STEPS = [
  {
    n: '01',
    title: 'Make your bot',
    body: 'Two minutes on Telegram, Discord, or Slack. No approval process, no waiting.',
  },
  {
    n: '02',
    title: 'Paste the token',
    body: 'Drop it into your Zoorzio settings. We encrypt it and wire up the connection for you.',
  },
  {
    n: '03',
    title: 'It answers only to you',
    body: 'Your bot serves your account and nobody else. Remove it any time and it goes quiet instantly.',
  },
];

const ASSURANCES = [
  { icon: KeyRound, label: 'Tokens encrypted at rest' },
  { icon: UserCheck, label: 'Scoped to your account alone' },
  { icon: ShieldCheck, label: 'Revoke in one click' },
];

export function OwnBotSection() {
  return (
    <section id="your-bots" className="relative px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="mb-12 text-center sm:mb-14"
        >
          <motion.p
            variants={fadeUp}
            custom={0}
            className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/40"
          >
            → Your keys, your bot
          </motion.p>
          <motion.h2
            variants={fadeUp}
            custom={0.05}
            className="mb-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl"
          >
            Or bring <span className="home-gradient-text">your own.</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={0.1}
            className="mx-auto max-w-xl leading-relaxed text-white/55"
          >
            Rather not share a bot with everyone else? Connect your own instead — under your name,
            on your infrastructure, handling nothing but your messages.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-10 grid grid-cols-2 gap-3 sm:mb-12 sm:gap-4 lg:grid-cols-4"
        >
          {PLATFORMS.map((p, i) => (
            <motion.div
              key={p.label}
              variants={fadeUp}
              custom={i * 0.06}
              className="home-glass flex flex-col items-center gap-2.5 rounded-2xl px-4 py-5 text-center"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-lg"
                style={{ backgroundColor: p.color }}
              >
                <p.icon size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{p.label}</p>
                <p className="mt-0.5 text-[11px] text-white/45">{p.hint}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3"
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              variants={fadeUp}
              custom={i * 0.08}
              className="home-glass rounded-2xl px-5 py-6 text-left"
            >
              <span className="home-gradient-text text-xs font-bold tracking-[0.14em]">{s.n}</span>
              <h3 className="mb-1.5 mt-2.5 text-base font-semibold text-white">{s.title}</h3>
              <p className="text-sm leading-relaxed text-white/55">{s.body}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
        >
          {ASSURANCES.map((a) => (
            <div key={a.label} className="flex items-center gap-2">
              <a.icon size={15} className="shrink-0" style={{ color: '#6366F1' }} />
              <span className="whitespace-nowrap text-xs text-white/50 sm:text-sm">{a.label}</span>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 text-center text-xs text-white/35"
        >
          Entirely optional — Zoorzio&apos;s shared bots work out of the box if you&apos;d rather
          skip the setup.
        </motion.p>
      </div>
    </section>
  );
}
