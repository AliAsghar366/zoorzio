'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Send, Mail, Mic, Globe, Hash, Slack } from 'lucide-react';

const CHANNELS = [
  { icon: MessageCircle, label: 'WhatsApp', color: '#25D366', offset: 'up' as const },
  { icon: Send, label: 'Telegram', color: '#229ED9', offset: 'down' as const },
  { icon: Hash, label: 'Discord', color: '#5865F2', offset: 'up' as const },
  { icon: Slack, label: 'Slack', color: '#E01E5A', offset: 'down' as const },
  { icon: Mail, label: 'Email', color: '#F43F5E', offset: 'up' as const },
  { icon: Mic, label: 'Voice notes', color: '#a855f7', offset: 'down' as const },
  { icon: Globe, label: 'Web app', color: '#6366f1', offset: 'up' as const },
];

export function ChannelsFlowSection() {
  return (
    <section id="channels" className="relative overflow-hidden px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            → Always with you
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Wherever you already are
          </h2>
          <p className="mx-auto max-w-xl leading-relaxed text-white/55">
            Text it, say it, or type it — Zoorzio listens on the channels you already use every day.
          </p>
        </motion.div>

        {/* Wraps on small screens - seven channels can't sit on one row at phone widths. */}
        <div className="relative mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-8 px-2 sm:gap-x-8 lg:flex-nowrap lg:justify-between">
          {/* The dashed thread assumes an evenly spaced single row, so it only shows once the row stops wrapping. */}
          <svg
            className="absolute inset-x-0 top-1/2 -z-10 hidden h-24 w-full -translate-y-1/2 lg:block"
            viewBox="0 0 500 100"
            preserveAspectRatio="none"
          >
            <path
              d="M 20 30 Q 85 -10, 145 30 T 270 30 T 395 30 T 480 30"
              fill="none"
              stroke="rgba(200,160,220,0.35)"
              strokeWidth="2"
              strokeDasharray="1 9"
              strokeLinecap="round"
            />
          </svg>

          {CHANNELS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: c.offset === 'up' ? 16 : -16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`flex flex-col items-center gap-2.5 ${c.offset === 'up' ? 'lg:-translate-y-4' : 'lg:translate-y-4'}`}
            >
              <motion.div
                whileHover={{ scale: 1.08 }}
                className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg sm:h-14 sm:w-14"
                style={{ backgroundColor: c.color }}
              >
                <c.icon size={20} className="text-white" />
              </motion.div>
              <span className="whitespace-nowrap text-xs text-white/60">{c.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
