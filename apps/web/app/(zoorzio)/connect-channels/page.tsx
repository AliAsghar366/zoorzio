'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChannelLinkPanel } from '@/components/ChannelLinkPanel';
import { ChannelCredentialPanel } from '@/components/ChannelCredentialPanel';

export default function ConnectChannelsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-xl px-6 pb-10 pt-6 text-white">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image
          src="/zoorzio-icon.png"
          alt="Zoorzio mascot"
          width={56}
          height={56}
          className="mascot-float"
        />
        <h1 className="mt-3 text-3xl font-bold">Connect your channels</h1>
        <p className="mt-2 max-w-md text-sm text-white/70">
          Welcome to Zoorzio! Optionally link WhatsApp, Telegram, SMS, Discord, or Slack now so
          anything you send there is remembered too. You can always do this later from your Profile.
        </p>
      </div>

      <ChannelLinkPanel showUnlink={false} />

      <div className="mt-4">
        <ChannelCredentialPanel />
      </div>

      <button onClick={() => router.push('/portal')} className="glass-btn-primary mt-6 w-full">
        Continue to Zoorzio
      </button>
    </div>
  );
}
