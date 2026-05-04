import { NextResponse } from 'next/server';
import type { TickerDisplayMetric, TickerNewsItem, TickerProfile } from '@/lib/trading/contracts';
import { getTickerProfile } from '@/lib/trading/ticker-profile';

type WatchlistNews = {
  symbol: string;
  name: string;
  source: string;
  time: string;
  title: string;
  summary: string;
  url?: string;
  kind?: TickerNewsItem['kind'];
};

type WatchlistProfilePayload = {
  metadata: WatchlistMetadata;
  news: WatchlistNews[];
};

type WatchlistMetadata = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string;
  pe: string;
  week52Low: string;
  week52High: string;
  week52Position: number | null;
  price: string;
  changePct: string;
  dayPoints: number[];
  tone: 'positive' | 'negative' | 'neutral';
  source: string;
};

function cleanMetric(value: string | undefined | null) {
  if (!value) return '—';
  const cleaned = value.replace(/^[A-Z]{3}\s+/, '').trim();
  if (!cleaned || /^provider pending$/i.test(cleaned) || /^data unavailable$/i.test(cleaned) || /^unavailable$/i.test(cleaned)) return '—';
  return cleaned;
}

function findMetric(metrics: TickerDisplayMetric[], labels: string[]) {
  const normalized = labels.map((label) => label.toLowerCase());
  return metrics.find((metric) => normalized.includes(metric.label.trim().toLowerCase()));
}

function formatCompactNumber(value: number | undefined | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    minimumFractionDigits: value >= 1000 ? 0 : 0,
  }).format(value);
}

function week52Metadata(profile: TickerProfile) {
  const range = profile.priceSeries.rangeSeries?.['1Y'];
  const values = range?.points.map((point) => point.value).filter((value) => Number.isFinite(value)) ?? [];
  if (!values.length) return { low: '—', high: '—', position: null };
  const low = Math.min(...values);
  const high = Math.max(...values);
  const current = profile.quote.rawPrice ?? values.at(-1) ?? null;
  const position = current == null || high === low
    ? null
    : Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return { low: formatCompactNumber(low), high: formatCompactNumber(high), position };
}

function compactFiveDayPoints(profile: TickerProfile) {
  const points = profile.priceSeries.rangeSeries?.['5D']?.points.map((point) => point.value).filter((value) => Number.isFinite(value)) ?? [];
  if (points.length <= 18) return points;
  const step = (points.length - 1) / 17;
  return Array.from({ length: 18 }, (_, index) => points[Math.round(index * step)]).filter((value): value is number => typeof value === 'number');
}

function metadataFromProfile(profile: TickerProfile): WatchlistMetadata {
  const peMetric = findMetric(profile.keyRatios, ['P/E Ratio', 'P/E (TTM)', 'Trailing P/E'])
    ?? findMetric(profile.headerStats, ['P/E Ratio', 'P/E (TTM)', 'P/E']);
  const week52 = week52Metadata(profile);
  return {
    symbol: profile.symbol,
    name: profile.name,
    logoUrl: profile.companyLogo.url,
    logoAlt: profile.companyLogo.alt || `${profile.name || profile.symbol} logo`,
    pe: cleanMetric(peMetric?.value),
    week52Low: week52.low,
    week52High: week52.high,
    week52Position: week52.position,
    price: cleanMetric(profile.quote.price),
    changePct: cleanMetric(profile.quote.changePct),
    dayPoints: compactFiveDayPoints(profile),
    tone: profile.quote.tone,
    source: profile.sourceMap.profile.source,
  };
}


function isUsableNewsItem(item: TickerNewsItem) {
  if (!item.title?.trim()) return false;
  if (!item.url?.trim()) return false;
  if (/headlines unavailable/i.test(item.title)) return false;
  if (/provider pending/i.test(item.time)) return false;
  return true;
}

function newsFromProfile(profile: TickerProfile): WatchlistNews[] {
  return profile.recentNews
    .filter(isUsableNewsItem)
    .slice(0, 3)
    .map((item) => ({
      symbol: profile.symbol,
      name: profile.name,
      source: item.source,
      time: item.time,
      title: item.title,
      summary: item.summary,
      url: item.url,
      kind: item.kind,
    }));
}

function payloadFromProfile(profile: TickerProfile): WatchlistProfilePayload {
  return {
    metadata: metadataFromProfile(profile),
    news: newsFromProfile(profile),
  };
}

function dedupeNews(items: WatchlistNews[]) {
  const seen = new Set<string>();
  const next: WatchlistNews[] = [];
  for (const item of items) {
    const key = item.url?.trim().toLowerCase() || `${item.symbol}:${item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
    if (next.length >= 18) break;
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') ?? '')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 24);

  if (!symbols.length) return NextResponse.json({ items: [] });

  const settled = await Promise.allSettled(symbols.map(async (symbol) => payloadFromProfile(await getTickerProfile(symbol))));
  const items = settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value.metadata;
    const symbol = symbols[index];
    return {
      symbol,
      name: symbol,
      logoUrl: null,
      logoAlt: `${symbol} logo`,
      pe: '—',
      week52Low: '—',
      week52High: '—',
      week52Position: null,
      price: '—',
      changePct: '—',
      dayPoints: [],
      tone: 'neutral' as const,
      source: 'unavailable',
    };
  });

  const news = dedupeNews(settled.flatMap((result) => result.status === 'fulfilled' ? result.value.news : []));

  return NextResponse.json({ items, news });
}
