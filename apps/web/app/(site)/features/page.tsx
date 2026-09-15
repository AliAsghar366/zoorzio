import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { FEATURES } from '@/lib/site-content';
import { Reveal } from '@/components/site/Reveal';

export const metadata: Metadata = {
  title: 'Features | Zoorzio',
  description:
    'Reminders, lists, calendar, Gmail, briefings and more - everything Zoorzio can do from your chats.',
};

export default function FeaturesPage() {
  return (
    <div className="zs-light zs-page-top pb-32">
      <div className="zs-container max-w-[1180px]">
        <Reveal>
          <h1 className="text-[clamp(44px,5vw,64px)] font-semibold leading-tight">Features</h1>
          <p className="mt-3 text-lg text-[#444]">
            Everything Zoorzio can do for you, from reminders to your inbox.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.slug} delay={(i % 4) * 70}>
              <Link href={`/features/${feature.slug}`} className="zs-feature-tile">
                <Image src={feature.image} alt="" width={437} height={500} />
                <h3>{feature.title}</h3>
                <span>
                  <Plus size={18} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
