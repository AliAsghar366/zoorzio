'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SiGithub, SiNotion, SiGooglecalendar, SiGoogle } from 'react-icons/si';
import { BsMicrosoft } from 'react-icons/bs';
import { Slack, Star } from 'lucide-react';
import {
  api,
  ApiError,
  integrationsApi,
  type IntegrationCard,
  type GitHubRepo,
  type GitHubIssue,
  type NotionPage,
  type GmailMessage,
  type DriveFile,
  type SlackChannel,
} from '@/lib/api';

const CATEGORIES = ['All', 'Active', 'Documents', 'Calendar', 'Email', 'Team Chat'] as const;
type Category = (typeof CATEGORIES)[number];

const CALENDAR_KEYS = new Set(['google_calendar', 'outlook_calendar']);
const PANEL_PROVIDERS = new Set(['github', 'notion', 'google_workspace', 'slack']);

const PROVIDER_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  github: SiGithub,
  notion: SiNotion,
  slack: Slack,
  google_calendar: SiGooglecalendar,
  outlook_calendar: BsMicrosoft,
  google_workspace: SiGoogle,
};

function IntegrationsPageInner() {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<IntegrationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = () => integrationsApi.list().then(setCards);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    if (provider && status) {
      setBanner(
        status === 'connected'
          ? { ok: true, text: `${provider} connected!` }
          : { ok: false, text: `${provider} connection failed: ${message || 'unknown error'}` },
      );
      window.history.replaceState(null, '', '/integrations');
      load();
    }
  }, [searchParams]);

  const handleConnect = async (card: IntegrationCard) => {
    setBusyKey(card.key);
    setBanner(null);
    try {
      const url = CALENDAR_KEYS.has(card.key)
        ? (await api.get<{ url: string }>(`/calendar/${card.key === 'google_calendar' ? 'google' : 'outlook'}/authorize`)).url
        : (await integrationsApi.authorize(providerFor(card.key))).url;
      window.location.href = url;
    } catch (err) {
      setBanner({ ok: false, text: err instanceof ApiError ? err.message : `Failed to start ${card.name} connection` });
      setBusyKey(null);
    }
  };

  const handleDisconnect = async (card: IntegrationCard) => {
    if (!confirm(`Disconnect ${card.name}?`)) return;
    setBusyKey(card.key);
    try {
      await integrationsApi.disconnect(card.key);
      await load();
    } catch (err) {
      setBanner({ ok: false, text: err instanceof ApiError ? err.message : `Failed to disconnect ${card.name}` });
    } finally {
      setBusyKey(null);
    }
  };

  const visible = useMemo(() => {
    let list = cards;
    if (category === 'Active') list = list.filter((c) => c.isConnected);
    else if (category !== 'All') list = list.filter((c) => c.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    return list;
  }, [cards, category, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="text-white pb-4">
      <h1 className="text-3xl font-bold">Integrations</h1>
      <p className="text-white/60 text-sm mt-1">Connect your favorite tools and boost your productivity.</p>

      {banner && <div className={`dashboard-card p-4 mt-4 text-sm ${banner.ok ? 'text-green-300' : 'text-red-300'}`}>{banner.text}</div>}

      <div className="flex gap-2 mt-4 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={category === c ? 'dashboard-pill active text-xs py-1.5 px-3' : 'dashboard-pill text-xs py-1.5 px-3'}>
            {c}
          </button>
        ))}
      </div>

      <input placeholder="Search integrations" value={search} onChange={(e) => setSearch(e.target.value)} className="dashboard-input mt-4" />

      <div className="space-y-3 mt-4">
        {visible.map((card) => {
          const hasDataPanel = card.isConnected && PANEL_PROVIDERS.has(card.key);
          return (
            <div key={card.key} className="dashboard-card overflow-hidden">
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ac84cc] to-[#dc8cc5] flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = PROVIDER_ICONS[card.key];
                      return Icon ? <Icon size={18} className="text-white" /> : <span className="text-xs font-bold">{card.name.slice(0, 2).toUpperCase()}</span>;
                    })()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{card.name}</p>
                      {card.isConnected && <span className="dashboard-pill text-[10px] py-0.5 px-2 cursor-default shrink-0">Connected</span>}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{card.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasDataPanel && (
                    <button
                      onClick={() => setExpandedKey((k) => (k === card.key ? null : card.key))}
                      className="dashboard-pill text-xs py-2 px-4"
                    >
                      {expandedKey === card.key ? 'Hide' : 'View'}
                    </button>
                  )}
                  <button
                    onClick={() => (card.isConnected ? handleDisconnect(card) : handleConnect(card))}
                    disabled={busyKey === card.key}
                    className="dashboard-pill text-xs py-2 px-4"
                  >
                    {busyKey === card.key ? '…' : card.isConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>
              {hasDataPanel && expandedKey === card.key && <IntegrationDataPanel providerKey={card.key} />}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="dashboard-card p-8 text-center">
            <p className="text-white/50 text-sm">No integrations match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function providerFor(key: string): 'github' | 'notion' | 'google_workspace' | 'slack' {
  return key as 'github' | 'notion' | 'google_workspace' | 'slack';
}

function IntegrationDataPanel({ providerKey }: { providerKey: string }) {
  return (
    <div className="border-t border-white/10 p-5 bg-white/5">
      {providerKey === 'github' && <GitHubPanel />}
      {providerKey === 'notion' && <NotionPanel />}
      {providerKey === 'google_workspace' && <GoogleWorkspacePanel />}
      {providerKey === 'slack' && <SlackPanel />}
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return <p className="text-xs text-red-300">{message}</p>;
}

function PanelLoading() {
  return <p className="text-xs text-white/40">Loading…</p>;
}

function GitHubPanel() {
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([integrationsApi.githubRepos(), integrationsApi.githubIssues()])
      .then(([r, i]) => {
        setRepos(r);
        setIssues(i);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load GitHub data'));
  }, []);

  if (error) return <PanelError message={error} />;
  if (!repos || !issues) return <PanelLoading />;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-white/70 mb-2">Your repositories</h3>
        {repos.length === 0 ? (
          <p className="text-xs text-white/40">No repositories found.</p>
        ) : (
          <div className="space-y-1.5">
            {repos.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10">
                <span className="text-sm truncate">{r.fullName}</span>
                <span className="flex items-center gap-1 text-xs text-white/50 shrink-0"><Star size={12} /> {r.stars}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-white/70 mb-2">Open issues assigned to you</h3>
        {issues.length === 0 ? (
          <p className="text-xs text-white/40">Nothing assigned to you right now.</p>
        ) : (
          <div className="space-y-1.5">
            {issues.map((i) => (
              <a key={i.id} href={i.url} target="_blank" rel="noreferrer" className="block bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10">
                <span className="text-sm block truncate">{i.title}</span>
                <span className="text-xs text-white/40">{i.repo} #{i.number}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotionPanel() {
  const [pages, setPages] = useState<NotionPage[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const search = (q?: string) => {
    integrationsApi
      .notionSearch(q)
      .then(setPages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to search Notion'));
  };

  useEffect(() => {
    search();
  }, []);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
          placeholder="Search your Notion pages"
          className="dashboard-input flex-1 !py-1.5 !text-sm"
        />
        <button onClick={() => search(query)} className="dashboard-pill text-xs px-4">
          Search
        </button>
      </div>
      {error && <PanelError message={error} />}
      {!error && !pages && <PanelLoading />}
      {pages && pages.length === 0 && (
        <p className="text-xs text-white/40">
          Nothing found. Notion only shows pages you&apos;ve explicitly shared with the Zoorzio integration — open a page in
          Notion, click Share, and add &quot;Zoorzio&quot;.
        </p>
      )}
      {pages && pages.length > 0 && (
        <div className="space-y-1.5">
          {pages.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10">
              <span className="text-sm truncate">{p.title}</span>
              <span className="text-[10px] text-white/40 shrink-0 ml-2">{p.object}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function GoogleWorkspacePanel() {
  const [emails, setEmails] = useState<GmailMessage[] | null>(null);
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([integrationsApi.googleWorkspaceEmails(), integrationsApi.googleWorkspaceFiles()])
      .then(([e, f]) => {
        setEmails(e);
        setFiles(f);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load Google Workspace data'));
  }, []);

  if (error) return <PanelError message={error} />;
  if (!emails || !files) return <PanelLoading />;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-white/70 mb-2">Recent emails</h3>
        {emails.length === 0 ? (
          <p className="text-xs text-white/40">No recent emails.</p>
        ) : (
          <div className="space-y-1.5">
            {emails.map((m) => (
              <div key={m.id} className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-sm truncate">{m.subject}</p>
                <p className="text-xs text-white/40 truncate">{m.from}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-white/70 mb-2">Recent Drive files</h3>
        {files.length === 0 ? (
          <p className="text-xs text-white/40">No recent files.</p>
        ) : (
          <div className="space-y-1.5">
            {files.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10">
                <span className="text-sm truncate block">{f.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlackPanel() {
  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    integrationsApi
      .slackChannels()
      .then((c) => {
        setChannels(c);
        if (c.length > 0) setSelectedChannel(c[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load Slack channels'));
  }, []);

  const send = async () => {
    if (!selectedChannel || !message.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await integrationsApi.slackSend(selectedChannel, message.trim());
      setNotice('Message sent!');
      setMessage('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (error && !channels) return <PanelError message={error} />;
  if (!channels) return <PanelLoading />;

  return (
    <div>
      <h3 className="text-xs font-semibold text-white/70 mb-2">Send a message to a channel</h3>
      {channels.length === 0 ? (
        <p className="text-xs text-white/40">No channels found — invite the Zoorzio app to a channel first.</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="dashboard-input !py-1.5 !text-sm !w-auto">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Message"
            className="dashboard-input flex-1 !py-1.5 !text-sm min-w-[140px]"
          />
          <button onClick={send} disabled={sending} className="dashboard-pill-primary text-xs px-4">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {notice && <p className="text-xs text-green-300 mt-2">{notice}</p>}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
        </div>
      }
    >
      <IntegrationsPageInner />
    </Suspense>
  );
}
