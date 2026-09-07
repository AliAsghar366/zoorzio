'use client';

import { motion } from 'framer-motion';
import { Brain, Bell, ListChecks, CalendarDays, Sunrise, MessageCircle } from 'lucide-react';

const FEATURES = [
  { icon: Brain, title: 'Memories', description: 'Every note, message, and voice memo you capture, searchable forever.' },
  { icon: Bell, title: 'Reminders', description: 'One-off or recurring, delivered right back to you on time.' },
  { icon: ListChecks, title: 'Lists', description: 'Shopping, to-dos, ideas — build them and check them off anywhere.' },
  { icon: CalendarDays, title: 'Calendar', description: 'Google and Outlook events alongside everything else you track.' },
  { icon: Sunrise, title: 'Daily briefing', description: "A short morning message with what's due, overdue, and on your calendar." },
  { icon: MessageCircle, title: 'Chat with Zoorzio', description: 'Ask what you captured, and get an answer pulled from your own memory layer.', highlighted: true },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const } }),
};

export function CaptureSection() {
  return (
    <section
      id="features"
      className="relative py-14 sm:py-20 px-4 sm:px-6"
      style={{ background: 'linear-gradient(180deg, #070A18 0%, #0B0D20 100%)' }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-14 items-start">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="lg:sticky lg:top-32"
        >
          <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.14em] uppercase text-white/40 mb-4">
            → Trusted by thousands
          </motion.p>
          <motion.h2 variants={fadeUp} custom={0.05} className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
            Everything you capture,
            <br />
            in one <span className="home-gradient-text">intelligent place</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={0.1} className="text-white/55 leading-relaxed mb-6">
            Message Zoorzio the way you already message anyone else.
          </motion.p>
          <motion.a
            variants={fadeUp}
            custom={0.15}
            href="#features"
            className="inline-flex items-center gap-1.5 text-sm font-semibold home-gradient-text hover:opacity-80 transition-opacity"
          >
            See how it works →
          </motion.a>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
              className="home-glass rounded-2xl p-5 transition-colors hover:bg-white/[0.06]"
            >
              <div
                className="w-9 h-9 rounded-lg border flex items-center justify-center mb-4"
                style={
                  feature.highlighted
                    ? { background: 'rgba(192, 132, 252, 0.16)', borderColor: 'rgba(192, 132, 252, 0.3)' }
                    : { background: 'rgba(168, 85, 247, 0.14)', borderColor: 'rgba(168, 85, 247, 0.22)' }
                }
              >
                <feature.icon size={16} style={{ color: feature.highlighted ? '#C084FC' : '#A855F7' }} />
              </div>
              <h3 className="font-semibold mb-1.5 text-sm" style={{ color: '#F5F3FF' }}>{feature.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#A7A3B8' }}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
