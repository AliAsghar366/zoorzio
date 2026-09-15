'use client';

import { Suspense, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Rocket, Star, Crown, Camera, X } from 'lucide-react';
import { ApiError, login, register } from '@/lib/api';

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

const FIELD =
  'w-full rounded-xl border border-white/25 bg-white/[0.12] px-4 py-3 text-[15px] text-white placeholder:text-white/55 outline-none transition-colors focus:border-white/60 focus:bg-white/[0.18]';
const LABEL = 'mb-1.5 ml-1 block text-xs font-medium text-white/90';

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_ACCOUNTS = [
  {
    email: 'admin@anchor.app',
    label: 'Admin',
    description: 'Full admin access',
    icon: ShieldCheck,
  },
  { email: 'starter@anchor.app', label: 'Starter', description: 'Starter plan', icon: Rocket },
  { email: 'pro@anchor.app', label: 'Pro', description: 'Pro plan, full demo data', icon: Star },
  { email: 'ultimate@anchor.app', label: 'Ultimate', description: 'Ultimate plan', icon: Crown },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoadingEmail, setDemoLoadingEmail] = useState<string | null>(null);

  // Set when the visitor picked a plan on /pricing before signing up.
  const chosenPlan = searchParams.get('plan');

  const routeAfterLogin = (role: string) => {
    router.push(role === 'ADMIN' ? '/admin' : '/portal');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image is too large — please choose one under 1.5MB.');
      return;
    }
    setAvatar(await readFileAsDataUri(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (mode === 'register' && !acceptedPrivacy) {
      setError('You must accept the Privacy Policy to create an account.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password);
        routeAfterLogin(result.user.role);
      } else {
        await register(email, password, {
          name: name || undefined,
          phone: phone || undefined,
          location: location || undefined,
          avatar: avatar || undefined,
          acceptedPrivacyPolicy: acceptedPrivacy,
        });
        // New accounts get a one-time stop to connect messaging channels
        // before landing in the app - returning logins skip straight through.
        // Someone who picked a plan first goes back to finish choosing it.
        router.push(
          chosenPlan ? `/pricing#${encodeURIComponent(chosenPlan)}` : '/connect-channels',
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError(null);
    setDemoLoadingEmail(demoEmail);
    try {
      const result = await login(demoEmail, DEMO_PASSWORD);
      routeAfterLogin(result.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setDemoLoadingEmail(null);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 py-20 text-white"
      style={{ background: "#2a1c3d url('/candy-bar-bg.png') center/cover no-repeat fixed" }}
    >
      <div
        className="absolute inset-0 backdrop-blur-[3px]"
        style={{ background: 'linear-gradient(160deg, rgba(34,22,52,0.72), rgba(72,44,110,0.78))' }}
      />

      <Link
        href="/"
        className="absolute left-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20"
      >
        <ArrowLeft size={16} /> Home
      </Link>

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="rounded-3xl border border-white/25 bg-white/[0.14] px-7 pb-8 pt-10 text-center shadow-[0_20px_60px_rgba(20,12,35,0.45)] backdrop-blur-2xl sm:px-8">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-white/90 shadow-[0_10px_24px_rgba(20,12,35,0.35)]">
            <Image
              src="/zoorzio-icon.png"
              alt="Zoorzio"
              width={52}
              height={52}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-semibold">
            {mode === 'login' ? 'Welcome back to Zoorzio' : 'Create your account'}
          </h1>
          <p className="mb-7 mt-1 text-sm font-light text-white/80">
            {mode === 'login' ? 'Sign in to open your workspace' : 'Start remembering everything'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {mode === 'register' && (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/40 bg-white/10 transition-colors hover:border-white/80"
                    aria-label="Add a profile picture (optional)"
                  >
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="Your avatar" className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={22} className="text-white/70" />
                    )}
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatar(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#5a3c82] shadow-md"
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <p className={`mt-2 text-xs ${avatarError ? 'text-[#ffd1d9]' : 'text-white/60'}`}>
                  {avatarError ?? 'Add a photo (optional)'}
                </p>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label htmlFor="name" className={LABEL}>
                  Name
                </label>
                <input
                  id="name"
                  className={FIELD}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className={LABEL}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className={FIELD}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="phone" className={LABEL}>
                  Phone (optional)
                </label>
                <input
                  id="phone"
                  type="tel"
                  className={FIELD}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+923001234567"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label htmlFor="location" className={LABEL}>
                  Location (optional)
                </label>
                <input
                  id="location"
                  className={FIELD}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Karachi, Pakistan"
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className={`${LABEL} !mb-0`}>
                  Password
                </label>
                {mode === 'login' && (
                  <Link
                    href="/forgot-password"
                    className="text-xs text-white/80 underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="password"
                required
                type="password"
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={FIELD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="confirm-password" className={LABEL}>
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  className={FIELD}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === 'register' && (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-white/10 text-[#9283D9] focus:ring-white/50"
                />
                <span>
                  I have read and accept the{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Privacy Policy
                  </Link>
                  , including how Zoorzio handles third-party channels like WhatsApp and Telegram.
                </span>
              </label>
            )}

            {error && <p className="text-sm text-[#ffd1d9]">{error}</p>}

            <button
              type="submit"
              disabled={loading || (mode === 'register' && !acceptedPrivacy)}
              className="mt-2 w-full rounded-xl bg-white/90 py-3 text-[15px] font-semibold text-[#5a3c82] shadow-[0_10px_24px_rgba(20,12,35,0.25)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Enter your workspace →'
                  : 'Create account →'}
            </button>
          </form>

          <p className="mt-6 text-sm text-white/80">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-semibold text-white underline-offset-2 hover:underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>

        <div className="mt-5 rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
          <p className="mb-1 text-sm font-medium">Try it without signing up</p>
          <p className="mb-4 text-xs text-white/70">
            No email system is wired up yet, so use one of these demo accounts instead. Password for
            all of them: <span className="font-mono text-white">{DEMO_PASSWORD}</span>
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleDemoLogin(account.email)}
                disabled={demoLoadingEmail !== null}
                className="flex w-full items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-left transition-all hover:-translate-y-px hover:bg-white/15 disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <account.icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{account.label}</span>
                  <span className="block truncate text-xs text-white/65">{account.email}</span>
                </span>
                <span className="shrink-0 text-xs text-white/60">
                  {demoLoadingEmail === account.email ? 'Logging in…' : account.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
