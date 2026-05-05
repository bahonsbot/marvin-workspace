'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  watchlistApi,
  type WatchlistItem,
  type WatchlistWithItems,
} from '@/lib/convex/watchlist-api';
import { sampleWatchlists } from './sample-watchlist';

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

interface WatchlistMetadataItem {
  symbol: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string;
  pe: string;
  week52Low: string;
  week52High: string;
  week52Position: number | null;
  price: string;
  rawPrice: number | null;
  priceTime: string;
  currency: string;
  changePct: string;
  dayPoints: number[];
  tone: 'positive' | 'negative' | 'neutral';
  source: string;
  quoteFreshness: string;
  providerDelay?: string;
}

interface WatchlistNewsItem {
  symbol: string;
  name: string;
  source: string;
  time: string;
  publishedAt?: string;
  title: string;
  summary: string;
  url?: string;
  kind?: 'story' | 'video' | 'press-release' | 'news';
}

interface WatchlistMetadataResponse {
  items: WatchlistMetadataItem[];
  news?: WatchlistNewsItem[];
}

function tickerResultMeta(result: TickerSearchResult) {
  return [result.country, result.currency, result.type].filter(Boolean).join(' · ');
}

const DEMO_USER_KEY = 'lab-single-user';
const WATCHLIST_METADATA_CACHE_KEY = 'mission-control-lab:watchlist-metadata:v1';
const WATCHLIST_NEWS_CACHE_KEY = 'mission-control-lab:watchlist-news:v1';
const WATCHLIST_METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WATCHLIST_NEWS_CACHE_TTL_MS = 30 * 60 * 1000;
type PriceAlertStatus = 'no-rule' | 'waiting' | 'near-low' | 'near-high' | 'below-min' | 'above-max' | 'unavailable';
type WatchlistSortKey = 'name' | 'price' | 'change' | 'priceAlert' | 'alert' | 'updated';
const sortLabels: Record<WatchlistSortKey, string> = {
  name: 'Name',
  price: 'Price',
  change: 'Price change',
  priceAlert: 'Price alert',
  alert: 'Alert',
  updated: 'Recently updated',
};
const priceAlertStatusLabels: Record<PriceAlertStatus, string> = {
  'no-rule': 'No rule',
  waiting: 'Inside range',
  'near-low': 'Near low',
  'near-high': 'Near high',
  'below-min': 'Below min',
  'above-max': 'Above max',
  unavailable: 'No quote',
};
const priceAlertStatusRank: Record<PriceAlertStatus, number> = {
  'below-min': 0,
  'above-max': 1,
  'near-low': 2,
  'near-high': 3,
  waiting: 4,
  unavailable: 5,
  'no-rule': 6,
};
type WatchlistItemPatch = {
  alertEnabled?: boolean;
  alertMinPrice?: number | null;
  alertMaxPrice?: number | null;
};

type CachedWatchlistMetadataEntry = {
  cachedAt: number;
  item: WatchlistMetadataItem;
};

type CachedWatchlistNewsEntry = {
  cachedAt: number;
  news: WatchlistNewsItem[];
};

function symbolHref(symbol: string) {
  return `/trading/ticker/${encodeURIComponent(symbol)}`;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function initialsFor(item: WatchlistItem) {
  const source = item.displaySymbol || item.symbol;
  return source.replace(/\W/g, '').slice(0, 2) || '•';
}

function WatchlistLogo({ item, metadata }: { item: WatchlistItem; metadata?: WatchlistMetadataItem }) {
  const logoUrl = metadata?.logoUrl;
  return (
    <span className={`trading-watchlist-logo ${logoUrl ? 'has-logo' : 'initials-only'}`} aria-hidden={logoUrl ? undefined : true}>
      {logoUrl ? <img src={logoUrl} alt={metadata?.logoAlt ?? `${item.displaySymbol || item.symbol} logo`} loading="lazy" decoding="async" /> : <span>{initialsFor(item)}</span>}
    </span>
  );
}

function parseMetricNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanAlertInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10000) / 10000;
}

function formatAlertPrice(value: number | undefined, currency?: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Set';
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 2 : 4,
    minimumFractionDigits: value >= 100 ? 2 : 0,
  }).format(value);
  return currency ? `${formatted}` : formatted;
}

function evaluatePriceAlert(item: WatchlistItem, metadata?: WatchlistMetadataItem): PriceAlertStatus {
  const hasMin = typeof item.alertMinPrice === 'number' && Number.isFinite(item.alertMinPrice) && item.alertMinPrice > 0;
  const hasMax = typeof item.alertMaxPrice === 'number' && Number.isFinite(item.alertMaxPrice) && item.alertMaxPrice > 0;
  const enabled = item.alertEnabled ?? (hasMin || hasMax);
  if (!enabled || (!hasMin && !hasMax)) return 'no-rule';
  const price = metadata?.rawPrice;
  if (typeof price !== 'number' || !Number.isFinite(price)) return 'unavailable';
  if (hasMin && price <= item.alertMinPrice!) return 'below-min';
  if (hasMax && price >= item.alertMaxPrice!) return 'above-max';
  const nearDistance = 0.02;
  if (hasMin && price <= item.alertMinPrice! * (1 + nearDistance)) return 'near-low';
  if (hasMax && price >= item.alertMaxPrice! * (1 - nearDistance)) return 'near-high';
  return 'waiting';
}


