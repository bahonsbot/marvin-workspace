'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TickerQuote } from '@/lib/trading/contracts';

type RefreshState = 'idle' | 'refreshing' | 'updated' | 'error';

type QuoteRefreshResponse = Pick<TickerQuote, 'price' | 'change' | 'changePct' | 'tone' | 'priceTime' | 'updatedAt' | 'providerDelay'> & {
  symbol: string;
  fetchedAt: string;
  provider: string;
};

function formatLocalTime(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function statusText(state: RefreshState) {
  if (state === 'refreshing') return 'Refreshing…';
  if (state === 'updated') return 'Updated';
  if (state === 'error') return 'Refresh failed';
  return 'Auto-refresh on';
}

export function TickerQuoteRefresh({ initialQuote }: { initialQuote: TickerQuote }) {
  const symbol = initialQuote.symbol;
  const [quote, setQuote] = useState<TickerQuote>(initialQuote);
  const [state, setState] = useState<RefreshState>('idle');
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(initialQuote.source.asOf ?? null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const delayText = quote.providerDelay ?? 'EODHD delayed quote, exact exchange delay not reported by this endpoint.';
  const canRefresh = Boolean(symbol?.includes('.'));

  const metaLine = useMemo(() => {
    const quoteTime = formatLocalTime(quote.updatedAt ?? quote.source.asOf);
    const fetchedTime = formatLocalTime(lastFetchedAt);
    return `Quote ${quoteTime} · fetched ${fetchedTime}`;
  }, [lastFetchedAt, quote.source.asOf, quote.updatedAt]);

  async function refreshQuote(manual = false) {
    if (!canRefresh || !symbol || inFlightRef.current) return;
    if (document.visibilityState !== 'visible' && !manual) return;

    inFlightRef.current = true;
    setState('refreshing');
    setError(null);

    try {
      const response = await fetch(`/api/trading/quote/${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Quote refresh failed (${response.status})`);
      const data = (await response.json()) as QuoteRefreshResponse;
      setQuote((current) => ({
        ...current,
        price: data.price,
        change: data.change,
        changePct: data.changePct,
        tone: data.tone,
        priceTime: data.priceTime,
        updatedAt: data.updatedAt,
        providerDelay: data.providerDelay,
      }));
      setLastFetchedAt(data.fetchedAt);
      setState('updated');
      window.setTimeout(() => setState((current) => (current === 'updated' ? 'idle' : current)), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote refresh failed');
      setState('error');
    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!canRefresh) return;
    const schedule = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => void refreshQuote(false), 90_000);
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshQuote(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRefresh, symbol]);

  return (
    <div className="trading-ticker-price-block" data-refresh-state={state}>
      <strong>{quote.price}</strong>
      <em className={quote.tone}>{quote.change} ({quote.changePct})</em>
      <span>{quote.priceTime}</span>
      <div className="trading-quote-refresh-meta">
        <span>{metaLine}</span>
        <span>{delayText}</span>
      </div>
      <button
        type="button"
        className="trading-quote-refresh-button"
        onClick={() => void refreshQuote(true)}
        disabled={!canRefresh || state === 'refreshing'}
        aria-label="Refresh current quote"
      >
        <RefreshCw size={12} strokeWidth={2.2} />
        {statusText(state)}
      </button>
      {error ? <small className="trading-quote-refresh-error">{error}</small> : null}
    </div>
  );
}
