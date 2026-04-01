'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchScopeRail } from '@/components/search/SearchScopeRail';
import { SearchResultsList } from '@/components/search/SearchResultsList';
import type { SearchQueryResponse, SearchScope } from '@/lib/types/contracts';

const EMPTY_RESPONSE: SearchQueryResponse = {
  status: 'partial',
  query: '',
  scope: 'all',
  limit: 50,
  total: 0,
  scannedFiles: 0,
  truncated: false,
  results: [],
  refreshedAt: new Date(0).toISOString(),
};

function normalizeScope(scope: string | null | undefined): SearchScope {
  if (scope === 'memory') return 'memory';
  if (scope === 'files') return 'files';
  if (scope === 'docs') return 'docs';
  if (scope === 'projects') return 'projects';
  if (scope === 'scripts') return 'scripts';
  return 'all';
}

export function SearchExperience({
  initialQuery,
  initialScope,
  initialData,
}: {
  initialQuery?: string;
  initialScope?: string;
  initialData?: SearchQueryResponse;
}) {
  const router = useRouter();

  const normalizedScope = normalizeScope(initialScope);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [scope, setScope] = useState<SearchScope>(normalizedScope);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchQueryResponse>(
    initialData ?? { ...EMPTY_RESPONSE, query: initialQuery?.trim() ?? '', scope: normalizedScope },
  );

  const canSearch = query.trim().length > 0;

  const summaryLine = useMemo(() => {
    if (!canSearch) return 'Keyword-first search across memory + workspace surfaces.';
    if (loading) return 'Searching…';

    const countLabel = data.total === 1 ? '1 result' : `${data.total} results`;
    const truncation = data.truncated ? ` (showing first ${data.limit})` : '';
    return `${countLabel} from ${data.scannedFiles} files${truncation}`;
  }, [canSearch, loading, data.total, data.scannedFiles, data.truncated, data.limit]);

  async function runSearch(nextQuery: string, nextScope: SearchScope) {
    const trimmed = nextQuery.trim();

    const nextParams = new URLSearchParams();
    if (trimmed.length > 0) {
      nextParams.set('q', trimmed);
      nextParams.set('scope', nextScope);
    }

    router.replace(`/search${nextParams.toString().length > 0 ? `?${nextParams.toString()}` : ''}`);

    if (trimmed.length === 0) {
      setData({ ...EMPTY_RESPONSE, query: '', scope: nextScope });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search/query?q=${encodeURIComponent(trimmed)}&scope=${encodeURIComponent(nextScope)}&limit=50`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        setData({ ...EMPTY_RESPONSE, query: trimmed, scope: nextScope });
        return;
      }

      const payload = (await response.json()) as SearchQueryResponse;
      setData(payload);
    } catch {
      setData({ ...EMPTY_RESPONSE, query: trimmed, scope: nextScope });
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query, scope);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 16, minHeight: 620 }}>
      <SearchScopeRail
        scope={scope}
        onScopeChange={(nextScope) => {
          setScope(nextScope);
          if (query.trim().length > 0) {
            void runSearch(query, nextScope);
          } else {
            setData({ ...EMPTY_RESPONSE, query: '', scope: nextScope });
          }
        }}
      />

      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 14,
          background: 'rgba(12, 20, 33, 0.72)',
          display: 'grid',
          alignContent: 'start',
          gap: 12,
          minWidth: 0,
        }}
      >
        <header style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Workspace Search</h2>
          <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search keyword, phrase, or filename"
              aria-label="Search query"
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(8, 14, 24, 0.6)',
                color: 'var(--text)',
                padding: '11px 12px',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                border: '1px solid rgba(94, 234, 212, 0.35)',
                background: 'rgba(94, 234, 212, 0.14)',
                color: '#5eead4',
                borderRadius: 12,
                padding: '0 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{summaryLine}</div>
        </header>

        <SearchResultsList data={data} />
      </section>
    </div>
  );
}
