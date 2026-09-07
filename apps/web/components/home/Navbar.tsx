'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#channels', label: 'Channels' },
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
      className="sticky top-0 inset-x-0 z-50 flex justify-center px-4 sm:px-6 py-4"
    >
      <div
        className="w-full max-w-6xl flex items-center justify-between rounded-full px-4 sm:px-6 py-3 border backdrop-blur-xl transition-all duration-500"
        style={
          scrolled
            ? { background: 'rgba(5, 7, 18, 0.75)', borderColor: 'rgba(168, 85, 247, 0.18)', boxShadow: '0 8px 32px -12px rgba(0,0,0,0.5)' }
            : { background: 'transparent', borderColor: 'transparent' }
        }
      >
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/zoorzio-icon.png" alt="Zoorzio" width={30} height={30} className="rounded-full object-cover" />
          <span className="font-bold text-lg tracking-tight text-[#EDE9FE]">Zoorzio</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-sm text-[#A5A3B8] hover:text-white rounded-full hover:bg-white/5 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 sm:gap-5 shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center px-5 py-2 rounded-full text-sm font-medium text-[#EDE9FE] border hover:bg-white/5 transition-colors"
            style={{ borderColor: 'rgba(168, 85, 247, 0.25)' }}
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=register"
            className="inline-flex items-center px-5 py-2 rounded-full text-sm font-semibold text-white home-btn-primary"
          >
            Sign up
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
