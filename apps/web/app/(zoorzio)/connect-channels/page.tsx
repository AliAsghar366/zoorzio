'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChannelLinkPanel } from '@/components/ChannelLinkPanel';

export default function ConnectChannelsPage() {
  const router = useRouter();

  return (
    <div className="max-w-xl mx-auto px-6 pt-6 pb-10 text-white">
      <div className="flex flex-col items-center text-center mb-6">
        <Image src="/zoorzio-icon.png" alt="Zoorzio mascot" width={56} height={56} className="mascot-float" />
        <h1 className="text-3xl font-bold mt-3">Connect your channels</h1>
        <p className="text-white/70 text-sm mt-2 max-w-md">
          Welcome to Zoorzio! Optionally link WhatsApp, Telegram, SMS, Discord, or Slack now so anything
          you send there is remembered too. You can always do this later from your Profile.
        </p>
      </div>

      <ChannelLinkPanel showUnlink={false} />

      <button onClick={() => router.push('/portal')} className="glass-btn-primary w-full mt-6">
        Continue to Zoorzio
      </button>
    </div>
  );
}
