'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatRelativeTime } from '@anchor/shared';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/lib/api';

const POLL_INTERVAL_MS = 30000;

export function NotificationBell({ dark = true, align = 'right' }: { dark?: boolean; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refreshCount = () => getUnreadNotificationCount().then(setUnreadCount).catch(() => undefined);
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setNotifications(await getNotifications());
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (notification.isRead) return;
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      // Non-critical - the count will self-correct on the next poll.
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // Non-critical - the count will self-correct on the next poll.
    }
  };

  const iconColor = dark ? 'text-anchor-300 hover:text-white' : 'text-anchor-500 hover:text-anchor-800';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className={`relative p-1.5 rounded-lg transition-colors ${iconColor}`}
      >
        <Bell size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-white shadow-2xl border border-anchor-100 z-50 text-left`}
        >

          <div className="flex items-center justify-between px-4 py-3 border-b border-anchor-100">
            <span className="text-sm font-semibold text-anchor-800">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-primary-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-anchor-400">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-anchor-400">You're all caught up.</div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-anchor-50 hover:bg-anchor-50 transition-colors ${
                      n.isRead ? '' : 'bg-primary-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-anchor-800 truncate">{n.title}</p>
                        <p className="text-xs text-anchor-500 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-anchor-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
