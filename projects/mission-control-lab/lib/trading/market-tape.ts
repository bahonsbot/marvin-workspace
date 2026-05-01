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

type TapeInstrument = {
  label: string;
  symbol: string;
  kind: 'index' | 'spot' | 'proxy';
};

const MARKET_TAPE: TapeInstrument[] = [
  { label: 'S&P 500', symbol: 'GSPC.INDX', kind: 'index' },
  { label: 'Nasdaq', symbol: 'IXIC.INDX', kind: 'index' },
  { label: 'Dow', symbol: 'DJI.INDX', kind: 'index' },
  { label: 'VIX', symbol: 'VIX.INDX', kind: 'index' },
  { label: 'Gold spot', symbol: 'XAUUSD.FOREX', kind: 'spot' },
  { label: 'Oil proxy', symbol: 'USO.US', kind: 'proxy' },
] as const;

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

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
  if (!asOf) return 'Updated: unknown';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(asOf);
  return `Updated: ${formatted}`;
}

export async function getMarketTape(): Promise<MarketTapeData> {
  if (!hasEodhdApiKey()) {
    return {
      status: 'EODHD market tape unavailable · API key missing',
      items: MARKET_TAPE.map((item) => ({ label: item.label, value: '—', change: '—' })),
    };
  }

  const quotes = await Promise.all(
    MARKET_TAPE.map(async (item) => {
      const quote = await fetchEodhdRealtimeQuote(item.symbol);
      return { item, quote };
    }),
  );

  const timestamps = quotes
    .map(({ quote }) => (typeof quote?.timestamp === 'number' ? new Date(quote.timestamp * 1000) : null))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  const latestAsOf = timestamps.length ? new Date(Math.max(...timestamps.map((date) => date.getTime()))) : null;
  const availableCount = quotes.filter(({ quote }) => asNumber(quote?.close) ?? asNumber(quote?.previousClose)).length;

  return {
    status: availableCount
      ? formatTapeStatus(latestAsOf)
      : 'Updated: unavailable',
    items: quotes.map(({ item, quote }) => {
      const close = asNumber(quote?.close) ?? asNumber(quote?.previousClose);
      return {
        label: item.label,
        value: formatTapeValue(close),
        change: formatTapeChange(asNumber(quote?.change_p)),
      };
    }),
  };
}
