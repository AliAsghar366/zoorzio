'use client';

import { Suspense, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Rocket, Star, Crown, Camera, X } from 'lucide-react';
import { Button, Input } from '@anchor/ui';
import { ApiError, login, register } from '@/lib/api';

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

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
  { email: 'admin@anchor.app', label: 'Admin', description: 'Full admin access', icon: ShieldCheck },
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
        router.push('/connect-channels');
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
    <div className="min-h-screen flex bg-white">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-anchor-900 flex-col justify-between p-12">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-brand-gradient opacity-25 blur-3xl" />
        <div className="absolute -bottom-40 -right-16 w-96 h-96 rounded-full bg-brand-gradient opacity-20 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <Image
            src="/zoorzio-icon.png"
            alt="Zoorzio mascot"
            width={32}
            height={32}
            className="rounded-full object-cover ring-2 ring-white/10"
          />
          <span className="text-lg font-bold text-white">Zoorzio</span>
        </div>

        <div className="relative">
          <Image
            src="/zoorzio-icon.png"
            alt="Zoorzio mascot"
            width={72}
            height={72}
            className="rounded-full object-cover shadow-2xl shadow-black/40 mb-8"
          />
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            The memory layer that actually remembers.
          </h1>
          <p className="text-anchor-300 leading-relaxed">
            Reminders, lists, notes, and calendar — unified in one place, and delivered right
            back to WhatsApp or Telegram when it matters.
          </p>
        </div>

        <p className="relative text-xs text-anchor-500">
          © {new Date().getFullYear()} Zoorzio. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 bg-anchor-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-8">
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
            <h2 className="text-2xl font-bold text-anchor-800 mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-anchor-500 mb-6 text-sm">
              {mode === 'login' ? 'Log in to your memory layer' : 'Start remembering everything'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="flex justify-center">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-full bg-anchor-100 border-2 border-dashed border-anchor-300 flex items-center justify-center overflow-hidden hover:border-primary-400 transition-colors"
                      aria-label="Add a profile picture (optional)"
                    >
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="Your avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={22} className="text-anchor-400" />
                      )}
                    </button>
                    {avatar && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatar(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md border border-anchor-200 flex items-center justify-center"
                        aria-label="Remove photo"
                      >
                        <X size={12} className="text-anchor-600" />
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
                </div>
              )}
              {mode === 'register' && avatarError && (
                <p className="text-xs text-red-500 text-center">{avatarError}</p>
              )}
              {mode === 'register' && !avatarError && (
                <p className="text-xs text-anchor-400 text-center -mt-2">Add a photo (optional)</p>
              )}

              {mode === 'register' && (
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                />
              )}
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {mode === 'register' && (
                <Input
                  label="Phone (optional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+923001234567"
                />
              )}
              {mode === 'register' && (
                <Input
                  label="Location (optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Karachi, Pakistan"
                />
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label !mb-0">Password</label>
                  {mode === 'login' && (
                    <Link href="/forgot-password" className="text-xs text-primary-500 hover:text-primary-600">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <Input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {mode === 'register' && (
                <Input
                  label="Confirm password"
                  required
                  type="password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              )}

              {mode === 'register' && (
                <label className="flex items-start gap-2.5 text-sm text-anchor-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-anchor-300 text-primary-500 focus:ring-primary-400"
                  />
                  <span>
                    I have read and accept the{' '}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:text-primary-600 font-medium underline"
                    >
                      Privacy Policy
                    </Link>
                    , including how Zoorzio handles third-party channels like WhatsApp and Telegram.
                  </span>
                </label>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={mode === 'register' && !acceptedPrivacy}
              >
                {mode === 'login' ? 'Log in' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-sm text-anchor-500 text-center">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                className="text-primary-500 hover:text-primary-600 font-medium"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>

          <div className="card mt-6">
            <p className="text-sm font-medium text-anchor-800 mb-1">Try it without signing up</p>
            <p className="text-xs text-anchor-500 mb-4">
              No email system is wired up yet, so use one of these demo accounts instead. Password
              for all of them: <span className="font-mono text-anchor-700">{DEMO_PASSWORD}</span>
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleDemoLogin(account.email)}
                  disabled={demoLoadingEmail !== null}
                  className="w-full flex items-center gap-3 rounded-xl border border-anchor-200 px-4 py-3 text-left hover:border-primary-300 hover:bg-anchor-50 hover:-translate-y-px hover:shadow-md transition-all disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-gradient-soft flex items-center justify-center shrink-0">
                    <account.icon size={16} className="text-primary-500" />
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-anchor-800">{account.label}</span>
                    <span className="block text-xs text-anchor-500 truncate">{account.email}</span>
                  </span>
                  <span className="text-xs text-anchor-400 shrink-0">
                    {demoLoadingEmail === account.email ? 'Logging in…' : account.description}
                  </span>
                </button>
              ))}
            </div>
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
