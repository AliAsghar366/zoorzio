'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, api } from '@/lib/api';
import { AnnouncementBar } from '@/components/home/AnnouncementBar';
import { Navbar } from '@/components/home/Navbar';
import { Hero } from '@/components/home/Hero';
import { CaptureSection } from '@/components/home/CaptureSection';
import { ChannelsFlowSection } from '@/components/home/ChannelsFlowSection';
import { OwnBotSection } from '@/components/home/OwnBotSection';
import { UnderstandSection } from '@/components/home/UnderstandSection';
import { PrivacySection } from '@/components/home/PrivacySection';
import { PricingSection } from '@/components/home/PricingSection';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { FinalCta } from '@/components/home/FinalCta';
import { Footer } from '@/components/home/Footer';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  features: string[];
}

export default function RootPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/portal');
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    api
      .get<Plan[]>('/plans')
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  if (checkingAuth) {
    return (
      <div className="home-cosmic-bg flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white/40" />
      </div>
    );
  }

  return (
    <div className="home-cosmic-bg home-noise relative overflow-x-hidden text-white">
      <AnnouncementBar />
      <Navbar />

      <main className="relative z-10">
        <Hero />
        <CaptureSection />
        <ChannelsFlowSection />
        <OwnBotSection />
        <UnderstandSection />
        <PrivacySection />
        <PricingSection plans={plans} />
        <TestimonialsSection />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
