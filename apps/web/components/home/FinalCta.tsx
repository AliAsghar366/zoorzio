'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function FinalCta() {
  return (
    <section className="relative px-4 sm:px-6 py-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-6xl mx-auto rounded-3xl overflow-hidden px-6 sm:px-10 py-10 sm:py-12 flex flex-col sm:flex-row items-center gap-8"
        style={{ background: 'linear-gradient(120deg, #7c3aed 0%, #c026d3 40%, #ec4899 70%, #fb923c 100%)' }}
      >
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle at 15% 50%, rgba(255,255,255,0.3), transparent 55%)' }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative shrink-0"
        >
          <Image src="/zoorzio-icon.png" alt="Zoorzio" width={92} height={92} className="object-contain drop-shadow-2xl" />
        </motion.div>

        <div className="relative flex-1 text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1.5 tracking-tight">Stop trying to remember everything.</h2>
          <p className="text-white/85 text-sm sm:text-base">Zoorzio is the memory layer that actually remembers.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative shrink-0"
        >
          <Link
            href="/login?mode=register"
            className="group inline-flex items-center gap-2 rounded-full bg-white text-[#24102f] font-semibold px-7 py-3.5 text-sm hover:bg-white/90 transition-colors shadow-xl"
          >
            Get started free
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
