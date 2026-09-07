'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Compass, Mic, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';
import type { User } from '@anchor/shared';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => undefined);
  }, []);

  const goToCoffee = () => {
    const q = message.trim();
    router.push(q ? `/coffee?q=${encodeURIComponent(q)}` : '/coffee');
  };

  const firstName = (user?.name || user?.email || '').split(/[\s@]/)[0];

  return (
    <div className="flex flex-col items-center pt-[12vh] px-6 text-center text-white">
      <div className="w-[120px] h-[120px] mb-4 mascot-float">
        <Image src="/zoorzio-icon.png" alt="Zoorzio mascot" width={120} height={120} className="object-contain" />
      </div>

      <h1 className="text-[clamp(28px,4.4vw,44px)] font-semibold tracking-tight [text-shadow:0_3px_18px_rgba(90,60,130,0.5)]">
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </h1>
      <p className="mt-2 mb-8 text-white/80 [text-shadow:0_2px_10px_rgba(90,60,130,0.35)]">Where do you want to go?</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToCoffee();
        }}
        className="glass-pill-input"
        style={{ width: 'min(92vw, 620px)' }}
      >
        <button type="button" className="w-[42px] h-[42px] rounded-full border border-white/55 bg-white/18 flex items-center justify-center shrink-0" aria-label="Add">
          <Plus size={18} />
        </button>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What can I help you with?"
          aria-label="Ask Zoorzio"
        />
        <button
          type="submit"
          className="w-[42px] h-[42px] rounded-full bg-white/90 text-primary-600 flex items-center justify-center shrink-0 hover:bg-white transition-colors"
          aria-label="Send"
        >
          <Mic size={18} />
        </button>
      </form>

      <div className="flex gap-4 mt-6" style={{ width: 'min(92vw, 620px)' }}>
        <Link
          href="/workspace"
          className="glass-card flex-1 p-4 text-left bg-gradient-to-br from-primary-400/35 to-primary-300/20 hover:-translate-y-1 transition-transform"
        >
          <div className="w-9 h-9 rounded-full bg-white/25 border border-white/50 flex items-center justify-center mb-2">
            <Briefcase size={18} />
          </div>
          <p className="text-[10.5px] font-semibold tracking-wide uppercase text-white/80">Your Workspace</p>
          <p className="text-base font-bold">Get things done</p>
        </Link>
        <Link
          href="/explore"
          className="glass-card flex-1 p-4 text-left bg-gradient-to-br from-accent-400/35 to-peach-300/25 hover:-translate-y-1 transition-transform"
        >
          <div className="w-9 h-9 rounded-full bg-white/25 border border-white/50 flex items-center justify-center mb-2">
            <Compass size={18} />
          </div>
          <p className="text-[10.5px] font-semibold tracking-wide uppercase text-white/80">Explore Zoorzio</p>
          <p className="text-base font-bold">Discover more</p>
        </Link>
      </div>
    </div>
  );
}
