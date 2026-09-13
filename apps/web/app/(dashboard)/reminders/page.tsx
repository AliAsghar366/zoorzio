'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatRelativeTime } from '@anchor/shared';
import { api, ApiError } from '@/lib/api';
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { ShareButton } from '@/components/ShareButton';

type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type ReminderStatus = 'SCHEDULED' | 'TRIGGERED' | 'SNOOZED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
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
  status: ReminderStatus;
  snoozeCount: number;
  completedAt?: string | null;
  cancelledAt?: string | null;
  recurrence?: Recurrence | null;
}

const RECURRENCE_LABEL: Record<RecurrenceFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

const STATUS_LABEL: Record<ReminderStatus, string> = {
  SCHEDULED: 'Scheduled',
  TRIGGERED: 'Waiting on you',
  SNOOZED: 'Snoozed',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
  FAILED: "Couldn't deliver",
};

/** A reminder nothing further will happen to. */
function isFinished(reminder: Reminder) {
  return (
    reminder.status === 'COMPLETED' ||
    reminder.status === 'CANCELLED' ||
    reminder.status === 'FAILED'
  );
}

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
      setReminders((prev) =>
        [...prev, created].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      );
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
    const updated = await api.patch<Reminder>(`/reminders/${id}/complete`);
    setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const cancelReminder = async (id: string) => {
    const updated = await api.patch<Reminder>(`/reminders/${id}/cancel`);
    setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const snoozeReminder = async (id: string) => {
    const updated = await api.patch<Reminder>(`/reminders/${id}/snooze`, { minutes: 60 });
    setReminders((prev) =>
      prev
        .map((r) => (r.id === id ? updated : r))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );
  };

  const deleteReminder = async (id: string) => {
    if (!confirm('Delete this reminder?')) return;
    await api.delete(`/reminders/${id}`);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const upcomingCount = reminders.filter((r) => !isFinished(r)).length;

  const visible = useMemo(() => {
    let list = reminders;
    if (filter === 'today') list = list.filter((r) => !isFinished(r) && isToday(r.scheduledAt));
    else if (filter === 'upcoming') list = list.filter((r) => !isFinished(r));
    else if (filter === 'completed') list = list.filter(isFinished);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    return list;
  }, [reminders, filter, search]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="pb-4 text-white">
      <h1 className="text-3xl font-bold">Reminders</h1>

      {shareError && <p className="mt-3 text-sm text-red-300">{shareError}</p>}
      {shareNotice && <p className="mt-3 text-sm text-green-300">{shareNotice}</p>}
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
        <form onSubmit={createReminder} className="dashboard-card mt-3 space-y-3 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Take medicine"
            required
            className="dashboard-input"
            autoFocus
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Extra detail (optional)"
            className="dashboard-input"
          />
          <div className="flex gap-3">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="dashboard-input"
              required
            />
            <select
              value={recurrenceFreq}
              onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFrequency | '')}
              className="dashboard-input"
            >
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

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterPill label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterPill label="Today" active={filter === 'today'} onClick={() => setFilter('today')} />
        <FilterPill
          label="Upcoming"
          active={filter === 'upcoming'}
          onClick={() => setFilter('upcoming')}
          count={upcomingCount}
        />
        <FilterPill
          label="Completed"
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
        />
      </div>

      {visible.length === 0 ? (
        <div className="dashboard-card mt-4 p-8 text-center">
          <p className="text-sm text-white/50">No reminders here.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((reminder) => (
            <div
              key={reminder.id}
              className={
                isFinished(reminder) ? 'dashboard-card p-4 opacity-60' : 'dashboard-card p-4'
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={isFinished(reminder) ? 'font-medium line-through' : 'font-medium'}>
                    {reminder.title}
                  </p>
                  {reminder.message && (
                    <p className="mt-0.5 text-xs text-white/60">{reminder.message}</p>
                  )}
                  <p className="mt-0.5 text-xs text-white/50">
                    {reminder.status === 'COMPLETED' && reminder.completedAt
                      ? `Completed ${formatRelativeTime(reminder.completedAt)}`
                      : reminder.status === 'CANCELLED' && reminder.cancelledAt
                        ? `Cancelled ${formatRelativeTime(reminder.cancelledAt)}`
                        : new Date(reminder.scheduledAt).toLocaleString()}
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                      {STATUS_LABEL[reminder.status]}
                    </span>
                    {reminder.recurrence && (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                        {RECURRENCE_LABEL[reminder.recurrence.freq]}
                      </span>
                    )}
                    {reminder.snoozeCount > 0 && (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                        Snoozed {reminder.snoozeCount}&times;
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!isFinished(reminder) && (
                    <>
                      <ShareButton
                        resourceType="REMINDER"
                        resourceId={reminder.id}
                        className="text-xs text-white/50 hover:text-white"
                        onShared={(email) => setShareNotice(`Shared with ${email}`)}
                        onError={setShareError}
                      />
                      <button
                        onClick={() => snoozeReminder(reminder.id)}
                        className="text-xs text-white/70 hover:text-white"
                      >
                        +1 hour
                      </button>
                      <button
                        onClick={() => completeReminder(reminder.id)}
                        className="text-xs text-white hover:text-white/70"
                      >
                        Mark done
                      </button>
                      <button
                        onClick={() => cancelReminder(reminder.id)}
                        className="text-xs text-white/40 hover:text-white/70"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="text-xs text-white/40 hover:text-red-300"
                  >
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
          <h2 className="mb-3 text-lg font-semibold">Shared with me</h2>
          <div className="space-y-2">
            {sharedReminders.map(({ shareId, owner, resource, permission }) => (
              <div key={shareId} className="dashboard-card p-4">
                <p className="text-sm font-medium">{resource.title}</p>
                <p className="text-xs text-white/50">
                  {new Date(resource.scheduledAt).toLocaleString()}
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
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

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active ? 'dashboard-pill active px-3 py-1.5 text-xs' : 'dashboard-pill px-3 py-1.5 text-xs'
      }
    >
      {label} {typeof count === 'number' && count > 0 ? count : ''}
    </button>
  );
}
