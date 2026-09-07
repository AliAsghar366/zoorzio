'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const TESTIMONIALS = [
  { quote: 'Zoorzio is like having a second brain that never sleeps.', name: 'Sara K.', role: 'Designer' },
  { quote: 'It just works. I message it and it handles the rest.', name: 'Ahmed R.', role: 'Product Manager' },
  { quote: 'Finally, a tool that understands me, not the other way around.', name: 'Priya S.', role: 'Entrepreneur' },
];

export function TestimonialsSection() {
  return (
    <section className="relative py-14 sm:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12"
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/40 mb-4">→ Loved by people</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              Loved by people who
              <br />
              don&apos;t want <span className="home-gradient-text">to forget</span>
            </h2>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="home-glass rounded-2xl p-6"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={13} className="fill-[#FBBF24] text-[#FBBF24]" />
                ))}
              </div>
              <p className="text-sm text-white/80 leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center text-[11px] font-bold text-white">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] text-white/40">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
