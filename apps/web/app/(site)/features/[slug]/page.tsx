import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { FEATURES } from '@/lib/site-content';
import { PhoneChat } from '@/components/site/ChatThread';
import { Reveal } from '@/components/site/Reveal';
import { StartLink } from '@/components/site/StartLink';

const TAG_COLORS: Record<string, { color: string; bg: string }> = {
  'Mental load': { color: '#b7791f', bg: '#fcefd6' },
  'Scattered apps': { color: '#e2489f', bg: '#fbe3f1' },
  Forgetting: { color: '#5c7be0', bg: '#e6ecfb' },
  Friction: { color: '#2a9bb8', bg: '#e0f3f7' },
};

export function generateStaticParams() {
  return FEATURES.map((feature) => ({ slug: feature.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const feature = FEATURES.find((item) => item.slug === params.slug);
  return feature ? { title: `${feature.title} | Zoorzio`, description: feature.short } : {};
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const feature = FEATURES.find((item) => item.slug === params.slug);
  if (!feature) notFound();

  const others = FEATURES.filter((item) => item.slug !== feature.slug).slice(0, 4);
  // Repeat the pain cards so the tilted row always fills the width.
  const pains = [...feature.pains, ...feature.pains].slice(0, 8);

  return (
    <div className="zs-light zs-page-top overflow-hidden">
      <section className="zs-container max-w-[1100px]">
        <nav className="zs-crumbs" aria-label="Breadcrumb">
          <Link href="/features">Features</Link>
          <ChevronRight size={16} />
          <strong>{feature.title}</strong>
        </nav>

        <div className="mt-10 grid items-center gap-8 md:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <h1 className="zs-grad-text pb-2 text-[clamp(52px,8vw,120px)] font-semibold leading-[1]">
              {feature.title}
            </h1>
          </Reveal>
          <Image
            src="/z/cat-tilted.webp"
            alt=""
            width={900}
            height={886}
            className="zs-float mx-auto w-[min(260px,60%)]"
            priority
          />
        </div>

        <Reveal>
          <p className="mt-10 max-w-[720px] text-[clamp(20px,1.9vw,26px)] font-medium leading-snug">
            {feature.lead} <span className="text-[#7a7888]">{feature.body}</span>
          </p>
        </Reveal>
      </section>

      <section className="relative mt-20 pb-10">
        <div className="flex gap-5 px-4" style={{ width: 'max-content' }}>
          {pains.map((pain, i) => {
            const tag = TAG_COLORS[pain.tag] ?? TAG_COLORS.Forgetting;
            return (
              <div
                key={i}
                className="zs-pain"
                style={
                  {
                    '--zs-rot': `${i % 2 ? 3 : -3}deg`,
                    marginTop: i % 3 === 1 ? 40 : 0,
                  } as React.CSSProperties
                }
              >
                <em style={{ color: tag.color, background: tag.bg }}>{pain.tag}</em>
                <p style={{ color: tag.color }}>{pain.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="mt-16 rounded-t-[48px] py-24 text-white"
        style={{ background: 'linear-gradient(135deg, #7ea9e4 0%, #9a8ade 50%, #c98bd0 100%)' }}
      >
        <div className="zs-container grid items-center gap-14 md:grid-cols-2">
          <Reveal className="flex justify-center">
            <PhoneChat
              messages={[
                { from: 'me', text: feature.example.user },
                { from: 'bot', text: feature.example.bot },
              ]}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className="text-lg">Just send a message:</p>
            <p className="mt-4 text-[clamp(30px,3.6vw,52px)] font-semibold leading-tight">
              “{feature.example.user}”
            </p>
            <div className="mt-12 grid gap-4">
              {feature.points.map((point) => (
                <div key={point.title} className="rounded-2xl bg-white/15 p-5 backdrop-blur">
                  <h3 className="text-xl font-semibold">{point.title}</h3>
                  <p className="mt-1 text-white/90">{point.text}</p>
                </div>
              ))}
            </div>
            <StartLink className="zs-btn zs-btn--soft mt-10">
              Try it yourself <ArrowRight size={18} />
            </StartLink>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#e8f0ef] py-24">
        <div className="zs-container max-w-[1180px]">
          <h2 className="text-[clamp(28px,3vw,40px)] font-semibold">More Zoorzio can do</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((item) => (
              <Link key={item.slug} href={`/features/${item.slug}`} className="zs-feature-tile">
                <Image src={item.image} alt="" width={437} height={500} />
                <h3>{item.title}</h3>
                <span>
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
