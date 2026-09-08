'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Send, Hash, Slack, Mail } from 'lucide-react';
import {
  ApiError,
  channelCredentialsApi,
  type ChannelCredential,
  type ChannelCredentialType,
} from '@/lib/api';

interface PlatformConfig {
  type: ChannelCredentialType;
  label: string;
  icon: React.ReactNode;
  tokenLabel: string;
  needsSecondaryToken?: string; // label for the second field, if the platform needs one
  needsFromEmail?: boolean;
  needsPhoneNumberId?: boolean;
  instructions: string[];
}

const PLATFORMS: PlatformConfig[] = [
  {
    type: 'telegram',
    label: 'Telegram',
    icon: <Send size={16} />,
    tokenLabel: 'Bot token',
    instructions: [
      'Open Telegram and message @BotFather',
      'Send /newbot and follow the prompts',
      'Copy the token BotFather gives you and paste it below',
    ],
  },
  {
    type: 'slack',
    label: 'Slack',
    icon: <Slack size={16} />,
    tokenLabel: 'Bot token (xoxb-...)',
    needsSecondaryToken: 'Signing secret',
    instructions: [
      'Create an app at api.slack.com/apps in your own workspace',
      'Copy its Bot User OAuth Token (xoxb-...) and Signing Secret, and save them below',
      'A Request URL will appear here once saved - paste it into your app under Event Subscriptions',
      'Subscribe to the message.im bot event, then install the app to your workspace',
    ],
  },
  {
    type: 'discord',
    label: 'Discord',
    icon: <Hash size={16} />,
    tokenLabel: 'Bot token',
    instructions: [
      'Create an application at discord.com/developers/applications',
      'Add a bot to it and copy its token',
      'Paste the token below',
    ],
  },
  {
    type: 'email',
    label: 'SendGrid',
    icon: <Mail size={16} />,
    tokenLabel: 'API key',
    needsFromEmail: true,
    instructions: [
      'Create an API key in your SendGrid account',
      'Verify a sender identity (the "from" address you want emails sent from)',
      'Paste the API key and that address below',
    ],
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    icon: <MessageCircle size={16} />,
    tokenLabel: 'Business API access token',
    needsPhoneNumberId: true,
    instructions: [
      'Requires a Meta-verified WhatsApp Business API account',
      'Most personal accounts won’t have this - skip it unless you already have Business API access',
      'Copy the access token and phone number ID from your Meta app dashboard',
    ],
  },
];

const STATUS_STYLE: Record<ChannelCredential['status'], string> = {
  ACTIVE: 'text-green-300',
  PENDING: 'text-yellow-300',
  INVALID: 'text-red-300',
  DISCONNECTED: 'text-white/50',
};

