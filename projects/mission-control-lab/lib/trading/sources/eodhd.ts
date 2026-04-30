import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  TickerBalanceSheetSnapshot,
  TickerCashDebtSnapshot,
  TickerDisplayMetric,
  TickerFinancialHighlight,
  TickerFinancialOverview,
  TickerNewsItem,
  TickerPriceRangeSeries,
  TickerPriceSeries,
  TickerProfile,
  TickerProfileSourceMap,
  TickerSourceMeta,
} from '../contracts';
import type { TickerProfileSource } from '../sources';
import { withProfileSource } from '../sources';
import { fetchSecTickerFundamentals } from './sec';
import { fetchWikipediaCompanyLogo, fetchWikipediaCompanyProfile } from './wikipedia';

const EODHD_BASE_URL = 'https://eodhd.com/api';
const EODHD_USER_AGENT = 'MissionControlLab/1.0 (https://motiondisplay.cloud; eodhd-provider)';
const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';
let workspaceEnvApiKey: string | null | undefined;

export const EODHD_PRICE_RANGES = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'] as const;

type EodhdPriceRange = (typeof EODHD_PRICE_RANGES)[number];

interface EodhdEodRow {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  adjusted_close?: number;
  volume?: number;
}

interface EodhdIntradayRow {
  timestamp?: number;
  datetime?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface EodhdQuoteResponse {
  code?: string;
  timestamp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  previousClose?: number;
  change?: number;
  change_p?: number;
}

interface EodhdExchangeDetails {
  Name?: string;
  Code?: string;
  Country?: string;
  Currency?: string;
  Timezone?: string;
}

export interface EodhdSearchResult {
  Code?: string;
  Exchange?: string;
  Name?: string;
  Type?: string;
  Country?: string;
  Currency?: string;
  ISIN?: string | null;
  isPrimary?: boolean;
  previousClose?: number;
  previousCloseDate?: string;
}

interface EodhdDividendRow {
  date?: string;
  declarationDate?: string;
  recordDate?: string;
  paymentDate?: string;
  period?: string;
  value?: number;
  unadjustedValue?: number;
  currency?: string;
}

interface EodhdSplitRow {
  date?: string;
  split?: string;
}

interface EodhdNewsRow {
  date?: string;
  title?: string;
  content?: string;
  link?: string;
  symbols?: string[];
  tags?: string[];
  sentiment?: {
    polarity?: number;
    neg?: number;
    neu?: number;
    pos?: number;
  };
}

type EodhdPoint = { time: string | number; value: number; open?: number; high?: number; low?: number; volume?: number };

export interface EodhdMarketDataBundle {
  resolvedSymbol: string;
  searchResult: EodhdSearchResult | null;
  quote: EodhdQuoteResponse | null;
  priceSeries: TickerPriceSeries | null;
  dividends: EodhdDividendRow[];
  splits: EodhdSplitRow[];
  news: TickerNewsItem[];
  source: TickerSourceMeta;
}

function readWorkspaceEnvApiKey() {
  if (workspaceEnvApiKey !== undefined) return workspaceEnvApiKey;
  workspaceEnvApiKey = null;
  try {
    const raw = readFileSync(path.join(WORKSPACE_ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith('EODHD_API_KEY=')) continue;
      workspaceEnvApiKey = trimmed.split('=', 2)[1]?.trim().replace(/^['"]|['"]$/g, '') || null;
      break;
    }
  } catch {
    workspaceEnvApiKey = null;
  }
  return workspaceEnvApiKey;
}

function eodhdApiKey() {
  return process.env.EODHD_API_KEY?.trim() || readWorkspaceEnvApiKey();
}

export function hasEodhdApiKey() {
  return Boolean(eodhdApiKey());
}

export function eodhdSource(asOf: string, note: string, freshness: TickerSourceMeta['freshness'] = 'fresh'): TickerSourceMeta {
  return {
    source: 'eodhd',
    asOf,
    freshness,
    note,
  };
}

function compact(value: number | null | undefined, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function formatMoney(value: number | null | undefined, currency = 'USD') {
  if (value == null || Number.isNaN(value)) return '$—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: value >= 100 ? 2 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(value >= 100 ? 2 : 4)}`;
  }
}

function formatQuoteTime(epochSeconds: number | undefined, fallback: string) {
  const asOf = epochSeconds ? new Date(epochSeconds * 1000) : new Date(fallback);
  return `EODHD · ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(asOf)}`;
}

function formatSigned(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}`;
}

function formatPct(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

function formatLarge(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString('en-US');
}

function formatRelativeTime(dateValue: string | undefined) {
  if (!dateValue) return 'Time pending';
  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) return 'Time pending';
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 60) return `${diffMinutes || 1}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(timestamp));
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeNewsContent(content: string | undefined) {
  const clean = stripHtml(content ?? '');
  if (!clean) return 'Provider-backed headline from EODHD. Full article opens at source.';
  const sentenceMatch = clean.match(/^(.{80,260}?[.!?])\s/);
  const summary = sentenceMatch?.[1] ?? clean.slice(0, 220);
  return summary.length < clean.length ? `${summary.replace(/[\s,;:]+$/, '')}…` : summary;
}

function safeSymbol(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
}

function endpoint(path: string, params: Record<string, string | number | undefined | null> = {}) {
  const apiToken = eodhdApiKey();
  if (!apiToken) return null;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(key, String(value));
  }
  search.set('api_token', apiToken);
  search.set('fmt', 'json');
  return `${EODHD_BASE_URL}${path}?${search.toString()}`;
}

async function fetchEodhdJson<T>(path: string, params: Record<string, string | number | undefined | null> = {}): Promise<T | null> {
  const url = endpoint(path, params);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': EODHD_USER_AGENT,
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(now: Date, days: number) {
  const next = startOfUtcDay(now);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function yearsAgo(now: Date, years: number) {
  const next = startOfUtcDay(now);
  next.setUTCFullYear(next.getUTCFullYear() - years);
  return next;
}

function unixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function eodRangeStart(range: EodhdPriceRange, now: Date) {
  if (range === '1M') return daysAgo(now, 45);
  if (range === '6M') return daysAgo(now, 220);
  if (range === 'YTD') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (range === '1Y') return daysAgo(now, 390);
  return yearsAgo(now, 5);
}

function rangeAxis(points: Array<{ time: string | number; value: number }>, intraday = false) {
  if (!points.length) return [];
  const formatter = intraday
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
    : new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const indices = [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1].map((ratio) => Math.min(points.length - 1, Math.round((points.length - 1) * ratio)));
  return Array.from(new Set(indices)).map((index) => {
    const time = points[index].time;
    const date = typeof time === 'number' ? new Date(time * 1000) : new Date(time);
    return formatter.format(date);
  });
}

function compactValues(points: Array<{ value: number }>) {
  if (points.length <= 36) return points.map((point) => Number(point.value.toFixed(2)));
  const output: number[] = [];
  const last = points.length - 1;
  for (let index = 0; index < 36; index += 1) {
    const sourceIndex = Math.round((index / 35) * last);
    output.push(Number(points[sourceIndex].value.toFixed(2)));
  }
  return output;
}

function isEodhdPoint(point: EodhdPoint | null): point is EodhdPoint {
  return point !== null;
}

function statsForPoints(points: EodhdPoint[], currency: string): TickerDisplayMetric[] {
  const first = points.at(0);
  const last = points.at(-1);
  const change = first && last ? last.value - first.value : null;
  const changePct = change != null && first?.value ? (change / first.value) * 100 : null;
  const highs = points.map((point) => point.high).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const lows = points.map((point) => point.low).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const volume = points.reduce((sum, point) => sum + (point.volume ?? 0), 0);
  return [
    { label: 'Range Start', value: formatMoney(first?.value, currency) },
    { label: 'Range End', value: formatMoney(last?.value, currency) },
    { label: 'Range Change', value: change == null ? '$—' : `${formatSigned(change)} (${formatPct(changePct ?? 0)})` },
    { label: 'Range High', value: formatMoney(highs.length ? Math.max(...highs) : undefined, currency) },
    { label: 'Range Low', value: formatMoney(lows.length ? Math.min(...lows) : undefined, currency) },
    { label: 'Range Volume', value: formatLarge(volume) },
  ];
}

function rangeFromEodRows(range: EodhdPriceRange, rows: EodhdEodRow[], source: TickerSourceMeta, currency: string): TickerPriceRangeSeries | null {
  const points = rows
    .map((row): EodhdPoint | null => {
      const value = compact(row.adjusted_close ?? row.close);
      if (!row.date || value == null) return null;
      return { time: row.date, value, open: row.open, high: row.high, low: row.low, volume: row.volume };
    })
    .filter(isEodhdPoint)
    .sort((a, b) => Date.parse(String(a.time)) - Date.parse(String(b.time)));
  if (!points.length) return null;
  return {
    range,
    points,
    axis: rangeAxis(points),
    stats: statsForPoints(points, currency),
    source,
    status: 'available',
  };
}

function rangeFromIntradayRows(range: EodhdPriceRange, rows: EodhdIntradayRow[], source: TickerSourceMeta, currency: string): TickerPriceRangeSeries | null {
  const points = rows
    .map((row): EodhdPoint | null => {
      const value = compact(row.close);
      if (typeof row.timestamp !== 'number' || value == null) return null;
      return { time: row.timestamp, value, open: row.open, high: row.high, low: row.low, volume: row.volume };
    })
    .filter(isEodhdPoint)
    .sort((a, b) => Number(a.time) - Number(b.time));
  if (!points.length) return null;
  return {
    range,
    points,
    axis: rangeAxis(points, true),
    stats: statsForPoints(points, currency),
    source,
    status: 'available',
  };
}

async function fetchRange(symbol: string, range: EodhdPriceRange, now: Date, source: TickerSourceMeta, currency: string) {
  if (range === '1D' || range === '5D') {
    const days = range === '1D' ? 3 : 10;
    const rows = await fetchEodhdJson<EodhdIntradayRow[]>(`/intraday/${encodeURIComponent(symbol)}`, {
      interval: range === '1D' ? '5m' : '1h',
      from: unixSeconds(daysAgo(now, days)),
      to: unixSeconds(now),
    });
    return rangeFromIntradayRows(range, Array.isArray(rows) ? rows : [], source, currency);
  }

  const rows = await fetchEodhdJson<EodhdEodRow[]>(`/eod/${encodeURIComponent(symbol)}`, {
    from: isoDate(eodRangeStart(range, now)),
    period: range === '5Y' ? 'w' : 'd',
    order: 'a',
  });
  return rangeFromEodRows(range, Array.isArray(rows) ? rows : [], source, currency);
}

function safeSearchQuery(input: string) {
  return input.trim().replace(/[^A-Za-z0-9.\-\s]/g, '').replace(/\s+/g, ' ').trim();
}

export async function fetchEodhdSearch(query: string) {
  const normalized = safeSearchQuery(query);
  if (!normalized) return [];
  const data = await fetchEodhdJson<EodhdSearchResult[]>(`/search/${encodeURIComponent(normalized)}`);
  return Array.isArray(data) ? data : [];
}

async function fetchEodhdExchangeDetails(exchange: string) {
  return fetchEodhdJson<EodhdExchangeDetails>(`/exchange-details/${encodeURIComponent(exchange)}`);
}

export async function resolveEodhdSymbol(symbol: string) {
  const normalized = safeSymbol(symbol);
  if (!normalized) return null;
  if (normalized.includes('.')) return { resolvedSymbol: normalized, searchResult: null };

  const results = await fetchEodhdSearch(normalized);
  const exact = results.find((item) => item.Code?.toUpperCase() === normalized && item.Exchange?.toUpperCase() === 'US')
    ?? results.find((item) => item.Code?.toUpperCase() === normalized && item.isPrimary)
    ?? results.find((item) => item.Code?.toUpperCase() === normalized)
    ?? results[0]
    ?? null;
  if (!exact?.Code || !exact.Exchange) return null;
  return {
    resolvedSymbol: `${exact.Code.toUpperCase()}.${exact.Exchange.toUpperCase()}`,
    searchResult: exact,
  };
}

function buildEodhdNews(rows: EodhdNewsRow[], source: TickerSourceMeta): TickerNewsItem[] {
  return rows
    .filter((item) => item.title && item.link)
    .slice(0, 6)
    .map((item) => ({
      source: 'EODHD News',
      time: formatRelativeTime(item.date),
      title: item.title!,
      summary: summarizeNewsContent(item.content),
      url: item.link,
      sourceMeta: source,
      relatedTickers: item.symbols,
      kind: 'news',
    }));
}

export async function fetchEodhdMarketData(symbol: string, now = new Date()): Promise<EodhdMarketDataBundle | null> {
  if (!hasEodhdApiKey()) return null;
  const resolved = await resolveEodhdSymbol(symbol);
  if (!resolved) return null;

  const asOf = now.toISOString();
  const source = eodhdSource(asOf, 'EODHD EOD+Intraday plan. Provider-backed global market data, dividends, splits, technicals, exchange metadata, and news.');
  const quote = await fetchEodhdJson<EodhdQuoteResponse>(`/real-time/${encodeURIComponent(resolved.resolvedSymbol)}`);
  const currency = resolved.searchResult?.Currency ?? 'USD';
  const [rangeEntries, dividends, splits, news] = await Promise.all([
    Promise.all(EODHD_PRICE_RANGES.map(async (range) => {
      const series = await fetchRange(resolved.resolvedSymbol, range, now, source, currency);
      return series ? [range, series] as const : null;
    })),
    fetchEodhdJson<EodhdDividendRow[]>(`/div/${encodeURIComponent(resolved.resolvedSymbol)}`, { from: isoDate(yearsAgo(now, 5)) }),
    fetchEodhdJson<EodhdSplitRow[]>(`/splits/${encodeURIComponent(resolved.resolvedSymbol)}`, { from: isoDate(yearsAgo(now, 10)) }),
    fetchEodhdJson<EodhdNewsRow[]>('/news', { s: resolved.resolvedSymbol, limit: 6 }),
  ]);

  const rangeSeries = Object.fromEntries(rangeEntries.filter((entry): entry is readonly [EodhdPriceRange, TickerPriceRangeSeries] => Boolean(entry)));
  const activeRange = rangeSeries['1Y'] ? '1Y' : Object.keys(rangeSeries)[0];
  const priceSeries: TickerPriceSeries | null = activeRange
    ? {
        values: compactValues(rangeSeries[activeRange].points),
        ranges: EODHD_PRICE_RANGES.filter((range) => rangeSeries[range]),
        activeRange,
        axis: rangeSeries[activeRange].axis,
        stats: rangeSeries[activeRange].stats,
        source,
        rangeSeries,
      }
    : null;

  return {
    resolvedSymbol: resolved.resolvedSymbol,
    searchResult: resolved.searchResult,
    quote,
    priceSeries,
    dividends: Array.isArray(dividends) ? dividends : [],
    splits: Array.isArray(splits) ? splits : [],
    news: buildEodhdNews(Array.isArray(news) ? news : [], source),
    source,
  };
}

export function buildEodhdDividendMetrics(bundle: EodhdMarketDataBundle): TickerDisplayMetric[] {
  const dividends = bundle.dividends
    .filter((item) => item.date && typeof item.value === 'number')
    .sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!));
  const latest = dividends[0];
  const now = Date.now();
  const trailing = dividends.filter((item) => item.date && now - Date.parse(item.date) <= 366 * 24 * 60 * 60 * 1000);
  const trailingTotal = trailing.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const price = bundle.quote?.close;
  const yieldPct = price && trailingTotal ? (trailingTotal / price) * 100 : null;

  return [
    {
      label: 'Latest dividend',
      value: latest?.value != null ? formatMoney(latest.value, latest.currency ?? bundle.searchResult?.Currency ?? 'USD') : 'Data unavailable',
      status: latest ? 'available' : 'unavailable',
      note: latest?.date ? `Ex-date ${latest.date}${latest.paymentDate ? ` · paid ${latest.paymentDate}` : ''}` : 'EODHD returned no dividend rows for this symbol.',
      source: bundle.source,
    },
    {
      label: 'Trailing 12M dividends',
      value: trailing.length ? formatMoney(trailingTotal, latest?.currency ?? bundle.searchResult?.Currency ?? 'USD') : 'Data unavailable',
      status: trailing.length ? 'available' : 'unavailable',
      note: trailing.length ? `${trailing.length} payment${trailing.length === 1 ? '' : 's'} in the last year.` : 'No trailing dividend payments found.',
      source: bundle.source,
    },
    {
      label: 'Indicated yield',
      value: yieldPct == null ? 'Data unavailable' : `${yieldPct.toFixed(2)}%`,
      status: yieldPct == null ? 'unavailable' : 'available',
      note: yieldPct == null ? 'Needs current quote and trailing dividend data.' : 'Computed from EODHD delayed quote and trailing dividends.',
      source: bundle.source,
    },
    {
      label: 'Dividend frequency',
      value: latest?.period ?? 'Data unavailable',
      status: latest?.period ? 'available' : 'unavailable',
      note: 'Provider-supplied period when available.',
      source: bundle.source,
    },
  ];
}

export function buildEodhdTechnicalMetrics(bundle: EodhdMarketDataBundle): TickerDisplayMetric[] {
  const active = bundle.priceSeries?.rangeSeries?.['1Y'];
  const points = active?.points ?? [];
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  const latest = values.at(-1);
  const yearHigh = values.length ? Math.max(...values) : null;
  const yearLow = values.length ? Math.min(...values) : null;
  const first = values.at(0);
  const returnPct = latest != null && first ? ((latest - first) / first) * 100 : null;
  const currency = bundle.quote?.code?.endsWith('.VN') ? 'VND' : bundle.searchResult?.Currency ?? 'USD';
  return [
    { label: '1Y range high', value: formatMoney(yearHigh, currency), status: yearHigh == null ? 'unavailable' : 'available', source: bundle.source },
    { label: '1Y range low', value: formatMoney(yearLow, currency), status: yearLow == null ? 'unavailable' : 'available', source: bundle.source },
    { label: '1Y return', value: returnPct == null ? 'Data unavailable' : formatPct(returnPct), status: returnPct == null ? 'unavailable' : 'available', source: bundle.source },
  ];
}

function unavailableSource(asOf: string, note: string): TickerSourceMeta {
  return {
    source: 'eodhd',
    asOf,
    freshness: 'missing',
    note,
  };
}

function eodhdSourceMap(source: TickerSourceMeta, missing: TickerSourceMeta): TickerProfileSourceMap {
  return {
    quote: source,
    profile: source,
    prices: source,
    financials: missing,
    news: source,
    resources: missing,
    filings: missing,
  };
}

function buildHeaderStats(bundle: EodhdMarketDataBundle): TickerDisplayMetric[] {
  return [
    { label: 'Market Cap', value: 'Provider pending', status: 'unavailable', note: 'Current EODHD plan excludes fundamentals/market-cap fields.' },
    { label: 'P/E (TTM)', value: 'Provider pending', status: 'unavailable', note: 'Current EODHD plan excludes fundamentals/ratios.' },
    { label: 'Country', value: bundle.searchResult?.Country ?? 'Provider pending', status: bundle.searchResult?.Country ? 'available' : 'unavailable' },
    { label: 'Type', value: bundle.searchResult?.Type ?? 'Provider pending', status: bundle.searchResult?.Type ? 'available' : 'unavailable' },
  ];
}

function unavailableFinancialHighlights(source: TickerSourceMeta): TickerFinancialHighlight[] {
  return ['Revenue', 'Net Income', 'Gross Margin', 'Operating Margin', 'EPS', 'Free Cash Flow', 'ROE', 'ROIC', 'Debt / Equity'].map((label) => ({
    label,
    value: 'Unavailable',
    delta: 'Provider required',
    tone: 'neutral',
    trend: [],
    source,
    status: 'unavailable',
    note: 'The active EODHD plan does not include Fundamental Data. Use SEC for US tickers or a future fundamentals provider.',
  }));
}

function unavailableCashDebt(source: TickerSourceMeta): TickerCashDebtSnapshot {
  return {
    period: 'Provider required',
    currency: '—',
    cashPercent: 50,
    debtPercent: 50,
    totalCash: 'Unavailable',
    totalDebt: 'Unavailable',
    netCash: 'Unavailable',
    netCashLabel: 'Net Cash',
    freeCashFlow: 'Unavailable',
    operatingCashFlow: 'Unavailable',
    interpretation: 'Fundamentals unavailable for this symbol',
    source,
  };
}

function unavailableBalanceSheet(source: TickerSourceMeta): TickerBalanceSheetSnapshot {
  return {
    period: 'Provider required',
    currency: '—',
    kpis: [
      { label: 'Debt / Equity', value: 'Unavailable', caption: 'Fundamentals provider required', tone: 'neutral' },
      { label: 'Current Ratio', value: 'Unavailable', caption: 'Fundamentals provider required', tone: 'neutral' },
      { label: 'Net Cash', value: 'Unavailable', caption: 'Fundamentals provider required', tone: 'neutral' },
    ],
    annual: [],
    note: 'Balance-sheet fields are intentionally blank because this EODHD plan excludes Fundamental Data.',
    source,
  };
}

function unavailableFinancialOverview(): TickerFinancialOverview {
  return {
    bars: [],
    status: 'unavailable',
    note: 'Revenue/net income chart requires SEC coverage for US tickers or a fundamentals provider for global tickers.',
  };
}

function unavailableKeyRatios(source: TickerSourceMeta): TickerDisplayMetric[] {
  return ['P/E Ratio', 'Forward P/E', 'PEG Ratio', 'Price / Sales', 'EV / EBITDA', 'Price / Book', 'Current Ratio', 'Quick Ratio'].map((label) => ({
    label,
    value: 'Unavailable',
    status: 'unavailable',
    note: 'Current EODHD plan excludes fundamentals/valuation ratios.',
    source,
  }));
}

function buildSupplemental(bundle: EodhdMarketDataBundle) {
  const estimates = unavailableSource(bundle.source.asOf, 'Current EODHD plan does not include Fundamental or Calendar APIs. Analyst estimates remain a manual broker-check slot until another provider is enabled.');
  const ownership = unavailableSource(bundle.source.asOf, 'Ownership requires a dedicated holdings/insider adapter. EODHD Extended does not include this as a clean fundamentals feed.');
  const dividendMetrics = buildEodhdDividendMetrics(bundle);
  const technicalMetrics = buildEodhdTechnicalMetrics(bundle);
  return {
    dividends: {
      status: dividendMetrics.some((metric) => metric.status === 'available') ? 'available' as const : 'unavailable' as const,
      note: 'Historical dividends from EODHD Extended. Upcoming calendar events are not included in this plan.',
      source: bundle.source,
      metrics: dividendMetrics,
    },
    technicals: {
      status: technicalMetrics.some((metric) => metric.status === 'available') ? 'available' as const : 'unavailable' as const,
      note: 'Range-derived technical context from EODHD EOD/intraday data.',
      source: bundle.source,
      metrics: technicalMetrics,
    },
    estimates: {
      status: 'unavailable' as const,
      note: 'Analyst estimates are not included in the current EODHD plan. Check broker apps manually for now.',
      source: estimates,
      metrics: [],
    },
    ownership: {
      status: 'unavailable' as const,
      note: 'Ownership and insider activity need a dedicated provider before display.',
      source: ownership,
      metrics: [],
    },
  };
}

export const eodhdTickerProfileSource: TickerProfileSource = {
  id: 'eodhd',
  label: 'EODHD global market-data adapter',
  async fetchProfile({ symbol, now }) {
    const bundle = await fetchEodhdMarketData(symbol, now);
    if (!bundle?.quote || !bundle.priceSeries) return null;

    const asOf = bundle.quote.timestamp ? new Date(bundle.quote.timestamp * 1000).toISOString() : now.toISOString();
    const exchangeCode = bundle.resolvedSymbol.split('.').at(-1) ?? bundle.searchResult?.Exchange ?? '';
    const [exchangeDetails, companyLogoResult, companyProfileResult, secFundamentals] = await Promise.all([
      exchangeCode ? fetchEodhdExchangeDetails(exchangeCode) : Promise.resolve(null),
      fetchWikipediaCompanyLogo(bundle.resolvedSymbol, bundle.searchResult?.Name ?? bundle.resolvedSymbol),
      fetchWikipediaCompanyProfile(bundle.resolvedSymbol, bundle.searchResult?.Name ?? bundle.resolvedSymbol, [
        { label: 'Exchange', value: exchangeCode || 'Provider pending' },
        { label: 'Country', value: bundle.searchResult?.Country ?? 'Provider pending' },
        { label: 'Currency', value: bundle.searchResult?.Currency ?? 'Provider pending' },
        { label: 'ISIN', value: bundle.searchResult?.ISIN ?? 'Provider pending' },
      ]),
      fetchSecTickerFundamentals(bundle.resolvedSymbol.replace(/\.US$/, ''), null),
    ]);
    const missing = unavailableSource(asOf, 'Current EODHD plan excludes Fundamental Data and Calendar Data.');
    const sourceMap = eodhdSourceMap(bundle.source, missing);
    if (secFundamentals) {
      sourceMap.financials = secFundamentals.source;
      sourceMap.resources = secFundamentals.source;
      sourceMap.filings = secFundamentals.source;
    }

    const price = bundle.quote.close;
    const previousClose = bundle.quote.previousClose;
    const change = bundle.quote.change ?? (price != null && previousClose != null ? price - previousClose : 0);
    const changePct = bundle.quote.change_p ?? (previousClose ? (change / previousClose) * 100 : 0);
    const tone = change < 0 ? 'negative' : change > 0 ? 'positive' : 'neutral';
    const currency = bundle.searchResult?.Currency ?? exchangeDetails?.Currency ?? 'USD';
    const name = bundle.searchResult?.Name ?? bundle.resolvedSymbol;
    const exchange = [exchangeDetails?.Name, bundle.searchResult?.Country].filter(Boolean).join(' · ') || bundle.searchResult?.Exchange || exchangeCode || 'EODHD';

    const profile: TickerProfile = {
      symbol: bundle.resolvedSymbol,
      name,
      exchange,
      currency,
      inWatchlist: false,
      quote: {
        price: formatMoney(price, currency),
        change: formatSigned(change),
        changePct: formatPct(changePct),
        priceTime: formatQuoteTime(bundle.quote.timestamp, asOf),
        currency,
        tone,
        source: bundle.source,
      },
      headerStats: buildHeaderStats(bundle),
      tabs: ['Overview', 'Financials', 'News', 'Metrics', 'Estimates', 'Dividends', 'Ownership', 'SEC Filings'],
      priceSeries: bundle.priceSeries,
      companyLogo: companyLogoResult ?? {
        url: null,
        alt: `${name} logo`,
        source: unavailableSource(asOf, 'Logo provider returned no confident match; using ticker initials fallback.'),
      },
      companyProfile: companyProfileResult?.profile ?? {
        summary: `${name} is covered by EODHD market-data endpoints. Fundamentals are unavailable under the current plan unless covered separately by SEC EDGAR or another provider.`,
        facts: [
          { label: 'Exchange', value: exchangeCode || 'Provider pending' },
          { label: 'Country', value: bundle.searchResult?.Country ?? exchangeDetails?.Country ?? 'Provider pending' },
          { label: 'Currency', value: currency },
          { label: 'ISIN', value: bundle.searchResult?.ISIN ?? 'Provider pending' },
        ],
        source: bundle.source,
      },
      financialHighlights: secFundamentals?.financialHighlights ?? unavailableFinancialHighlights(missing),
      cashDebtSnapshot: secFundamentals?.cashDebtSnapshot ?? unavailableCashDebt(missing),
      balanceSheetSnapshot: secFundamentals?.balanceSheetSnapshot ?? unavailableBalanceSheet(missing),
      recentNews: bundle.news.length ? bundle.news : [{
        source: 'EODHD News',
        time: 'Provider pending',
        title: `${bundle.resolvedSymbol} headlines unavailable`,
        summary: 'EODHD returned no usable linked headlines for this ticker.',
        sourceMeta: unavailableSource(asOf, 'EODHD News returned no usable linked headlines.'),
        kind: 'news',
      }],
      resources: secFundamentals?.resources ?? [],
      financialOverview: secFundamentals?.financialOverview ?? unavailableFinancialOverview(),
      keyRatios: secFundamentals?.keyRatios ?? unavailableKeyRatios(missing),
      supplemental: buildSupplemental(bundle),
      sourceMap,
      asOf,
      freshness: 'fresh',
    };

    return withProfileSource(profile, 'eodhd', asOf);
  },
};
