'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BellRing, Sun, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Reveal } from '../Reveal';

export interface PublicPlan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  features: string[];
}

export function formatPrice(plan: PublicPlan): string {
  const amount = plan.priceCents / 100;
  const symbol =
    plan.currency?.toLowerCase() === 'usd' || !plan.currency
      ? '$'
      : `${plan.currency.toUpperCase()} `;
  return `${symbol}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

const GOALS = [
  {
    icon: <BellRing size={20} />,
    color: '#e07ab8',
    label: 'Stop things slipping through the cracks',
  },
  { icon: <Sun size={20} />, color: '#8f7fe6', label: 'Start every day already ahead' },
  { icon: <Zap size={20} />, color: '#f29b73', label: 'Get everything, with priority support' },
];

export function PlanFinder() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [goal, setGoal] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<PublicPlan[]>('/plans')
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  // Plans come back cheapest first, so each goal maps onto the matching tier.
  const suggestion =
    goal !== null && plans && plans.length > 0 ? plans[Math.min(goal, plans.length - 1)] : null;

  return (
    <section id="plans" className="zs-plans">
      <div
        className="zs-cloud"
        style={{ '--w': '360px', left: '-100px', top: '10%', '--o': 0.6 } as React.CSSProperties}
      />

      <div className="zs-container">
        <Reveal className="text-center">
          <h2 className="zs-h2">Pick the plan that fits you</h2>
        </Reveal>

        {plans && plans.length > 0 && (
          <Reveal className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/pricing#${plan.slug}`}
                className="rounded-2xl border border-white/50 bg-white/15 px-6 py-5 transition-transform hover:-translate-y-1"
              >
                <p className="text-sm font-bold uppercase tracking-wider text-white/80">
                  {plan.name}
                </p>
                <p className="mt-1 text-4xl font-semibold">
                  {formatPrice(plan)}
                  <span className="text-base font-normal text-white/80">/mo</span>
                </p>
                {plan.features[0] && (
                  <p className="mt-2 text-sm text-white/90">{plan.features[0]}</p>
                )}
              </Link>
            ))}
          </Reveal>
        )}

        <Reveal className="mt-28 text-center">
          <h3 className="zs-h2 !text-[clamp(34px,4.6vw,68px)]">Not sure which one suits you?</h3>
        </Reveal>

        <Reveal className="mx-auto mt-10 max-w-[1000px]">
          <div className="zs-finder">
            <div className="zs-finder-lead">
              <p className="relative z-[1] max-w-[280px] text-[clamp(30px,3.4vw,46px)] font-semibold leading-tight">
                What would help you most right now?
              </p>
              <Image
                src="/z/cat-plain.webp"
                alt=""
                width={200}
                height={200}
                className="absolute -right-4 -top-4 w-[150px] opacity-95"
              />
            </div>

            <div className="flex flex-col justify-center gap-4">
              {GOALS.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  className={`zs-finder-option ${goal === i ? 'is-active' : ''}`}
                  aria-pressed={goal === i}
                  onClick={() => setGoal(i)}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: item.color }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  <i />
                </button>
              ))}

              {suggestion && (
                <div
                  className="rounded-2xl bg-white/90 p-5 text-[#1f1a33]"
                  style={{ animation: 'zs-pop 0.3s ease-out' }}
                >
                  <p className="text-sm text-[#5b5670]">We’d suggest</p>
                  <p className="text-2xl font-semibold">
                    {suggestion.name} · {formatPrice(suggestion)}/mo
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[#5b5670]">
                    {suggestion.features.map((feature) => (
                      <li key={feature}>✓ {feature}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 text-center">
          <Link href="/pricing" className="zs-btn zs-btn--soft">
            See every plan
          </Link>
        </div>
      </div>
    </section>
  );
}