function isProviderPlaceholderDisplayName(value: string | undefined | null) {
  const normalizedValue = (value ?? '').trim().toLowerCase();
  return normalizedValue.includes('covered by eodhd market-data endpoints')
    || normalizedValue.includes('verified company summary is not available yet')
    || normalizedValue.includes('verified fund strategy summary is not available yet');
}

function isTickerLikeDisplayName(value: string | undefined | null, symbol: string) {
  const normalizedValue = (value ?? '').trim().toUpperCase();
  if (!normalizedValue) return true;
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return true;
  if (normalizedValue === normalizedSymbol) return true;
  if (normalizedValue === normalizedSymbol.split('.')[0]) return true;
  return false;
}

function resolvedWatchlistName(item: WatchlistItem, metadata?: WatchlistMetadataItem) {
  const metadataName = metadata?.name?.trim();
  const safeMetadataName = metadataName && !isProviderPlaceholderDisplayName(metadataName) ? metadataName : undefined;
  const savedName = item.name?.trim();
  const savedNameIsFallback = isTickerLikeDisplayName(savedName, item.symbol) || isProviderPlaceholderDisplayName(savedName) || !savedName;
  if (safeMetadataName && savedNameIsFallback) return safeMetadataName;
  if (savedName && !savedNameIsFallback) return savedName;
  return safeMetadataName || metadata?.symbol || item.symbol || item.displaySymbol || 'Provider pending';
}

function resolvedWatchlistSymbol(item: WatchlistItem, metadata?: WatchlistMetadataItem) {
  return metadata?.symbol || item.symbol || item.displaySymbol;
}

function watchlistMetadataForItem(metadata: Map<string, WatchlistMetadataItem>, item: WatchlistItem) {
  return metadata.get(normalizeSymbol(item.symbol))
    ?? metadata.get(item.symbol)
    ?? metadata.get(normalizeSymbol(item.displaySymbol))
    ?? metadata.get(item.displaySymbol);
}

function metadataMapFromItems(items: WatchlistMetadataItem[], requestedSymbols: string[] = []) {
  const next = new Map<string, WatchlistMetadataItem>();
  items.forEach((item, index) => {
    const requestedSymbol = requestedSymbols[index];
    if (requestedSymbol) next.set(normalizeSymbol(requestedSymbol), item);
    next.set(normalizeSymbol(item.symbol), item);
  });
  return next;
}

function readWatchlistMetadataCache(symbols: string[]) {
  if (typeof window === 'undefined') return new Map<string, WatchlistMetadataItem>();
  try {
    const raw = window.localStorage.getItem(WATCHLIST_METADATA_CACHE_KEY);
    if (!raw) return new Map<string, WatchlistMetadataItem>();
    const parsed = JSON.parse(raw) as Record<string, CachedWatchlistMetadataEntry>;
    const now = Date.now();
    const next = new Map<string, WatchlistMetadataItem>();
    for (const symbol of symbols) {
      const normalizedSymbol = normalizeSymbol(symbol);
      const cached = parsed[normalizedSymbol];
      if (!cached?.item || now - cached.cachedAt > WATCHLIST_METADATA_CACHE_TTL_MS) continue;
      next.set(normalizedSymbol, cached.item);
      next.set(normalizeSymbol(cached.item.symbol), cached.item);
    }
    return next;
  } catch {
    return new Map<string, WatchlistMetadataItem>();
  }
}

function writeWatchlistMetadataCache(items: WatchlistMetadataItem[], requestedSymbols: string[]) {
  if (typeof window === 'undefined' || !items.length) return;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(WATCHLIST_METADATA_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, CachedWatchlistMetadataEntry> : {};
    const next: Record<string, CachedWatchlistMetadataEntry> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry?.item || now - entry.cachedAt > WATCHLIST_METADATA_CACHE_TTL_MS) continue;
      next[key] = entry;
    }
    items.forEach((item, index) => {
      const requestedSymbol = requestedSymbols[index];
      const entry = { cachedAt: now, item };
      next[normalizeSymbol(item.symbol)] = entry;
      if (requestedSymbol) next[normalizeSymbol(requestedSymbol)] = entry;
    });
    window.localStorage.setItem(WATCHLIST_METADATA_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Cache is best-effort only. Rendering should never depend on localStorage.
  }
}


function watchlistNewsCacheKey(symbolsKey: string) {
  return symbolsKey.split(',').map(normalizeSymbol).filter(Boolean).sort().join(',');
}

