'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isImpersonating, stopImpersonation, getCurrentUser } from '@/lib/api';

export function ImpersonationBanner() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isImpersonating()) return;
    setActive(true);
    getCurrentUser()
      .then((user) => setEmail(user.email))
      .catch(() => undefined);
  }, []);

  if (!active) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-amber-950 text-sm font-medium px-4 py-2 flex items-center justify-center gap-3">
      <span>
        Viewing as {email || 'another user'} — actions you take are logged under your admin account.
      </span>
      <button
        type="button"
        onClick={() => {
          stopImpersonation();
          router.replace('/admin');
          router.refresh();
        }}
        className="underline font-semibold"
      >
        Return to admin
      </button>
    </div>
  );
}
