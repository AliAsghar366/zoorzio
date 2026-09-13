'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, getCurrentUser } from '@/lib/api';

const APP_ID = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
const SDK_VERSION = 'v25.0';
const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const WHATSAPP_MANAGER_URL = 'https://business.facebook.com/wa/manage/home/';

/** Session events come from Facebook's signup popup; anything else posting a message is ignored. */
const FACEBOOK_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*facebook\.com$/;

type SyncKind = 'contacts' | 'history';
type Stage = 'idle' | 'signing-up' | 'connecting';

interface Connection {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber: string | null;
  isOnBizApp: boolean;
  platformType: string | null;
  status: 'ACTIVE' | 'DISCONNECTED';
  connectedAt: string;
  disconnectedAt: string | null;
  disconnectReason: string | null;
  syncDeadline: string;
  contactsSync: { requestId: string | null; startedAt: string | null };
  historySync: {
    requestId: string | null;
    startedAt: string | null;
    progress: number | null;
    declined: boolean;
  };
  lastSyncError: string | null;
}

interface SessionInfo {
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
}

interface FacebookSdk {
  init: (options: Record<string, unknown>) => void;
  login: (
    callback: (response: { authResponse?: { code?: string } | null }) => void,
    options: Record<string, unknown>,
  ) => void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadFacebookSdk(): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: SDK_VERSION });
      resolve();
    };

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Could not load the Facebook SDK.'));
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export default function AdminWhatsAppPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busySync, setBusySync] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The signup code (from FB.login) and the account ids (from the session
  // event) arrive separately and in either order; the code expires after about
  // 30 seconds, so the connection is submitted the moment both are present.
  const pending = useRef<{ code?: string; session?: SessionInfo; submitted?: boolean }>({});

  const isConfigured = Boolean(APP_ID && CONFIG_ID);

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
    api
      .get<Connection[]>('/admin/whatsapp-business')
      .then(setConnections)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load connections.'),
      )
      .finally(() => setLoading(false));
  }, [checked]);

  // Loaded ahead of the click: FB.login opens a popup, which browsers block
  // unless it is opened directly from the click itself.
  useEffect(() => {
    if (!checked || !isConfigured) return;
    loadFacebookSdk()
      .then(() => setSdkReady(true))
      .catch((err: Error) => setError(err.message));
  }, [checked, isConfigured]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const submitIfReady = useCallback(async () => {
    const { code, session, submitted } = pending.current;
    if (!code || !session || submitted) return;
    pending.current.submitted = true;

    setStage('connecting');
    try {
      const connection = await api.post<Connection>('/admin/whatsapp-business/connect', {
        code,
        phoneNumberId: session.phoneNumberId,
        wabaId: session.wabaId,
        ...(session.businessId ? { businessId: session.businessId } : {}),
      });
      setConnections((prev) => [connection, ...prev.filter((c) => c.id !== connection.id)]);
      setNotice(
        connection.isOnBizApp
          ? 'Connected. Contacts and chat history sync have been requested.'
          : 'Connected, but Meta reports this number is not on the WhatsApp Business app, so there is nothing to sync.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connecting the number failed.');
    } finally {
      pending.current = {};
      setStage('idle');
    }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!FACEBOOK_ORIGIN.test(event.origin)) return;

      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' || data.event === 'FINISH') {
        if (!data.data?.phone_number_id || !data.data?.waba_id) {
          setError('Signup finished without a phone number or account id.');
          setStage('idle');
          return;
        }
        pending.current.session = {
          phoneNumberId: String(data.data.phone_number_id),
          wabaId: String(data.data.waba_id),
          businessId: data.data.business_id ? String(data.data.business_id) : undefined,
        };
        void submitIfReady();
      } else if (data.event === 'CANCEL') {
        const step = data.data?.current_step;
        setError(`Signup was cancelled${step ? ` at "${step}"` : ''}.`);
        pending.current = {};
        setStage('idle');
      } else if (data.event === 'ERROR') {
        setError(data.data?.error_message || 'Signup reported an error.');
        pending.current = {};
        setStage('idle');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [submitIfReady]);

  const launchSignup = () => {
    if (!window.FB) return;
    setError(null);
    setNotice(null);
    pending.current = {};
    setStage('signing-up');

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          if (!pending.current.session) {
            setError('The signup window was closed before it finished.');
            setStage('idle');
          }
          return;
        }
        pending.current.code = code;
        void submitIfReady();
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    );
  };

  const retrySync = async (connectionId: string, kind: SyncKind) => {
    setBusySync(`${connectionId}:${kind}`);
    setError(null);
    try {
      const updated = await api.post<Connection>(
        `/admin/whatsapp-business/${connectionId}/sync/${kind}`,
      );
      setConnections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The sync request failed.');
    } finally {
      setBusySync(null);
    }
  };

  if (!checked || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-10 pt-6 text-white">
      <Link href="/admin" className="text-sm text-white/60 hover:text-white">
        &larr; Admin
      </Link>
      <h1 className="mt-2 text-3xl font-bold">WhatsApp Business number</h1>
      <p className="mt-2 text-sm text-white/60">
        Connect Zoorzio&apos;s WhatsApp Business app number to the Cloud API. The number keeps
        working in the WhatsApp Business app on your phone, and Zoorzio sends and receives on it
        too.
      </p>

      {error && <div className="glass-card mt-5 px-4 py-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="glass-card mt-5 px-4 py-3 text-sm text-green-200">{notice}</div>}

      <div className="glass-card mt-6 p-6">
        <h2 className="text-lg font-semibold">Before you connect</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/70">
          <li>Your Meta app must be approved as a Tech Provider.</li>
          <li>The phone must be running WhatsApp Business app version 2.24.17 or later.</li>
          <li>
            The app&apos;s webhook must be subscribed to <code>messages</code>, <code>history</code>
            , <code>smb_app_state_sync</code>, <code>smb_message_echoes</code> and{' '}
            <code>account_update</code>.
          </li>
          <li>This page must be served over HTTPS for the Facebook signup window to open.</li>
          <li>
            Contacts and chat history must sync within 24 hours of connecting - Zoorzio requests
            both immediately.
          </li>
        </ul>

        {!isConfigured ? (
          <p className="mt-5 text-sm text-amber-200">
            Set <code>NEXT_PUBLIC_WHATSAPP_APP_ID</code> and{' '}
            <code>NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID</code> to enable connecting.
          </p>
        ) : (
          <button
            onClick={launchSignup}
            disabled={!sdkReady || stage !== 'idle'}
            className="mt-5 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/30 disabled:opacity-50"
          >
            {stage === 'signing-up'
              ? 'Waiting for signup to finish…'
              : stage === 'connecting'
                ? 'Connecting…'
                : sdkReady
                  ? 'Connect WhatsApp Business app number'
                  : 'Loading Facebook…'}
          </button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {connections.length === 0 ? (
          <div className="glass-card p-6 text-sm text-white/60">
            No number has been connected yet.
          </div>
        ) : (
          connections.map((connection) => {
            const deadline = new Date(connection.syncDeadline).getTime();
            const withinDeadline = connection.status === 'ACTIVE' && now < deadline;
            const hoursLeft = Math.floor((deadline - now) / 3_600_000);
            const minutesLeft = Math.floor(((deadline - now) % 3_600_000) / 60_000);

            return (
              <div key={connection.id} className="glass-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">
                      {connection.displayPhoneNumber
                        ? `+${connection.displayPhoneNumber}`
                        : connection.phoneNumberId}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      Phone number ID {connection.phoneNumberId} · WABA {connection.wabaId}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      connection.status === 'ACTIVE' ? 'bg-green-400/25' : 'bg-white/15'
                    }`}
                  >
                    {connection.status === 'ACTIVE' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <Detail
                    label="On WhatsApp Business app"
                    value={connection.isOnBizApp ? 'Yes' : 'No'}
                  />
                  <Detail
                    label="Connected"
                    value={new Date(connection.connectedAt).toLocaleString()}
                  />
                  {connection.status === 'DISCONNECTED' && (
                    <Detail
                      label="Disconnected"
                      value={`${connection.disconnectedAt ? new Date(connection.disconnectedAt).toLocaleString() : ''}${
                        connection.disconnectReason ? ` (${connection.disconnectReason})` : ''
                      }`}
                    />
                  )}
                </dl>

                {connection.isOnBizApp && (
                  <div className="mt-5 space-y-3">
                    <SyncRow
                      label="Contacts sync"
                      startedAt={connection.contactsSync.startedAt}
                      canRetry={withinDeadline && !connection.contactsSync.startedAt}
                      busy={busySync === `${connection.id}:contacts`}
                      onRetry={() => retrySync(connection.id, 'contacts')}
                    />
                    <SyncRow
                      label="Chat history sync"
                      startedAt={connection.historySync.startedAt}
                      detail={
                        connection.historySync.declined
                          ? 'History sharing is turned off in the WhatsApp Business app'
                          : connection.historySync.progress !== null
                            ? `${connection.historySync.progress}% received`
                            : undefined
                      }
                      canRetry={withinDeadline && !connection.historySync.startedAt}
                      busy={busySync === `${connection.id}:history`}
                      onRetry={() => retrySync(connection.id, 'history')}
                    />
                    {withinDeadline &&
                      (!connection.contactsSync.startedAt || !connection.historySync.startedAt) && (
                        <p className="text-xs text-amber-200">
                          {hoursLeft}h {minutesLeft}m left to start the remaining sync before Meta
                          disconnects the number.
                        </p>
                      )}
                    {connection.lastSyncError && (
                      <p className="text-xs text-red-200">
                        Last sync error: {connection.lastSyncError}
                      </p>
                    )}
                  </div>
                )}

                {connection.status === 'ACTIVE' && (
                  <p className="mt-5 text-xs text-white/50">
                    Onboarding completes once a payment method is added in{' '}
                    <a
                      href={WHATSAPP_MANAGER_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      WhatsApp Manager
                    </a>
                    .
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-white/50">{label}</dt>
      <dd className="text-white/90">{value}</dd>
    </div>
  );
}

function SyncRow({
  label,
  startedAt,
  detail,
  canRetry,
  busy,
  onRetry,
}: {
  label: string;
  startedAt: string | null;
  detail?: string;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-white/50">
          {startedAt ? `Requested ${new Date(startedAt).toLocaleString()}` : 'Not requested'}
          {detail ? ` · ${detail}` : ''}
        </p>
      </div>
      {canRetry && (
        <button
          onClick={onRetry}
          disabled={busy}
          className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 disabled:opacity-50"
        >
          {busy ? '…' : 'Request now'}
        </button>
      )}
    </div>
  );
}
