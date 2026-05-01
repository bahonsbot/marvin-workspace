import 'server-only';

import { fetchEodhdRealtimeQuote, hasEodhdApiKey } from './sources/eodhd';

export type MarketTapeItem = {
  label: string;
  value: string;
  change: string;
};

export type MarketTapeData = {
  items: MarketTapeItem[];
  status: string;
};

const ETF_PROXY_TAPE = [
  { label: 'S&P proxy', symbol: 'SPY.US' },
  { label: 'Nasdaq proxy', symbol: 'QQQ.US' },
  { label: 'Dow proxy', symbol: 'DIA.US' },
  { label: 'VIX proxy', symbol: 'VIXY.US' },
  { label: 'Gold proxy', symbol: 'GLD.US' },
  { label: 'Oil proxy', symbol: 'USO.US' },
] as const;

function formatTapeValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 3,
    minimumFractionDigits: Math.abs(value) >= 100 ? 2 : 2,
  }).format(value);
}

function formatTapeChange(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

function formatTapeStatus(asOf: Date | null) {
  if (!asOf) return 'EODHD ETF-proxy tape · quote time unavailable';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(asOf);
  return `EODHD ETF-proxy tape · delayed quotes · updated ${formatted}`;
}

export async function getMarketTape(): Promise<MarketTapeData> {
  if (!hasEodhdApiKey()) {
    return {
      status: 'EODHD ETF-proxy tape unavailable · API key missing',
      items: ETF_PROXY_TAPE.map((item) => ({ label: item.label, value: '—', change: '—' })),
    };
  }

  const quotes = await Promise.all(
    ETF_PROXY_TAPE.map(async (item) => {
      const quote = await fetchEodhdRealtimeQuote(item.symbol);
      return { item, quote };
    }),
  );

  const timestamps = quotes
    .map(({ quote }) => (typeof quote?.timestamp === 'number' ? new Date(quote.timestamp * 1000) : null))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  const latestAsOf = timestamps.length ? new Date(Math.max(...timestamps.map((date) => date.getTime()))) : null;
  const availableCount = quotes.filter(({ quote }) => typeof quote?.close === 'number').length;

  return {
    status: availableCount
      ? formatTapeStatus(latestAsOf)
      : 'EODHD ETF-proxy tape unavailable · provider returned no quote data',
    items: quotes.map(({ item, quote }) => ({
      label: item.label,
      value: formatTapeValue(quote?.close),
      change: formatTapeChange(quote?.change_p),
    })),
  };
}
