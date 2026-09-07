'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, KeyRound, EyeOff, UserCog, Lock } from 'lucide-react';

const POINTS = [
  { icon: KeyRound, label: 'Argon2id hashing' },
  { icon: EyeOff, label: 'Private by design' },
  { icon: UserCog, label: 'You control your data' },
  { icon: Lock, label: 'Secured in transit' },
];

export function PrivacySection() {
  return (
    <section className="relative py-12 sm:py-16 px-4 sm:px-6" style={{ background: '#080B18' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto home-glass rounded-3xl px-6 sm:px-10 py-7 sm:py-8 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8"
      >
        <div className="flex items-center gap-4 shrink-0">
          <div
            className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(99,102,241,0.25))' }}
          >
            <ShieldCheck size={22} className="text-[#8B5CF6]" />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Your data is yours.</p>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Always private, always secure.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {POINTS.map((p) => (
            <div key={p.label} className="flex items-center gap-2">
              <p.icon size={15} className="shrink-0" style={{ color: '#6366F1' }} />
              <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: '#9CA3AF' }}>{p.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
