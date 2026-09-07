'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative border-t py-10 px-4 sm:px-6" style={{ background: '#040610', borderColor: 'rgba(168, 85, 247, 0.12)' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <Image src="/zoorzio-icon.png" alt="Zoorzio" width={22} height={22} className="rounded-full object-cover" />
            <span className="text-sm font-semibold text-[#D8D4E5]">Zoorzio</span>
          </div>
          <p className="text-xs text-[#77738A]">© {new Date().getFullYear()} Zoorzio — the memory layer that actually remembers.</p>
        </div>

        {/* Terms/Contact pages don't exist yet - shown as labels, not links, so nothing points to a fake destination. */}
        <div className="flex items-center gap-5 text-xs text-[#A5A0B8]">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <span>Terms</span>
          <span>Contact</span>
        </div>
      </div>
    </footer>
  );
}
