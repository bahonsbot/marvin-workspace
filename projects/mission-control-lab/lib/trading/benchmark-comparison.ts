import 'server-only';

import { fetchYfinancePriceHistory, type YfinancePriceHistory, type YfinancePricePoint } from './sources/yfinance-prices';

export type BenchmarkComparisonPoint = {
  date: string;
  selected: number | null;
  spy: number | null;
  qqq: number | null;
};

export type BenchmarkComparisonSeries = {
  key: 'selected' | 'spy' | 'qqq';
  label: string;
  symbol: string;
  returnPct: number | null;
  points: Array<{ date: string; value: number }>;
};

export type BenchmarkComparisonResult = {
  ok: boolean;
  range: string;
  source: 'yfinance';
  asOf: string;
  selectedSymbol: string;
  resolvedSymbol: string;
  attemptedSymbols: string[];
  benchmarks: string[];
  points: BenchmarkComparisonPoint[];
  series: BenchmarkComparisonSeries[];
  stats: {
    selectedReturnPct: number | null;
    spyReturnPct: number | null;
    qqqReturnPct: number | null;
    vsSpyPct: number | null;
    vsQqqPct: number | null;
  };
  missing: string[];
  note: string;
};

const BENCHMARKS = [
  { key: 'spy' as const, symbol: 'SPY', label: 'SPY' },
  { key: 'qqq' as const, symbol: 'QQQ', label: 'QQQ' },
];

const YFINANCE_SUFFIX_OVERRIDES: Record<string, string | null> = {
  US: null,
  NASDAQ: null,
  NYSE: null,
  AMEX: null,
  LSE: 'L',
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean)));
}

function yfinanceCandidates(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const [code, exchange] = normalized.split('.');
  if (!code || !exchange) return unique([normalized]);
  const override = YFINANCE_SUFFIX_OVERRIDES[exchange];
  const mapped = override === undefined ? normalized : (override ? `${code}.${override}` : code);
  return unique([mapped, normalized, code]);
}

async function fetchFirstAvailableHistory(symbol: string, range: string) {
  const attemptedSymbols = yfinanceCandidates(symbol);
  for (const candidate of attemptedSymbols) {
    const history = await fetchYfinancePriceHistory(candidate, { period: range });
    if (history?.points.length) return { history, resolvedSymbol: candidate, attemptedSymbols };
  }
  return { history: null, resolvedSymbol: attemptedSymbols[0] ?? symbol.trim().toUpperCase(), attemptedSymbols };
}

function historyMap(history: YfinancePriceHistory | null) {
  const map = new Map<string, number>();
  for (const point of history?.points ?? []) {
    if (!Number.isFinite(point.close)) continue;
    map.set(point.date, point.close);
  }
  return map;
}

function indexedValue(point: YfinancePricePoint | undefined, base: number | null) {
  if (!point || base == null || !Number.isFinite(base) || base <= 0) return null;
  return (point.close / base) * 100;
}

function returnPct(points: Array<{ value: number }>) {
  if (points.length < 2) return null;
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (first == null || last == null || !Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / first) * 100;
}

