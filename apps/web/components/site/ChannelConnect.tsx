'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ApiError, channelsApi } from '@/lib/api';
import type { SiteChannel } from '@/lib/site-content';
import { useAuthed } from './useAuthed';

/**
 * Signed-out visitors go to sign-up. Signed-in users get a real link code from the API
 * and are sent straight to WhatsApp or Telegram to finish linking.
 */
export function ChannelConnect({ channel }: { channel: SiteChannel }) {
  const authed = useAuthed();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!authed) {
    return (
      <Link href="/login?mode=register" className="zs-btn zs-btn--grad">
        Get started on {channel.name} <ArrowRight size={20} />
      </Link>
    );
  }

  if (channel.slug === 'web') {
    return (
      <Link href="/portal" className="zs-btn zs-btn--grad">
        Open the web app <ArrowRight size={20} />
      </Link>
    );
  }

  const connect = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (channel.slug === 'whatsapp') {
        const result = await channelsApi.linkWhatsApp();
        if (result.configured && result.waLink) {
          window.open(result.waLink, '_blank', 'noopener,noreferrer');
          setNote('WhatsApp opened in a new tab - send the prepared message to finish linking.');
        } else {
          setNote(`WhatsApp linking isn’t switched on yet. Your link code is ${result.code}.`);
        }
      } else {
        const result = await channelsApi.linkTelegram();
        if (result.configured && result.deepLink) {
          window.open(result.deepLink, '_blank', 'noopener,noreferrer');
          setNote('Telegram opened in a new tab - press Start in the bot to finish linking.');
        } else {
          setNote('Telegram linking isn’t switched on yet. Please try again later.');
        }
      }
    } catch (err) {
      setNote(
        err instanceof ApiError
          ? err.message
          : `Couldn’t create a ${channel.name} link. Please try again.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="zs-btn zs-btn--grad" onClick={connect} disabled={busy}>
        {busy ? 'Creating your link…' : `Link ${channel.name}`} <ArrowRight size={20} />
      </button>
      {note && <p className="mt-4 max-w-[440px] text-[15px] text-[#5b5670]">{note}</p>}
    </div>
  );
}
