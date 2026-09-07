'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@anchor/ui';
import { getSourceIcon, formatRelativeTime } from '@anchor/shared';
import { api } from '@/lib/api';

interface SearchResult {
  id: string;
  content: string;
  summary?: string | null;
  source: string;
  createdAt?: string;
  score?: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.get<SearchResult[]>(
        `/memory/search?q=${encodeURIComponent(query)}&limit=20`,
      );
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-anchor-800 mb-8">Search</h1>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Ask about anything you've captured..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} loading={loading}>
          Search
        </Button>
      </div>

      {searched && !loading && results.length === 0 && (
        <Card>
          <p className="text-anchor-500 text-center py-4">No results for &ldquo;{query}&rdquo;.</p>
        </Card>
      )}

      <div className="space-y-4">
        {results.map((result) => (
          <Card key={result.id}>
            <div className="flex items-center text-sm text-anchor-500 mb-2">
              <span>{getSourceIcon(result.source)}</span>
              <span className="ml-2 capitalize">{result.source?.toLowerCase()}</span>
              {result.createdAt && (
                <>
                  <span className="mx-2">•</span>
                  <span>{formatRelativeTime(result.createdAt)}</span>
                </>
              )}
            </div>
            <p className="text-anchor-800">{result.summary || result.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
