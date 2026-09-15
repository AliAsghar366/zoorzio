import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CHANNELS, FEATURES } from '@/lib/site-content';
import { StartLink } from './StartLink';

export function SiteFooter() {
  return (
    <footer className="zs-footer text-white">
      <div
        className="zs-cloud"
        style={{ '--w': '420px', left: '-120px', top: '38%', '--o': 0.55 } as React.CSSProperties}
      />
      <div
        className="zs-cloud"
        style={
          {
            '--w': '520px',
            right: '-160px',
            bottom: '6%',
            '--o': 0.7,
            '--t': '24s',
          } as React.CSSProperties
        }
      />

      <div className="zs-container zs-footer-grid">
        <div>
          <div className="zs-wordmark">Zoorzio</div>
          <p className="mt-4 text-[clamp(22px,2.4vw,34px)] font-medium leading-tight">
            You get on with life. Zoorzio keeps track.
          </p>
          <StartLink className="zs-btn zs-btn--ghost mt-8" authedHref="/coffee">
            Start a chat <ArrowRight size={20} />
          </StartLink>
        </div>

        <div className="zs-footer-cols">
          <div>
            <h5>Features</h5>
            {FEATURES.slice(0, 8).map((feature) => (
              <Link key={feature.slug} href={`/features/${feature.slug}`}>
                {feature.title}
              </Link>
            ))}
            <Link
              href="/features"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/70 !py-2 px-4"
            >
              Everything it can do <ArrowRight size={16} />
            </Link>
          </div>
          <div>
            <h5>Channels</h5>
            {CHANNELS.map((channel) => (
              <Link key={channel.slug} href={`/channel/${channel.slug}`}>
                {channel.name}
              </Link>
            ))}
          </div>
          <div>
            <h5>Company</h5>
            <Link href="/security">Security</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/login">Log in</Link>
          </div>
        </div>
      </div>

      <p className="zs-container relative z-[2] mt-24 text-sm text-white/90">
        © {new Date().getFullYear()} Zoorzio. All rights reserved.
      </p>
    </footer>
  );
}
