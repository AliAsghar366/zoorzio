'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { ChannelChips } from '../ChannelChips';
import { Reveal } from '../Reveal';

const STEPS = [
  { title: 'Capture', text: 'A message, a voice note or a quick sentence.' },
  { title: 'Organise', text: 'Understands it and files it in the right place.' },
  { title: 'Recall', text: 'Find it later by asking for what you meant.' },
  { title: 'Act', text: 'Sets the reminder, books the slot, sends the email.' },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((i) => (i + 1) % STEPS.length), 1800);
    return () => clearInterval(timer);
  }, []);

  const answered = active === STEPS.length - 1;

  return (
    <section id="how" className="zs-how">
      <div className="zs-container">
        <Reveal className="text-center">
          <h2 className="zs-h3 mx-auto max-w-[900px] !text-[clamp(32px,3.6vw,52px)]">
            Say it the way you&apos;d tell a friend, and let Zoorzio turn it into done.
          </h2>
          <p className="mx-auto mt-5 max-w-[640px] text-lg text-white/90">
            One memory on top of the apps you already use. No commands, no formatting, no filing -
            plain sentences in, order out.
          </p>
        </Reveal>

        <div className="zs-flow mt-16">
          <Reveal className="zs-flow-panel">
            <div className="zs-flow-card">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7d73d8] text-lg font-bold text-white">
                You
              </span>
              <div>
                <p className="text-lg text-[#777]">You say</p>
                <p className="mt-1 text-xl leading-snug">
                  “Remind me every Tuesday that Sam owes me $75”
                </p>
              </div>
            </div>
          </Reveal>

          <ArrowRight className="zs-flow-arrow text-white" size={30} />

          <div className="grid gap-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className={`zs-flow-step ${i === active ? 'is-active' : ''}`}>
                <h5>{step.title}</h5>
                <p>{step.text}</p>
              </div>
            ))}
          </div>

          <ArrowRight className="zs-flow-arrow text-white" size={30} />

          <Reveal className="zs-flow-panel" delay={200}>
            <div className="zs-flow-card min-h-[118px]">
              <Image
                src="/z/cat-flow.webp"
                alt=""
                width={48}
                height={52}
                className="h-[52px] w-12 shrink-0"
              />
              <div>
                <p className="text-lg text-[#777]">Zoorzio answers</p>
                <p
                  className={`mt-1 text-xl leading-snug transition-opacity duration-500 ${answered ? 'opacity-100' : 'opacity-0'}`}
                >
                  Weekly reminder set · Tuesdays: Sam owes you $75
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal className="relative mt-24 flex flex-col items-center gap-4 text-center">
          <Image
            src="/z/cat-tilted.webp"
            alt=""
            width={200}
            height={197}
            className="zs-float mb-4 w-[150px] md:absolute md:left-[8%] md:top-[-40px] md:mb-0 md:w-[200px]"
          />
          <p className="text-xl font-medium">Lives inside the apps already on your phone</p>
          <ChannelChips size={38} />
        </Reveal>
      </div>
    </section>
  );
}
