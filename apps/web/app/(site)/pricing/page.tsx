'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { FEATURES } from '@/lib/site-content';
import { formatPrice, type PublicPlan } from '@/components/site/home/PlanFinder';
import { useAuthed } from '@/components/site/useAuthed';

interface Subscription {
  planId: string;
  status: string;
}

const TIER_STYLES = [
  {
    kicker: 'Everyday memory',
    background: 'linear-gradient(135deg, #a8792c 0%, #d8b25a 55%, #f1d99a 100%)',
  },
  {
    kicker: 'Proactive assistant',
    background: 'linear-gradient(135deg, #8a8f9e 0%, #c9cbd6 55%, #e9e7f0 100%)',
  },
  {
    kicker: 'Everything included',
    background: 'linear-gradient(135deg, #2f6fd0 0%, #5aa6ea 55%, #9fdcf6 100%)',
  },
];

export default function PricingPage() {
  const authed = useAuthed();
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PublicPlan[]>('/plans')
      .then(setPlans)
      .catch(() => {
        setPlans([]);
        setLoadFailed(true);
      });
  }, []);

  useEffect(() => {
    if (!authed) return;
    api
      .get<Subscription | null>('/billing/subscription')
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [authed]);

  const subscribe = async (planId: string) => {
    setError(null);
    setMessage(null);
    setBusyPlanId(planId);
    try {
      const result = await api.post<{ mode: 'live' | 'demo'; checkoutUrl?: string }>(
        '/billing/checkout',
        { planId },
      );
      if (result.mode === 'live' && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setMessage('Plan activated in demo mode - no payment provider is connected yet.');
      const updated = await api.get<Subscription | null>('/billing/subscription').catch(() => null);
      setSubscription(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <section
      className="relative overflow-hidden pb-32 pt-[150px]"
      style={{
        background: 'linear-gradient(180deg, #7ea9e4 0%, #9a8ade 40%, #c98bd0 75%, #db8cc4 100%)',
      }}
    >
      <div
        className="zs-cloud"
        style={{ '--w': '380px', left: '-120px', top: '16%', '--o': 0.55 } as React.CSSProperties}
      />
      <div
        className="zs-cloud"
        style={
          {
            '--w': '420px',
            right: '-140px',
            top: '48%',
            '--o': 0.5,
            '--t': '22s',
          } as React.CSSProperties
        }
      />

      <div className="zs-container relative">
        <div className="text-center">
          <h1 className="zs-h1 !text-[clamp(44px,6vw,84px)]">Start with Zoorzio today</h1>
          <p className="mx-auto mt-5 max-w-[620px] text-lg text-white/90">
            Every plan works in WhatsApp, Telegram and the web app. Prices are per month.
          </p>
          <p className="mx-auto mt-3 max-w-[620px] text-[15px] text-white/80">
            Not ready to pay? A free account includes up to 5 active reminders, 3 lists, 10 memories
            and 10 tasks.
          </p>
          {message && <p className="mt-4 font-medium text-[#e9ffe9]">{message}</p>}
          {error && <p className="mt-4 font-medium text-[#ffe3e3]">{error}</p>}
        </div>

        {plans === null && (
          <div className="mt-24 flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
          </div>
        )}

        {loadFailed && (
          <p className="mx-auto mt-20 max-w-md rounded-2xl bg-white/20 p-6 text-center">
            We couldn&apos;t load the plans just now. Please refresh the page in a moment.
          </p>
        )}

        {plans && plans.length > 0 && (
          <div className="mx-auto mt-24 grid max-w-[1080px] items-start gap-8 md:grid-cols-3">
            {plans.map((plan, i) => {
              const tier = TIER_STYLES[Math.min(i, TIER_STYLES.length - 1)];
              const popular = plan.slug === 'pro';
              const isCurrent =
                subscription?.planId === plan.id && subscription.status === 'ACTIVE';

              return (
                <div
                  key={plan.id}
                  id={plan.slug}
                  className={`zs-plan scroll-mt-40 ${popular ? 'is-popular' : ''}`}
                >
                  {popular && <span className="zs-plan-badge">MOST POPULAR</span>}
                  <div className="zs-plan-top" style={{ background: tier.background }}>
                    <span className="rounded-full border border-white/60 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                      {tier.kicker}
                    </span>
                    <h2 className="mt-5 text-3xl font-semibold">{plan.name}</h2>
                    <p className="mt-6 text-5xl font-semibold">
                      {formatPrice(plan)}
                      <span className="text-lg font-normal">/mo</span>
                    </p>
                    <ul>
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <Check size={18} className="mt-0.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {authed ? (
                    <button
                      type="button"
                      className="zs-btn zs-btn--soft w-full"
                      disabled={isCurrent || busyPlanId === plan.id}
                      onClick={() => subscribe(plan.id)}
                    >
                      {isCurrent
                        ? 'Current plan'
                        : busyPlanId === plan.id
                          ? 'Working…'
                          : `Choose ${plan.name}`}
                    </button>
                  ) : (
                    <Link
                      href={`/login?mode=register&plan=${plan.slug}`}
                      className="zs-btn zs-btn--soft w-full"
                    >
                      Get started
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mt-28 text-center text-[clamp(24px,2.4vw,32px)] font-semibold">
          Everything Zoorzio can do
        </h2>
        <div className="mx-auto mt-8 grid max-w-[1000px] grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {FEATURES.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/45 bg-white/15 p-3 text-center text-sm font-semibold transition-transform hover:-translate-y-1"
            >
              <Image
                src={feature.image}
                alt=""
                width={64}
                height={73}
                className="h-16 w-14 rounded-xl object-cover"
              />
              {feature.title}
            </Link>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link href="/#plans" className="zs-btn zs-btn--soft">
            Help me choose
          </Link>
        </div>
      </div>
    </section>
  );
}
