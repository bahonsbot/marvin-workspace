import { NextResponse } from 'next/server';
import { fetchEodhdSearch, type EodhdSearchResult } from '@/lib/trading/sources/eodhd';

const FALLBACK_EXPANSIONS: Record<string, string[]> = {
  TSM: ['Taiwan Semiconductor Manufacturing'],
};

function resultKey(item: EodhdSearchResult) {
  return `${item.Code?.toUpperCase() ?? ''}.${item.Exchange?.toUpperCase() ?? ''}`;
}

function companyNameFromPrimary(raw: EodhdSearchResult[], query: string) {
  const normalized = query.toUpperCase();
  const primary = raw.find((item) => item.Code?.toUpperCase() === normalized && item.Name);
  if (!primary?.Name) return [];
  const stripped = primary.Name
    .replace(/\b(ADR|ADS|American Depositary Receipts?|Sponsored|Unsponsored)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped && stripped.toUpperCase() !== normalized ? [stripped] : [];
}

function rankSearchResult(item: EodhdSearchResult, query: string) {
  const code = item.Code?.toUpperCase() ?? '';
  const exchange = item.Exchange?.toUpperCase() ?? '';
  const country = item.Country?.toUpperCase() ?? '';
  const type = item.Type?.toUpperCase() ?? '';
  const normalized = query.toUpperCase();
  let score = 0;

  if (code === normalized) score += 120;
  if (item.isPrimary) score += 20;
  if (type.includes('COMMON')) score += 15;
  if (exchange === 'US') score += 8;
  if (['TW', 'TWO'].includes(exchange) || country === 'TAIWAN') score += 18;
  if (['BA', 'SA', 'MX'].includes(exchange)) score -= 5;
  if (type.includes('ETF') || type.includes('FUND')) score -= 35;
  return score;
}

async function expandedEodhdSearch(query: string) {
  const primary = await fetchEodhdSearch(query);
  const expansions = Array.from(new Set([
    ...(FALLBACK_EXPANSIONS[query.toUpperCase()] ?? []),
    ...companyNameFromPrimary(primary, query),
  ])).slice(0, 2);

  if (!expansions.length) return primary;
  const expanded = await Promise.all(expansions.map((term) => fetchEodhdSearch(term)));
  const merged = new Map<string, EodhdSearchResult>();
  for (const item of [...primary, ...expanded.flat()]) {
    const key = resultKey(item);
    if (!item.Code || !item.Exchange || !key.includes('.')) continue;
    if (!merged.has(key)) merged.set(key, item);
  }
  return Array.from(merged.values());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';

  if (query.length < 1) {
    return NextResponse.json({ query, results: [] });
  }

  const raw = await expandedEodhdSearch(query);
  const results = raw
    .filter((item) => item.Code && item.Exchange)
    .sort((a, b) => rankSearchResult(b, query) - rankSearchResult(a, query))
    .slice(0, 10)
    .map((item) => ({
      symbol: `${item.Code!.toUpperCase()}.${item.Exchange!.toUpperCase()}`,
      code: item.Code,
      exchange: item.Exchange,
      name: item.Name ?? `${item.Code}.${item.Exchange}`,
      type: item.Type ?? 'Instrument',
      country: item.Country ?? 'Unknown',
      currency: item.Currency ?? '—',
      previousClose: item.previousClose ?? null,
      previousCloseDate: item.previousCloseDate ?? null,
      isPrimary: Boolean(item.isPrimary),
    }));

  return NextResponse.json({ query, results });
}
