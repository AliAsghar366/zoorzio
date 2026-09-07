'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { friendsApi, type Friend, type FriendRequest, type FriendQuota, type FriendReminderReceived } from '@/lib/api';

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [quota, setQuota] = useState<FriendQuota | null>(null);
  const [reminders, setReminders] = useState<FriendReminderReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remindDrafts, setRemindDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [friendsData, requestsData, quotaData, remindersData] = await Promise.all([
      friendsApi.list(),
      friendsApi.requests(),
      friendsApi.quota(),
      friendsApi.reminders(),
    ]);
    setFriends(friendsData);
    setRequests(requestsData);
    setQuota(quotaData);
    setReminders(remindersData);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setNotice(null);
    try {
      await friendsApi.sendRequest(email.trim());
      setNotice(`Friend request sent to ${email}`);
      setEmail('');
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send friend request');
    }
  };

  const handleAccept = async (id: string) => {
    setBusyId(id);
    try {
      await friendsApi.accept(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept request');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setBusyId(id);
    try {
      await friendsApi.decline(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to decline request');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this friend?')) return;
    setBusyId(id);
    try {
      await friendsApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove friend');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemind = async (friendId: string) => {
    const message = (remindDrafts[friendId] || '').trim();
    if (!message) return;
    setBusyId(friendId);
    setError(null);
    try {
      await friendsApi.remind(friendId, message);
      setNotice('Reminder sent!');
      setRemindDrafts((prev) => ({ ...prev, [friendId]: '' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reminder');
    } finally {
      setBusyId(null);
    }
  };

  const visibleFriends = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter(({ friend }) => (friend.name || friend.email).toLowerCase().includes(q));
  }, [friends, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="text-white pb-4">
      <h1 className="text-3xl font-bold">Friend-to-friend Reminders</h1>
      <p className="text-white/60 text-sm mt-1">Send reminders to friends and manage your connections.</p>

      <button onClick={() => setShowAdd((v) => !v)} className="dashboard-pill-primary mt-4">
        <UserPlus size={16} /> New contact
      </button>

      {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
      {notice && <p className="text-green-300 text-sm mt-3">{notice}</p>}

      {showAdd && (
        <form onSubmit={handleSendRequest} className="dashboard-card p-4 mt-3 flex gap-2">
          <input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="dashboard-input flex-1"
            autoFocus
          />
          <button type="submit" className="dashboard-pill-primary shrink-0">
            Send request
          </button>
        </form>
      )}

      {quota && (
        <div className="flex flex-wrap gap-2 mt-5">
          <Chip label={`Total friends: ${quota.friends.used}`} />
          <Chip label={`Pending: ${requests.length}`} />
          <Chip label={`Reminders today: ${quota.remindersToday.used}`} />
          <Chip label={`This month: ${quota.remindersThisMonth.used}`} />
        </div>
      )}

      {quota && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <QuotaBar label="Your Friends" used={quota.friends.used} limit={quota.friends.limit} />
          <QuotaBar label="Daily reminders" used={quota.remindersToday.used} limit={quota.remindersToday.limit} />
          <QuotaBar label="Monthly reminders" used={quota.remindersThisMonth.used} limit={quota.remindersThisMonth.limit} />
          <QuotaBar label="Daily additions" used={quota.requestsToday.used} limit={quota.requestsToday.limit} />
        </div>
      )}

      {requests.length > 0 && (
        <div className="dashboard-card p-5 mt-4">
          <h2 className="font-semibold mb-3">Pending requests</h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="bg-white/5 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{req.requester.name || req.requester.email}</p>
                  <p className="text-xs text-white/50">{req.requester.email}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(req.id)} disabled={busyId === req.id} className="dashboard-pill-primary px-4 py-1.5 text-xs">
                    Accept
                  </button>
                  <button onClick={() => handleDecline(req.id)} disabled={busyId === req.id} className="dashboard-pill px-4 py-1.5 text-xs">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        placeholder="Search contacts"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="dashboard-input mt-4"
      />

      {visibleFriends.length === 0 ? (
        <div className="dashboard-card p-8 mt-4 text-center">
          <Users size={40} className="mx-auto text-white/30 mb-3" />
          <p className="font-semibold">Ready to connect?</p>
          <p className="text-sm text-white/50 mt-1 mb-4">Send friend requests and schedule reminders with friends.</p>
          <button onClick={() => setShowAdd(true)} className="dashboard-pill-primary">
            <UserPlus size={16} /> Add a friend
          </button>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {visibleFriends.map(({ friendshipId, friend }) => (
            <div key={friendshipId} className="dashboard-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">{friend.name || friend.email}</p>
                  <p className="text-xs text-white/50">{friend.email}</p>
                </div>
                <button onClick={() => handleRemove(friendshipId)} className="text-xs text-white/40 hover:text-red-300">
                  Remove
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  placeholder={`Remind ${friend.name || 'them'} to...`}
                  value={remindDrafts[friend.id] || ''}
                  onChange={(e) => setRemindDrafts((prev) => ({ ...prev, [friend.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleRemind(friend.id)}
                  className="dashboard-input flex-1"
                />
                <button onClick={() => handleRemind(friend.id)} disabled={busyId === friend.id} className="dashboard-pill-primary px-4 text-xs shrink-0">
                  Send
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reminders.length > 0 && (
        <div className="dashboard-card p-5 mt-4">
          <h2 className="font-semibold mb-3">Reminders from friends</h2>
          <div className="space-y-2">
            {reminders.map((r) => (
              <div key={r.id} className="bg-white/5 rounded-2xl p-4">
                <p className="text-xs text-white/50 mb-1">
                  From {r.sender.name || r.sender.email} · {new Date(r.createdAt).toLocaleString()}
                </p>
                <p className="text-sm">{r.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="dashboard-pill text-xs py-1.5 px-3 cursor-default">{label}</span>;
}

function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="dashboard-card p-4">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium">{label}</span>
        <span className="text-white/50">
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ac84cc] to-[#dc8cc5]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-white/40">{limit - used} left</p>
    </div>
  );
}
