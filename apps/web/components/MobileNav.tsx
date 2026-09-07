'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { NotificationBell } from './NotificationBell';

const LINKS = [
  { href: '/workspace', label: 'Workspace' },
  { href: '/friends', label: 'Friends' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/lists', label: 'Lists' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/master-zoorzio', label: 'Master Zoorzio' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/profile', label: 'Profile' },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="md:hidden bg-anchor-900 text-white sticky top-0 z-30 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/workspace" className="flex items-center gap-2">
          <Image src="/zoorzio-icon.png" alt="Zoorzio" width={26} height={26} className="rounded-full object-cover" />
          <span className="font-bold">Zoorzio</span>
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell dark />
          <button onClick={handleLogout} className="text-xs text-anchor-300 hover:text-white">
            Log out
          </button>
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto px-4 pb-3 text-sm">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname?.startsWith(link.href)
                ? 'whitespace-nowrap text-white font-medium'
                : 'whitespace-nowrap text-anchor-400'
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
