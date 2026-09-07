'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Briefcase,
  Coffee,
  Compass,
  MoreHorizontal,
  CreditCard,
  ShieldCheck,
  LogOut,
  Users,
  CheckSquare,
  ListChecks,
  Bell,
  CalendarDays,
  Trophy,
  Share2,
  UserCog,
} from 'lucide-react';
import { logout, getCurrentUser } from '@/lib/api';
import { useEffect } from 'react';

const TABS = [
  { href: '/portal', label: 'Portal', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: Briefcase },
  { href: '/coffee', label: 'Coffee', icon: Coffee },
  { href: '/explore', label: 'Explore', icon: Compass },
];

export function ZoorzioTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setIsAdmin(u.role === 'ADMIN'))
      .catch(() => undefined);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,620px)]">
      {moreOpen && (
        <div className="mb-3 glass-card p-2 flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
          <Link
            href="/friends"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <Users size={16} /> Friends
          </Link>
          <Link
            href="/boards"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <CheckSquare size={16} /> Boards
          </Link>
          <Link
            href="/lists"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <ListChecks size={16} /> Lists
          </Link>
          <Link
            href="/reminders"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <Bell size={16} /> Reminders
          </Link>
          <Link
            href="/calendar"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <CalendarDays size={16} /> Calendar
          </Link>
          <Link
            href="/master-zoorzio"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <Trophy size={16} /> Master Zoorzio
          </Link>
          <Link
            href="/integrations"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <Share2 size={16} /> Integrations
          </Link>
          <Link
            href="/profile"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <UserCog size={16} /> Profile
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
          >
            <CreditCard size={16} /> Pricing
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors"
            >
              <ShieldCheck size={16} /> Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/15 transition-colors text-left"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}

      <nav className="glass-card flex items-center justify-between px-2 py-2">
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setMoreOpen(false)}
              className={
                active
                  ? 'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold bg-white text-primary-600 shadow-md'
                  : 'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 transition-colors'
              }
            >
              <Icon size={17} strokeWidth={2} />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={
            moreOpen
              ? 'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold bg-white text-primary-600 shadow-md'
              : 'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 transition-colors'
          }
        >
          <MoreHorizontal size={17} strokeWidth={2} />
          <span className="hidden sm:inline">More</span>
        </button>
      </nav>
    </div>
  );
}
