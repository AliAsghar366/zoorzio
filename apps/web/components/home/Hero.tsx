'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { HeroVisual } from './HeroVisual';

export function Hero() {
  return (
    <section className="relative pb-10 sm:pb-14">
      {/* Headline text is baked into the hero image below - kept here for
          screen readers and SEO without visually duplicating it. */}
      <h1 className="sr-only">
        You shouldn&#8217;t have to remember it all. Zoorzio captures what matters across your apps, understands it,
        and brings it back when you need it.
      </h1>

      <HeroVisual />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="flex flex-col items-center gap-1.5 mt-8"
      >
        <span className="text-[11px] tracking-[0.14em] uppercase text-white/35">Scroll to explore</span>
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <ChevronDown size={16} className="text-white/35" />
        </motion.div>
      </motion.div>
    </section>
  );
}
