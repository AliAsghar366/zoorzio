'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Mic, Plus } from 'lucide-react';
import { PERSONAS } from '@/lib/site-content';
import { ChannelChips } from '../ChannelChips';
import { ChatThread } from '../ChatThread';
import { Reveal } from '../Reveal';

export function Personas() {
  const [active, setActive] = useState(0);
  const persona = PERSONAS[active];

  return (
    <section className="zs-personas">
      <div className="zs-container">
        <Reveal className="text-center">
          <span className="zs-tag">Who it&apos;s for</span>
          <h2 className="zs-h2 mt-6">Made for however your mind works.</h2>
        </Reveal>

        <div className="mt-10 flex flex-wrap justify-center gap-3" role="tablist">
          {PERSONAS.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`zs-persona-tab ${i === active ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Reveal className="mx-auto mt-12 max-w-[820px]">
          <div className="zs-persona-stage">
            <div className="zs-chat-wall flex min-h-[420px] flex-col justify-between rounded-[28px] p-6">
              <ChatThread
                key={persona.label}
                loop={false}
                messages={[
                  { from: 'me', text: persona.user },
                  { from: 'bot', text: persona.bot },
                ]}
              />
              <div className="mt-6 flex items-center gap-3 rounded-full bg-white/85 px-4 py-3 text-[#777]">
                <Plus size={20} />
                <span className="flex-1">Write something</span>
                <Mic size={20} />
              </div>
            </div>

            <div className="relative flex min-h-[260px] flex-col items-center justify-center text-center">
              <p className="text-xl font-semibold">Available on</p>
              <div className="mt-3 rounded-xl border border-white/40 bg-white/10 p-2">
                <ChannelChips size={30} />
              </div>
              <Image
                src="/z/cat-hero.webp"
                alt=""
                width={240}
                height={240}
                className="zs-float mt-6 w-[200px]"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
