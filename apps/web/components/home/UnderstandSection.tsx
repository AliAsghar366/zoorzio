'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Image as ImageIcon, RefreshCw } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const } }),
};

export function UnderstandSection() {
  return (
    <section className="relative py-14 sm:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.75fr_1.25fr] gap-10 lg:gap-14 items-center">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }}>
          <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.14em] uppercase text-white/40 mb-4">
            → More than a storage
          </motion.p>
          <motion.h2 variants={fadeUp} custom={0.05} className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
            It doesn&apos;t just store.
            <br />
            It <span className="home-gradient-text">understands.</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={0.1} className="text-white/55 leading-relaxed mb-6">
            Zoorzio turns your messy inputs into organized, actionable knowledge.
          </motion.p>
          <motion.a
            variants={fadeUp}
            custom={0.15}
            href="#features"
            className="inline-flex items-center gap-1.5 text-sm font-semibold home-gradient-text hover:opacity-80 transition-opacity"
          >
            See it in action →
          </motion.a>
        </motion.div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-5 md:gap-3 items-center">
            {/* Stage 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="home-glass rounded-2xl p-5 h-full"
            >
              <p className="text-[11px] font-semibold text-white/50 mb-4">① You capture</p>
              <div className="space-y-2">
                <p className="text-xs text-white/75 bg-white/[0.04] rounded-lg px-3 py-2 leading-snug">
                  Remind me to send the proposal to Ahmed tomorrow at 10.
                </p>
                <p className="text-xs text-white/75 bg-white/[0.04] rounded-lg px-3 py-2 leading-snug">
                  Don&apos;t forget Mom&apos;s birthday next week
                </p>
                <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-2">
                  <ImageIcon size={12} className="text-white/40" />
                  <span className="text-[10px] text-white/40">photo.jpg</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex md:justify-center rotate-90 md:rotate-0"
            >
              <ArrowRight size={18} className="text-white/25" />
            </motion.div>

            {/* Stage 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="home-glass rounded-2xl p-5 h-full"
            >
              <p className="text-[11px] font-semibold text-white/50 mb-4 flex items-center gap-1.5">
                ② Zoorzio understands
              </p>
              <div className="space-y-1.5 text-xs text-white/70">
                <p className="flex items-center gap-1.5 text-white/40 text-[10px] mb-2">
                  <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '2.5s' }} /> Extracting details…
                </p>
                <p>📤 Send proposal</p>
                <p>📅 Tomorrow</p>
                <p>🕙 10:00 AM</p>
                <p>👤 To Ahmed</p>
                <div className="mt-3 bg-white/[0.06] rounded-lg px-3 py-2 text-white/80">
                  Mom&apos;s birthday → Next week
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex md:justify-center rotate-90 md:rotate-0"
            >
              <ArrowRight size={18} className="text-white/25" />
            </motion.div>

            {/* Stage 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="home-glass-strong rounded-2xl p-5 h-full"
            >
              <p className="text-[11px] font-semibold text-white/50 mb-4">③ Zoorzio acts</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs bg-white/[0.05] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span className="text-white/85">Reminder created — Tomorrow, 10:00 AM</span>
                </div>
                <div className="flex items-center gap-2 text-xs bg-white/[0.05] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                  <span className="text-white/85">Task added — Send proposal to Ahmed</span>
                </div>
                <div className="flex items-center gap-2 text-xs bg-white/[0.05] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-white/85">Calendar updated — Mom&apos;s birthday</span>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="hidden xl:block absolute -right-16 top-1/2 -translate-y-1/2"
          >
            <Image src="/zoorzio-icon.png" alt="" width={64} height={64} className="object-contain opacity-90" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
