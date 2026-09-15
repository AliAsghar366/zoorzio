import type { Metadata } from 'next';
import { Hero } from '@/components/site/home/Hero';
import { ProblemSections } from '@/components/site/home/ProblemSections';
import { OverloadLife } from '@/components/site/home/OverloadLife';
import { Relief } from '@/components/site/home/Relief';
import { HowItWorks } from '@/components/site/home/HowItWorks';
import { NoHarder } from '@/components/site/home/NoHarder';
import { Personas } from '@/components/site/home/Personas';
import { FeatureRail } from '@/components/site/home/FeatureRail';
import { PlanFinder } from '@/components/site/home/PlanFinder';
import { Privacy } from '@/components/site/home/Privacy';
import { Faq } from '@/components/site/home/Faq';

export const metadata: Metadata = {
  title: 'Zoorzio | Nothing slips through the cracks',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSections />
      <OverloadLife />
      <Relief />
      <HowItWorks />
      <NoHarder />
      <Personas />
      <FeatureRail />
      <PlanFinder />
      <Privacy />
      <Faq />
    </>
  );
}
