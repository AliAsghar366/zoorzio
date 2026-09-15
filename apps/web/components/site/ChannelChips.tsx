import Image from 'next/image';
import Link from 'next/link';
import { Globe } from 'lucide-react';

export function ChannelChips({ size = 26 }: { size?: number }) {
  const style = { width: size, height: size };

  return (
    <span className="inline-flex items-center gap-2">
      <Link href="/channel/whatsapp" className="zs-icon-chip" style={style} aria-label="WhatsApp">
        <Image src="/z/icon-whatsapp.webp" alt="" width={size} height={size} />
      </Link>
      <Link href="/channel/telegram" className="zs-icon-chip" style={style} aria-label="Telegram">
        <Image src="/z/icon-telegram.webp" alt="" width={size} height={size} />
      </Link>
      <Link href="/channel/web" className="zs-icon-chip" style={style} aria-label="Web app">
        <Globe size={Math.round(size * 0.62)} className="text-[#6a6fd8]" />
      </Link>
    </span>
  );
}
