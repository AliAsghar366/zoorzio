'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input } from '@anchor/ui';
import { MemoryType, getSourceIcon, formatRelativeTime } from '@anchor/shared';
import { api } from '@/lib/api';

interface Memory {
  id: string;
  content: string;
  summary?: string | null;
  type: string;
  source: string;
  tags: string[];
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchMemories = useCallback(async (nextOffset: number, query: string, type: string) => {
    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: nextOffset.toString(),
      ...(query && { search: query }),
      ...(type !== 'all' && { type }),
    });

    const page = await api.get<Memory[]>(`/memory?${params}`);
    setHasMore(page.length === PAGE_SIZE);
    return page;
  }, []);

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    fetchMemories(0, searchQuery, filterType)
      .then(setMemories)
      .finally(() => setLoading(false));
    // searchQuery is intentionally excluded: search runs on explicit
    // submit (handleSearch), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, fetchMemories]);

  const handleSearch = async () => {
    setLoading(true);
    setOffset(0);
    try {
      setMemories(await fetchMemories(0, searchQuery, filterType));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    const page = await fetchMemories(nextOffset, searchQuery, filterType);
    setMemories((prev) => [...prev, ...page]);
    setOffset(nextOffset);
  };

  const deleteMemory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    await api.delete(`/memory/${id}`);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-anchor-800">Memories</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-anchor-300 rounded-lg bg-white text-anchor-800"
        >
          <option value="all">All Types</option>
          {Object.values(MemoryType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {loading && memories.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : memories.length === 0 ? (
        <Card>
          <p className="text-anchor-500 text-lg text-center py-8">
            No memories found. Start capturing your thoughts!
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {memories.map((memory) => (
            <Card key={memory.id} hover>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-2xl">{getSourceIcon(memory.source)}</span>
                  <div className="flex-1">
                    <p className="text-anchor-800 mb-2">{memory.summary || memory.content}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {memory.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center text-sm text-anchor-500">
                      <span className="mr-4 capitalize">{memory.source.toLowerCase()}</span>
                      <span>{formatRelativeTime(memory.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMemory(memory.id)}
                  className="p-2 text-anchor-400 hover:text-red-500 transition-colors"
                  aria-label="Delete memory"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center py-4">
              <Button onClick={loadMore} variant="secondary">
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
