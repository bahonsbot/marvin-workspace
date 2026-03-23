import { NextResponse } from 'next/server';

// Real index symbols (not ETF proxies). Yahoo Finance supports these directly.
const INDICES = [
  { id: '^GSPC', symbol: 'SPX', label: 'S&P 500' },
  { id: '^NDX', symbol: 'NDX', label: 'Nasdaq 100' },
  { id: '^DJI', symbol: 'DJI', label: 'Dow Jones' },
  { id: '^RUT', symbol: 'RUT', label: 'Russell 2000' },
];

// Commodity ETFs — these ARE the commodities, not proxies for indices
const COMMODITIES = [
  { id: 'GLD', symbol: 'GLD', label: 'Gold' },
  { id: 'USO', symbol: 'USO', label: 'Oil (USO)' },
  { id: 'CORN', symbol: 'CORN', label: 'Corn' },
];

async function fetchQuote(symbol: string): Promise<{ price: number | null; changePct: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      next: { revalidate: 900 },
    });
    if (!res.ok) return { price: null, changePct: null };

    const json = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number } }> };
    };
    const result = json?.chart?.result?.[0];
    if (!result?.meta) return { price: null, changePct: null };

    const { regularMarketPrice, previousClose } = result.meta;
    if (typeof regularMarketPrice !== 'number') return { price: null, changePct: null };

    const changePct =
      typeof previousClose === 'number' && previousClose > 0
        ? ((regularMarketPrice - previousClose) / previousClose) * 100
        : null;

    return { price: regularMarketPrice, changePct };
  } catch {
    return { price: null, changePct: null };
  }
}

export async function GET() {
  const freshness = 'delayed';

  const [indicesResults, commoditiesResults] = await Promise.all([
    Promise.all(INDICES.map(async (item) => {
      const { price, changePct } = await fetchQuote(item.id);
      return { id: item.id, symbol: item.symbol, label: item.label, price, changePct, freshness };
    })),
    Promise.all(COMMODITIES.map(async (item) => {
      const { price, changePct } = await fetchQuote(item.id);
      return { id: item.id, symbol: item.symbol, label: item.label, price, changePct, freshness };
    })),
  ]);

  return NextResponse.json({ indices: indicesResults, commodities: commoditiesResults });
}
