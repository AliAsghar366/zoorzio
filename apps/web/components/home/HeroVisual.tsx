'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Play } from 'lucide-react';

export function HeroVisual() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full aspect-[3/2] overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        animate={reduceMotion ? undefined : { scale: [1, 1.035, 1], y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src="/hero-full.png"
          alt="Zoorzio: you shouldn't have to remember it all. Zoorzio captures what matters across WhatsApp, Telegram, Email, Voice notes and the Web, understands it, and brings it back when you need it."
          fill
          priority
          className="object-contain"
        />
      </motion.div>

      {/* Scrim behind the overlaid buttons, for legibility against the image. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Link
          href="/login?mode=register"
          className="inline-flex items-center gap-2 rounded-full home-btn-primary text-white font-semibold px-7 py-3.5 text-sm sm:text-[15px]"
        >
          Get started free
        </Link>
        <a
          href="#features"
          className="inline-flex items-center gap-2 rounded-full home-btn-secondary text-white/90 font-medium px-6 py-3.5 text-sm sm:text-[15px]"
        >
          <Play size={14} className="fill-white" />
          Meet Zoorzio
        </a>
      </div>
    </motion.div>
  );
}
