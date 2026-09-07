'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Send, Hash, Slack } from 'lucide-react';
import { ApiError, channelsApi, type LinkedChannel } from '@/lib/api';

const CHANNEL_META: Record<LinkedChannel['type'], { label: string; icon: React.ReactNode }> = {
  WHATSAPP: { label: 'WhatsApp', icon: <MessageCircle size={16} /> },
  TELEGRAM: { label: 'Telegram', icon: <Send size={16} /> },
  SMS: { label: 'SMS', icon: <MessageCircle size={16} /> },
  DISCORD: { label: 'Discord', icon: <Hash size={16} /> },
  SLACK: { label: 'Slack', icon: <Slack size={16} /> },
};

interface ChannelLinkPanelProps {
  title?: string;
  description?: string;
  showUnlink?: boolean;
}

export function ChannelLinkPanel({
  title = 'Connect messaging channels',
  description = "Link WhatsApp, Telegram, SMS, Discord, or Slack so anything you send there gets saved to your Zoorzio account.",
  showUnlink = true,
}: ChannelLinkPanelProps) {
  const [linkedChannels, setLinkedChannels] = useState<LinkedChannel[]>([]);
  const [whatsappLink, setWhatsappLink] = useState<{ code: string; waLink: string | null; configured: boolean } | null>(null);
  const [telegramLink, setTelegramLink] = useState<{ deepLink: string | null; configured: boolean } | null>(null);
  const [smsLink, setSmsLink] = useState<{ code: string; smsLink: string | null; configured: boolean } | null>(null);
  const [discordLink, setDiscordLink] = useState<{ code: string; configured: boolean } | null>(null);
  const [slackLink, setSlackLink] = useState<{ code: string; configured: boolean } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);

  const loadLinkedChannels = () => {
    channelsApi.listLinked().then(setLinkedChannels).catch(() => undefined);
  };

  useEffect(() => {
    loadLinkedChannels();
  }, []);

  const handleLink = async (platform: string, fn: () => Promise<any>, setResult: (r: any) => void) => {
    setLinking(platform);
    setChannelError(null);
    try {
      setResult(await fn());
    } catch (err) {
      setChannelError(err instanceof ApiError ? err.message : `Failed to generate a ${platform} link`);
    } finally {
      setLinking(null);
    }
  };

  const handleUnlinkChannel = async (id: string) => {
    if (!confirm('Unlink this channel? Messages from it will stop being saved to your account.')) return;
    try {
      await channelsApi.unlink(id);
      loadLinkedChannels();
    } catch (err) {
      setChannelError(err instanceof ApiError ? err.message : 'Failed to unlink channel');
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-semibold text-lg mb-1">{title}</h2>
      <p className="text-xs text-white/60 mb-4">{description}</p>

      {channelError && <p className="text-red-200 text-sm mb-3">{channelError}</p>}

      {linkedChannels.length > 0 && (
        <div className="space-y-2 mb-4">
          {linkedChannels.map((ch) => (
            <div key={ch.id} className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {CHANNEL_META[ch.type].icon}
                <div>
                  <p className="text-sm font-medium">{CHANNEL_META[ch.type].label}</p>
                  <p className="text-xs text-white/60">{ch.name || ch.externalId}</p>
                </div>
              </div>
              {showUnlink && (
                <button onClick={() => handleUnlinkChannel(ch.id)} className="text-xs text-white/50 hover:text-red-200">
                  Unlink
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleLink('WhatsApp', channelsApi.linkWhatsApp, setWhatsappLink)}
          disabled={linking === 'WhatsApp'}
          className="glass-btn-pill text-xs"
        >
          <MessageCircle size={14} className="mr-1.5 inline" />
          {linking === 'WhatsApp' ? 'Generating…' : 'Link WhatsApp'}
        </button>
        <button
          onClick={() => handleLink('Telegram', channelsApi.linkTelegram, setTelegramLink)}
          disabled={linking === 'Telegram'}
          className="glass-btn-pill text-xs"
        >
          <Send size={14} className="mr-1.5 inline" />
          {linking === 'Telegram' ? 'Generating…' : 'Link Telegram'}
        </button>
        <button
          onClick={() => handleLink('SMS', channelsApi.linkSms, setSmsLink)}
          disabled={linking === 'SMS'}
          className="glass-btn-pill text-xs"
        >
          <MessageCircle size={14} className="mr-1.5 inline" />
          {linking === 'SMS' ? 'Generating…' : 'Link SMS'}
        </button>
        <button
          onClick={() => handleLink('Discord', channelsApi.linkDiscord, setDiscordLink)}
          disabled={linking === 'Discord'}
          className="glass-btn-pill text-xs"
        >
          <Hash size={14} className="mr-1.5 inline" />
          {linking === 'Discord' ? 'Generating…' : 'Link Discord'}
        </button>
        <button
          onClick={() => handleLink('Slack', channelsApi.linkSlack, setSlackLink)}
          disabled={linking === 'Slack'}
          className="glass-btn-pill text-xs"
        >
          <Slack size={14} className="mr-1.5 inline" />
          {linking === 'Slack' ? 'Generating…' : 'Link Slack'}
        </button>
      </div>

      {whatsappLink && (
        <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 text-sm">
          {whatsappLink.configured ? (
            <>
              <p className="mb-2">Tap below to send us the code from WhatsApp:</p>
              <a href={whatsappLink.waLink!} target="_blank" rel="noreferrer" className="glass-btn-primary inline-block">
                Open WhatsApp
              </a>
            </>
          ) : (
            <p className="text-white/70 text-xs">
              WhatsApp linking isn&apos;t configured on this server yet. Your code is <strong>{whatsappLink.code}</strong>.
            </p>
          )}
        </div>
      )}

      {telegramLink && (
        <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 text-sm">
          {telegramLink.configured ? (
            <>
              <p className="mb-2">Tap below to link your Telegram account:</p>
              <a href={telegramLink.deepLink!} target="_blank" rel="noreferrer" className="glass-btn-primary inline-block">
                Open Telegram
              </a>
            </>
          ) : (
            <p className="text-white/70 text-xs">Telegram linking isn&apos;t configured on this server yet.</p>
          )}
        </div>
      )}

      {smsLink && (
        <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 text-sm">
          {smsLink.configured ? (
            <>
              <p className="mb-2">Tap below to text us the code:</p>
              <a href={smsLink.smsLink!} className="glass-btn-primary inline-block">
                Open Messages
              </a>
            </>
          ) : (
            <p className="text-white/70 text-xs">
              SMS linking isn&apos;t configured on this server yet. Your code is <strong>{smsLink.code}</strong>.
            </p>
          )}
        </div>
      )}

      {discordLink && (
        <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 text-sm">
          {discordLink.configured ? (
            <p className="text-white/80">
              DM our Discord bot with: <strong>LINK {discordLink.code}</strong>
            </p>
          ) : (
            <p className="text-white/70 text-xs">Discord linking isn&apos;t configured on this server yet.</p>
          )}
        </div>
      )}

      {slackLink && (
        <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 text-sm">
          {slackLink.configured ? (
            <p className="text-white/80">
              DM our Slack app with: <strong>LINK {slackLink.code}</strong>
            </p>
          ) : (
            <p className="text-white/70 text-xs">Slack linking isn&apos;t configured on this server yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