export function ChannelCredentialPanel() {
  const [credentials, setCredentials] = useState<Record<string, ChannelCredential>>({});
  const [expanded, setExpanded] = useState<ChannelCredentialType | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [secondaryInput, setSecondaryInput] = useState('');
  const [fromEmailInput, setFromEmailInput] = useState('');
  const [phoneNumberIdInput, setPhoneNumberIdInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const load = () => {
    channelCredentialsApi
      .list()
      .then((list) => {
        const byType: Record<string, ChannelCredential> = {};
        for (const c of list) byType[c.type] = c;
        setCredentials(byType);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setTokenInput('');
    setSecondaryInput('');
    setFromEmailInput('');
    setPhoneNumberIdInput('');
  };

  const handleSave = async (platform: PlatformConfig) => {
    if (!tokenInput.trim()) {
      setError('Enter a token first');
      return;
    }
    setBusy(platform.type);
    setError(null);
    try {
      await channelCredentialsApi.save(platform.type, {
        token: tokenInput.trim(),
        secondaryToken: secondaryInput.trim() || undefined,
        fromEmail: fromEmailInput.trim() || undefined,
        phoneNumberId: phoneNumberIdInput.trim() || undefined,
      });
      resetForm();
      setExpanded(null);
      load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Failed to save ${platform.label} credential`,
      );
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async (platform: PlatformConfig) => {
    setBusy(`test-${platform.type}`);
    setTestResult((prev) => ({ ...prev, [platform.type]: '' }));
    try {
      const result = await channelCredentialsApi.test(platform.type);
      setTestResult((prev) => ({
        ...prev,
        [platform.type]: result.success ? 'Connected successfully' : result.error || 'Test failed',
      }));
      load();
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [platform.type]: err instanceof ApiError ? err.message : 'Test failed',
      }));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (platform: PlatformConfig) => {
    if (
      !confirm(
        `Remove your ${platform.label} bot? It will stop receiving and sending messages for your account.`,
      )
    )
      return;
    setBusy(`remove-${platform.type}`);
    try {
      await channelCredentialsApi.remove(platform.type);
      load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Failed to remove ${platform.label} credential`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="mb-1 text-lg font-semibold">Bring your own bot</h2>
      <p className="mb-4 text-xs text-white/60">
        Connect your own Telegram, Discord, or Slack bot, or your own SendGrid key, instead of using
        Zoorzio&apos;s shared bots. Your bot only ever handles messages for your account.
      </p>

      {error && <p className="mb-3 text-sm text-red-200">{error}</p>}

      <div className="space-y-2">
        {PLATFORMS.map((platform) => {
          const credential = credentials[platform.type.toUpperCase()];
          const isExpanded = expanded === platform.type;

          return (
            <div key={platform.type} className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {platform.icon}
                  <div>
                    <p className="text-sm font-medium">{platform.label}</p>
                    {credential ? (
                      <p className={`text-xs ${STATUS_STYLE[credential.status]}`}>
                        {credential.status}
                      </p>
                    ) : (
                      <p className="text-xs text-white/50">Not connected</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {credential && (
                    <>
                      <button
                        onClick={() => handleTest(platform)}
                        disabled={busy === `test-${platform.type}`}
                        className="text-xs text-white/60 hover:text-white"
                      >
                        {busy === `test-${platform.type}` ? 'Testing…' : 'Test'}
                      </button>
                      <button
                        onClick={() => handleRemove(platform)}
                        disabled={busy === `remove-${platform.type}`}
                        className="text-xs text-white/50 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setExpanded(isExpanded ? null : platform.type);
                      setError(null);
                      resetForm();
                    }}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    {credential ? 'Replace' : 'Connect'}
                  </button>
                </div>
              </div>

              {credential?.webhookUrl && (
                <div className="mt-2 text-xs">
                  <p className="mb-1 text-white/50">
                    Paste this into your Slack app&apos;s Event Subscriptions &rarr; Request URL:
                  </p>
                  <code className="block break-all rounded-lg bg-black/30 px-2 py-1.5 text-white/80">
                    {credential.webhookUrl}
                  </code>
                </div>
              )}

              {credential?.status === 'INVALID' && credential.lastError && (
                <p className="mt-2 text-xs text-red-300">{credential.lastError}</p>
              )}

              {testResult[platform.type] && (
                <p className="mt-2 text-xs text-white/60">{testResult[platform.type]}</p>
              )}

              {isExpanded && (
                <div className="mt-3 border-t border-white/10 pt-3 text-xs">
                  <ol className="mb-3 list-inside list-decimal space-y-1 text-white/60">
                    {platform.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>

                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder={platform.tokenLabel}
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="w-full rounded-lg bg-white/10 px-3 py-2 text-white outline-none placeholder:text-white/40"
                    />
                    {platform.needsSecondaryToken && (
                      <input
                        type="password"
                        placeholder={platform.needsSecondaryToken}
                        value={secondaryInput}
                        onChange={(e) => setSecondaryInput(e.target.value)}
                        className="w-full rounded-lg bg-white/10 px-3 py-2 text-white outline-none placeholder:text-white/40"
                      />
                    )}
                    {platform.needsPhoneNumberId && (
                      <input
                        type="text"
                        placeholder="Phone number ID"
                        value={phoneNumberIdInput}
                        onChange={(e) => setPhoneNumberIdInput(e.target.value)}
                        className="w-full rounded-lg bg-white/10 px-3 py-2 text-white outline-none placeholder:text-white/40"
                      />
                    )}
                    {platform.needsFromEmail && (
                      <input
                        type="email"
                        placeholder="Verified sender email"
                        value={fromEmailInput}
                        onChange={(e) => setFromEmailInput(e.target.value)}
                        className="w-full rounded-lg bg-white/10 px-3 py-2 text-white outline-none placeholder:text-white/40"
                      />
                    )}
                    <button
                      onClick={() => handleSave(platform)}
                      disabled={busy === platform.type}
                      className="glass-btn-primary text-xs"
                    >
                      {busy === platform.type ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
