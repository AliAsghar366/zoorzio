'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChannelChips } from '../ChannelChips';
import { ChatThread } from '../ChatThread';
import { StartLink } from '../StartLink';

const PHRASES: [string, string][] = [
  ['have to keep every', 'detail in their head'],
  ['lose a great idea', 'to an open tab'],
  ['check four apps', 'before breakfast'],
  ['be the memory', 'for the whole house'],
  ['find out the passport', 'expired at the airport'],
  ['start the week not', "knowing what's coming"],
  ['let a project stall', 'in a group chat'],
  ['forget a birthday', 'that really mattered'],
  ['stand at the door', 'hunting for the code'],
];

const HERO_CHAT = [
  { from: 'me' as const, text: 'Remind me to renew my passport in March' },
  { from: 'bot' as const, text: 'Done ✅ I’ll remind you on 1 March to renew your passport.' },
  { from: 'me' as const, text: 'And add sunscreen to the holiday list' },
  { from: 'bot' as const, text: 'Added 🧴 Sunscreen is on “Holiday packing”.' },
];

export function Hero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), 2800);
    return () => clearInterval(timer);
  }, []);

  const [first, second] = PHRASES[index];

  return (
    <section className="zs-hero">
      <div className="zs-stars" />

      <div className="zs-container zs-hero-grid">
        <div>
          <h1 className="zs-h1">
            <span className="block">Nobody should</span>
            <span className="zs-hero-rotator" key={index}>
              <span>{first}</span>
              <span style={{ animationDelay: '80ms' }}>{second}</span>
            </span>
          </h1>

          <p className="mt-8 text-[clamp(18px,1.5vw,21px)] font-medium">
            So we built Zoorzio. It remembers for you.
          </p>

          <div className="zs-available mt-8">
            Available on <ChannelChips />
          </div>

          <div className="zs-hero-actions mt-10 flex flex-wrap gap-4">
            <StartLink className="zs-btn zs-btn--candy min-w-[230px]">Start now</StartLink>
            <a href="#how" className="zs-btn zs-btn--ghost min-w-[230px]">
              See how it works
            </a>
          </div>
        </div>

        <div className="relative mx-auto mt-16 w-full max-w-[600px] md:mt-0">
          <Image
            src="/z/cat-tilted.webp"
            alt="Zoorzio, the black cat mascot"
            width={180}
            height={177}
            className="zs-hero-cat zs-float"
            priority
          />
          <div className="zs-hero-card">
            <Image
              src="/z/hero-card.webp"
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 600px"
              priority
            />
            <ChatThread messages={HERO_CHAT} className="zs-hero-chat" />
          </div>
        </div>
      </div>
    </section>
  );
}
