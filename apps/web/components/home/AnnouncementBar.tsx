'use client';

import { motion } from 'framer-motion';

export function AnnouncementBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-40 flex items-center justify-center gap-3 py-2.5 px-4 text-center flex-wrap"
      style={{
        background: 'linear-gradient(90deg, rgba(172,132,204,0.85), rgba(220,140,197,0.85), rgba(252,173,150,0.85))',
      }}
    >
      <span className="text-xs sm:text-[13px] font-medium text-white/95">
        ★ Introducing Zoorzio — one memory layer above every app you use
      </span>
      <a
        href="#features"
        className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/20 hover:bg-white/30 transition-colors rounded-full px-3 py-1 text-white shrink-0"
      >
        Learn more →
      </a>
    </motion.div>
  );
}
