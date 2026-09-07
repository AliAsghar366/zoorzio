'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Send, Mail, Mic, Globe } from 'lucide-react';

const CHANNELS = [
  { icon: MessageCircle, label: 'WhatsApp', color: '#25D366', offset: 'up' as const },
  { icon: Send, label: 'Telegram', color: '#229ED9', offset: 'down' as const },
  { icon: Mail, label: 'Email', color: '#F43F5E', offset: 'up' as const },
  { icon: Mic, label: 'Voice notes', color: '#a855f7', offset: 'down' as const },
  { icon: Globe, label: 'Web app', color: '#6366f1', offset: 'up' as const },
];

export function ChannelsFlowSection() {
  return (
    <section id="channels" className="relative py-14 sm:py-20 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/40 mb-4">→ Always with you</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Wherever you already are</h2>
          <p className="text-white/55 max-w-xl mx-auto leading-relaxed">
            Text it, say it, or type it — Zoorzio listens on the channels you already use every day.
          </p>
        </motion.div>

        <div className="relative flex items-center justify-between max-w-3xl mx-auto px-2">
          <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-24 -z-10" viewBox="0 0 500 100" preserveAspectRatio="none">
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
              className={`flex flex-col items-center gap-2.5 ${c.offset === 'up' ? '-translate-y-4' : 'translate-y-4'}`}
            >
              <motion.div
                whileHover={{ scale: 1.08 }}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: c.color }}
              >
                <c.icon size={20} className="text-white" />
              </motion.div>
              <span className="text-xs text-white/60 whitespace-nowrap">{c.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
