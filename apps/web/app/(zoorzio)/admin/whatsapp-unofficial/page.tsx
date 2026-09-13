'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, getCurrentUser } from '@/lib/api';

type Status = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

interface StatusView {
  status: Status;
  connectedNumber: string | null;
  lastError: string | null;
  qrDataUrl: string | null;
  qrGeneratedAt: string | null;
}

const POLL_MS = 3000;

export default function AdminWhatsAppUnofficialPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<StatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'logout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

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

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<StatusView>('/admin/whatsapp-unofficial');
      setView(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load connection status.');
    } finally {
      setLoading(false);
    }
  }, []);

  // While pairing (waiting for a scan) or mid-handshake, poll for a fresh QR
  // or the connection landing - Baileys rotates the QR roughly every 20-60s.
  useEffect(() => {
    if (!checked) return;
    void fetchStatus();

    const shouldPoll = view?.status === 'CONNECTING' || view === null;
    if (shouldPoll) {
      pollRef.current = window.setInterval(fetchStatus, POLL_MS);
    }
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // Deliberately keyed on view?.status, not view - a status change is what
    // should start/stop polling, not every qrDataUrl refresh from the poll itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, view?.status, fetchStatus]);

  const connect = async () => {
    setBusy('connect');
    setError(null);
    try {
      const data = await api.post<StatusView>('/admin/whatsapp-unofficial/connect');
      setView(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start pairing.');
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    if (!window.confirm('Unlink this device and clear the stored session? You will need to scan a new QR code to reconnect.')) {
      return;
    }
    setBusy('logout');
    setError(null);
    try {
      const data = await api.post<StatusView>('/admin/whatsapp-unofficial/logout');
      setView(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log out.');
    } finally {
      setBusy(null);
    }
  };

  if (!checked || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  const status = view?.status ?? 'DISCONNECTED';

  return (
    <div className="mx-auto max-w-2xl px-6 pb-10 pt-6 text-white">
      <Link href="/admin" className="text-sm text-white/60 hover:text-white">
        &larr; Admin
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Personal WhatsApp connection</h1>
      <p className="mt-2 text-sm text-white/60">
        Links Zoorzio to a personal WhatsApp number via QR pairing (Baileys), the same way WhatsApp
        Web links a browser. This bypasses Meta&apos;s Cloud API entirely - see{' '}
        <code>whatsapp-unofficial.service.ts</code> for why that trade-off was accepted.
      </p>

      <div className="glass-card mt-5 px-4 py-3 text-sm text-amber-200">
        Whoever scans the QR becomes the linked number - it is not tied to a specific phone in
        advance, the same way anyone who scans a WhatsApp Web QR on your screen links their own
        account. Only scan it with the intended phone, and don&apos;t leave this page open where
        someone else could scan it first. If the wrong phone scans it, the connection is logged out
        automatically as soon as it opens.
      </div>

      {error && <div className="glass-card mt-5 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="glass-card mt-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">
              {status === 'CONNECTED'
                ? `Linked${view?.connectedNumber ? ` as +${view.connectedNumber}` : ''}`
                : status === 'CONNECTING'
                  ? 'Waiting for scan…'
                  : 'Not connected'}
            </p>
            {view?.lastError && <p className="mt-1 text-xs text-red-200">{view.lastError}</p>}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              status === 'CONNECTED'
                ? 'bg-green-400/25'
                : status === 'CONNECTING'
                  ? 'bg-amber-400/25'
                  : 'bg-white/15'
            }`}
          >
            {status === 'CONNECTED' ? 'Connected' : status === 'CONNECTING' ? 'Pairing' : 'Disconnected'}
          </span>
        </div>

        {status === 'CONNECTING' && view?.qrDataUrl && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view.qrDataUrl} alt="WhatsApp pairing QR code" className="h-56 w-56" />
            </div>
            <p className="text-center text-xs text-white/60">
              On the phone: WhatsApp &rarr; Settings &rarr; Linked Devices &rarr; Link a Device, then
              scan this code. It refreshes automatically every 20-60 seconds.
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          {status !== 'CONNECTED' && (
            <button
              onClick={connect}
              disabled={busy !== null}
              className="rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/30 disabled:opacity-50"
            >
              {busy === 'connect' ? 'Starting…' : status === 'CONNECTING' ? 'Refresh' : 'Start pairing'}
            </button>
          )}
          {status !== 'DISCONNECTED' && (
            <button
              onClick={logout}
              disabled={busy !== null}
              className="rounded-xl bg-red-500/20 px-5 py-2.5 text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50"
            >
              {busy === 'logout' ? 'Logging out…' : 'Log out / unlink'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
