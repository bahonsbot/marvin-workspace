'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './shell.module.css';

interface TickerSearchResult {
  symbol: string;
  code: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  previousClose: number | null;
  previousCloseDate: string | null;
  isPrimary: boolean;
}

interface TickerSearchResponse {
  query: string;
  results: TickerSearchResult[];
}

function resultMeta(result: TickerSearchResult) {
  return [result.country, result.currency, result.type].filter(Boolean).join(' · ');
}

export function TickerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activeDomain = pathname.startsWith('/trading') ? 'trading' : 'general';
  const trimmedQuery = query.trim();
  const hasResults = results.length > 0;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open || trimmedQuery.length < 1) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/trading/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as TickerSearchResponse;
        setResults(data.results ?? []);
        setActiveIndex(0);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmedQuery]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selected = useMemo(() => results[Math.min(activeIndex, Math.max(results.length - 1, 0))], [activeIndex, results]);

  function navigateTo(symbol: string) {
    if (!symbol) return;
    router.push(`/trading/ticker/${encodeURIComponent(symbol)}`);
  }

  return (
    <div className={styles.tickerSearchWrap} ref={panelRef} data-open={open ? 'true' : undefined}>
      <button
        type="button"
        className={styles.topTabSearchButton}
        aria-label="Search ticker"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Search size={15} strokeWidth={2.2} />
      </button>
      {open ? (
        <div className={styles.tickerSearchPanel} role="dialog" aria-label="Ticker search">
          <div className={styles.tickerSearchInputRow}>
            <Search size={15} strokeWidth={2.2} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={activeDomain === 'trading' ? 'Search ticker or company, e.g. ASML.AS' : 'Search ticker'}
              aria-label="Search ticker or company"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false);
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (selected) navigateTo(selected.symbol);
                  else if (trimmedQuery) navigateTo(trimmedQuery.toUpperCase());
                }
              }}
            />
            {query ? (
              <button type="button" aria-label="Clear ticker search" onClick={() => setQuery('')}>
                <X size={14} strokeWidth={2.2} />
              </button>
            ) : null}
          </div>
          <div className={styles.tickerSearchHint}>Use exact exchange suffixes for global listings. ASML.AS is Amsterdam, ASML.US is the ADR.</div>
          <div className={styles.tickerSearchResults} role="listbox" aria-label="Ticker results">
            {loading ? <div className={styles.tickerSearchState}>Searching EODHD…</div> : null}
            {!loading && error ? <div className={styles.tickerSearchState}>{error}</div> : null}
            {!loading && !error && trimmedQuery && !hasResults ? <div className={styles.tickerSearchState}>No matching symbols found.</div> : null}
            {!loading && !error && !trimmedQuery ? <div className={styles.tickerSearchState}>Start typing a ticker, company, or exchange symbol.</div> : null}
            {!loading && !error && hasResults ? <div className={styles.tickerSearchState}>Showing ADRs plus local listings when EODHD can infer the company name.</div> : null}
            {results.map((result, index) => (
              <button
                key={result.symbol}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={styles.tickerSearchResult}
                data-active={index === activeIndex ? 'true' : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateTo(result.symbol)}
              >
                <span>
                  <strong>{result.symbol}</strong>
                  {result.isPrimary ? <em>Primary</em> : null}
                </span>
                <b>{result.name}</b>
                <small>{resultMeta(result)}{result.previousCloseDate ? ` · ${result.previousCloseDate}` : ''}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
