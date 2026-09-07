'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Globe, MapPin, Sparkles, LogOut, ChevronDown, Camera, Bell } from 'lucide-react';
import { api, logout, ApiError, channelsApi, type LinkedChannel } from '@/lib/api';
import { ChannelLinkPanel } from '@/components/ChannelLinkPanel';
import type { User } from '@anchor/shared';

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Subscription {
  status: string;
  plan: { name: string; priceCents: number };
}

interface Preferences {
  aiTone: string;
  notifications?: { preferredChannel?: string };
}

const PERSONALITIES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
  { value: 'calm', label: 'Calm' },
];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [linkedChannels, setLinkedChannels] = useState<LinkedChannel[]>([]);
  const [savingTone, setSavingTone] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<User>('/users/me').then(setUser).catch(() => setError('Failed to load your profile.'));
    api.get<Subscription | null>('/billing/subscription').then(setSubscription).catch(() => setSubscription(null));
    api.get<Preferences>('/users/me/preferences').then(setPreferences).catch(() => undefined);
    channelsApi.listLinked().then(setLinkedChannels).catch(() => undefined);
  }, []);

  const handlePersonalityChange = async (tone: string) => {
    setSavingTone(true);
    try {
      await api.put('/users/me/preferences', { aiTone: tone });
      setPreferences((prev) => (prev ? { ...prev, aiTone: tone } : { aiTone: tone }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update personality');
    } finally {
      setSavingTone(false);
    }
  };

  const handleCycleNotificationChannel = async () => {
    const options = ['EMAIL', ...linkedChannels.map((c) => c.type)];
    const current = preferences?.notifications?.preferredChannel || 'EMAIL';
    const next = options[(options.indexOf(current) + 1) % options.length];
    try {
      await api.put('/users/me/preferences', { notifications: { preferredChannel: next } });
      setPreferences((prev) => (prev ? { ...prev, notifications: { preferredChannel: next } } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update notification channel');
    }
  };

  const handlePhoneChange = async () => {
    const phone = window.prompt('Phone number (E.164, e.g. +15551234567)', user?.phone || '');
    if (phone === null) return;
    try {
      const updated = await api.put<User>('/users/me', { phone });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update phone number');
    }
  };

  const handleLanguageChange = async () => {
    const language = window.prompt('Language code (e.g. en, es, fr)', user?.language || 'en');
    if (!language) return;
    try {
      const updated = await api.put<User>('/users/me', { language });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update language');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image is too large — please choose one under 1.5MB.');
      return;
    }

    setSavingAvatar(true);
    try {
      const dataUri = await readFileAsDataUri(file);
      const updated = await api.put<User>('/users/me', { avatar: dataUri });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update photo');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await api.delete('/billing/subscription');
      setSubscription(null);
      setShowCancel(false);
    } finally {
      setCanceling(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const notificationChannelLabel = preferences?.notifications?.preferredChannel || 'EMAIL';

  return (
    <div className="text-white pb-4">
      <h1 className="text-3xl font-bold text-center">Profile</h1>
      <p className="text-white/60 text-sm text-center mt-2 max-w-md mx-auto">
        Here you can update your email address, phone number, and password. Keep them up to date so you don&apos;t miss your reminders.
      </p>

      {error && <p className="text-red-300 text-sm text-center mt-4">{error}</p>}

      <div className="dashboard-card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Mail size={16} className="text-white/70" />
            </span>
            <div>
              <h2 className="font-semibold">Account Information</h2>
              <p className="text-xs text-white/50">
                {user && `Member since ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
              </p>
            </div>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={savingAvatar}
              className="w-11 h-11 rounded-full overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center disabled:opacity-50"
              aria-label="Change profile photo"
            >
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="Your avatar" className="w-full h-full object-cover" />
              ) : (
                <Image src="/zoorzio-icon.png" alt="Zoorzio mascot" width={28} height={28} />
              )}
            </button>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
              <Camera size={10} className="text-[#2b1f47]" />
            </span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
        </div>

        <div className="space-y-2.5">
          <FieldRow icon={<Mail size={16} />} label="Email" value={user?.email || '—'} />
          <FieldRow icon={<Phone size={16} />} label="Phone number" value={user?.phone || 'Not set'} onChange={handlePhoneChange} />
          <FieldRow icon={<MapPin size={16} />} label="Location" value={user?.location || 'Not set'} />
          <FieldRow icon={<Globe size={16} />} label="Language" value={user?.language || 'en'} onChange={handleLanguageChange} />
          <FieldRow icon={<Bell size={16} />} label="Notification Channel" value={notificationChannelLabel} onChange={handleCycleNotificationChannel} />

          <div className="bg-white/5 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles size={16} className="text-white/50" />
              <span className="text-xs text-white/50">Personality</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.value}
                  disabled={savingTone}
                  onClick={() => handlePersonalityChange(p.value)}
                  className={p.value === preferences?.aiTone ? 'dashboard-pill active text-xs py-1.5 px-3' : 'dashboard-pill text-xs py-1.5 px-3'}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Link href="/forgot-password" className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors">
            <span className="text-sm">Password</span>
            <span className="text-xs font-semibold bg-white/10 px-3 py-1 rounded-full">Change</span>
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <ChannelLinkPanel />
      </div>

      <div className="dashboard-card p-6 mt-4">
        <h2 className="font-semibold mb-4">Subscription Details</h2>
        {subscription ? (
          <>
            <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">{subscription.plan.name}</p>
                <p className="text-xs text-white/50">${(subscription.plan.priceCents / 100).toFixed(2)}/mo · Monthly plan</p>
              </div>
              <span className="dashboard-pill text-xs py-1 px-3 cursor-default">{subscription.status}</span>
            </div>
            <div className="flex gap-3">
              <Link href="/pricing" className="dashboard-pill flex-1 text-center">
                Change plan
              </Link>
              <Link href="/pricing" className="dashboard-pill flex-1 text-center">
                Manage subscription
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-white/60 text-sm mb-4">You don&apos;t have an active plan yet.</p>
            <Link href="/pricing" className="dashboard-pill-primary inline-flex px-6">
              View plans
            </Link>
          </div>
        )}
        <p className="text-center text-xs text-white/40 mt-4">Need help? support@zoorzio.ai</p>
      </div>

      {subscription && (
        <div className="dashboard-card p-5 mt-4">
          <button onClick={() => setShowCancel((v) => !v)} className="w-full flex items-center justify-between text-sm font-semibold">
            <span>
              Danger zone
              <span className="block text-xs font-normal text-white/50">Manage subscription cancellation</span>
            </span>
            <ChevronDown size={16} className={showCancel ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {showCancel && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-white/50 mb-3">Your benefits will end at the close of this billing period; access continues until then.</p>
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="w-full text-sm font-semibold bg-red-500/20 hover:bg-red-500/30 transition-colors rounded-full py-2.5 disabled:opacity-50"
              >
                {canceling ? 'Canceling…' : 'Cancel subscription'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="dashboard-card p-6 mt-4 text-center">
        <p className="font-semibold mb-1">End session</p>
        <p className="text-xs text-white/50 mb-4">Finish your session safely from this device.</p>
        <button onClick={handleLogout} className="dashboard-pill-primary inline-flex">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}

function FieldRow({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: string; onChange?: () => void }) {
  return (
    <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-3">
      <span className="text-white/50">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/50">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      {onChange && (
        <button onClick={onChange} className="text-xs font-semibold bg-white/10 hover:bg-white/15 px-3 py-1 rounded-full transition-colors shrink-0">
          Change
        </button>
      )}
    </div>
  );
}
