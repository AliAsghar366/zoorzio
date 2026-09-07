'use client';

import Link from 'next/link';
import Image from 'next/image';
import { User as UserIcon } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export function ZoorzioTopBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-6">
      <Link href="/profile" className="glass-btn" aria-label="Profile">
        <UserIcon size={20} />
      </Link>
      <div className="glass-btn">
        <NotificationBell dark align="right" />
      </div>
    </div>
  );
}
