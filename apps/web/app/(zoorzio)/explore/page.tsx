'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Mic, Plus, ArrowUp, X, Check } from 'lucide-react';
import { formatRelativeTime, getSourceIcon } from '@anchor/shared';
import { api } from '@/lib/api';

interface Memory {
  id: string;
  content: string;
  summary?: string | null;
  source: string;
  createdAt: string;
}

type Tab = 'everything' | 'bubbles' | 'cleanup';

const CARD_TONES = [
  'bg-gradient-to-br from-primary-400/30 to-primary-200/20',
  'bg-gradient-to-br from-accent-400/30 to-pastel-pink/20',
  'bg-gradient-to-br from-peach-300/30 to-soft-cream/20',
  'bg-gradient-to-br from-sky-300/30 to-pastel-blue/20',
];

export default function ExplorePage() {
  const [tab, setTab] = useState<Tab>('everything');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  // Cleanup mode state
  const [cleanupQueue, setCleanupQueue] = useState<Memory[]>([]);
  const [cleanupIndex, setCleanupIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  const load = useCallback(async (activeTab: Tab, query = '') => {
    setLoading(true);
    try {
      if (activeTab === 'cleanup') {
        const queue = await api.get<Memory[]>('/memory?isVerified=false&limit=50');
        setCleanupQueue(queue);
        setCleanupIndex(0);
        setReviewedCount(0);
      } else {
        const params = new URLSearchParams({ limit: '40' });
        if (activeTab === 'bubbles') params.set('isVerified', 'true');
        if (query) params.set('search', query);
        const data = await api.get<Memory[]>(`/memory?${params}`);
        setMemories(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const handleReview = async (action: 'forget' | 'keep') => {
    const current = cleanupQueue[cleanupIndex];
    if (!current) return;

    try {
      if (action === 'forget') {
        await api.delete(`/memory/${current.id}`);
      } else {
        await api.put(`/memory/${current.id}`, { isVerified: true });
      }
    } finally {
      setReviewedCount((n) => n + 1);
      setCleanupIndex((i) => i + 1);
    }
  };

  const current = cleanupQueue[cleanupIndex];

  return (
    <div className="max-w-5xl mx-auto px-6 pt-4 text-white">
      <div className="flex justify-center mb-6">
        <div className="glass-card inline-flex p-1.5 gap-1">
          {(['everything', 'bubbles', 'cleanup'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? 'px-4 py-2 rounded-full text-sm font-semibold bg-white text-primary-600'
                  : 'px-4 py-2 rounded-full text-sm font-medium text-white/85 hover:bg-white/10 transition-colors'
              }
            >
              {t === 'everything' ? 'Everything' : t === 'bubbles' ? 'My bubbles' : 'Clean up'}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'cleanup' && (
        <>
          <h1 className="text-3xl md:text-4xl italic font-light mb-6 text-center md:text-left">
            Search your Memory…
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(tab, search);
            }}
            className="glass-pill-input mb-4"
          >
            <button type="button" className="w-[38px] h-[38px] rounded-full border border-white/55 bg-white/18 flex items-center justify-center shrink-0" aria-label="Voice">
              <Mic size={16} />
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your memory..."
            />
            <button type="submit" className="w-[38px] h-[38px] rounded-full bg-white/90 text-primary-600 flex items-center justify-center shrink-0" aria-label="Search">
              <ArrowUp size={16} />
            </button>
          </form>

          <div className="glass-card p-4 mb-6 flex items-center gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type or record a new thought"
              className="flex-1 bg-transparent outline-none text-white placeholder:text-white/60 text-sm"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && draft.trim()) {
                  await api.post('/memory', { content: draft, type: 'NOTE', source: 'NATIVE_APP' });
                  setDraft('');
                  load(tab);
                }
              }}
            />
            <button className="w-9 h-9 rounded-full bg-white/15 border border-white/40 flex items-center justify-center" aria-label="Add">
              <Plus size={16} />
            </button>
            <button className="w-9 h-9 rounded-full bg-white/15 border border-white/40 flex items-center justify-center" aria-label="Record">
              <Mic size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
            </div>
          ) : memories.length === 0 ? (
            <p className="text-center text-white/70 py-12">
              {tab === 'bubbles' ? "No kept memories yet — review some in Clean up." : 'Nothing here yet.'}
            </p>
          ) : (
            <div className="columns-2 md:columns-3 gap-4 space-y-4 pb-8">
              {memories.map((memory, i) => (
                <div key={memory.id} className={`glass-card p-4 break-inside-avoid ${CARD_TONES[i % CARD_TONES.length]}`}>
                  <div className="flex items-center gap-2 text-xs text-white/70 mb-2">
                    <span>{getSourceIcon(memory.source)}</span>
                    <span className="capitalize">{memory.source.toLowerCase()}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(memory.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium">{memory.summary || memory.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'cleanup' && (
        <div className="flex flex-col items-center pt-4 pb-16">
          <div className="glass-card px-5 py-3 mb-6 flex gap-6 text-sm">
            <span>{Math.max(cleanupQueue.length - reviewedCount, 0)} memories remaining</span>
            <span>{reviewedCount} reviewed</span>
          </div>

          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          ) : !current ? (
            <div className="glass-card p-10 text-center max-w-md">
              <Image src="/zoorzio-icon.png" alt="Zoorzio mascot" width={64} height={64} className="mx-auto mb-4" />
              <p className="font-semibold text-lg">All caught up!</p>
              <p className="text-white/70 text-sm mt-1">Nothing left to review right now.</p>
            </div>
          ) : (
            <>
              <p className="text-white/70 text-sm mb-3">
                {cleanupIndex + 1} of {cleanupQueue.length} · {current.source}
              </p>
              <div className={`glass-card p-8 max-w-md w-full text-center mb-8 ${CARD_TONES[cleanupIndex % CARD_TONES.length]}`}>
                <p className="text-lg font-medium">{current.summary || current.content}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleReview('forget')}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/15 border border-white/40 hover:bg-white/25 transition-colors font-medium"
                >
                  <X size={18} /> Forget
                </button>
                <button
                  onClick={() => handleReview('keep')}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-primary-600 hover:bg-white/90 transition-colors font-semibold"
                >
                  <Check size={18} /> Keep
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
