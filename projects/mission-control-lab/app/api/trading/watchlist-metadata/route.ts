import { NextResponse } from 'next/server';
import type { TickerDisplayMetric, TickerProfile } from '@/lib/trading/contracts';
import { getTickerProfile } from '@/lib/trading/ticker-profile';

type WatchlistMetadata = {
  symbol: string;
  logoUrl: string | null;
  logoAlt: string;
  pe: string;
  week52: string;
  price: string;
  changePct: string;
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

function rangeValue(stats: TickerDisplayMetric[], label: string) {
  return cleanMetric(stats.find((metric) => metric.label.trim().toLowerCase() === label)?.value);
}

function format52Week(profile: TickerProfile) {
  const range = profile.priceSeries.rangeSeries?.['1Y'];
  if (!range) return '—';
  const low = rangeValue(range.stats, 'range low');
  const high = rangeValue(range.stats, 'range high');
  if (low === '—' || high === '—') return '—';
  return `${low} - ${high}`;
}

function metadataFromProfile(profile: TickerProfile): WatchlistMetadata {
  const peMetric = findMetric(profile.keyRatios, ['P/E Ratio', 'P/E (TTM)', 'Trailing P/E'])
    ?? findMetric(profile.headerStats, ['P/E Ratio', 'P/E (TTM)', 'P/E']);
  return {
    symbol: profile.symbol,
    logoUrl: profile.companyLogo.url,
    logoAlt: profile.companyLogo.alt,
    pe: cleanMetric(peMetric?.value),
    week52: format52Week(profile),
    price: cleanMetric(profile.quote.price),
    changePct: cleanMetric(profile.quote.changePct),
    tone: profile.quote.tone,
    source: profile.sourceMap.profile.source,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') ?? '')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 24);

  if (!symbols.length) return NextResponse.json({ items: [] });

  const settled = await Promise.allSettled(symbols.map(async (symbol) => metadataFromProfile(await getTickerProfile(symbol))));
  const items = settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const symbol = symbols[index];
    return {
      symbol,
      logoUrl: null,
      logoAlt: `${symbol} logo`,
      pe: '—',
      week52: '—',
      price: '—',
      changePct: '—',
      tone: 'neutral' as const,
      source: 'unavailable',
    };
  });

  return NextResponse.json({ items });
}