function readWatchlistNewsCache(symbolsKey: string) {
  if (typeof window === 'undefined') return [] as WatchlistNewsItem[];
  try {
    const key = watchlistNewsCacheKey(symbolsKey);
    if (!key) return [];
    const raw = window.localStorage.getItem(WATCHLIST_NEWS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, CachedWatchlistNewsEntry>;
    const cached = parsed[key];
    if (!cached?.news?.length || Date.now() - cached.cachedAt > WATCHLIST_NEWS_CACHE_TTL_MS) return [];
    return cached.news;
  } catch {
    return [];
  }
}

function writeWatchlistNewsCache(symbolsKey: string, news: WatchlistNewsItem[]) {
  if (typeof window === 'undefined' || !news.length) return;
  try {
    const key = watchlistNewsCacheKey(symbolsKey);
    if (!key) return;
    const now = Date.now();
    const raw = window.localStorage.getItem(WATCHLIST_NEWS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, CachedWatchlistNewsEntry> : {};
    const next: Record<string, CachedWatchlistNewsEntry> = {};
    for (const [entryKey, entry] of Object.entries(parsed)) {
      if (!entry?.news?.length || now - entry.cachedAt > WATCHLIST_NEWS_CACHE_TTL_MS) continue;
      next[entryKey] = entry;
    }
    next[key] = { cachedAt: now, news };
    window.localStorage.setItem(WATCHLIST_NEWS_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Cache is best-effort only. Rendering should never depend on localStorage.
  }
}

function sortWatchlistItems(items: WatchlistItem[], metadata: Map<string, WatchlistMetadataItem>, sortKey: WatchlistSortKey) {
  return [...items].sort((a, b) => {
    const metaA = watchlistMetadataForItem(metadata, a);
    const metaB = watchlistMetadataForItem(metadata, b);
    if (sortKey === 'name') return resolvedWatchlistName(a, metaA).localeCompare(resolvedWatchlistName(b, metaB));
    if (sortKey === 'price') return (parseMetricNumber(metaB?.price) ?? -Infinity) - (parseMetricNumber(metaA?.price) ?? -Infinity);
    if (sortKey === 'change') return (parseMetricNumber(metaB?.changePct) ?? -Infinity) - (parseMetricNumber(metaA?.changePct) ?? -Infinity);
    if (sortKey === 'priceAlert') {
      const statusA = evaluatePriceAlert(a, metaA);
      const statusB = evaluatePriceAlert(b, metaB);
      return priceAlertStatusRank[statusA] - priceAlertStatusRank[statusB];
    }
    if (sortKey === 'alert') return priceAlertStatusRank[evaluatePriceAlert(a, metaA)] - priceAlertStatusRank[evaluatePriceAlert(b, metaB)];
    return b.updatedAt - a.updatedAt;
  });
}

function FiveDaySparkline({ values, tone }: { values?: number[]; tone: WatchlistMetadataItem['tone'] }) {
  const cleanValues = (values ?? []).filter((value) => Number.isFinite(value));
  if (cleanValues.length < 2) return <span className="trading-watchlist-spark-empty" aria-label="5D chart unavailable" />;
  const width = 86;
  const height = 28;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const points = cleanValues.map((value, index) => {
    const x = (index / Math.max(cleanValues.length - 1, 1)) * (width - 4) + 2;
    const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className={`trading-watchlist-mini-spark ${tone}`} viewBox={`0 0 ${width} ${height}`} aria-label="5D price history sparkline" role="img">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Week52Range({ metadata }: { metadata?: WatchlistMetadataItem }) {
  const position = metadata?.week52Position;
  return (
    <div className="trading-watchlist-52w" aria-label="52 week range">
      <span>{metadata?.week52Low ?? '—'}</span>
      <i><b style={{ left: `${position ?? 50}%` }} data-empty={position == null ? 'true' : undefined} /></i>
      <span>{metadata?.week52High ?? '—'}</span>
    </div>
  );
}

function PriceAlertCell({ item, metadata, canMutate, isSaving, onUpdate }: {
  item: WatchlistItem;
  metadata?: WatchlistMetadataItem;
  canMutate: boolean;
  isSaving?: boolean;
  onUpdate?: (id: string, patch: WatchlistItemPatch) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<'min' | 'max' | null>(null);
  const [draft, setDraft] = useState('');
  const currency = metadata?.currency;

  function startEdit(side: 'min' | 'max') {
    if (!canMutate || isSaving) return;
    const value = side === 'min' ? item.alertMinPrice : item.alertMaxPrice;
    setEditing(side);
    setDraft(typeof value === 'number' ? String(value) : '');
  }

  async function save() {
    if (!editing) return;
    const value = cleanAlertInput(draft);
    const nextMin = editing === 'min' ? value : item.alertMinPrice;
    const nextMax = editing === 'max' ? value : item.alertMaxPrice;
    const ok = await onUpdate?.(item._id, {
      alertEnabled: Boolean(nextMin || nextMax),
      [editing === 'min' ? 'alertMinPrice' : 'alertMaxPrice']: value,
    });
    if (ok !== false) setEditing(null);
  }

  function cancel() {
    setEditing(null);
    setDraft('');
  }

  function renderButton(side: 'min' | 'max') {
    const label = side === 'min' ? 'Min' : 'Max';
    const value = side === 'min' ? item.alertMinPrice : item.alertMaxPrice;
    if (editing === side) {
      return (
        <span className="trading-watchlist-alert-edit">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save();
              if (event.key === 'Escape') cancel();
            }}
            onBlur={() => void save()}
            inputMode="decimal"
            autoFocus
            aria-label={`${label} price alert for ${resolvedWatchlistSymbol(item, metadata)}`}
          />
        </span>
      );
    }
    return (
      <button
        type="button"
        className={`trading-watchlist-alert-bound ${typeof value === 'number' ? 'set' : 'empty'}`}
        onClick={() => startEdit(side)}
        disabled={!canMutate || isSaving}
        title={`Click to ${typeof value === 'number' ? 'change or remove' : 'set'} ${label.toLowerCase()} alert`}
      >
        <span>{label}</span>
        <strong>{formatAlertPrice(value, currency)}</strong>
      </button>
    );
  }

  return (
    <div className="trading-watchlist-price-alert-cell">
      {renderButton('min')}
      {renderButton('max')}
    </div>
  );
}

function PriceAlertStatusPill({ status }: { status: PriceAlertStatus }) {
  return <span className={`trading-watchlist-alert-status ${status}`}>{priceAlertStatusLabels[status]}</span>;
}

function PinIcon({ active }: { active?: boolean }) {
  return (
    <span className={`trading-watchlist-pin-icon ${active ? 'active' : ''}`} title={active ? 'Pinned to Overview' : 'Not pinned'} aria-label={active ? 'Pinned to Overview' : 'Not pinned'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 4.5 19.5 9.5 17.4 11.6 19.2 15.2 17.8 16.6 13.8 12.6 11.2 15.2 11.5 18.6 10.2 19.9 8.3 16.2 4.6 14.3 5.9 13 9.3 13.3 11.9 10.7 7.9 6.7 9.3 5.3 12.9 7.1 14.5 4.5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function WatchlistAddForm({ enabled, watchlistId, onSaved }: { enabled: boolean; watchlistId?: string; onSaved?: () => void }) {
  if (!enabled) return <DisabledWatchlistAddForm />;
  return <LiveWatchlistAddForm watchlistId={watchlistId} onSaved={onSaved} />;
}

function DisabledWatchlistAddForm() {
  return (
    <form className="trading-watchlist-add-form">
      <label className="trading-watchlist-symbol-field">
        <span>Symbol</span>
        <input placeholder="Search ticker or company" disabled />
      </label>
      <label>
        <span>Alert</span>
        <select disabled defaultValue="watch">
          <option value="none">No alert</option>
          <option value="watch">Watch</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="wide">
        <span>Watch note</span>
        <input placeholder="Why is this worth watching?" disabled />
      </label>
      <button type="button" disabled>Add symbol</button>
      <p>Connect Convex to save watchlists.</p>
    </form>
  );
}

function LiveWatchlistAddForm({ watchlistId, onSaved }: { watchlistId?: string; onSaved?: () => void }) {
  const addItem = useMutation(watchlistApi.add);
  const [symbol, setSymbol] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<TickerSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [thesis, setThesis] = useState('');
  const [alertMinPrice, setAlertMinPrice] = useState('');
  const [alertMaxPrice, setAlertMaxPrice] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const trimmedSymbol = symbol.trim();
  const searchResultsId = useId();
  const selectedResult = searchResults[Math.min(activeResultIndex, Math.max(searchResults.length - 1, 0))];
  const showSearchPanel = searchOpen && Boolean(trimmedSymbol) && (searchLoading || searchError || searchResults.length > 0);

  useEffect(() => {
    if (!trimmedSymbol || selectedTicker?.symbol === normalizeSymbol(trimmedSymbol)) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/trading/search?q=${encodeURIComponent(trimmedSymbol)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as TickerSearchResponse;
        setSearchResults(data.results ?? []);
        setActiveResultIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedTicker?.symbol, trimmedSymbol]);

  function selectTicker(result: TickerSearchResult) {
    setSymbol(result.symbol);
    setSelectedTicker(result);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setStatus(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSymbol = normalizeSymbol(symbol);
    if (!nextSymbol) {
      setStatus('Add a symbol first.');
      return;
    }
    const lockedTicker = selectedTicker?.symbol === nextSymbol ? selectedTicker : null;
    setIsSaving(true);
    setStatus(null);
    try {
      await addItem({
        userKey: DEMO_USER_KEY,
        watchlistId,
        symbol: nextSymbol,
        name: lockedTicker?.name,
        exchange: lockedTicker?.exchange,
        currency: lockedTicker?.currency,
        thesis: thesis.trim() || undefined,
        alertEnabled: Boolean(cleanAlertInput(alertMinPrice) || cleanAlertInput(alertMaxPrice)),
        alertMinPrice: cleanAlertInput(alertMinPrice) ?? undefined,
        alertMaxPrice: cleanAlertInput(alertMaxPrice) ?? undefined,
        tags: [],
      });
      setSymbol('');
      setSelectedTicker(null);
      setSearchResults([]);
      setThesis('');
      setAlertMinPrice('');
      setAlertMaxPrice('');
      setStatus(`${nextSymbol} added to watchlist.`);
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save watchlist item.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="trading-watchlist-add-form" onSubmit={handleSubmit}>
      <label className="trading-watchlist-symbol-field">
        <span>Symbol</span>
        <div className="trading-watchlist-symbol-search">
          <input
            value={symbol}
            onChange={(event) => {
              setSymbol(event.target.value);
              setSelectedTicker(null);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearchOpen(false);
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveResultIndex((index) => Math.min(index + 1, Math.max(searchResults.length - 1, 0)));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveResultIndex((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === 'Enter' && searchOpen && selectedResult) {
                event.preventDefault();
                selectTicker(selectedResult);
              }
            }}
            placeholder="Search ticker or company"
            aria-label="Search ticker or company"
            aria-autocomplete="list"
            aria-controls={showSearchPanel ? searchResultsId : undefined}
            disabled={isSaving}
          />
          {showSearchPanel ? (
            <div id={searchResultsId} className="trading-watchlist-symbol-results" role="listbox" aria-label="Symbol search results">
              {searchLoading ? <div className="trading-watchlist-symbol-state">Searching symbols…</div> : null}
              {!searchLoading && searchError ? <div className="trading-watchlist-symbol-state">{searchError}</div> : null}
              {!searchLoading && !searchError && searchResults.map((result, index) => (
                <button
                  key={result.symbol}
                  type="button"
                  role="option"
                  aria-selected={index === activeResultIndex}
                  data-active={index === activeResultIndex ? 'true' : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveResultIndex(index)}
                  onClick={() => selectTicker(result)}
                >
                  <strong>{result.symbol}</strong>
                  <span>{result.name}</span>
                  <small>{tickerResultMeta(result)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {selectedTicker ? <em className="trading-watchlist-symbol-selected">Selected {selectedTicker.symbol} · {selectedTicker.name}</em> : null}
      </label>
      <label>
        <span>Min alert</span>
        <input value={alertMinPrice} onChange={(event) => setAlertMinPrice(event.target.value)} inputMode="decimal" placeholder="Below" disabled={isSaving} />
      </label>
      <label>
        <span>Max alert</span>
        <input value={alertMaxPrice} onChange={(event) => setAlertMaxPrice(event.target.value)} inputMode="decimal" placeholder="Above" disabled={isSaving} />
      </label>
      <label className="wide">
        <span>Watch note</span>
        <input value={thesis} onChange={(event) => setThesis(event.target.value)} placeholder="Why is this worth watching?" disabled={isSaving} />
      </label>
      <button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Add symbol'}</button>
      <p>{status ?? 'Search by ticker or company, then choose a result to lock in the listing.'}</p>
    </form>
  );
}

function WatchlistTable({ items, watchlists, activeWatchlistId, canMutate, metadata, metadataLoading, onRemove, onUpdate, onMove, removingId, updatingId, movingId, updateError }: {
  items: WatchlistItem[];
  watchlists: WatchlistWithItems[];
  activeWatchlistId?: string;
  canMutate: boolean;
  metadata: Map<string, WatchlistMetadataItem>;
  metadataLoading?: boolean;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, patch: WatchlistItemPatch) => Promise<boolean>;
  onMove?: (id: string, targetWatchlistId: string) => Promise<boolean>;
  removingId?: string | null;
  updatingId?: string | null;
  movingId?: string | null;
  updateError?: { id: string; message: string } | null;
}) {
  const [openRowMenu, setOpenRowMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const moveTargets = watchlists.filter((watchlist) => watchlist._id !== activeWatchlistId);

  function toggleRowMenu(item: WatchlistItem, event: React.MouseEvent<HTMLButtonElement>) {
    if (openRowMenu?.id === item._id) {
      setOpenRowMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setOpenRowMenu({
      id: item._id,
      left: Math.min(window.innerWidth - 300, Math.max(16, rect.right - 284)),
      top: Math.max(16, rect.top - 96),
    });
  }

  useEffect(() => {
    if (!openRowMenu) return;
    function closeMenu() {
      setOpenRowMenu(null);
    }
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openRowMenu]);

  return (
    <div className="trading-table-shell trading-watchlist-page-table-shell">
      <table className="trading-table trading-watchlist-page-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Price</th>
            <th>5D</th>
            <th>P/E</th>
            <th>52W</th>
            <th>Price Alert</th>
            <th>Status</th>
            <th aria-label="More" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const itemMetadata = watchlistMetadataForItem(metadata, item);
            const tone = itemMetadata?.tone ?? 'neutral';
            const displayName = resolvedWatchlistName(item, itemMetadata);
            const alertStatus = evaluatePriceAlert(item, itemMetadata);
            return (
              <tr key={item._id}>
                <td>
                  <div className="trading-watchlist-symbol-cell">
                    <WatchlistLogo item={item} metadata={itemMetadata} />
                    <div>
                      <Link href={symbolHref(resolvedWatchlistSymbol(item, itemMetadata))}>{resolvedWatchlistSymbol(item, itemMetadata)}</Link>
                    </div>
                  </div>
                </td>
                <td>{displayName}</td>
                <td>
                  {itemMetadata?.price ?? (metadataLoading ? 'Loading…' : '—')}
                  <span className={`trading-watchlist-change ${tone}`}>
                    {itemMetadata?.changePct ?? (metadataLoading ? 'Provider' : '—')}
                  </span>
                </td>
                <td className="trading-watchlist-day-cell">
                  <FiveDaySparkline values={itemMetadata?.dayPoints} tone={tone} />
                </td>
                <td>{itemMetadata?.pe ?? (metadataLoading ? 'Loading…' : '—')}</td>
                <td><Week52Range metadata={itemMetadata} /></td>
                <td>
                  <PriceAlertCell item={item} metadata={itemMetadata} canMutate={canMutate} isSaving={updatingId === item._id} onUpdate={onUpdate} />
                </td>
                <td>
                  <PriceAlertStatusPill status={alertStatus} />
                </td>
                <td className="trading-watchlist-row-actions">
                  <button type="button" className="trading-watchlist-more-button" onClick={(event) => toggleRowMenu(item, event)} aria-expanded={openRowMenu?.id === item._id} aria-label={`Move ${resolvedWatchlistSymbol(item, itemMetadata)} to another watchlist`}>
                    <span aria-hidden="true">↔</span>
                  </button>
                  <button type="button" className="trading-watchlist-remove-pill" onClick={() => onRemove?.(item._id)} disabled={!canMutate || item._id.startsWith('sample-') || removingId === item._id || updatingId === item._id || movingId === item._id} aria-label={`Remove ${resolvedWatchlistSymbol(item, itemMetadata)}`}>
                    <span aria-hidden="true">{removingId === item._id ? '…' : '−'}</span>
                  </button>
                  {updateError?.id === item._id ? <span className="trading-watchlist-row-error">{updateError.message}</span> : null}
                  {openRowMenu?.id === item._id ? (
                    <div className="trading-watchlist-row-menu" style={{ left: openRowMenu.left, top: openRowMenu.top }}>
                      <strong>Move {resolvedWatchlistSymbol(item, itemMetadata)}</strong>
                      {moveTargets.length ? (
                        <div className="trading-watchlist-move-list">
                          {moveTargets.map((watchlist) => (
                            <button
                              key={watchlist._id}
                              type="button"
                              onClick={async () => {
                                const ok = await onMove?.(item._id, watchlist._id);
                                if (ok) setOpenRowMenu(null);
                              }}
                              disabled={!canMutate || movingId === item._id || updatingId === item._id}
                            >
                              <span>{watchlist.name}</span>
                              <em>{watchlist.items.length} symbols</em>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p>Create another watchlist first, then move symbols between lists here.</p>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LiveWatchlistTable({ items, watchlists, activeWatchlistId, metadata, metadataLoading }: { items: WatchlistItem[]; watchlists: WatchlistWithItems[]; activeWatchlistId?: string; metadata: Map<string, WatchlistMetadataItem>; metadataLoading?: boolean }) {
  const removeItem = useMutation(watchlistApi.remove);
  const updateItem = useMutation(watchlistApi.update);
  const moveItem = useMutation(watchlistApi.move);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<{ id: string; message: string } | null>(null);

  async function remove(id: string) {
    if (id.startsWith('sample-')) return;
    setRemovingId(id);
    try {
      await removeItem({ id });
    } finally {
      setRemovingId(null);
    }
  }

  async function update(id: string, patch: WatchlistItemPatch) {
    if (id.startsWith('sample-')) return false;
    setUpdatingId(id);
    setUpdateError(null);
    try {
      await updateItem({ id, ...patch });
      return true;
    } catch (error) {
      setUpdateError({ id, message: error instanceof Error ? error.message : 'Could not update row.' });
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function move(id: string, targetWatchlistId: string) {
    if (id.startsWith('sample-')) return false;
    setMovingId(id);
    setUpdateError(null);
    try {
      await moveItem({ id, targetWatchlistId, userKey: DEMO_USER_KEY });
      return true;
    } catch (error) {
      setUpdateError({ id, message: error instanceof Error ? error.message : 'Could not move row.' });
      return false;
    } finally {
      setMovingId(null);
    }
  }

  return <WatchlistTable items={items} watchlists={watchlists} activeWatchlistId={activeWatchlistId} canMutate metadata={metadata} metadataLoading={metadataLoading} onRemove={remove} onUpdate={update} onMove={move} removingId={removingId} updatingId={updatingId} movingId={movingId} updateError={updateError} />;
}

function WatchlistTabs({
  watchlists,
  activeId,
  onSelect,
}: {
  watchlists: WatchlistWithItems[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="trading-watchlist-tabs" aria-label="Watchlists">
      {watchlists.map((watchlist) => (
        <button key={watchlist._id} type="button" className={watchlist._id === activeId ? 'active' : ''} onClick={() => onSelect(watchlist._id)}>
          <strong>{watchlist.name}</strong>
          <span>{watchlist.items.length} symbols{watchlist.pinned ? ' · pinned' : ''}</span>
        </button>
      ))}
    </nav>
  );
}

function WatchlistLoadingState() {
  return (
    <div className="trading-watchlist-loading-state" aria-live="polite">
      <div>
        <span>Loading live watchlists…</span>
        <p>Checking Convex before showing any rows.</p>
      </div>
      <div className="trading-watchlist-loading-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function StaticWatchlistManager() {
  return (
    <div className="trading-watchlist-menu-panel" aria-label="Watchlist management unavailable">
      <div>
        <h3>Manage watchlist</h3>
        <p>Connect Convex to create lists, add symbols, and pin watchlists to Overview.</p>
      </div>
      <DisabledWatchlistAddForm />
      <button type="button" disabled>Pin to Overview</button>
      <button type="button" disabled>Rename watchlist</button>
      <button type="button" disabled>New list</button>
    </div>
  );
}

function LiveWatchlistManager({ activeWatchlist, canDelete, onCreated, onClose }: {
  activeWatchlist?: WatchlistWithItems;
  canDelete: boolean;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const createWatchlist = useMutation(watchlistApi.createWatchlist);
  const updateWatchlist = useMutation(watchlistApi.updateWatchlist);
  const deleteWatchlist = useMutation(watchlistApi.deleteWatchlist);
  const [name, setName] = useState(activeWatchlist?.name ?? '');
  const [description, setDescription] = useState(activeWatchlist?.description ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(activeWatchlist?.name ?? '');
    setDescription(activeWatchlist?.description ?? '');
    setStatus(null);
  }, [activeWatchlist?._id, activeWatchlist?.name, activeWatchlist?.description]);

  async function updateActive(patch: { name?: string; description?: string; pinned?: boolean }, success: string) {
    if (!activeWatchlist) return;
    setIsSaving(true);
    setStatus(null);
    try {
      await updateWatchlist({ id: activeWatchlist._id, ...patch });
      setStatus(success);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  async function renameActive() {
    const nextName = name.trim();
    if (!nextName) {
      setStatus('Name the watchlist first.');
      return;
    }
    await updateActive({ name: nextName, description: description.trim() || undefined }, 'Watchlist details saved.');
  }

  async function createNew() {
    setIsSaving(true);
    setStatus(null);
    try {
      const id = await createWatchlist({ userKey: DEMO_USER_KEY, name: 'New Watchlist' });
      onCreated(id);
      setStatus('New watchlist created.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteActive() {
    if (!activeWatchlist || !canDelete) return;
    setIsSaving(true);
    setStatus(null);
    try {
      await deleteWatchlist({ id: activeWatchlist._id, userKey: DEMO_USER_KEY });
      setStatus('Watchlist deleted.');
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="trading-watchlist-menu-panel" aria-label="Manage watchlist">
      <div>
        <h3>Manage watchlist</h3>
        <p>Add symbols, save list details, and choose whether this list appears on Overview later.</p>
      </div>
      <WatchlistAddForm enabled watchlistId={activeWatchlist?._id} onSaved={onClose} />
      <div className="trading-watchlist-menu-fields">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving || !activeWatchlist} />
        </label>
        <label>
          <span>Description</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSaving || !activeWatchlist} placeholder="Optional list context" />
        </label>
      </div>
      <div className="trading-watchlist-menu-actions">
        <button type="button" onClick={() => updateActive({ pinned: !activeWatchlist?.pinned }, activeWatchlist?.pinned ? 'Removed from Overview.' : 'Pinned to Overview.')} disabled={isSaving || !activeWatchlist}>
          {activeWatchlist?.pinned ? 'Unpin from Overview' : 'Pin to Overview'}
        </button>
        <button type="button" onClick={renameActive} disabled={isSaving || !activeWatchlist}>Save details</button>
        <button type="button" onClick={createNew} disabled={isSaving}>New list</button>
        <button type="button" onClick={deleteActive} disabled={isSaving || !canDelete || !activeWatchlist}>Delete list</button>
      </div>
      {status ? <p className="trading-watchlist-menu-status">{status}</p> : null}
    </div>
  );
}

function newsSortValue(item: WatchlistNewsItem) {
  const timestamp = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
  if (Number.isFinite(timestamp)) return timestamp;
  const relative = item.time.match(/^(\d+)\s*([mhd])\s+ago$/i);
  if (!relative) return 0;
  const value = Number(relative[1]);
  const unit = relative[2].toLowerCase();
  if (unit === 'm') return Date.now() - value * 60_000;
  if (unit === 'h') return Date.now() - value * 60 * 60_000;
  return Date.now() - value * 24 * 60 * 60_000;
}

type WatchlistNewsSortKey = 'newest' | 'ticker';

function WatchlistNews({ items, metadata, news, isLoading }: { items: WatchlistItem[]; metadata: Map<string, WatchlistMetadataItem>; news: WatchlistNewsItem[]; isLoading?: boolean }) {
  const [symbolFilter, setSymbolFilter] = useState('all');
  const [newsSort, setNewsSort] = useState<WatchlistNewsSortKey>('newest');
  const previewItems = items.slice(0, 6);
  const newsSymbols = useMemo(() => Array.from(new Set(news.map((item) => item.symbol))).sort(), [news]);
  const visibleNews = useMemo(() => {
    const filtered = symbolFilter === 'all' ? news : news.filter((item) => item.symbol === symbolFilter);
    const sorted = [...filtered].sort((a, b) => {
      if (newsSort === 'ticker') return a.symbol.localeCompare(b.symbol) || newsSortValue(b) - newsSortValue(a);
      return newsSortValue(b) - newsSortValue(a) || a.symbol.localeCompare(b.symbol);
    });
    return sorted.slice(0, 16);
  }, [news, newsSort, symbolFilter]);

  useEffect(() => {
    if (symbolFilter !== 'all' && !newsSymbols.includes(symbolFilter)) setSymbolFilter('all');
  }, [newsSymbols, symbolFilter]);

  return (
    <section className="trading-watchlist-news-panel">
      <div className="trading-section-head trading-watchlist-news-head">
        <div>
          <div className="trading-section-label">Watchlist news</div>
          {news.length ? <p>{visibleNews.length} of {news.length} linked headlines · newest first</p> : null}
        </div>
        {news.length ? (
          <div className="trading-watchlist-news-controls">
            <label>
              <span>Filter</span>
              <select value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value)}>
                <option value="all">All tickers</option>
                {newsSymbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={newsSort} onChange={(event) => setNewsSort(event.target.value as WatchlistNewsSortKey)}>
                <option value="newest">Newest</option>
                <option value="ticker">Ticker</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
      {isLoading ? (
        <p>Loading watchlist news…</p>
      ) : visibleNews.length ? (
        <div className="trading-watchlist-news-list">
          {visibleNews.map((item) => (
            <article key={`${item.symbol}-${item.title}`}>
              <a href={item.url} target="_blank" rel="noreferrer" aria-label={`${item.title} source link`}>
                <span><b>{item.symbol}</b> · {item.source} · {item.time}{item.kind === 'video' ? ' · Video' : ''}</span>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </a>
            </article>
          ))}
        </div>
      ) : news.length ? (
        <p>No headlines match the selected filter.</p>
      ) : items.length ? (
        <div className="trading-watchlist-news-placeholder">
          <div className="trading-watchlist-news-symbols">
            {previewItems.map((item) => (
              <span key={item._id}>
                <WatchlistLogo item={item} metadata={watchlistMetadataForItem(metadata, item)} />
                {resolvedWatchlistSymbol(item, watchlistMetadataForItem(metadata, item))}
              </span>
            ))}
          </div>
          <p>No provider-linked headlines are available for this list right now.</p>
        </div>
      ) : (
        <p>Add symbols to see related headlines for the selected watchlist.</p>
      )}
    </section>
  );
}

function WatchlistLayout({ watchlists, isLive, isLoading }: { watchlists: WatchlistWithItems[]; isLive: boolean; isLoading?: boolean }) {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortKey, setSortKey] = useState<WatchlistSortKey>('updated');
  const [metadata, setMetadata] = useState<Map<string, WatchlistMetadataItem>>(new Map());
  const [watchlistNews, setWatchlistNews] = useState<WatchlistNewsItem[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeWatchlist = useMemo(() => {
    if (!watchlists.length) return undefined;
    return watchlists.find((watchlist) => watchlist._id === selectedWatchlistId) ?? watchlists[0];
  }, [selectedWatchlistId, watchlists]);
  const items = useMemo(() => activeWatchlist?.items ?? [], [activeWatchlist?.items]);
  const sortedItems = useMemo(() => sortWatchlistItems(items, metadata, sortKey), [items, metadata, sortKey]);
  const symbols = useMemo(() => items.map((item) => normalizeSymbol(item.symbol)).filter(Boolean).sort(), [items]);
  const symbolsKey = useMemo(() => symbols.join(','), [symbols]);

  useEffect(() => {
    if (!symbolsKey) {
      setMetadata(new Map());
      setWatchlistNews([]);
      setMetadataLoading(false);
      return;
    }
    const requestedSymbols = symbolsKey.split(',').filter(Boolean);
    setMetadata(readWatchlistMetadataCache(requestedSymbols));
    setWatchlistNews(readWatchlistNewsCache(symbolsKey));
    const controller = new AbortController();
    setMetadataLoading(true);
    fetch(`/api/trading/watchlist-metadata?symbols=${encodeURIComponent(symbolsKey)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Metadata failed (${response.status})`);
        return response.json() as Promise<WatchlistMetadataResponse>;
      })
      .then((data) => {
        const items = data.items ?? [];
        writeWatchlistMetadataCache(items, requestedSymbols);
        const news = data.news ?? [];
        writeWatchlistNewsCache(symbolsKey, news);
        setMetadata(metadataMapFromItems(items, requestedSymbols));
        setWatchlistNews(news.length ? news : readWatchlistNewsCache(symbolsKey));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMetadata(readWatchlistMetadataCache(requestedSymbols));
          setWatchlistNews(readWatchlistNewsCache(symbolsKey));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetadataLoading(false);
      });
    return () => controller.abort();
  }, [symbolsKey]);

  useEffect(() => {
    setMenuOpen(false);
  }, [activeWatchlist?._id]);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <section className="trading-watchlist-command-bar">
        <div>
          <h1>Watchlists</h1>
        </div>
        <div className="trading-watchlist-command-actions" ref={menuRef}>
          <label className="trading-watchlist-sort-control">
            <span>Sort by</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as WatchlistSortKey)}>
              {(Object.keys(sortLabels) as WatchlistSortKey[]).map((key) => <option key={key} value={key}>{sortLabels[key]}</option>)}
            </select>
          </label>
          <button type="button" className="trading-watchlist-manage-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            Manage watchlist
          </button>
          {menuOpen ? (
            isLive ? (
              <LiveWatchlistManager activeWatchlist={activeWatchlist} canDelete={watchlists.length > 1} onCreated={setSelectedWatchlistId} onClose={() => setMenuOpen(false)} />
            ) : (
              <StaticWatchlistManager />
            )
          ) : null}
        </div>
      </section>

      <section className="trading-watchlist-workspace">
        <WatchlistTabs watchlists={watchlists} activeId={activeWatchlist?._id} onSelect={setSelectedWatchlistId} />
        <article className="trading-watchlist-main-panel">
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">{isLoading ? 'Loading Convex…' : activeWatchlist?.name ?? (isLive ? 'No watchlist yet' : 'Local preview data')}</div>
            </div>
            <PinIcon active={activeWatchlist?.pinned} />
          </div>
          {isLoading ? (
            <WatchlistLoadingState />
          ) : items.length ? (
            isLive ? <LiveWatchlistTable items={sortedItems} watchlists={watchlists} activeWatchlistId={activeWatchlist?._id} metadata={metadata} metadataLoading={metadataLoading} /> : <WatchlistTable items={sortedItems} watchlists={watchlists} activeWatchlistId={activeWatchlist?._id} canMutate={false} metadata={metadata} metadataLoading={metadataLoading} />
          ) : (
            <div className="trading-watchlist-empty-state">
              <span>No tracked names yet</span>
              <p>Open Manage watchlist to add symbols to this list.</p>
            </div>
          )}
        </article>
      </section>

      <WatchlistNews items={items} metadata={metadata} news={watchlistNews} isLoading={isLoading || (metadataLoading && !watchlistNews.length)} />
    </>
  );
}

function LiveWatchlistContent() {
  const liveWatchlists = useQuery(watchlistApi.listWatchlists, { userKey: DEMO_USER_KEY });
  const isLoading = liveWatchlists === undefined;
  return <WatchlistLayout watchlists={isLoading ? [] : liveWatchlists} isLive isLoading={isLoading} />;
}

export function WatchlistClient({ convexEnabled }: { convexEnabled: boolean }) {
  if (!convexEnabled) return <WatchlistLayout watchlists={sampleWatchlists} isLive={false} />;
  return <LiveWatchlistContent />;
}
