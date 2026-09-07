'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  LayoutGrid,
  Users,
  Share2,
  Bell,
  CalendarDays,
  ListChecks,
  CheckSquare,
  Lightbulb,
  Search,
  Volume2,
  VolumeX,
  UserCog,
  CreditCard,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { getCurrentUser, logout } from '@/lib/api';

const ICONS = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/workspace', label: 'Workspace', icon: LayoutGrid },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/integrations', label: 'Integrations', icon: Share2 },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/lists', label: 'Lists', icon: ListChecks },
  { href: '/boards', label: 'Boards', icon: CheckSquare },
  { href: '/master-zoorzio', label: 'Master Zoorzio', icon: Lightbulb },
];

export function TopIconNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [muted, setMuted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initial, setInitial] = useState('?');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setIsAdmin(u.role === 'ADMIN');
        setInitial((u.name || u.email || '?').charAt(0).toUpperCase());
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [accountOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="sticky top-0 z-30 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1 dashboard-card px-2 py-1.5 overflow-x-auto">
          {ICONS.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={
                  active
                    ? 'flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 text-white shrink-0'
                    : 'flex items-center justify-center w-9 h-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0'
                }
              >
                <Icon size={17} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <div className="dashboard-card w-9 h-9 flex items-center justify-center">
            <NotificationBell dark align="right" />
          </div>
          <Link
            href="/explore"
            aria-label="Search"
            title="Search"
            className="dashboard-card w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <Search size={16} />
          </Link>
          <button
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
            className="dashboard-card w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setAccountOpen((v) => !v)}
              aria-label="Account"
              title="Account"
              className="dashboard-card w-9 h-9 flex items-center justify-center text-xs font-bold text-white"
            >
              {initial}
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-11 dashboard-card p-1.5 flex flex-col gap-0.5 w-44 z-40">
                <Link
                  href="/profile"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/85 hover:bg-white/10 transition-colors"
                >
                  <UserCog size={15} /> Profile
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/85 hover:bg-white/10 transition-colors"
                >
                  <CreditCard size={15} /> Pricing
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/85 hover:bg-white/10 transition-colors"
                  >
                    <ShieldCheck size={15} /> Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/85 hover:bg-white/10 transition-colors text-left"
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
