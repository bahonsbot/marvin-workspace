import { NextResponse } from 'next/server';
import {
  EODHD_DELAY_NOTE,
  fetchEodhdRealtimeQuote,
  formatEodhdMoney,
  formatEodhdPct,
  formatEodhdQuoteTime,
  formatEodhdSigned,
} from '@/lib/trading/sources/eodhd';

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const normalized = decodeURIComponent(symbol).trim().toUpperCase();

  if (!normalized.includes('.')) {
    return NextResponse.json({ error: 'Quote refresh requires a canonical exchange-suffixed symbol.' }, { status: 400 });
  }

  const quote = await fetchEodhdRealtimeQuote(normalized);
  if (!quote || typeof quote.close !== 'number') {
    return NextResponse.json({ error: 'Quote unavailable from EODHD.' }, { status: 502 });
  }

  const now = new Date().toISOString();
  const updatedAt = quote.timestamp ? new Date(quote.timestamp * 1000).toISOString() : now;
  const currency = normalized.endsWith('.VN') ? 'VND' : undefined;
  const previousClose = quote.previousClose;
  const change = quote.change ?? (previousClose != null ? quote.close - previousClose : 0);
  const changePct = quote.change_p ?? (previousClose ? (change / previousClose) * 100 : 0);
  const tone = change < 0 ? 'negative' : change > 0 ? 'positive' : 'neutral';

  return NextResponse.json({
    symbol: normalized,
    price: formatEodhdMoney(quote.close, currency),
    change: formatEodhdSigned(change),
    changePct: formatEodhdPct(changePct),
    tone,
    priceTime: formatEodhdQuoteTime(quote.timestamp, updatedAt),
    updatedAt,
    fetchedAt: now,
    provider: 'EODHD',
    providerDelay: EODHD_DELAY_NOTE,
    raw: {
      close: quote.close,
      previousClose: quote.previousClose ?? null,
      change,
      changePct,
      timestamp: quote.timestamp ?? null,
    },
  });
}
