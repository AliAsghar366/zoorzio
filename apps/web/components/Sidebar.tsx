'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  ListChecks,
  Bell,
  CalendarDays,
  CreditCard,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  Users,
  Trophy,
} from 'lucide-react';
import { logout, getCurrentUser } from '@/lib/api';
import { NotificationBell } from './NotificationBell';
import type { User } from '@anchor/shared';

// Portal/Coffee/Explore live behind the bottom tab bar (see ZoorzioTabBar) -
// this sidebar is Workspace's own internal nav for its sub-sections.
const LINKS = [
  { href: '/workspace', label: 'Workspace', icon: LayoutDashboard },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/lists', label: 'Lists', icon: ListChecks },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/master-zoorzio', label: 'Master Zoorzio', icon: Trophy },
  { href: '/pricing', label: 'Pricing', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = (user?.name || user?.email || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 bg-anchor-900 flex-col shadow-2xl">
      {/* Logo */}
      <div className="flex items-center justify-between gap-2.5 px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full shadow-lg shadow-black/30">
            <Image
              src="/zoorzio-icon.png"
              alt="Zoorzio mascot"
              width={34}
              height={34}
              className="rounded-full object-cover ring-2 ring-white/10"
            />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Zoorzio</span>
        </div>
        <NotificationBell dark align="left" />
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-brand-gradient text-white shadow-lg shadow-primary-900/40'
                  : 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-anchor-300 hover:bg-white/5 hover:text-white transition-colors'
              }
            >
              <Icon size={18} strokeWidth={2} />
              {link.label}
            </Link>
          );
        })}

        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            className={
              pathname?.startsWith('/admin')
                ? 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-brand-gradient text-white shadow-lg shadow-primary-900/40 mt-3'
                : 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-anchor-300 hover:bg-white/5 hover:text-white transition-colors mt-3'
            }
          >
            <ShieldCheck size={18} strokeWidth={2} />
            Admin
          </Link>
        )}
      </nav>

      {/* User + settings + logout */}
      <div className="border-t border-white/5 p-3 space-y-1">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-semibold text-white shadow-md shadow-black/20 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Zoorzio user'}</p>
            <p className="text-xs text-anchor-400 truncate">{user?.email}</p>
          </div>
        </div>
        <Link
          href="/profile"
          className={
            pathname?.startsWith('/profile')
              ? 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-white/10 text-white'
              : 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-anchor-300 hover:bg-white/5 hover:text-white transition-colors'
          }
        >
          <SettingsIcon size={18} strokeWidth={2} />
          Profile
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-anchor-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} strokeWidth={2} />
          Log out
        </button>
      </div>
    </aside>
  );
}
