'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'zoorzio-cookie-consent';

type Consent = 'accepted' | 'rejected';

export function CookieBanner() {
  // Starts hidden and only decides whether to show itself after mount, so
  // this never affects first paint / LCP and never causes a server/client
  // hydration mismatch from reading localStorage during render.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (!existing) setVisible(true);
  }, []);

  const choose = (consent: Consent) => {
    window.localStorage.setItem(STORAGE_KEY, consent);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    // A slim single-line strip rather than a floating card - both bottom
    // corners can sit over real page content on this site (e.g. the signup
    // form's Privacy Policy checkbox, or the homepage hero's overlaid CTA
    // buttons), so keeping this short minimizes how much it can ever cover.
    <div
      className="fixed inset-x-0 bottom-0 z-[100] bg-white border-t border-anchor-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-anchor-600">
          We use cookies/local storage strictly necessary to keep you signed in.{' '}
          <Link href="/privacy" className="text-primary-500 hover:text-primary-600 font-medium underline">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => choose('rejected')}
            className="rounded-md border border-anchor-300 px-3 py-1 text-xs font-medium text-anchor-700 hover:bg-anchor-50 transition-colors"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="rounded-md bg-brand-gradient px-3 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition-shadow"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
