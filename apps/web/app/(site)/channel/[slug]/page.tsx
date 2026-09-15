import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { CHANNELS, FEATURES } from '@/lib/site-content';
import { ChannelConnect } from '@/components/site/ChannelConnect';
import { Reveal } from '@/components/site/Reveal';

const STEP_COLORS = ['#ef5fb0', '#5c7be0', '#3fb7e0'];
const SHOWCASE = [
  {
    slug: 'reminders',
    background: 'linear-gradient(135deg, #7458e6 0%, #c05ed8 60%, #f36bc4 100%)',
  },
  { slug: 'calendar', background: 'linear-gradient(135deg, #0fbf9c 0%, #10a98c 100%)' },
  { slug: 'lists', background: 'linear-gradient(135deg, #ffae3b 0%, #ff8a4c 100%)' },
];

/** Splits after the first sentence so the opening line can be emphasised. */
function splitIntro(intro: string): [string, string] {
  const match = intro.match(/^.*?[.?!]\s/);
  if (!match) return [intro, ''];
  return [match[0].trim(), intro.slice(match[0].length)];
}

const leadSentence = (intro: string) => splitIntro(intro)[0];
const restOfIntro = (intro: string) => splitIntro(intro)[1];

export function generateStaticParams() {
  return CHANNELS.map((channel) => ({ slug: channel.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const channel = CHANNELS.find((item) => item.slug === params.slug);
  return channel ? { title: `Zoorzio on ${channel.name}`, description: channel.intro } : {};
}

export default function ChannelPage({ params }: { params: { slug: string } }) {
  const channel = CHANNELS.find((item) => item.slug === params.slug);
  if (!channel) notFound();

  return (
    <div className="zs-light zs-page-top overflow-hidden">
      <section className="zs-container max-w-[1000px]">
        <nav className="zs-crumbs" aria-label="Breadcrumb">
          <span>Channels</span>
          <ChevronRight size={16} />
          <strong>{channel.name}</strong>
        </nav>

        <Reveal className="relative mt-10 text-center">
          <h1 className="zs-grad-text pb-3 text-[clamp(54px,9vw,130px)] font-semibold leading-[0.98]">
            Zoorzio
            <br />
            on {channel.name}
          </h1>
          <Image
            src={channel.cat}
            alt=""
            width={720}
            height={720}
            className="zs-float absolute right-0 top-[-30px] w-[clamp(90px,13vw,150px)]"
            priority
          />
        </Reveal>

        <div className="mt-8 grid items-center gap-12 md:grid-cols-2">
          <Reveal className="flex justify-center">
            {channel.phone ? (
              <Image
                src={channel.phone}
                alt={`Zoorzio chat on ${channel.name}`}
                width={710}
                height={1000}
                className="w-[min(340px,90%)] drop-shadow-2xl"
              />
            ) : (
              <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex gap-1.5 border-b px-4 py-3">
                  <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <Image
                  src="/z/channel-app.webp"
                  alt="The Zoorzio web app"
                  width={800}
                  height={800}
                  className="w-full"
                />
              </div>
            )}
          </Reveal>

          <Reveal delay={120}>
            <p className="text-[clamp(19px,1.7vw,22px)] font-medium leading-snug">
              <span className="text-[#1f1a33]">{leadSentence(channel.intro)}</span>{' '}
              <span className="text-[#7a7888]">{restOfIntro(channel.intro)}</span>
            </p>
            <div className="mt-8">
              <ChannelConnect channel={channel} />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="zs-container max-w-[1240px] py-28">
        <Reveal className="text-center">
          <span className="zs-tag zs-tag--pink">Getting started</span>
          <h2 className="zs-grad-text mt-5 text-[clamp(32px,3.6vw,50px)] font-semibold">
            This is how you use it
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {channel.steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div className="h-full rounded-[28px] bg-white/80 p-8 shadow-sm">
                <span className="text-2xl font-semibold" style={{ color: STEP_COLORS[i] }}>
                  0{i + 1}
                </span>
                <h3 className="mt-5 text-[clamp(24px,2.2vw,32px)] font-medium leading-tight">
                  {step.title}
                </h3>
                <p className="mt-4 text-[16px] leading-relaxed text-[#333]">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-white py-28">
        <div className="zs-container max-w-[900px]">
          <h2 className="zs-grad-text text-center text-[clamp(32px,3.6vw,54px)] font-semibold">
            Where Zoorzio takes over
          </h2>
          <div className="mt-12 grid gap-6">
            {SHOWCASE.map(({ slug, background }) => {
              const feature = FEATURES.find((item) => item.slug === slug);
              if (!feature) return null;
              return (
                <Reveal key={slug}>
                  <div
                    className="grid items-center gap-8 rounded-[28px] p-8 text-white md:grid-cols-2"
                    style={{ background }}
                  >
                    <div>
                      <h3 className="text-[clamp(24px,2.4vw,32px)] font-semibold leading-tight">
                        {feature.lead}
                      </h3>
                      <p className="mt-4 text-white/90">{feature.body}</p>
                      <Link
                        href={`/features/${feature.slug}`}
                        className="mt-5 inline-block font-semibold underline underline-offset-4"
                      >
                        More about {feature.title.toLowerCase()} →
                      </Link>
                    </div>
                    <div className="zs-chat">
                      <div className="zs-bubble zs-bubble--me">{feature.example.user}</div>
                      <div className="zs-bubble zs-bubble--bot">{feature.example.bot}</div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
