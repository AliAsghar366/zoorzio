'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getCurrentUser, ApiError, downloadAuditLogCsv, setUserPlan, startImpersonation } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  subscription: { status: string; plan: { id: string; name: string } } | null;
  _count: { memories: number; tasks: number; reminders: number };
}

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalMemories: number;
  totalTasks: number;
  totalReminders: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  createdAt: string;
  ipAddress: string | null;
  user: { email: string; name: string | null };
}

interface Plan {
  id: string;
  name: string;
  slug: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        if (user.role !== 'ADMIN') {
          router.replace('/portal');
          return;
        }
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!checked) return;

    Promise.all([
      api.get<AdminUser[]>('/admin/users'),
      api.get<AdminStats>('/admin/stats'),
      api.get<AuditLogEntry[]>('/admin/audit-logs?limit=50'),
      api.get<Plan[]>('/plans'),
    ])
      .then(([usersData, statsData, auditLogsData, plansData]) => {
        setUsers(usersData);
        setStats(statsData);
        setAuditLogs(auditLogsData);
        setPlans(plansData);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load admin data'))
      .finally(() => setLoading(false));
  }, [checked]);

  async function handlePlanChange(userId: string, planId: string) {
    setBusyUserId(userId);
    setActionError(null);
    try {
      await setUserPlan(userId, planId || undefined);
      const plan = plans.find((p) => p.id === planId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, subscription: plan ? { status: 'ACTIVE', plan: { id: plan.id, name: plan.name } } : null }
            : u,
        ),
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to update plan');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleImpersonate(userId: string) {
    setBusyUserId(userId);
    setActionError(null);
    try {
      await startImpersonation(userId);
      router.push('/portal');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to start impersonation');
      setBusyUserId(null);
    }
  }

  async function handleExportCsv() {
    try {
      await downloadAuditLogCsv();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to export audit log');
    }
  }

  if (!checked || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 pt-6 text-white">
        <div className="glass-card p-6">
          <p className="text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 text-white">
      <h1 className="text-3xl font-bold mb-8">Admin</h1>

      {actionError && (
        <div className="mb-6 glass-card px-4 py-3 text-sm text-red-200 border-red-300/40">{actionError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="Active Subscriptions" value={stats?.activeSubscriptions ?? 0} />
        <StatCard label="Memories" value={stats?.totalMemories ?? 0} />
        <StatCard label="Tasks" value={stats?.totalTasks ?? 0} />
        <StatCard label="Reminders" value={stats?.totalReminders ?? 0} />
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/60 border-b border-white/15">
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Memories</th>
                <th className="pb-2 pr-4">Tasks</th>
                <th className="pb-2 pr-4">Reminders</th>
                <th className="pb-2 pr-4">Joined</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/10">
                  <td className="py-2 pr-4">{user.email}</td>
                  <td className="py-2 pr-4 text-white/80">{user.name || '—'}</td>
                  <td className="py-2 pr-4">
                    <span className="text-[11px] font-semibold bg-white/20 rounded-full px-2.5 py-0.5">{user.role}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      className="glass-input text-xs py-1.5 w-auto"
                      value={user.subscription?.plan.id ?? ''}
                      disabled={busyUserId === user.id}
                      onChange={(e) => handlePlanChange(user.id, e.target.value)}
                    >
                      <option value="">Free tier</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4 text-white/80">{user._count.memories}</td>
                  <td className="py-2 pr-4 text-white/80">{user._count.tasks}</td>
                  <td className="py-2 pr-4 text-white/80">{user._count.reminders}</td>
                  <td className="py-2 pr-4 text-white/60">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    {user.role !== 'ADMIN' && (
                      <button
                        type="button"
                        className="text-white hover:underline disabled:opacity-50 disabled:no-underline"
                        disabled={busyUserId === user.id}
                        onClick={() => handleImpersonate(user.id)}
                      >
                        Impersonate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <button type="button" onClick={handleExportCsv} className="text-sm font-medium text-white hover:underline">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/60 border-b border-white/15">
                <th className="pb-2 pr-4">When</th>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Resource</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((entry) => (
                <tr key={entry.id} className="border-b border-white/10">
                  <td className="py-2 pr-4 text-white/60 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">{entry.user?.email ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={actionBadgeClass(entry.action)}>{entry.action}</span>
                  </td>
                  <td className="py-2 pr-4 text-white/80">{entry.resource}</td>
                  <td className="py-2 text-white/60">{entry.ipAddress || '—'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-white/50">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function actionBadgeClass(action: string): string {
  const base = 'text-[11px] font-semibold rounded-full px-2.5 py-0.5';
  if (action.includes('FAILED')) return `${base} bg-red-400/30 text-red-100`;
  if (action.includes('SUCCESS') || action.includes('RESET')) return `${base} bg-green-400/30 text-green-100`;
  return `${base} bg-white/20`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs font-medium text-white/60">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
