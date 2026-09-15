'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { CHANNELS, FEATURES } from '@/lib/site-content';
import { useAuthed } from './useAuthed';

// Pages whose top section is a dark or saturated gradient get the dark nav pill.
const DARK_NAV_ROUTES = ['/', '/pricing'];

export function SiteHeader() {
  const pathname = usePathname();
  const authed = useAuthed();
  const navRef = useRef<HTMLElement>(null);
  const [openMenu, setOpenMenu] = useState<'features' | 'channels' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = pathname === '/';
  const dark = DARK_NAV_ROUTES.includes(pathname);
  const cta = authed
    ? { href: '/portal', label: 'Open Zoorzio' }
    : { href: '/login?mode=register', label: 'Try for free' };

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const toggle = (menu: 'features' | 'channels') =>
    setOpenMenu((current) => (current === menu ? null : menu));

  return (
    <>
      {isHome && (
        <div className="zs-announce">
          <span>✦ Reminders, lists and your calendar - all by text</span>
          <Link href="/features">See how</Link>
        </div>
      )}

      <header className={`zs-header ${isHome ? 'has-announce' : ''}`}>
        <nav
          ref={navRef}
          className={`zs-nav ${dark ? 'zs-nav--dark' : 'zs-nav--light'}`}
          aria-label="Main"
        >
          <Link href="/" aria-label="Zoorzio home">
            <Image
              src="/z/logo-white.png"
              alt="Zoorzio"
              width={139}
              height={26}
              className="zs-logo"
              priority
            />
          </Link>

          <div className="zs-nav-desktop flex items-center">
            <div className="relative">
              <button
                type="button"
                className="zs-nav-link"
                aria-expanded={openMenu === 'features'}
                onClick={() => toggle('features')}
              >
                Features <ChevronDown size={16} />
              </button>
              {openMenu === 'features' && (
                <div className="zs-dropdown">
                  <div className="zs-dropdown-grid">
                    {FEATURES.map((feature) => (
                      <Link
                        key={feature.slug}
                        href={`/features/${feature.slug}`}
                        className="zs-dropdown-item"
                      >
                        <Image src={feature.image} alt="" width={44} height={44} />
                        <div>
                          <strong>{feature.title}</strong>
                          <span>{feature.short}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href="/features"
                    className="mt-2 block rounded-xl py-2.5 text-center text-sm font-semibold text-[#7d73d8] hover:bg-[#f1eefb]"
                  >
                    See every feature →
                  </Link>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                className="zs-nav-link"
                aria-expanded={openMenu === 'channels'}
                onClick={() => toggle('channels')}
              >
                Channels <ChevronDown size={16} />
              </button>
              {openMenu === 'channels' && (
                <div className="zs-dropdown" style={{ width: 'min(340px, 92vw)' }}>
                  <div className="grid gap-1">
                    {CHANNELS.map((channel) => (
                      <Link
                        key={channel.slug}
                        href={`/channel/${channel.slug}`}
                        className="zs-dropdown-item"
                      >
                        <Image src={channel.cat} alt="" width={44} height={44} />
                        <div>
                          <strong>{channel.name}</strong>
                          <span>Use Zoorzio in {channel.name}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="/security" className="zs-nav-link">
              Security
            </Link>
            <Link href="/pricing" className="zs-nav-link">
              Pricing
            </Link>
            {!authed && (
              <Link href="/login" className="zs-nav-link">
                Log in
              </Link>
            )}
            <Link href={cta.href} className="zs-nav-cta">
              {cta.label}
            </Link>
          </div>

          <button
            type="button"
            className="zs-menu-btn"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={26} />
          </button>
        </nav>
      </header>

      {mobileOpen && (
        <div className="zs-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute right-5 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={22} />
          </button>

          <h4>Features</h4>
          {FEATURES.map((feature) => (
            <Link key={feature.slug} href={`/features/${feature.slug}`}>
              {feature.title}
            </Link>
          ))}

          <h4>Channels</h4>
          {CHANNELS.map((channel) => (
            <Link key={channel.slug} href={`/channel/${channel.slug}`}>
              {channel.name}
            </Link>
          ))}

          <h4>Company</h4>
          <Link href="/security">Security</Link>
          <Link href="/pricing">Pricing</Link>
          {!authed && <Link href="/login">Log in</Link>}

          <Link href={cta.href} className="zs-btn zs-btn--grad mt-8 w-full">
            {cta.label}
          </Link>
        </div>
      )}
    </>
  );
}
