'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  features: string[];
}

export function PricingSection({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="relative py-14 sm:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.6fr_1.4fr] gap-10 lg:gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/40 mb-4">→ Simple, honest pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Simple, paid plans</h2>
          <p className="text-white/55 leading-relaxed">No free tier gimmicks. Pick the plan that fits and cancel anytime.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
          {plans.map((plan, i) => {
            const isPro = plan.slug === 'pro';
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                className={`relative rounded-3xl p-6 border sm:${isPro ? 'scale-[1.05]' : ''}`}
                style={
                  isPro
                    ? { background: 'rgba(30, 17, 54, 0.85)', borderColor: '#A855F7', boxShadow: '0 0 50px 6px rgba(168, 85, 247, 0.28)' }
                    : { background: 'rgba(13, 14, 31, 0.82)', borderColor: 'rgba(139, 92, 246, 0.18)' }
                }
              >
                {isPro && (
                  <motion.span
                    initial={{ opacity: 0, y: -6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full home-btn-primary text-white"
                  >
                    Most popular
                  </motion.span>
                )}
                <h3 className="font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-3xl font-bold text-white mb-5">
                  ${(plan.priceCents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-white/40">/mo</span>
                </p>
                <ul className="space-y-2.5 mb-7 text-sm text-white/65">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check size={14} className="text-[#A855F7] mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login?mode=register"
                  className={`w-full text-center block rounded-full py-3 text-sm font-semibold transition-all border ${isPro ? 'text-white' : 'text-white/90 hover:bg-white/5'}`}
                  style={isPro ? { background: 'linear-gradient(135deg, #8B5CF6, #EC4899, #FB923C)', borderColor: 'transparent' } : { background: '#211642', borderColor: '#A855F7' }}
                >
                  Get started
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
