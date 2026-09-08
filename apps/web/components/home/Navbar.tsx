'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#channels', label: 'Channels' },
  { href: '#your-bots', label: 'Your bots' },
  { href: '#pricing', label: 'Pricing' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky inset-x-0 top-0 z-50 flex justify-center px-4 py-4 sm:px-6"
    >
      <div
        className="flex w-full max-w-6xl items-center justify-between rounded-full border px-4 py-3 backdrop-blur-xl transition-all duration-500 sm:px-6"
        style={
          scrolled
            ? {
                background: 'rgba(5, 7, 18, 0.75)',
                borderColor: 'rgba(168, 85, 247, 0.18)',
                boxShadow: '0 8px 32px -12px rgba(0,0,0,0.5)',
              }
            : { background: 'transparent', borderColor: 'transparent' }
        }
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/zoorzio-icon.png"
            alt="Zoorzio"
            width={30}
            height={30}
            className="rounded-full object-cover"
          />
          <span className="text-lg font-bold tracking-tight text-[#EDE9FE]">Zoorzio</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm text-[#A5A3B8] transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          <Link
            href="/login"
            className="hidden items-center rounded-full border px-5 py-2 text-sm font-medium text-[#EDE9FE] transition-colors hover:bg-white/5 sm:inline-flex"
            style={{ borderColor: 'rgba(168, 85, 247, 0.25)' }}
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=register"
            className="home-btn-primary inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            Sign up
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