function sortedPoints(history: YfinancePriceHistory | null) {
  return [...(history?.points ?? [])].sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildBenchmarkComparison(input: { symbol: string; range?: string }): Promise<BenchmarkComparisonResult> {
  const selectedSymbol = input.symbol.trim().toUpperCase();
  const range = input.range ?? '1y';
  const [selectedResolved, spyHistory, qqqHistory] = await Promise.all([
    fetchFirstAvailableHistory(selectedSymbol, range),
    fetchYfinancePriceHistory('SPY', { period: range }),
    fetchYfinancePriceHistory('QQQ', { period: range }),
  ]);
  const selectedHistory = selectedResolved.history;

  const histories = {
    selected: selectedHistory,
    spy: spyHistory,
    qqq: qqqHistory,
  };
  const missing = [
    !selectedHistory?.points.length ? selectedSymbol : null,
    !spyHistory?.points.length ? 'SPY' : null,
    !qqqHistory?.points.length ? 'QQQ' : null,
  ].filter((value): value is string => Boolean(value));

  const selectedMap = historyMap(selectedHistory);
  const spyMap = historyMap(spyHistory);
  const qqqMap = historyMap(qqqHistory);
  const sharedDates = [...selectedMap.keys()]
    .filter((date) => spyMap.has(date) && qqqMap.has(date))
    .sort((a, b) => a.localeCompare(b));

  const selectedPoints = sortedPoints(selectedHistory).filter((point) => sharedDates.includes(point.date));
  const spyPoints = sortedPoints(spyHistory).filter((point) => sharedDates.includes(point.date));
  const qqqPoints = sortedPoints(qqqHistory).filter((point) => sharedDates.includes(point.date));
  const selectedBase = selectedPoints[0]?.close ?? null;
  const spyBase = spyPoints[0]?.close ?? null;
  const qqqBase = qqqPoints[0]?.close ?? null;

  const points: BenchmarkComparisonPoint[] = sharedDates.map((date) => ({
    date,
    selected: indexedValue(selectedPoints.find((point) => point.date === date), selectedBase),
    spy: indexedValue(spyPoints.find((point) => point.date === date), spyBase),
    qqq: indexedValue(qqqPoints.find((point) => point.date === date), qqqBase),
  })).filter((point) => point.selected != null || point.spy != null || point.qqq != null);

  const selectedSeriesPoints = points.filter((point): point is BenchmarkComparisonPoint & { selected: number } => point.selected != null).map((point) => ({ date: point.date, value: point.selected }));
  const spySeriesPoints = points.filter((point): point is BenchmarkComparisonPoint & { spy: number } => point.spy != null).map((point) => ({ date: point.date, value: point.spy }));
  const qqqSeriesPoints = points.filter((point): point is BenchmarkComparisonPoint & { qqq: number } => point.qqq != null).map((point) => ({ date: point.date, value: point.qqq }));
  const selectedReturnPct = returnPct(selectedSeriesPoints);
  const spyReturnPct = returnPct(spySeriesPoints);
  const qqqReturnPct = returnPct(qqqSeriesPoints);

  return {
    ok: missing.length === 0 && points.length >= 2,
    range,
    source: 'yfinance',
    asOf: [histories.selected?.asOf, histories.spy?.asOf, histories.qqq?.asOf].filter(Boolean).sort().at(-1) ?? new Date().toISOString(),
    selectedSymbol,
    resolvedSymbol: selectedResolved.resolvedSymbol,
    attemptedSymbols: selectedResolved.attemptedSymbols,
    benchmarks: BENCHMARKS.map((benchmark) => benchmark.symbol),
    points,
    series: [
      { key: 'selected', label: selectedResolved.resolvedSymbol, symbol: selectedResolved.resolvedSymbol, returnPct: selectedReturnPct, points: selectedSeriesPoints },
      { key: 'spy', label: 'SPY', symbol: 'SPY', returnPct: spyReturnPct, points: spySeriesPoints },
      { key: 'qqq', label: 'QQQ', symbol: 'QQQ', returnPct: qqqReturnPct, points: qqqSeriesPoints },
    ],
    stats: {
      selectedReturnPct,
      spyReturnPct,
      qqqReturnPct,
      vsSpyPct: selectedReturnPct != null && spyReturnPct != null ? selectedReturnPct - spyReturnPct : null,
      vsQqqPct: selectedReturnPct != null && qqqReturnPct != null ? selectedReturnPct - qqqReturnPct : null,
    },
    missing,
    note: points.length >= 2
      ? `Indexed to 100 at the first shared trading date.${selectedResolved.resolvedSymbol !== selectedSymbol ? ` ${selectedSymbol} resolved to ${selectedResolved.resolvedSymbol} for yfinance.` : ''}`
      : `Not enough shared yfinance history to compare the selected ticker with SPY and QQQ. Tried ${selectedResolved.attemptedSymbols.join(', ')}.`,
  };
}
