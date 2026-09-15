'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import { Reveal } from '../Reveal';

/** Words light up one by one as the paragraph scrolls through the viewport. */
function ScrollWords({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const value = (viewport * 0.85 - rect.top) / (rect.height + viewport * 0.35);
      setProgress(Math.min(1, Math.max(0, value)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const words = text.split(' ');

  return (
    <p ref={ref} className="zs-words">
      {words.map((word, i) => (
        <span key={i} style={{ opacity: i / words.length < progress ? 1 : 0.36 }}>
          {word}{' '}
        </span>
      ))}
    </p>
  );
}

function AppTile({
  src,
  badge,
  style,
}: {
  src: string;
  badge: number;
  style: React.CSSProperties;
}) {
  return (
    <div className="zs-app-tile zs-float" style={style}>
      <Image src={src} alt="" width={58} height={58} />
      <b>{badge}</b>
    </div>
  );
}

function AppsMock() {
  return (
    <div className="zs-mock">
      <div className="zs-mock-pink">
        <AppTile src="/z/icon-slack.webp" badge={9} style={{ left: '8%', top: '10%' }} />
        <AppTile
          src="/z/icon-gmail.webp"
          badge={7}
          style={{ left: '14%', top: '45%', animationDelay: '0.8s' }}
        />
        <AppTile
          src="/z/icon-telegram.webp"
          badge={5}
          style={{ left: '8%', bottom: '9%', animationDelay: '1.4s' }}
        />

        <div className="zs-mock-window">
          <div className="zs-mock-window-bar">
            <i style={{ background: '#ff5f57' }} />
            <i style={{ background: '#febc2e' }} />
            <i style={{ background: '#28c840' }} />
          </div>
          <div className="zs-mock-tabs">
            <span>Calendar</span>
            <span>12 unread</span>
            <span>Notes</span>
            <span>Tasks</span>
          </div>
          <div
            className="zs-sticky zs-sticky--lilac"
            style={
              { left: '38%', top: '48%', '--zs-rot': '-8deg', width: 96 } as React.CSSProperties
            }
          >
            Call the dentist
          </div>
        </div>

        <div
          className="absolute rounded-xl bg-white px-3 py-1.5 text-center text-[#222] shadow-lg"
          style={{ right: '8%', top: '14%' }}
        >
          <div className="text-[11px] font-bold text-[#e5484d]">WED</div>
          <div className="text-[30px] font-medium leading-none">28</div>
        </div>
        <div
          className="zs-sticky zs-sticky--pink"
          style={{ left: '46%', top: '-7%', '--zs-rot': '8deg' } as React.CSSProperties}
        >
          Catch up at 2pm
        </div>
      </div>
    </div>
  );
}

function PaperMock() {
  return (
    <div className="zs-mock">
      <div
        className="relative rounded-[28px] p-[10%] pt-[24%]"
        style={{ background: 'linear-gradient(160deg, #6f3fe0, #b04fd8 55%, #f07cc6)' }}
      >
        <AppTile src="/z/icon-gmail.webp" badge={22} style={{ right: '16%', top: '8%' }} />
        <div className="zs-paper" style={{ marginLeft: '-16%' }}>
          <h5>MONDAY - TO DO</h5>
          <ul>
            <li>Reply to the landlord</li>
            <li>Book the car service</li>
            <li>Send the slides</li>
            <li />
            <li />
          </ul>
        </div>
        <div
          className="zs-sticky zs-sticky--blue"
          style={{ right: '-4%', bottom: '-6%', '--zs-rot': '12deg' } as React.CSSProperties}
        >
          Did I reply?
        </div>
      </div>
    </div>
  );
}

function OrbitMock() {
  const tiles: { src?: string; left: string; top: string }[] = [
    { src: '/z/icon-whatsapp.webp', left: '22%', top: '12%' },
    { src: '/z/icon-slack.webp', left: '68%', top: '10%' },
    { src: '/z/icon-telegram.webp', left: '80%', top: '48%' },
    { src: '/z/icon-gmail.webp', left: '10%', top: '52%' },
    { src: '/z/icon-googlechat.webp', left: '64%', top: '80%' },
    { left: '26%', top: '80%' },
  ];

  return (
    <div className="zs-mock">
      <div className="zs-orbit">
        {tiles.map((tile, i) => (
          <div
            key={i}
            className="zs-app-tile zs-float flex items-center justify-center text-[#4a6fd8]"
            style={{ left: tile.left, top: tile.top, animationDelay: `${i * 0.5}s` }}
          >
            {tile.src ? (
              <Image src={tile.src} alt="" width={58} height={58} />
            ) : (
              <Globe size={30} />
            )}
          </div>
        ))}
        <Image
          src="/z/cat-sad.webp"
          alt=""
          width={180}
          height={195}
          className="absolute left-1/2 top-1/2 w-[38%] -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}

export function ProblemSections() {
  return (
    <section className="zs-night">
      <div className="zs-stars" />
      <div className="zs-container">
        <div className="zs-split">
          <ScrollWords text="Notes in one app, plans in a chat, dates in your head - everything you know ends up spread a little too thin." />
          <Reveal>
            <AppsMock />
          </Reveal>
        </div>

        <div className="zs-split zs-split--reverse">
          <ScrollWords text="You've checked your calendar five times today, and the one thing that mattered still got away." />
          <Reveal>
            <PaperMock />
          </Reveal>
        </div>

        <div className="zs-split">
          <ScrollWords text="Work in one place, family in another, everything else somewhere in between. Miss one corner and the thing you needed is gone." />
          <Reveal>
            <OrbitMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
