import { NextResponse } from 'next/server';
import { fetchEodhdSearch } from '@/lib/trading/sources/eodhd';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';

  if (query.length < 1) {
    return NextResponse.json({ query, results: [] });
  }

  const raw = await fetchEodhdSearch(query);
  const results = raw
    .filter((item) => item.Code && item.Exchange)
    .slice(0, 8)
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
