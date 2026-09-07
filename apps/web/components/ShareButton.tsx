'use client';

import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { api, ApiError, friendsApi, type Friend } from '@/lib/api';

interface ShareButtonProps {
  resourceType: 'LIST' | 'REMINDER';
  resourceId: string;
  className?: string;
  onShared?: (email: string) => void;
  onError?: (message: string) => void;
}

/**
 * Replaces the old window.prompt("email?") share flow with a picker over the
 * user's actual Friends list, while keeping a "Custom email" fallback so you
 * can still share with someone who isn't a friend yet.
 */
export function ShareButton({ resourceType, resourceId, className, onShared, onError }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [sharingWith, setSharingWith] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && friends === null) {
      friendsApi.list().then(setFriends).catch(() => setFriends([]));
    }
  }, [open, friends]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const share = async (targetEmail: string) => {
    setSharingWith(targetEmail);
    setOpen(false);
    try {
      await api.post('/sharing', { resourceType, resourceId, targetEmail });
      onShared?.(targetEmail);
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : 'Failed to share');
    } finally {
      setSharingWith(null);
    }
  };

  const shareWithCustomEmail = () => {
    setOpen(false);
    const email = window.prompt("Share with which Zoorzio user's email?");
    if (email) share(email.trim());
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!!sharingWith}
        className={className}
      >
        {sharingWith ? 'Sharing…' : 'Share'}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 glass-card py-2 text-left text-white">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60 flex items-center gap-1.5">
            <Users size={12} /> Share with a friend
          </p>
          {friends === null ? (
            <p className="px-3 py-2 text-sm text-white/60">Loading…</p>
          ) : friends.length === 0 ? (
            <p className="px-3 py-2 text-sm text-white/60">No friends yet.</p>
          ) : (
            friends.map(({ friendshipId, friend }) => (
              <button
                key={friendshipId}
                onClick={() => share(friend.email)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/15 transition-colors truncate"
              >
                {friend.name || friend.email}
              </button>
            ))
          )}
          <div className="border-t border-white/15 mt-1 pt-1">
            <button
              onClick={shareWithCustomEmail}
              className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/15 transition-colors"
            >
              Custom email…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
