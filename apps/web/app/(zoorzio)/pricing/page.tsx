'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  features: string[];
}

interface Subscription {
  planId: string;
  status: string;
  plan: Plan;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([api.get<Plan[]>('/plans'), api.get<Subscription | null>('/billing/subscription').catch(() => null)])
      .then(([plansData, subData]) => {
        setPlans(plansData);
        setSubscription(subData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubscribe = async (planId: string) => {
    setError(null);
    setMessage(null);
    setSubscribingPlanId(planId);
    try {
      const result = await api.post<{ mode: 'live' | 'demo'; checkoutUrl?: string }>('/billing/checkout', { planId });
      if (result.mode === 'live' && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setMessage('Subscribed! (Demo mode — no payment provider connected yet.)');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 text-white">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Plans</h1>
        <p className="text-white/70">Simple pricing. Cancel anytime.</p>
        {message && <p className="text-sm text-green-200 mt-3">{message}</p>}
        {error && <p className="text-sm text-red-200 mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = subscription?.planId === plan.id && subscription.status === 'ACTIVE';
          const isPopular = plan.slug === 'pro';

          return (
            <div key={plan.id} className="glass-card p-6 relative">
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold bg-white text-primary-600 rounded-full px-3 py-1">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>
              <p className="text-3xl font-bold mb-1">
                ${(plan.priceCents / 100).toFixed(2)}
                <span className="text-sm font-normal text-white/60">/mo</span>
              </p>
              <ul className="space-y-2 my-6 text-sm text-white/80">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-white">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className={isPopular ? 'glass-btn-primary w-full' : 'glass-btn-pill w-full'}
                disabled={isCurrent || subscribingPlanId === plan.id}
                onClick={() => handleSubscribe(plan.id)}
              >
                {isCurrent ? 'Current plan' : subscribingPlanId === plan.id ? 'Working…' : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
