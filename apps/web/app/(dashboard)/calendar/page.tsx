'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { api, ApiError } from '@/lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  calendar?: { name: string; color?: string | null; provider: string };
}

interface CalendarSummary {
  id: string;
  name: string;
  provider: string;
}

type ViewMode = 'month' | 'week' | 'day';

function CalendarPageInner() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [loading, setLoading] = useState(true);

  const [appleId, setAppleId] = useState('');
  const [applePassword, setApplePassword] = useState('');
  const [connectingApple, setConnectingApple] = useState(false);
  const [appleResult, setAppleResult] = useState<string | null>(null);
  const [appleError, setAppleError] = useState<string | null>(null);

  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCalendarId, setNewEventCalendarId] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [addEventError, setAddEventError] = useState<string | null>(null);

  useEffect(() => {
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    if (provider && status) {
      const label = provider === 'google' ? 'Google Calendar' : provider === 'outlook' ? 'Outlook Calendar' : provider;
      if (status === 'connected') {
        setOauthBanner({ ok: true, text: `${label} connected!` });
      } else {
        setOauthBanner({ ok: false, text: `${label} connection failed: ${message || 'unknown error'}` });
      }
      window.history.replaceState(null, '', '/calendar');
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    api
      .get<CalendarEvent[]>(`/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [currentDate]);

  useEffect(() => {
    api
      .get<CalendarSummary[]>('/calendar/health')
      .then((data) => {
        setCalendars(data);
        if (data.length > 0) setNewEventCalendarId(data[0].id);
      })
      .catch(() => setCalendars([]));
  }, []);

  const reloadEvents = () => {
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    api
      .get<CalendarEvent[]>(`/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .then(setEvents)
      .catch(() => undefined);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventCalendarId || !newEventStart || !newEventEnd) return;
    setAddEventError(null);
    try {
      await api.post('/calendar/events', {
        calendarId: newEventCalendarId,
        title: newEventTitle.trim(),
        startTime: new Date(newEventStart).toISOString(),
        endTime: new Date(newEventEnd).toISOString(),
      });
      setNewEventTitle('');
      setNewEventStart('');
      setNewEventEnd('');
      setShowAddEvent(false);
      reloadEvents();
    } catch (err) {
      setAddEventError(err instanceof ApiError ? err.message : 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await api.delete(`/calendar/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    setOauthBanner(null);
    try {
      const result = await api.get<{ url: string }>('/calendar/google/authorize');
      window.location.href = result.url;
    } catch (err) {
      setOauthBanner({ ok: false, text: err instanceof ApiError ? err.message : 'Failed to start Google sign-in' });
      setConnectingGoogle(false);
    }
  };

  const handleConnectOutlook = async () => {
    setConnectingOutlook(true);
    setOauthBanner(null);
    try {
      const result = await api.get<{ url: string }>('/calendar/outlook/authorize');
      window.location.href = result.url;
    } catch (err) {
      setOauthBanner({ ok: false, text: err instanceof ApiError ? err.message : 'Failed to start Outlook sign-in' });
      setConnectingOutlook(false);
    }
  };

  const handleConnectApple = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppleError(null);
    setAppleResult(null);
    setConnectingApple(true);
    try {
      const result = await api.post<{ success: boolean; calendarsCount: number }>('/calendar/apple/connect', {
        username: appleId,
        appPassword: applePassword,
      });
      setAppleResult(`Connected! Synced ${result.calendarsCount} calendar(s).`);
      setApplePassword('');
    } catch (err) {
      setAppleError(err instanceof ApiError ? err.message : 'Failed to connect Apple Calendar');
    } finally {
      setConnectingApple(false);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));

    return days;
  };

  const getEventsForDate = (date: Date) =>
    events.filter((event) => new Date(event.startTime).toDateString() === date.toDateString());

  const providerColor = (provider?: string) => {
    switch (provider) {
      case 'GOOGLE':
        return 'bg-sky-400/30';
      case 'OUTLOOK':
        return 'bg-primary-400/30';
      case 'APPLE':
        return 'bg-accent-400/30';
      default:
        return 'bg-white/15';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  const selectedEvents = getEventsForDate(selectedDate);

  return (
    <div className="text-white pb-4">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-3xl font-bold">Calendars</h1>
        <Image src="/zoorzio-icon.png" alt="" width={24} height={24} />
      </div>

      {oauthBanner && (
        <div className={`dashboard-card p-4 mb-4 text-sm ${oauthBanner.ok ? 'text-green-300' : 'text-red-300'}`}>
          {oauthBanner.text}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={viewMode === mode ? 'dashboard-pill active text-xs py-1.5 px-4 capitalize' : 'dashboard-pill text-xs py-1.5 px-4 capitalize'}
          >
            {mode}
          </button>
        ))}
        <button onClick={goToToday} className="dashboard-pill text-xs py-1.5 px-4">
          Today
        </button>
        <span className="dashboard-pill text-xs py-1.5 px-4 cursor-default">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="dashboard-card p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="dashboard-pill px-4 py-1.5 text-xs"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="dashboard-pill px-4 py-1.5 text-xs"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-2 text-center font-bold text-white/50 text-[11px]">
              {day}
            </div>
          ))}

          {getDaysInMonth().map((date, index) => (
            <div
              key={index}
              className={`min-h-[64px] p-1.5 rounded-lg cursor-pointer transition-colors ${
                date ? 'hover:bg-white/10' : ''
              } ${date && selectedDate.toDateString() === date.toDateString() ? 'ring-1 ring-white/40 bg-white/10' : ''}`}
              onClick={() => date && setSelectedDate(date)}
            >
              {date && (
                <>
                  <div className="text-xs font-medium mb-1">{date.getDate()}</div>
                  <div className="space-y-0.5">
                    {getEventsForDate(date)
                      .slice(0, 2)
                      .map((event) => (
                        <div key={event.id} className={`text-[9px] p-0.5 rounded truncate ${providerColor(event.calendar?.provider)}`} title={event.title}>
                          {event.title}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-card p-6 mt-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2">
            Today's events
            <Image src="/zoorzio-icon.png" alt="" width={20} height={20} />
          </h3>
          {calendars.length > 0 && (
            <button onClick={() => setShowAddEvent((v) => !v)} className="dashboard-pill text-xs py-1.5 px-3">
              + Add event
            </button>
          )}
        </div>
        <p className="text-xs text-white/50 mb-4">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        {showAddEvent && (
          <form onSubmit={handleAddEvent} className="space-y-2 mb-4 bg-white/5 rounded-2xl p-4">
            <input
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Event title"
              required
              autoFocus
              className="dashboard-input"
            />
            <div className="flex gap-2 flex-wrap">
              <select value={newEventCalendarId} onChange={(e) => setNewEventCalendarId(e.target.value)} className="dashboard-input flex-1">
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.provider})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input type="datetime-local" value={newEventStart} onChange={(e) => setNewEventStart(e.target.value)} required className="dashboard-input flex-1" />
              <input type="datetime-local" value={newEventEnd} onChange={(e) => setNewEventEnd(e.target.value)} required className="dashboard-input flex-1" />
            </div>
            {addEventError && <p className="text-xs text-red-300">{addEventError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="dashboard-pill-primary text-xs">
                Add event
              </button>
              <button type="button" onClick={() => setShowAddEvent(false)} className="text-xs text-white/40 hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        )}

        {selectedEvents.length === 0 ? (
          <div className="text-center py-6">
            <Image src="/zoorzio-icon.png" alt="" width={56} height={56} className="mx-auto mb-3 opacity-80" />
            <p className="font-semibold text-sm">Nothing scheduled</p>
            <p className="text-xs text-white/50 mt-1">This day is completely free. A good window for deep work.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div>
                  <h4 className="font-medium text-sm">{event.title}</h4>
                  {event.description && <p className="text-xs text-white/50">{event.description}</p>}
                  <p className="text-xs text-white/40 mt-1">
                    {new Date(event.startTime).toLocaleTimeString()} - {new Date(event.endTime).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {event.calendar && (
                    <span className={`px-2 py-1 text-[10px] rounded-full ${providerColor(event.calendar.provider)}`}>{event.calendar.provider}</span>
                  )}
                  <button onClick={() => handleDeleteEvent(event.id)} className="text-white/30 hover:text-red-300 text-xs">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card p-6 mt-4">
        <h3 className="text-lg font-bold mb-1">Connect a calendar</h3>
        <p className="text-xs text-white/50 mb-4">
          Google and Outlook connect via your account&apos;s real sign-in screen. Apple/iCloud connects over CalDAV using an{' '}
          <a href="https://support.apple.com/en-us/102654" target="_blank" rel="noreferrer" className="underline hover:text-white">
            app-specific password
          </a>{' '}
          — never your normal iCloud password.
        </p>
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={handleConnectGoogle} disabled={connectingGoogle} className="dashboard-pill text-xs">
            {connectingGoogle ? 'Redirecting…' : 'Connect Google Calendar'}
          </button>
          <button onClick={handleConnectOutlook} disabled={connectingOutlook} className="dashboard-pill text-xs">
            {connectingOutlook ? 'Redirecting…' : 'Connect Outlook'}
          </button>
        </div>
        <form onSubmit={handleConnectApple} className="space-y-3 max-w-sm">
          <input type="email" required value={appleId} onChange={(e) => setAppleId(e.target.value)} placeholder="you@icloud.com" className="dashboard-input" />
          <input
            type="password"
            required
            value={applePassword}
            onChange={(e) => setApplePassword(e.target.value)}
            placeholder="app-specific password"
            className="dashboard-input"
          />
          {appleResult && <p className="text-sm text-green-300">{appleResult}</p>}
          {appleError && <p className="text-sm text-red-300">{appleError}</p>}
          <button type="submit" disabled={connectingApple} className="dashboard-pill-primary">
            {connectingApple ? 'Connecting…' : 'Connect Apple Calendar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
        </div>
      }
    >
      <CalendarPageInner />
    </Suspense>
  );
}
