'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { FAQS } from '@/lib/site-content';
import { Reveal } from '../Reveal';
import { StartLink } from '../StartLink';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="zs-faq">
      <div className="zs-container zs-faq-grid">
        <Reveal>
          <span className="zs-tag">FAQ</span>
          <h2 className="zs-h3 mt-6 !text-[clamp(38px,4vw,60px)]">Questions people ask a lot</h2>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#8f86dc] p-6">
            <p className="text-lg font-semibold leading-snug">
              Still wondering?
              <br />
              Ask Zoorzio itself.
            </p>
            <StartLink
              authedHref="/coffee"
              className="zs-btn !min-h-[48px] bg-gradient-to-r from-[#2fb59a] to-[#4bc98a] !text-white"
            >
              Get started
            </StartLink>
          </div>
        </Reveal>

        <div className="flex flex-col gap-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 60}>
                <div className="zs-faq-item">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.q}
                    {isOpen ? (
                      <Minus size={22} className="shrink-0" />
                    ) : (
                      <Plus size={22} className="shrink-0" />
                    )}
                  </button>
                  {isOpen && <p>{item.a}</p>}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
