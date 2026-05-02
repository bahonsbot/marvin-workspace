import { NextResponse } from 'next/server';
import {
  EODHD_DELAY_NOTE,
  fetchEodhdRealtimeQuote,
  fetchEodhdSearch,
  formatEodhdMoney,
  formatEodhdPct,
  formatEodhdQuoteTime,
  formatEodhdSigned,
} from '@/lib/trading/sources/eodhd';
import { getTickerProfile } from '@/lib/trading/ticker-profile';

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const normalized = decodeURIComponent(symbol).trim().toUpperCase();

  if (!normalized.includes('.')) {
    return NextResponse.json({ error: 'Quote refresh requires a canonical exchange-suffixed symbol.' }, { status: 400 });
  }

  const quote = await fetchEodhdRealtimeQuote(normalized);
  if (!quote || typeof quote.close !== 'number') {
    const profile = await getTickerProfile(normalized).catch(() => null);
    if (profile?.quote?.rawPrice != null || profile?.quote?.price) {
      const now = new Date().toISOString();
      return NextResponse.json({
        symbol: normalized,
        price: profile.quote.price,
        change: profile.quote.change,
        changePct: profile.quote.changePct,
        tone: profile.quote.tone,
        priceTime: profile.quote.priceTime,
        updatedAt: profile.quote.updatedAt ?? profile.quote.source.asOf,
        fetchedAt: now,
        provider: profile.quote.source.source === 'yahoo' ? 'Yahoo Finance' : profile.quote.source.source.toUpperCase(),
        providerDelay: profile.quote.providerDelay ?? 'Cached quote; live refresh unavailable from EODHD.',
        stale: true,
        raw: {
          close: profile.quote.rawPrice ?? null,
          previousClose: null,
          change: profile.quote.rawChange ?? null,
          changePct: profile.quote.rawChangePct ?? null,
          timestamp: profile.quote.updatedAt ? Math.floor(Date.parse(profile.quote.updatedAt) / 1000) : null,
        },
      });
    }
    return NextResponse.json({ error: 'Quote unavailable from EODHD.' }, { status: 502 });
  }

  const now = new Date().toISOString();
  const updatedAt = quote.timestamp ? new Date(quote.timestamp * 1000).toISOString() : now;
  const [code, exchange] = normalized.split('.');
  const searchResult = code && exchange
    ? (await fetchEodhdSearch(code)).find((item) => item.Code?.toUpperCase() === code && item.Exchange?.toUpperCase() === exchange)
    : undefined;
  const currency = searchResult?.Currency ?? (normalized.endsWith('.VN') ? 'VND' : 'USD');
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
