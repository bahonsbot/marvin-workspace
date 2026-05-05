import { NextResponse } from "next/server";
import type {
  TickerPricePoint,
  TickerPriceRangeSeries,
} from "@/lib/trading/contracts";
import { getTickerProfile } from "@/lib/trading/ticker-profile";

const BASE_CURRENCY = "EUR";
const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y"] as const;
type PortfolioRange = (typeof RANGES)[number];
type OverlayKey = "portfolio" | "sp500" | "allworld" | "nasdaq";

const BENCHMARKS: Record<Exclude<OverlayKey, "portfolio">, string> = {
  sp500: "SPY.US",
  allworld: "VT.US",
  nasdaq: "QQQ.US",
};

const BENCHMARK_LABELS: Record<OverlayKey, string> = {
  portfolio: "Portfolio",
  sp500: "S&P 500",
  allworld: "All-World",
  nasdaq: "Nasdaq 100",
};

type HoldingRequest = {
  symbol?: string;
  quantity?: number;
  currency?: string;
  assetType?: string;
  fxRate?: number;
};

type NormalizedSeriesPoint = { time: string | number; value: number };
type PerformanceSeries = {
  key: OverlayKey;
  label: string;
  range: PortfolioRange;
  points: NormalizedSeriesPoint[];
  source: string;
  note?: string;
};

function normalizeSymbol(value: string | undefined | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
}

function asRange(value: string | null): PortfolioRange {
  const normalized = value?.trim().toUpperCase();
  return RANGES.find((range) => range === normalized) ?? "1Y";
}

function numericTime(point: TickerPricePoint | NormalizedSeriesPoint) {
  return typeof point.time === "number"
    ? point.time
    : Date.parse(point.time) / 1000;
}

function normalizeRangeSeries(series: TickerPriceRangeSeries | undefined) {
  return [...(series?.points ?? [])]
    .filter(
      (point) =>
        Number.isFinite(point.value) && Number.isFinite(numericTime(point)),
    )
    .sort((a, b) => numericTime(a) - numericTime(b));
}

function normalizeToPercent(points: NormalizedSeriesPoint[]) {
  const first = points.find(
    (point) => Number.isFinite(point.value) && point.value > 0,
  )?.value;
  if (!first) return [];
  return points.map((point) => ({
    time: point.time,
    value: Number((((point.value - first) / first) * 100).toFixed(4)),
  }));
}

function previousOrExactValue(points: TickerPricePoint[], targetTime: number) {
  let next: TickerPricePoint | null = null;
  for (const point of points) {
    if (numericTime(point) <= targetTime) next = point;
    else break;
  }
  return next?.value ?? null;
}

function mergeTimeline(
  series: Array<{
    symbol: string;
    quantity: number;
    points: TickerPricePoint[];
  }>,
) {
  const seen = new Map<string, string | number>();
  series.forEach(({ points }) => {
    points.forEach((point) => seen.set(String(numericTime(point)), point.time));
  });
  return Array.from(seen.entries())
    .map(([timeNumber, original]) => ({
      timeNumber: Number(timeNumber),
      original,
    }))
    .filter((point) => Number.isFinite(point.timeNumber))
    .sort((a, b) => a.timeNumber - b.timeNumber);
}

async function buildPortfolioSeries(
  holdings: HoldingRequest[],
  range: PortfolioRange,
): Promise<PerformanceSeries> {
  const investmentHoldings = holdings
    .map((holding) => ({
      symbol: normalizeSymbol(holding.symbol),
      quantity: Number(holding.quantity),
      assetType: holding.assetType?.toLowerCase() ?? "",
      fxRate: Number.isFinite(Number(holding.fxRate))
        ? Number(holding.fxRate)
        : 1,
    }))
    .filter(
      (holding) =>
        holding.symbol &&
        holding.assetType !== "cash" &&
        Number.isFinite(holding.quantity) &&
        holding.quantity > 0,
    )
    .slice(0, 24);

  const settled = await Promise.allSettled(
    investmentHoldings.map(async (holding) => {
      const profile = await getTickerProfile(holding.symbol);
      const points = normalizeRangeSeries(
        profile.priceSeries.rangeSeries?.[range],
      );
      return {
        symbol: holding.symbol,
        quantity: holding.quantity,
        fxRate: holding.fxRate,
        points,
        source: profile.sourceMap.prices.source,
      };
    }),
  );

  const usable = settled.flatMap((result) => {
    if (result.status !== "fulfilled" || result.value.points.length < 2)
      return [];
    return [result.value];
  });

  if (!usable.length) {
    return {
      key: "portfolio",
      label: BENCHMARK_LABELS.portfolio,
      range,
      points: [],
      source: "unavailable",
      note: "No portfolio price history available yet.",
    };
  }

  const timeline = mergeTimeline(usable);
  const rawValues = timeline
    .map(({ timeNumber, original }) => {
      let value = 0;
      let coverage = 0;
      usable.forEach((entry) => {
        const price = previousOrExactValue(entry.points, timeNumber);
        if (price == null) return;
        value += entry.quantity * price * entry.fxRate;
        coverage += 1;
      });
      if (coverage === 0) return null;
      return { time: original, value };
    })
    .filter((point): point is NormalizedSeriesPoint => Boolean(point));

  return {
    key: "portfolio",
    label: BENCHMARK_LABELS.portfolio,
    range,
    points: normalizeToPercent(rawValues),
    source:
      Array.from(new Set(usable.map((entry) => entry.source))).join(" + ") ||
      "provider",
    note: "Portfolio line is reconstructed from current holdings, current FX rates, and historical prices; dividends, cash flows, and transaction-date FX are excluded for now.",
  };
}

async function buildBenchmarkSeries(
  key: Exclude<OverlayKey, "portfolio">,
  range: PortfolioRange,
): Promise<PerformanceSeries> {
  const symbol = BENCHMARKS[key];
  try {
    const profile = await getTickerProfile(symbol);
    const points = normalizeRangeSeries(
      profile.priceSeries.rangeSeries?.[range],
    ).map((point) => ({ time: point.time, value: point.value }));
    return {
      key,
      label: BENCHMARK_LABELS[key],
      range,
      points: normalizeToPercent(points),
      source: profile.sourceMap.prices.source,
    };
  } catch {
    return {
      key,
      label: BENCHMARK_LABELS[key],
      range,
      points: [],
      source: "unavailable",
      note: `${BENCHMARK_LABELS[key]} overlay unavailable.`,
    };
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    range?: string;
    holdings?: HoldingRequest[];
  };
  const range = asRange(body.range ?? null);
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];
  const [portfolio, sp500, allworld, nasdaq] = await Promise.all([
    buildPortfolioSeries(holdings, range),
    buildBenchmarkSeries("sp500", range),
    buildBenchmarkSeries("allworld", range),
    buildBenchmarkSeries("nasdaq", range),
  ]);

  return NextResponse.json({
    baseCurrency: BASE_CURRENCY,
    range,
    ranges: RANGES,
    series: [portfolio, sp500, allworld, nasdaq],
    generatedAt: new Date().toISOString(),
  });
}
