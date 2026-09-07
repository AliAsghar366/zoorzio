'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, ListChecks, ChevronRight } from 'lucide-react';
import { api, getCurrentUser } from '@/lib/api';

interface DashboardStats {
  totalMemories: number;
  activeTasks: number;
  upcomingEvents: number;
  channelsActive: number;
}

interface Briefing {
  message: string;
}

interface UpcomingEvent {
  title: string;
  startAt?: string;
}

interface ZoorzioList {
  id: string;
  name: string;
}

export default function WorkspacePage() {
  const [firstName, setFirstName] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyBriefing, setWeeklyBriefing] = useState<Briefing | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [lists, setLists] = useState<ZoorzioList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [user, memoryStats, taskStats, upcomingEvents, channelsHealth, weekly, listsData] = await Promise.all([
        getCurrentUser().catch(() => null),
        api.get<{ total: number }>('/memory/stats').catch(() => ({ total: 0 })),
        api.get<{ pending: number }>('/tasks/stats').catch(() => ({ pending: 0 })),
        api.get<UpcomingEvent[]>('/calendar/upcoming').catch(() => []),
        api.get<{ whatsapp: string; telegram: string }>('/channels/health').catch(() => null),
        api.get<Briefing>('/briefing/weekly').catch(() => null),
        api.get<ZoorzioList[]>('/lists').catch(() => []),
      ]);

      if (cancelled) return;
      setFirstName(user?.name?.split(' ')[0] || '');
      setStats({
        totalMemories: memoryStats.total,
        activeTasks: taskStats.pending,
        upcomingEvents: upcomingEvents.length,
        channelsActive: channelsHealth
          ? Object.values(channelsHealth).filter((v) => v === 'initialized').length
          : 0,
      });
      setEvents(upcomingEvents.slice(0, 1));
      setWeeklyBriefing(weekly);
      setLists(listsData.slice(0, 1));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="text-white pb-4">
      <div className="dashboard-card p-6 mb-4">
        <p className="text-white/60 text-sm">Welcome back{firstName ? `, ${firstName}` : ''}</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">What&apos;s on your mind today?</h1>
      </div>

      <div className="dashboard-card p-6 md:p-8 mb-4 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide bg-white/10 px-3 py-1 rounded-full">
            New
          </span>
          <h2 className="text-2xl md:text-3xl font-bold mt-3">Weekly briefing</h2>
          <p className="text-white/60 text-sm mt-2 max-w-md">
            See your week at a glance, prioritize what matters, and go into Monday ready.
          </p>
          <Link href="/coffee?q=Give me my weekly briefing" className="dashboard-pill-primary inline-flex mt-4">
            Open briefing <ChevronRight size={16} />
          </Link>
        </div>
        <div className="w-20 h-20 shrink-0 mascot-float hidden sm:block">
          <Image src="/zoorzio-icon.png" alt="Zoorzio mascot" width={80} height={80} className="object-contain" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-4">
        <WorkspaceCard
          title="Reminder"
          href="/reminders"
          suggestions={['Zoorzio, remind me to call mom', 'Zoorzio, wake up at 7']}
        >
          <p className="text-sm text-white/80">
            {stats?.activeTasks ? `${stats.activeTasks} tasks need attention` : 'Nothing due right now'}
          </p>
        </WorkspaceCard>

        <WorkspaceCard
          title="Calendars"
          href="/calendar"
          suggestions={['Zoorzio, schedule meeting at 3pm', 'Zoorzio, show my week']}
        >
          {events.length === 0 ? (
            <p className="text-sm text-white/60">No events</p>
          ) : (
            <p className="text-sm text-white/80">{events[0].title}</p>
          )}
        </WorkspaceCard>

        <WorkspaceCard
          title="Lists"
          href="/lists"
          suggestions={['Zoorzio, add milk to shopping list', 'Zoorzio, create a to-do']}
        >
          {lists.length === 0 ? (
            <p className="text-sm text-white/60">No lists</p>
          ) : (
            <p className="text-sm text-white/80">{lists[0].name}</p>
          )}
        </WorkspaceCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Memories" value={stats?.totalMemories ?? 0} />
        <StatPill label="Active tasks" value={stats?.activeTasks ?? 0} />
        <StatPill label="Upcoming events" value={stats?.upcomingEvents ?? 0} />
        <StatPill label="Active channels" value={stats?.channelsActive ?? 0} />
      </div>
    </div>
  );
}

function WorkspaceCard({
  title,
  href,
  suggestions,
  children,
}: {
  title: string;
  href: string;
  suggestions: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-semibold">
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <Image src="/zoorzio-icon.png" alt="" width={18} height={18} />
          </span>
          {title}
        </div>
        <Link href={href} className="text-xs font-semibold bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full transition-colors">
          View all
        </Link>
      </div>
      <div className="mb-3">{children}</div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <span key={s} className="text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-white/60">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-card p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
