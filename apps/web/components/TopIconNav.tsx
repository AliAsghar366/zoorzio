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
  Contact,
  SlidersHorizontal,
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
  { href: '/contacts', label: 'Contacts', icon: Contact },
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
    <div className="sticky top-0 z-30 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between">
        <nav className="dashboard-card flex items-center gap-1 overflow-x-auto px-2 py-1.5">
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
                    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white'
                    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white'
                }
              >
                <Icon size={17} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>

        <div className="ml-2 flex shrink-0 items-center gap-2">
          <div className="dashboard-card flex h-9 w-9 items-center justify-center">
            <NotificationBell dark align="right" />
          </div>
          <Link
            href="/explore"
            aria-label="Search"
            title="Search"
            className="dashboard-card flex h-9 w-9 items-center justify-center text-white/70 transition-colors hover:text-white"
          >
            <Search size={16} />
          </Link>
          <button
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
            className="dashboard-card flex h-9 w-9 items-center justify-center text-white/70 transition-colors hover:text-white"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setAccountOpen((v) => !v)}
              aria-label="Account"
              title="Account"
              className="dashboard-card flex h-9 w-9 items-center justify-center text-xs font-bold text-white"
            >
              {initial}
            </button>
            {accountOpen && (
              <div className="dashboard-card absolute right-0 top-11 z-40 flex w-44 flex-col gap-0.5 p-1.5">
                <Link
                  href="/profile"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  <UserCog size={15} /> Profile
                </Link>
                <Link
                  href="/action-permissions"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  <SlidersHorizontal size={15} /> Action permissions
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  <CreditCard size={15} /> Pricing
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                  >
                    <ShieldCheck size={15} /> Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
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
