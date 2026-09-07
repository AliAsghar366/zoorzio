'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@anchor/ui';
import { api, getCurrentUser, ApiError } from '@/lib/api';
import type { User } from '@anchor/shared';

interface Subscription {
  status: string;
  plan: { name: string; priceCents: number };
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const [appleId, setAppleId] = useState('');
  const [applePassword, setApplePassword] = useState('');
  const [connectingApple, setConnectingApple] = useState(false);
  const [appleResult, setAppleResult] = useState<string | null>(null);
  const [appleError, setAppleError] = useState<string | null>(null);

  const loadSubscription = () => {
    api
      .get<Subscription | null>('/billing/subscription')
      .then(setSubscription)
      .catch(() => setSubscription(null));
  };

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setError('Failed to load your profile.'));
    loadSubscription();
  }, []);

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription?')) return;
    setCanceling(true);
    try {
      await api.delete('/billing/subscription');
      loadSubscription();
    } finally {
      setCanceling(false);
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-anchor-800">Settings</h1>

      <Card className="max-w-lg">
        <h2 className="text-lg font-semibold text-anchor-800 mb-4">Profile</h2>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {!user && !error && <p className="text-anchor-500 text-sm">Loading...</p>}
        {user && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-anchor-500">Name</dt>
              <dd className="text-anchor-800">{user.name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-anchor-500">Email</dt>
              <dd className="text-anchor-800">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-anchor-500">Role</dt>
              <dd className="text-anchor-800">{user.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-anchor-500">Timezone</dt>
              <dd className="text-anchor-800">{user.timezone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-anchor-500">Language</dt>
              <dd className="text-anchor-800">{user.language}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="max-w-lg">
        <h2 className="text-lg font-semibold text-anchor-800 mb-4">Billing</h2>
        {subscription ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-anchor-500">Plan</dt>
              <dd className="text-anchor-800">{subscription.plan.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-anchor-500">Price</dt>
              <dd className="text-anchor-800">${(subscription.plan.priceCents / 100).toFixed(2)}/mo</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-anchor-500">Status</dt>
              <dd>
                <span className="badge badge-success">{subscription.status}</span>
              </dd>
            </div>
            <div className="pt-2 flex gap-3">
              <Link href="/pricing">
                <Button variant="secondary" size="sm">
                  Change plan
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleCancel} loading={canceling}>
                Cancel subscription
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-anchor-500 text-sm mb-4">You don&apos;t have an active plan yet.</p>
            <Link href="/pricing">
              <Button size="sm">View plans</Button>
            </Link>
          </div>
        )}
      </Card>

      <Card className="max-w-lg">
        <h2 className="text-lg font-semibold text-anchor-800 mb-1">Apple Calendar</h2>
        <p className="text-xs text-anchor-500 mb-4">
          Apple has no OAuth API for third-party calendar access, so this connects over CalDAV
          using an{' '}
          <a
            href="https://support.apple.com/en-us/102654"
            target="_blank"
            rel="noreferrer"
            className="text-primary-500 hover:underline"
          >
            app-specific password
          </a>{' '}
          from your Apple ID — never your normal iCloud password.
        </p>
        <form onSubmit={handleConnectApple} className="space-y-3">
          <Input
            label="Apple ID"
            type="email"
            required
            value={appleId}
            onChange={(e) => setAppleId(e.target.value)}
            placeholder="you@icloud.com"
          />
          <Input
            label="App-specific password"
            type="password"
            required
            value={applePassword}
            onChange={(e) => setApplePassword(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
          />
          {appleResult && <p className="text-sm text-green-600">{appleResult}</p>}
          {appleError && <p className="text-sm text-red-500">{appleError}</p>}
          <Button type="submit" size="sm" loading={connectingApple}>
            Connect Apple Calendar
          </Button>
        </form>
      </Card>
    </div>
  );
}
