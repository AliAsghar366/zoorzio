'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Circle } from 'lucide-react';
import { getGamificationProgress, type GamificationProgress } from '@/lib/api';

type Category = 'actions' | 'tricks' | 'usecases' | null;

const TRICKS = [
  'Say "Zoorzio, remind me to call mom at 5pm" in Coffee to create a reminder without opening a form.',
  'Text "LINK <code>" to our WhatsApp/SMS number to link that number to your account in seconds.',
  'Use the search bar in Explore to find any memory instantly, even ones from months ago.',
  'Swipe through Clean up mode in Explore to quickly review and archive old memories.',
];

const USE_CASES = [
  'Give me my weekly briefing',
  'Show me what needs my attention first',
  'Add milk to my shopping list',
  'Schedule a meeting at 3pm tomorrow',
  'Remind Sarah to send the deck by Friday',
];

export default function MasterZoorzioPage() {
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>(null);

  useEffect(() => {
    getGamificationProgress()
      .then(setProgress)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  const percent = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="text-white pb-4">
      <h1 className="text-3xl font-bold">Master Zoorzio</h1>
      <p className="text-white/60 text-sm mt-1">Watch, try, and unlock rewards as you learn.</p>

      <div className="grid grid-cols-1 gap-4 mt-5">
        <CategoryCard
          active={category === 'actions'}
          onClick={() => setCategory('actions')}
          gradient="from-[#fcad96] to-[#f5caa2]"
          title="Actions"
          subtitle={`${progress?.completed ?? 0}/${progress?.total ?? 21} completed · Learn by doing`}
        />
        <CategoryCard
          active={category === 'tricks'}
          onClick={() => setCategory('tricks')}
          gradient="from-[#7ea9e4] to-[#9283d9]"
          title="Tricks"
          subtitle="Small tricks. Big time saved."
        />
        <CategoryCard
          active={category === 'usecases'}
          onClick={() => setCategory('usecases')}
          gradient="from-[#dc8cc5] to-[#fcad96]"
          title="Use Cases"
          subtitle="Ready-to-use prompts for daily life."
        />
      </div>

      {category === null && (
        <div className="dashboard-card p-8 mt-4 text-center">
          <p className="text-white/50 text-sm">Pick a category above to see what&apos;s inside.</p>
        </div>
      )}

      {category === 'actions' && (
        <div className="mt-4 space-y-4">
          <div className="dashboard-card p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold">
                {progress?.completed} of {progress?.total} actions
              </span>
              <span className="text-sm font-medium text-white/70">{percent}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#fcad96] to-[#f5caa2] transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="dashboard-card p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {progress?.actions.map((action) => (
                <div key={action.key} className={action.completed ? 'flex items-center gap-3 rounded-2xl p-3 bg-white/10' : 'flex items-center gap-3 rounded-2xl p-3 bg-white/[0.03]'}>
                  {action.completed ? <CheckCircle2 size={18} className="text-white shrink-0" /> : <Circle size={18} className="text-white/30 shrink-0" />}
                  <span className={action.completed ? 'text-sm font-medium' : 'text-sm text-white/50'}>{action.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {category === 'tricks' && (
        <div className="dashboard-card p-5 mt-4 space-y-2.5">
          {TRICKS.map((tip) => (
            <div key={tip} className="bg-white/5 rounded-2xl p-4 text-sm text-white/80">
              {tip}
            </div>
          ))}
        </div>
      )}

      {category === 'usecases' && (
        <div className="dashboard-card p-5 mt-4 space-y-2.5">
          {USE_CASES.map((prompt) => (
            <div key={prompt} className="bg-white/5 rounded-2xl p-4 text-sm text-white/80">
              &ldquo;{prompt}&rdquo;
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  active,
  onClick,
  gradient,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  gradient: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button onClick={onClick} className={`dashboard-card overflow-hidden text-left transition-transform ${active ? 'ring-1 ring-white/40' : ''}`}>
      <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <Image src="/zoorzio-icon.png" alt="" width={44} height={44} />
      </div>
      <div className="p-4">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}
