'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Card } from '@anchor/ui';
import { formatRelativeTime, getSourceIcon } from '@anchor/shared';
import { api } from '@/lib/api';

interface Memory {
  id: string;
  content: string;
  summary?: string | null;
  source: string;
  createdAt: string;
}

interface DashboardStats {
  totalMemories: number;
  activeTasks: number;
  upcomingEvents: number;
  channelsActive: number;
}

interface Briefing {
  message: string;
  tasksDueToday: { title: string }[];
  overdueTasks: { title: string }[];
  events: { title: string }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [memoryStats, taskStats, upcomingEvents, channelsHealth, recent, dailyBriefing] =
        await Promise.all([
          api.get<{ total: number }>('/memory/stats').catch(() => ({ total: 0 })),
          api.get<{ pending: number }>('/tasks/stats').catch(() => ({ pending: 0 })),
          api.get<unknown[]>('/calendar/upcoming').catch(() => []),
          api.get<{ whatsapp: string; telegram: string }>('/channels/health').catch(() => null),
          api.get<Memory[]>('/memory/recent?limit=10').catch(() => []),
          api.get<Briefing>('/briefing').catch(() => null),
        ]);

      if (cancelled) return;

      setStats({
        totalMemories: memoryStats.total,
        activeTasks: taskStats.pending,
        upcomingEvents: upcomingEvents.length,
        channelsActive: channelsHealth
          ? Object.values(channelsHealth).filter((v) => v === 'initialized').length
          : 0,
      });
      setRecentMemories(recent);
      setBriefing(dailyBriefing);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-anchor-800 mb-8">Dashboard</h1>

      {briefing && (
        <Card className="mb-8 bg-brand-gradient-soft border-primary-200">
          <div className="flex items-start gap-4">
            <Image
              src="/zoorzio-icon.png"
              alt="Zoorzio mascot"
              width={48}
              height={48}
              className="rounded-full object-cover shrink-0"
            />
            <p className="text-anchor-700 whitespace-pre-line text-sm">{briefing.message}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Memories" value={stats?.totalMemories ?? 0} />
        <StatCard label="Active Tasks" value={stats?.activeTasks ?? 0} />
        <StatCard label="Upcoming Events" value={stats?.upcomingEvents ?? 0} />
        <StatCard label="Active Channels" value={stats?.channelsActive ?? 0} />
      </div>

      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-anchor-800">Recent Memories</h2>
          <Link href="/memories" className="text-primary-400 hover:text-primary-300 text-sm">
            See all
          </Link>
        </div>

        {recentMemories.length === 0 ? (
          <p className="text-anchor-500 text-center py-8">
            No memories yet. Start capturing your thoughts!
          </p>
        ) : (
          <div className="space-y-3">
            {recentMemories.map((memory) => (
              <div key={memory.id} className="bg-anchor-50 rounded-lg p-4">
                <div className="flex items-center text-sm text-anchor-500 mb-1">
                  <span>{getSourceIcon(memory.source)}</span>
                  <span className="ml-2 capitalize">{memory.source.toLowerCase()}</span>
                  <span className="mx-2">•</span>
                  <span>{formatRelativeTime(memory.createdAt)}</span>
                </div>
                <p className="text-anchor-800">{memory.summary || memory.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-anchor-800 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/tasks">
              <Button className="w-full" variant="secondary">
                + Create Task
              </Button>
            </Link>
            <Link href="/search">
              <Button className="w-full" variant="secondary">
                Search Memories
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm font-medium text-anchor-500">{label}</p>
      <p className="text-2xl font-bold text-anchor-800 mt-1">{value}</p>
    </Card>
  );
}
