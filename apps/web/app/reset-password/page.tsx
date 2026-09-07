'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@anchor/ui';
import { ApiError, resetPassword } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="card-elevated">
        <p className="text-sm text-red-500">
          This reset link is missing its token. Please request a new one.
        </p>
        <Link href="/forgot-password" className="text-primary-500 hover:text-primary-600 text-sm font-medium">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="card-elevated">
      <h1 className="text-2xl font-bold text-anchor-800 mb-1">Choose a new password</h1>
      <p className="text-anchor-500 mb-6 text-sm">Must be at least 8 characters.</p>

      {done ? (
        <p className="text-sm text-green-600">Password updated! Redirecting to log in…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Confirm new password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Reset password
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-anchor-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/zoorzio-icon.png"
            alt="Zoorzio mascot"
            width={56}
            height={56}
            className="rounded-full object-cover shadow-lg mb-3"
          />
          <span className="text-xl font-bold text-gradient">Zoorzio</span>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
