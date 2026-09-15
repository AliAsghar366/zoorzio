'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { FEATURES } from '@/lib/site-content';
import { Reveal } from '../Reveal';

export function FeatureRail() {
  const railRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 1 | -1) => {
    railRef.current?.scrollBy({ left: direction * 340, behavior: 'smooth' });
  };

  return (
    <section className="zs-features">
      <Reveal className="zs-container text-center">
        <span className="zs-tag">Features</span>
        <h2 className="zs-h2 mt-8">A better memory, on demand</h2>
      </Reveal>

      <div ref={railRef} className="zs-rail mt-14">
        {FEATURES.map((feature) => (
          <Link key={feature.slug} href={`/features/${feature.slug}`} className="zs-feature-card">
            <div className="zs-feature-art">
              <Image src={feature.image} alt="" width={437} height={500} />
              <h4>{feature.title}</h4>
            </div>
            <p>{feature.short}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-4">
        <button
          type="button"
          className="zs-round-btn"
          aria-label="Previous features"
          onClick={() => scroll(-1)}
        >
          <ArrowLeft size={22} />
        </button>
        <button
          type="button"
          className="zs-round-btn"
          aria-label="Next features"
          onClick={() => scroll(1)}
        >
          <ArrowRight size={22} />
        </button>
      </div>
    </section>
  );
}
