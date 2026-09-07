'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatRelativeTime } from '@anchor/shared';
import { api, ApiError } from '@/lib/api';
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { ShareButton } from '@/components/ShareButton';

type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type Filter = 'all' | 'today' | 'upcoming' | 'completed';

interface Recurrence {
  freq: RecurrenceFrequency;
  interval?: number;
}

interface Reminder {
  id: string;
  title: string;
  message?: string | null;
  scheduledAt: string;
  completedAt?: string | null;
  recurrence?: Recurrence | null;
}

const RECURRENCE_LABEL: Record<RecurrenceFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

interface SharedReminder {
  shareId: string;
  permission: 'VIEW' | 'EDIT';
  owner: { id: string; email: string; name: string | null };
  resource: Reminder;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [sharedReminders, setSharedReminders] = useState<SharedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFrequency | ''>('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchReminders = async () => {
    const data = await api.get<Reminder[]>('/reminders');
    setReminders(data);
  };

  const fetchSharedReminders = async () => {
    const data = await api.get<SharedReminder[]>('/sharing/shared-with-me?resourceType=REMINDER');
    setSharedReminders(data);
  };

  useEffect(() => {
    Promise.all([fetchReminders(), fetchSharedReminders()]).finally(() => setLoading(false));
  }, []);

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;

    setCreateError(null);
    try {
      const created = await api.post<Reminder>('/reminders', {
        title,
        message: message.trim() || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        recurrence: recurrenceFreq ? { freq: recurrenceFreq } : undefined,
      });
      setReminders((prev) => [...prev, created].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
      setTitle('');
      setMessage('');
      setScheduledAt('');
      setRecurrenceFreq('');
      setShowForm(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create reminder');
    }
  };

  const completeReminder = async (id: string) => {
    await api.patch(`/reminders/${id}/complete`);
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completedAt: new Date().toISOString() } : r)));
  };

  const deleteReminder = async (id: string) => {
    if (!confirm('Delete this reminder?')) return;
    await api.delete(`/reminders/${id}`);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const upcomingCount = reminders.filter((r) => !r.completedAt).length;

  const visible = useMemo(() => {
    let list = reminders;
    if (filter === 'today') list = list.filter((r) => !r.completedAt && isToday(r.scheduledAt));
    else if (filter === 'upcoming') list = list.filter((r) => !r.completedAt);
    else if (filter === 'completed') list = list.filter((r) => !!r.completedAt);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    return list;
  }, [reminders, filter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="text-white pb-4">
      <h1 className="text-3xl font-bold">Reminders</h1>

      {shareError && <p className="text-red-300 text-sm mt-3">{shareError}</p>}
      {shareNotice && <p className="text-green-300 text-sm mt-3">{shareNotice}</p>}
      {createError && <UpgradeBanner message={createError} />}

      <input
        placeholder="Search for a reminder"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="dashboard-input mt-4"
      />

      <button onClick={() => setShowForm((v) => !v)} className="dashboard-pill-primary mt-3">
        <Plus size={16} /> New Reminder
      </button>

      {showForm && (
        <form onSubmit={createReminder} className="dashboard-card p-5 mt-3 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Take medicine" required className="dashboard-input" autoFocus />
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Extra detail (optional)" className="dashboard-input" />
          <div className="flex gap-3">
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="dashboard-input" required />
            <select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFrequency | '')} className="dashboard-input">
              <option value="">Never</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <button type="submit" className="dashboard-pill-primary w-full">
            Add
          </button>
        </form>
      )}

      <div className="flex gap-2 mt-4 flex-wrap">
        <FilterPill label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterPill label="Today" active={filter === 'today'} onClick={() => setFilter('today')} />
        <FilterPill label="Upcoming" active={filter === 'upcoming'} onClick={() => setFilter('upcoming')} count={upcomingCount} />
        <FilterPill label="Completed" active={filter === 'completed'} onClick={() => setFilter('completed')} />
      </div>

      {visible.length === 0 ? (
        <div className="dashboard-card p-8 mt-4 text-center">
          <p className="text-white/50 text-sm">No reminders here.</p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {visible.map((reminder) => (
            <div key={reminder.id} className={reminder.completedAt ? 'dashboard-card p-4 opacity-60' : 'dashboard-card p-4'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={reminder.completedAt ? 'font-medium line-through' : 'font-medium'}>{reminder.title}</p>
                  {reminder.message && <p className="text-xs text-white/60 mt-0.5">{reminder.message}</p>}
                  <p className="text-xs text-white/50 mt-0.5">
                    {reminder.completedAt
                      ? `Completed ${formatRelativeTime(reminder.completedAt)}`
                      : new Date(reminder.scheduledAt).toLocaleString()}
                    {reminder.recurrence && (
                      <span className="ml-2 text-[10px] font-semibold bg-white/10 rounded-full px-2 py-0.5">
                        {RECURRENCE_LABEL[reminder.recurrence.freq]}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!reminder.completedAt && (
                    <>
                      <ShareButton
                        resourceType="REMINDER"
                        resourceId={reminder.id}
                        className="text-xs text-white/50 hover:text-white"
                        onShared={(email) => setShareNotice(`Shared with ${email}`)}
                        onError={setShareError}
                      />
                      <button onClick={() => completeReminder(reminder.id)} className="text-xs text-white hover:text-white/70">
                        Mark done
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteReminder(reminder.id)} className="text-xs text-white/40 hover:text-red-300">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sharedReminders.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Shared with me</h2>
          <div className="space-y-2">
            {sharedReminders.map(({ shareId, owner, resource, permission }) => (
              <div key={shareId} className="dashboard-card p-4">
                <p className="font-medium text-sm">{resource.title}</p>
                <p className="text-xs text-white/50">
                  {new Date(resource.scheduledAt).toLocaleString()}
                  <span className="ml-2 text-[10px] font-semibold bg-white/10 rounded-full px-2 py-0.5">
                    From {owner.name || owner.email} · {permission}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} className={active ? 'dashboard-pill active text-xs py-1.5 px-3' : 'dashboard-pill text-xs py-1.5 px-3'}>
      {label} {typeof count === 'number' && count > 0 ? count : ''}
    </button>
  );
}
