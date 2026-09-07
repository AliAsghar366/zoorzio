'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@anchor/ui';
import { ApiError, forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

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

        <div className="card-elevated">
          <h1 className="text-2xl font-bold text-anchor-800 mb-1">Forgot your password?</h1>
          <p className="text-anchor-500 mb-6 text-sm">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>

          {message ? (
            <p className="text-sm text-green-600">{message}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" loading={loading}>
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-anchor-500 text-center">
            <Link href="/login" className="text-primary-500 hover:text-primary-600 font-medium">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
