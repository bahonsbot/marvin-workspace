"use client";

import Link from "next/link";
import { Pencil, Plus, Wallet, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import {
  portfolioApi,
  type PortfolioAssetType,
  type PortfolioHolding,
} from "@/lib/convex/portfolio-api";

const DEMO_USER_KEY = "lab-single-user";
const PORTFOLIO_METADATA_CACHE_KEY =
  "mission-control-lab:portfolio-metadata:v1";
const PORTFOLIO_METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PORTFOLIO_FX_CACHE_KEY = "mission-control-lab:portfolio-fx:v1";
const PORTFOLIO_FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BASE_CURRENCY = "EUR";

type AllocationDimension =
  | "ticker"
  | "sector"
  | "industry"
  | "country"
  | "assetType"
  | "strategy"
  | "currency"
  | "broker";
type SortKey = "weight" | "value" | "pl" | "symbol";

type TickerSearchResult = {
  symbol: string;
  code: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  previousClose: number | null;
  previousCloseDate: string | null;
  isPrimary: boolean;
};

type TickerSearchResponse = { query: string; results: TickerSearchResult[] };
type BenchmarkKey = "portfolio" | "sp500" | "allworld" | "nasdaq";
type PerformanceRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y";

type PortfolioMetadataItem = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string;
  week52Low?: string;
  week52High?: string;
  week52Position?: number | null;
  price: string;
  rawPrice: number | null;
  priceTime: string;
  currency: string;
  changePct: string;
  dayPoints: number[];
  tone: "positive" | "negative" | "neutral";
  source: string;
  quoteFreshness: string;
};

type PortfolioMetadataResponse = { items?: PortfolioMetadataItem[] };
type CachedPortfolioMetadataEntry = {
  cachedAt: number;
  item: PortfolioMetadataItem;
};

type FxRate = {
  from: string;
  to: string;
  rate: number;
  asOf: string;
  source: "frankfurter" | "static" | "identity";
  freshness: "fresh" | "fallback" | "identity" | "missing";
};

type FxRatesResponse = { baseCurrency: string; rates?: FxRate[] };

type PerformancePoint = { time: string | number; value: number };
type PerformanceSeries = {
  key: BenchmarkKey;
  label: string;
  range: PerformanceRange;
  points: PerformancePoint[];
  source: string;
  note?: string;
};
type PortfolioPerformanceResponse = {
  baseCurrency: string;
  range: PerformanceRange;
  ranges: PerformanceRange[];
  series: PerformanceSeries[];
  generatedAt: string;
};

type HoldingInput = {
  symbol: string;
  name: string;
  assetType: PortfolioAssetType;
  quantity: string;
  averageCost: string;
  currency: string;
  strategy: string;
  transactionFee: string;
  broker: string;
  alertMinPrice: string;
  alertMaxPrice: string;
};

type PortfolioFormMode = "add" | "edit";
type CashFormMode = "add" | "edit";

type BuyMoreInput = {
  quantity: string;
  purchasePrice: string;
  transactionFee: string;
};

type CashInput = {
  currency: string;
  amount: string;
  broker: string;
};

type EnrichedHolding = PortfolioHolding & {
  metadata?: PortfolioMetadataItem;
  displayName: string;
  currentPrice: number | null;
  marketValue: number;
  marketValueBase: number;
  costBasisValue: number;
  costBasisBase: number;
  totalPl: number;
  totalPlBase: number;
  totalPlPct: number | null;
  weight: number;
  displayCurrency: string;
  fxRate: FxRate;
  dayChangePct: number | null;
  allocation: Record<AllocationDimension, string>;
};

const sampleHoldings: PortfolioHolding[] = [
  {
    _id: "sample-wise",
    userKey: DEMO_USER_KEY,
    symbol: "WISE.LSE",
    displaySymbol: "WISE",
    name: "Wise",
    assetType: "stock",
    strategy: "Compounders",
    sector: "Information Technology",
    industry: "Payments",
    country: "United Kingdom",
    currency: "EUR",
    broker: "Demo broker",
    quantity: 6120,
    averageCost: 9.82,
    costBasis: 60098.4,
    alertEnabled: true,
    alertMinPrice: 8.8,
    alertMaxPrice: 13.5,
    sortOrder: 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "sample-amzn",
    userKey: DEMO_USER_KEY,
    symbol: "AMZN.US",
    displaySymbol: "AMZN",
    name: "Amazon",
    assetType: "stock",
    strategy: "Compounders",
    sector: "Consumer Discretionary",
    industry: "Internet Retail",
    country: "United States",
    currency: "USD",
    broker: "Demo broker",
    quantity: 298,
    averageCost: 113.1,
    costBasis: 33703.8,
    alertEnabled: true,
    alertMinPrice: 175,
    alertMaxPrice: 230,
    sortOrder: 2000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "sample-googl",
    userKey: DEMO_USER_KEY,
    symbol: "GOOGL.US",
    displaySymbol: "GOOGL",
    name: "Alphabet",
    assetType: "stock",
    strategy: "Compounders",
    sector: "Communication Services",
    industry: "Interactive Media",
    country: "United States",
    currency: "USD",
    broker: "Demo broker",
    quantity: 295,
    averageCost: 57.64,
    costBasis: 17003.8,
    alertEnabled: true,
    alertMinPrice: 160,
    sortOrder: 3000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    _id: "sample-cash",
    userKey: DEMO_USER_KEY,
    symbol: "CASH.EUR",
    displaySymbol: "Cash",
    name: "Cash EUR",
    assetType: "cash",
    strategy: "Reserve",
    sector: "Cash",
    country: "Eurozone",
    currency: "EUR",
    broker: "Demo broker",
    quantity: 49039.05,
    averageCost: 1,
    costBasis: 49039.05,
    sortOrder: 4000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const allocationLabels: Record<AllocationDimension, string> = {
  ticker: "Ticker weight",
  sector: "Sector",
  industry: "Industry",
  country: "Country",
  assetType: "Asset type",
  strategy: "Strategy",
  currency: "Currency",
  broker: "Broker",
};

const benchmarkLabels: Record<BenchmarkKey, string> = {
  portfolio: "Portfolio",
  sp500: "S&P 500",
  allworld: "All-World",
  nasdaq: "Nasdaq 100",
};

const performanceRanges: PerformanceRange[] = [
  "1D",
  "5D",
  "1M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
];

const benchmarkColors: Record<BenchmarkKey, string> = {
  portfolio: "#31523f",
  sp500: "#37a6ff",
  allworld: "#20b86f",
  nasdaq: "#7c5cff",
};

const colors = [
  "#20b86f",
  "#37a6ff",
  "#7c5cff",
  "#ff9f43",
  "#23c7b7",
  "#8fd14f",
  "#ff6f91",
  "#5f8dff",
];

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function parseNumber(value: string | number | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number, currency = BASE_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
    value,
  );
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function cleanAlertInput(value: string) {
  const parsed = parseNumber(value);
  if (parsed == null || parsed <= 0) return undefined;
  return Math.round(parsed * 10000) / 10000;
}

function symbolHref(symbol: string) {
  if (symbol.startsWith("CASH")) return "/trading/portfolio";
  return `/trading/ticker/${encodeURIComponent(symbol)}`;
}

function initialsForHolding(holding: EnrichedHolding) {
  const source = holding.displaySymbol || holding.symbol;
  return source.replace(/\W/g, "").slice(0, 2) || "•";
}

function readMetadataCache(symbols: string[]) {
  if (typeof window === "undefined")
    return new Map<string, PortfolioMetadataItem>();
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_METADATA_CACHE_KEY);
    if (!raw) return new Map<string, PortfolioMetadataItem>();
    const parsed = JSON.parse(raw) as Record<
      string,
      CachedPortfolioMetadataEntry
    >;
    const now = Date.now();
    const next = new Map<string, PortfolioMetadataItem>();
    for (const symbol of symbols) {
      const entry = parsed[normalizeSymbol(symbol)];
      if (
        !entry?.item ||
        now - entry.cachedAt > PORTFOLIO_METADATA_CACHE_TTL_MS
      )
        continue;
      next.set(normalizeSymbol(symbol), entry.item);
      next.set(normalizeSymbol(entry.item.symbol), entry.item);
    }
    return next;
  } catch {
    return new Map<string, PortfolioMetadataItem>();
  }
}

function writeMetadataCache(
  items: PortfolioMetadataItem[],
  requestedSymbols: string[],
) {
  if (typeof window === "undefined" || !items.length) return;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(PORTFOLIO_METADATA_CACHE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, CachedPortfolioMetadataEntry>)
      : {};
    const next: Record<string, CachedPortfolioMetadataEntry> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (
        !entry?.item ||
        now - entry.cachedAt > PORTFOLIO_METADATA_CACHE_TTL_MS
      )
        continue;
      next[key] = entry;
    }
    items.forEach((item, index) => {
      const entry = { cachedAt: now, item };
      next[normalizeSymbol(item.symbol)] = entry;
      if (requestedSymbols[index])
        next[normalizeSymbol(requestedSymbols[index])] = entry;
    });
    window.localStorage.setItem(
      PORTFOLIO_METADATA_CACHE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // best effort only
  }
}

function metadataForHolding(
  metadata: Map<string, PortfolioMetadataItem>,
  holding: PortfolioHolding,
) {
  return (
    metadata.get(normalizeSymbol(holding.symbol)) ??
    metadata.get(normalizeSymbol(holding.displaySymbol))
  );
}

function assetTypeFromSearchType(value: string): PortfolioAssetType {
  const normalized = value.toLowerCase();
  if (normalized.includes("etf") || normalized.includes("fund")) return "etf";
  if (normalized.includes("cash")) return "cash";
  if (
    normalized.includes("common") ||
    normalized.includes("stock") ||
    normalized.includes("equity")
  )
    return "stock";
  return "stock";
}

function searchResultMeta(result: TickerSearchResult) {
  return [result.country, result.currency, result.type]
    .filter(Boolean)
    .join(" · ");
}

function assetTypeLabel(value: PortfolioAssetType) {
  if (value === "etf") return "ETF";
  if (value === "cash") return "Cash";
  if (value === "other") return "Other";
  return "Stock";
}

function identityFxRate(currency = BASE_CURRENCY): FxRate {
  const normalized = currency.trim().toUpperCase() || BASE_CURRENCY;
  return {
    from: normalized,
    to: BASE_CURRENCY,
    rate: normalized === BASE_CURRENCY ? 1 : 1,
    asOf: new Date().toISOString(),
    source: normalized === BASE_CURRENCY ? "identity" : "static",
    freshness: normalized === BASE_CURRENCY ? "identity" : "missing",
  };
}

function readFxCache(currencies: string[]) {
  const next = new Map<string, FxRate>();
  currencies.forEach((currency) => {
    const normalized = currency.trim().toUpperCase();
    if (normalized === BASE_CURRENCY)
      next.set(normalized, identityFxRate(normalized));
  });
  if (typeof window === "undefined") return next;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_FX_CACHE_KEY);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Record<
      string,
      { cachedAt: number; rate: FxRate }
    >;
    const now = Date.now();
    currencies.forEach((currency) => {
      const normalized = currency.trim().toUpperCase();
      const entry = parsed[normalized];
      if (!entry?.rate || now - entry.cachedAt > PORTFOLIO_FX_CACHE_TTL_MS)
        return;
      next.set(normalized, entry.rate);
    });
  } catch {
    // best effort only
  }
  return next;
}

function writeFxCache(rates: FxRate[]) {
  if (typeof window === "undefined" || !rates.length) return;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(PORTFOLIO_FX_CACHE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, { cachedAt: number; rate: FxRate }>)
      : {};
    const next: Record<string, { cachedAt: number; rate: FxRate }> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry?.rate || now - entry.cachedAt > PORTFOLIO_FX_CACHE_TTL_MS)
        continue;
      next[key] = entry;
    }
    rates.forEach((rate) => {
      next[rate.from] = { cachedAt: now, rate };
    });
    window.localStorage.setItem(PORTFOLIO_FX_CACHE_KEY, JSON.stringify(next));
  } catch {
    // best effort only
  }
}

function fxRateForCurrency(fxRates: Map<string, FxRate>, currency: string) {
  const normalized = currency.trim().toUpperCase() || BASE_CURRENCY;
  return fxRates.get(normalized) ?? identityFxRate(normalized);
}

function formatFxRate(rate: FxRate | undefined) {
  if (!rate) return "FX pending";
  if (rate.from === rate.to) return "1:1";
  const approx = rate.freshness === "fresh" ? "" : "≈ ";
  return `${approx}1 ${rate.from} = ${rate.rate.toFixed(4)} ${rate.to}`;
}

function enrichHoldings(
  holdings: PortfolioHolding[],
  metadata: Map<string, PortfolioMetadataItem>,
  fxRates: Map<string, FxRate>,
) {
  const interim = holdings.map((holding) => {
    const meta = metadataForHolding(metadata, holding);
    const isCash =
      holding.assetType === "cash" || holding.symbol.startsWith("CASH");
    const displayCurrency = holding.currency || meta?.currency || BASE_CURRENCY;
    const fxRate = fxRateForCurrency(fxRates, displayCurrency);
    const currentPrice = isCash ? 1 : (meta?.rawPrice ?? null);
    const marketValue =
      currentPrice != null
        ? holding.quantity * currentPrice
        : holding.costBasis;
    const marketValueBase = marketValue * fxRate.rate;
    const costBasisBase = holding.costBasis * fxRate.rate;
    const totalPl = marketValue - holding.costBasis;
    const totalPlBase = marketValueBase - costBasisBase;
    const totalPlPct =
      costBasisBase > 0 ? (totalPlBase / costBasisBase) * 100 : null;
    const displayName =
      holding.name?.trim() ||
      meta?.name ||
      holding.displaySymbol ||
      holding.symbol;
    return {
      ...holding,
      metadata: meta,
      displayName,
      currentPrice,
      marketValue,
      marketValueBase,
      costBasisValue: holding.costBasis,
      costBasisBase,
      totalPl,
      totalPlBase,
      totalPlPct,
      weight: 0,
      displayCurrency,
      fxRate,
      dayChangePct: parseNumber(meta?.changePct),
      allocation: {
        ticker: holding.displaySymbol || holding.symbol,
        sector: holding.sector || (isCash ? "Cash" : "Unclassified"),
        industry: holding.industry || (isCash ? "Cash" : "Unclassified"),
        country: holding.country || "Unclassified",
        assetType: assetTypeLabel(holding.assetType),
        strategy: holding.strategy || "Unassigned",
        currency: displayCurrency,
        broker: holding.broker || "Unassigned",
      },
    } satisfies EnrichedHolding;
  });
  const total = interim.reduce(
    (sum, holding) => sum + holding.marketValueBase,
    0,
  );
  return interim.map((holding) => ({
    ...holding,
    weight: total > 0 ? (holding.marketValueBase / total) * 100 : 0,
  }));
}

function allocationRows(
  holdings: EnrichedHolding[],
  dimension: AllocationDimension,
) {
  const totals = new Map<string, number>();
  holdings.forEach((holding) => {
    const key = holding.allocation[dimension] || "Unclassified";
    totals.set(key, (totals.get(key) ?? 0) + holding.marketValueBase);
  });
  const total = Array.from(totals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  return Array.from(totals.entries())
    .map(([label, value], index) => ({
      label,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value);
}

function DonutChart({ rows }: { rows: ReturnType<typeof allocationRows> }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const segments = rows.map((row, index) => {
    const dash = total > 0 ? (row.value / total) * circumference : 0;
    const previous = rows
      .slice(0, index)
      .reduce(
        (sum, previousRow) =>
          sum + (total > 0 ? (previousRow.value / total) * circumference : 0),
        0,
      );
    return { ...row, dash, offset: 25 - previous };
  });
  return (
    <svg
      className="trading-portfolio-donut"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Portfolio allocation donut"
    >
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="rgba(28,37,32,0.08)"
        strokeWidth="14"
      />
      {segments.map((row) => (
        <circle
          key={row.label}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={row.color}
          strokeWidth="14"
          strokeDasharray={`${row.dash} ${circumference - row.dash}`}
          strokeDashoffset={row.offset}
          strokeLinecap="butt"
          transform="rotate(-90 50 50)"
        />
      ))}
      <text x="50" y="47" textAnchor="middle">
        {rows.length}
      </text>
      <text x="50" y="58" textAnchor="middle">
        groups
      </text>
    </svg>
  );
}

function performancePointTime(point: PerformancePoint) {
  return typeof point.time === "number"
    ? point.time
    : Date.parse(point.time) / 1000;
}

function performanceLineData(
  series: PerformanceSeries | undefined,
): LineData<Time>[] {
  return [...(series?.points ?? [])]
    .map((point) => ({
      time: point.time as Time,
      value: point.value,
      sortTime: performancePointTime(point),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.sortTime) && Number.isFinite(point.value),
    )
    .sort((a, b) => a.sortTime - b.sortTime)
    .map(({ time, value }) => ({ time, value }));
}

function PortfolioPerformanceChart({
  visible,
  series,
}: {
  visible: Record<BenchmarkKey, boolean>;
  series: PerformanceSeries[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<BenchmarkKey, ISeriesApi<"Line">>>(new Map());
  const activeSeries = useMemo(
    () => series.filter((entry) => visible[entry.key] && entry.points.length),
    [series, visible],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height: 236,
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: { color: "transparent" },
        textColor: "rgba(34, 48, 41, 0.58)",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(28, 37, 32, 0.04)" },
        horzLines: { color: "rgba(28, 37, 32, 0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(28, 37, 32, 0.12)",
        textColor: "rgba(34, 48, 41, 0.55)",
      },
      timeScale: {
        borderColor: "rgba(28, 37, 32, 0.12)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: {
        vertLine: {
          color: "rgba(23, 36, 30, 0.24)",
          labelBackgroundColor: "#17241e",
        },
        horzLine: {
          color: "rgba(23, 36, 30, 0.18)",
          labelBackgroundColor: "#17241e",
        },
      },
    });
    chartRef.current = chart;
    const lineSeries = seriesRef.current;
    const observer = new ResizeObserver(() => chart.timeScale().fitContent());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      lineSeries.clear();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const wanted = new Set(activeSeries.map((entry) => entry.key));
    for (const [key, line] of seriesRef.current.entries()) {
      if (!wanted.has(key)) {
        chart.removeSeries(line);
        seriesRef.current.delete(key);
      }
    }
    activeSeries.forEach((entry) => {
      let line = seriesRef.current.get(entry.key);
      if (!line) {
        line = chart.addSeries(LineSeries, {
          color: benchmarkColors[entry.key],
          lineWidth: entry.key === "portfolio" ? 3 : 2,
          lastValueVisible: true,
          priceLineVisible: false,
          title: benchmarkLabels[entry.key],
        });
        seriesRef.current.set(entry.key, line);
      }
      line.setData(performanceLineData(entry));
    });
    chart.timeScale().fitContent();
  }, [activeSeries]);

  return (
    <div className="trading-portfolio-performance-chart-shell">
      <div
        ref={containerRef}
        className="trading-portfolio-performance-chart"
        aria-label="Portfolio performance chart"
      />
      {!activeSeries.length ? (
        <div className="trading-portfolio-performance-empty">
          Performance data is still loading.
        </div>
      ) : null}
    </div>
  );
}

function FiveDayGlimmer({
  values,
  tone,
}: {
  values?: number[];
  tone: PortfolioMetadataItem["tone"] | undefined;
}) {
  const cleanValues = (values ?? []).filter((value) => Number.isFinite(value));
  if (cleanValues.length < 2) {
    return (
      <span
        className="trading-portfolio-glimmer-empty"
        aria-label="5D chart unavailable"
      />
    );
  }
  const width = 86;
  const height = 28;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const points = cleanValues
    .map((value, index) => {
      const x = (index / Math.max(cleanValues.length - 1, 1)) * (width - 4) + 2;
      const y =
        height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={`trading-portfolio-glimmer ${tone ?? "neutral"}`}
      viewBox={`0 0 ${width} ${height}`}
      aria-label="5D price history glimmer line"
      role="img"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Week52Range({ metadata }: { metadata?: PortfolioMetadataItem }) {
  const position = metadata?.week52Position;
  return (
    <div className="trading-portfolio-52w" aria-label="52 week range">
      <span>{metadata?.week52Low ?? "—"}</span>
      <i>
        <b
          style={{ left: `${position ?? 50}%` }}
          data-empty={position == null ? "true" : undefined}
        />
      </i>
      <span>{metadata?.week52High ?? "—"}</span>
    </div>
  );
}

function initialHoldingInput(holding?: EnrichedHolding): HoldingInput {
  if (!holding) {
    return {
      symbol: "",
      name: "",
      assetType: "stock",
      quantity: "",
      averageCost: "",
      currency: BASE_CURRENCY,
      strategy: "",
      transactionFee: "",
      broker: "",
      alertMinPrice: "",
      alertMaxPrice: "",
    };
  }
  return {
    symbol: holding.symbol,
    name: holding.name ?? holding.displayName ?? "",
    assetType: holding.assetType,
    quantity: String(holding.quantity),
    averageCost: String(holding.averageCost),
    currency: holding.currency || holding.metadata?.currency || BASE_CURRENCY,
    strategy: holding.strategy ?? "",
    transactionFee:
      holding.transactionFee != null ? String(holding.transactionFee) : "",
    broker: holding.broker ?? "",
    alertMinPrice:
      holding.alertMinPrice != null ? String(holding.alertMinPrice) : "",
    alertMaxPrice:
      holding.alertMaxPrice != null ? String(holding.alertMaxPrice) : "",
  };
}

function initialBuyMoreInput(): BuyMoreInput {
  return { quantity: "", purchasePrice: "", transactionFee: "" };
}

function initialCashInput(holding?: EnrichedHolding | null): CashInput {
  if (!holding) return { currency: BASE_CURRENCY, amount: "", broker: "" };
  return {
    currency: holding.currency || BASE_CURRENCY,
    amount: String(holding.quantity),
    broker: holding.broker ?? "",
  };
}

function cashSymbol(currency: string) {
  return `CASH.${currency.trim().toUpperCase() || BASE_CURRENCY}`;
}

function fxTooltipRows(rates: FxRate[]) {
  const relevant = rates
    .filter((rate) => rate.from !== rate.to)
    .sort((a, b) => a.from.localeCompare(b.from));
  if (!relevant.length)
    return ["All holdings already match the base currency."];
  return relevant.map((rate) => {
    const date = Number.isFinite(Date.parse(rate.asOf))
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(rate.asOf))
      : "latest";
    const source =
      rate.freshness === "fresh"
        ? "Frankfurter"
        : rate.freshness === "fallback"
          ? "fallback"
          : rate.freshness;
    return `${formatFxRate(rate)} · ${source} · ${date}`;
  });
}

function performanceRequestPayload(holdings: EnrichedHolding[]) {
  return holdings
    .filter((holding) => holding.assetType !== "cash")
    .map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity,
      currency: holding.displayCurrency,
      assetType: holding.assetType,
      fxRate: holding.fxRate.rate,
    }));
}

function seriesChange(series: PerformanceSeries | undefined) {
  const last = series?.points.at(-1)?.value;
  return typeof last === "number" && Number.isFinite(last) ? last : null;
}

function sourceLabel(series: PerformanceSeries[]) {
  const sources = Array.from(
    new Set(series.map((entry) => entry.source).filter(Boolean)),
  );
  if (!sources.length) return "provider data";
  return sources.slice(0, 3).join(" + ");
}

function PortfolioHoldingForm({
  enabled,
  mode,
  holding,
  onSaved,
  onCancel,
}: {
  enabled: boolean;
  mode: PortfolioFormMode;
  holding?: EnrichedHolding;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  if (!enabled) {
    return (
      <div className="trading-portfolio-add-disabled">
        Connect Convex to manage manual portfolio holdings.
      </div>
    );
  }
  return (
    <LivePortfolioHoldingForm
      mode={mode}
      holding={holding}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function LivePortfolioHoldingForm({
  mode,
  holding,
  onSaved,
  onCancel,
}: {
  mode: PortfolioFormMode;
  holding?: EnrichedHolding;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const addHolding = useMutation(portfolioApi.add);
  const updateHolding = useMutation(portfolioApi.update);
  const [input, setInput] = useState<HoldingInput>(() =>
    initialHoldingInput(holding),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearchSymbol, setSelectedSearchSymbol] = useState<
    string | null
  >(null);
  const selectedSymbolStillCurrent =
    selectedSearchSymbol !== null &&
    normalizeSymbol(input.symbol) === selectedSearchSymbol;
  const searchTerm = selectedSymbolStillCurrent
    ? ""
    : [input.symbol.trim(), input.name.trim()].filter(Boolean).join(" ");

  useEffect(() => {
    setInput(initialHoldingInput(holding));
  }, [holding]);

  useEffect(() => {
    if (
      mode !== "add" ||
      !searchOpen ||
      selectedSymbolStillCurrent ||
      searchTerm.length < 1
    ) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/trading/search?q=${encodeURIComponent(searchTerm)}`,
          {
            signal: controller.signal,
            headers: { accept: "application/json" },
          },
        );
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as TickerSearchResponse;
        setSearchResults(data.results ?? []);
        setActiveIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(
          error instanceof Error ? error.message : "Search failed",
        );
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, searchOpen, searchTerm, selectedSymbolStillCurrent]);

  function patch<K extends keyof HoldingInput>(key: K, value: HoldingInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function applySearchResult(result: TickerSearchResult) {
    setSelectedSearchSymbol(normalizeSymbol(result.symbol));
    setInput((current) => ({
      ...current,
      symbol: result.symbol,
      name: result.name || current.name,
      currency:
        result.currency && result.currency !== "—"
          ? result.currency.toUpperCase()
          : current.currency,
      assetType: assetTypeFromSearchType(result.type),
    }));
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setActiveIndex(0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = normalizeSymbol(input.symbol);
    const quantity = parseNumber(input.quantity);
    const averageCost = parseNumber(input.averageCost);
    const transactionFee = parseNumber(input.transactionFee) ?? 0;
    if (!symbol) {
      setStatus("Symbol is required.");
      return;
    }
    if (
      !quantity ||
      quantity <= 0 ||
      !averageCost ||
      averageCost <= 0 ||
      transactionFee < 0
    ) {
      setStatus(
        "Shares and average cost must be greater than zero. Fee cannot be negative.",
      );
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const alertMinPrice = cleanAlertInput(input.alertMinPrice);
      const alertMaxPrice = cleanAlertInput(input.alertMaxPrice);
      const payload = {
        name: input.name.trim() || undefined,
        assetType: input.assetType,
        quantity,
        averageCost,
        transactionFee,
        currency: input.currency.trim().toUpperCase() || BASE_CURRENCY,
        strategy: input.strategy.trim() || undefined,
        broker: input.broker.trim() || undefined,
        alertEnabled: Boolean(alertMinPrice || alertMaxPrice),
        alertMinPrice,
        alertMaxPrice,
      };
      if (mode === "edit" && holding) {
        await updateHolding({ id: holding._id, ...payload });
        setStatus(`${holding.displaySymbol} updated.`);
      } else {
        await addHolding({ userKey: DEMO_USER_KEY, symbol, ...payload });
        setInput(initialHoldingInput());
        setStatus(`${symbol} added.`);
      }
      onSaved?.();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save holding.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const selected =
    searchResults[Math.min(activeIndex, Math.max(searchResults.length - 1, 0))];

  return (
    <form className="trading-portfolio-add-form" onSubmit={handleSubmit}>
      <div className="trading-portfolio-form-title">
        <strong>
          {mode === "edit"
            ? `Edit ${holding?.displaySymbol ?? "holding"}`
            : "Add holding"}
        </strong>
        {onCancel ? (
          <button
            type="button"
            className="trading-portfolio-form-close"
            onClick={onCancel}
            aria-label="Close holding form"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <label className="trading-portfolio-symbol-search">
        <span>Symbol or name</span>
        <input
          value={input.symbol}
          onChange={(event) => {
            setSelectedSearchSymbol(null);
            patch("symbol", event.target.value);
            if (mode === "add") setSearchOpen(true);
          }}
          onFocus={() =>
            setSearchOpen(mode === "add" && !selectedSymbolStillCurrent)
          }
          onKeyDown={(event) => {
            if (mode !== "add") return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(searchResults.length - 1, 0)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && selected && searchOpen) {
              event.preventDefault();
              applySearchResult(selected);
            } else if (event.key === "Escape") {
              setSearchOpen(false);
            }
          }}
          placeholder="Type ticker or company"
          disabled={isSaving || mode === "edit"}
        />
        {mode === "add" && searchOpen && !selectedSymbolStillCurrent ? (
          <div
            className="trading-portfolio-search-results"
            role="listbox"
            aria-label="Portfolio ticker suggestions"
          >
            {searchLoading ? <div>Searching…</div> : null}
            {!searchLoading && searchError ? <div>{searchError}</div> : null}
            {!searchLoading &&
            !searchError &&
            searchTerm &&
            !searchResults.length ? (
              <div>No matches yet.</div>
            ) : null}
            {searchResults.map((result, index) => (
              <button
                key={result.symbol}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => applySearchResult(result)}
              >
                <span>
                  <b>{result.symbol}</b>
                  {result.isPrimary ? <em>Primary</em> : null}
                </span>
                <strong>{result.name}</strong>
                <small>{searchResultMeta(result)}</small>
              </button>
            ))}
          </div>
        ) : null}
      </label>
      <label>
        <span>Name</span>
        <input
          value={input.name}
          onChange={(event) => patch("name", event.target.value)}
          placeholder="Autofills after symbol select"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Type</span>
        <select
          value={input.assetType}
          onChange={(event) =>
            patch("assetType", event.target.value as PortfolioAssetType)
          }
          disabled={isSaving}
        >
          <option value="stock">Stock</option>
          <option value="etf">ETF</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        <span>Shares</span>
        <input
          value={input.quantity}
          onChange={(event) => patch("quantity", event.target.value)}
          inputMode="decimal"
          placeholder="10"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Avg cost</span>
        <input
          value={input.averageCost}
          onChange={(event) => patch("averageCost", event.target.value)}
          inputMode="decimal"
          placeholder="125.50"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Transaction fee</span>
        <input
          value={input.transactionFee}
          onChange={(event) => patch("transactionFee", event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Currency</span>
        <input
          value={input.currency}
          onChange={(event) => patch("currency", event.target.value)}
          placeholder="EUR"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Strategy</span>
        <input
          value={input.strategy}
          onChange={(event) => patch("strategy", event.target.value)}
          placeholder="Compounders"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Broker</span>
        <input
          value={input.broker}
          onChange={(event) => patch("broker", event.target.value)}
          placeholder="Broker"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Min alert</span>
        <input
          value={input.alertMinPrice}
          onChange={(event) => patch("alertMinPrice", event.target.value)}
          inputMode="decimal"
          placeholder="Below"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Max alert</span>
        <input
          value={input.alertMaxPrice}
          onChange={(event) => patch("alertMaxPrice", event.target.value)}
          inputMode="decimal"
          placeholder="Above"
          disabled={isSaving}
        />
      </label>
      <button type="submit" disabled={isSaving}>
        {isSaving
          ? "Saving…"
          : mode === "edit"
            ? "Save changes"
            : "Add holding"}
      </button>
      {status ? <p>{status}</p> : null}
    </form>
  );
}

function BuyMoreForm({
  holding,
  onSaved,
  onCancel,
}: {
  holding: EnrichedHolding;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const updateHolding = useMutation(portfolioApi.update);
  const [input, setInput] = useState<BuyMoreInput>(() => initialBuyMoreInput());
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addedQuantity = parseNumber(input.quantity);
    const purchasePrice = parseNumber(input.purchasePrice);
    const transactionFee = parseNumber(input.transactionFee) ?? 0;
    if (
      !addedQuantity ||
      addedQuantity <= 0 ||
      !purchasePrice ||
      purchasePrice <= 0 ||
      transactionFee < 0
    ) {
      setStatus(
        "Amount and purchase price must be greater than zero. Fee cannot be negative.",
      );
      return;
    }

    const nextQuantity = holding.quantity + addedQuantity;
    const nextTransactionFee = (holding.transactionFee ?? 0) + transactionFee;
    const nextCostBasis =
      holding.costBasis + addedQuantity * purchasePrice + transactionFee;
    const nextAverageCost = (nextCostBasis - nextTransactionFee) / nextQuantity;

    setIsSaving(true);
    setStatus(null);
    try {
      await updateHolding({
        id: holding._id,
        quantity: nextQuantity,
        averageCost: Math.round(nextAverageCost * 10000) / 10000,
        transactionFee: Math.round(nextTransactionFee * 100) / 100,
      });
      setStatus(`${holding.displaySymbol} purchase added.`);
      setInput(initialBuyMoreInput());
      onSaved?.();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not add purchase.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="trading-portfolio-buy-more-form" onSubmit={handleSubmit}>
      <div className="trading-portfolio-form-title">
        <strong>Add purchase · {holding.displaySymbol}</strong>
        {onCancel ? (
          <button
            type="button"
            className="trading-portfolio-form-close"
            onClick={onCancel}
            aria-label="Close add purchase form"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <label>
        <span>Amount</span>
        <input
          value={input.quantity}
          onChange={(event) =>
            setInput((current) => ({
              ...current,
              quantity: event.target.value,
            }))
          }
          inputMode="decimal"
          placeholder="10"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Purchase price</span>
        <input
          value={input.purchasePrice}
          onChange={(event) =>
            setInput((current) => ({
              ...current,
              purchasePrice: event.target.value,
            }))
          }
          inputMode="decimal"
          placeholder={
            holding.currentPrice != null ? String(holding.currentPrice) : "0.00"
          }
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Transaction costs</span>
        <input
          value={input.transactionFee}
          onChange={(event) =>
            setInput((current) => ({
              ...current,
              transactionFee: event.target.value,
            }))
          }
          inputMode="decimal"
          placeholder="0.00"
          disabled={isSaving}
        />
      </label>
      <button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : "Add purchase"}
      </button>
      {status ? <p>{status}</p> : null}
    </form>
  );
}

function CashManagementForm({
  enabled,
  mode,
  holding,
  onSaved,
  onCancel,
}: {
  enabled: boolean;
  mode: CashFormMode;
  holding?: EnrichedHolding | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  if (!enabled) {
    return (
      <div className="trading-portfolio-add-disabled">
        Connect Convex to manage cash balances.
      </div>
    );
  }
  return (
    <LiveCashManagementForm
      mode={mode}
      holding={holding ?? null}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function LiveCashManagementForm({
  mode,
  holding,
  onSaved,
  onCancel,
}: {
  mode: CashFormMode;
  holding: EnrichedHolding | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const addHolding = useMutation(portfolioApi.add);
  const updateHolding = useMutation(portfolioApi.update);
  const [input, setInput] = useState<CashInput>(() =>
    initialCashInput(holding),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setInput(initialCashInput(holding));
  }, [holding]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currency = input.currency.trim().toUpperCase() || BASE_CURRENCY;
    const amount = parseNumber(input.amount);
    if (!amount || amount <= 0) {
      setStatus("Cash amount must be greater than zero.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const payload = {
        name: `Cash ${currency}`,
        assetType: "cash" as PortfolioAssetType,
        quantity: amount,
        averageCost: 1,
        transactionFee: 0,
        currency,
        strategy: "Reserve",
        broker: input.broker.trim() || undefined,
      };
      if (mode === "edit" && holding) {
        await updateHolding({ id: holding._id, ...payload });
        setStatus(`${currency} cash updated.`);
      } else {
        await addHolding({
          userKey: DEMO_USER_KEY,
          symbol: cashSymbol(currency),
          ...payload,
        });
        setInput(initialCashInput());
        setStatus(`${currency} cash added.`);
      }
      onSaved?.();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save cash.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="trading-portfolio-cash-form" onSubmit={handleSubmit}>
      <div className="trading-portfolio-form-title">
        <strong>
          {mode === "edit"
            ? `Edit ${holding?.displaySymbol ?? "cash"}`
            : "Add cash"}
        </strong>
        {onCancel ? (
          <button
            type="button"
            className="trading-portfolio-form-close"
            onClick={onCancel}
            aria-label="Close cash form"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <label>
        <span>Currency</span>
        <input
          value={input.currency}
          onChange={(event) =>
            setInput((current) => ({
              ...current,
              currency: event.target.value,
            }))
          }
          placeholder="EUR"
          disabled={isSaving || mode === "edit"}
        />
      </label>
      <label>
        <span>Amount</span>
        <input
          value={input.amount}
          onChange={(event) =>
            setInput((current) => ({ ...current, amount: event.target.value }))
          }
          inputMode="decimal"
          placeholder="1000"
          disabled={isSaving}
        />
      </label>
      <label>
        <span>Broker / account</span>
        <input
          value={input.broker}
          onChange={(event) =>
            setInput((current) => ({ ...current, broker: event.target.value }))
          }
          placeholder="Cash account"
          disabled={isSaving}
        />
      </label>
      <button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : mode === "edit" ? "Save cash" : "Add cash"}
      </button>
      {status ? <p>{status}</p> : null}
    </form>
  );
}

function CashManagementPanel({
  cashHoldings,
  totalValue,
  canMutate,
  onEdit,
  onAdd,
  onRemove,
  removingId,
}: {
  cashHoldings: EnrichedHolding[];
  totalValue: number;
  canMutate: boolean;
  onEdit?: (holding: EnrichedHolding) => void;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  removingId?: string | null;
}) {
  return (
    <section className="trading-portfolio-panel trading-portfolio-cash-panel">
      <div className="trading-section-head trading-portfolio-cash-head">
        <div>
          <div className="trading-section-label">Cash management</div>
          <p>
            Cash balances are separate from ticker search and included in the
            EUR base view.
          </p>
        </div>
        <button
          type="button"
          className="trading-portfolio-cash-add"
          onClick={onAdd}
          disabled={!canMutate}
        >
          <Wallet size={14} />
          Add cash
        </button>
      </div>
      {cashHoldings.length ? (
        <div className="trading-portfolio-cash-list">
          {cashHoldings.map((cash) => (
            <div key={cash._id} className="trading-portfolio-cash-row">
              <div>
                <strong>{cash.displaySymbol}</strong>
                <span>{cash.broker || "Cash balance"}</span>
              </div>
              <div>
                <b>{formatMoney(cash.marketValueBase, BASE_CURRENCY)}</b>
                {cash.displayCurrency !== BASE_CURRENCY ? (
                  <span>
                    {formatMoney(cash.marketValue, cash.displayCurrency)}
                  </span>
                ) : null}
                <em>
                  {totalValue > 0
                    ? `${cash.weight.toFixed(1)}% of portfolio`
                    : "—"}
                </em>
              </div>
              <div className="trading-portfolio-row-actions">
                <button
                  type="button"
                  className="trading-portfolio-edit"
                  onClick={() => onEdit?.(cash)}
                  disabled={!canMutate || cash._id.startsWith("sample-")}
                >
                  <Pencil size={13} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="trading-portfolio-remove"
                  onClick={() => onRemove?.(cash._id)}
                  disabled={
                    !canMutate ||
                    cash._id.startsWith("sample-") ||
                    removingId === cash._id
                  }
                  aria-label={`Remove ${cash.displaySymbol}`}
                >
                  {removingId === cash._id ? "…" : "−"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="trading-portfolio-empty">
          No cash balance yet. Add cash to include reserves in allocation and
          total value.
        </div>
      )}
    </section>
  );
}

function LiveCashManagementPanel({
  cashHoldings,
  totalValue,
  onEdit,
  onAdd,
}: {
  cashHoldings: EnrichedHolding[];
  totalValue: number;
  onEdit: (holding: EnrichedHolding) => void;
  onAdd: () => void;
}) {
  const removeHolding = useMutation(portfolioApi.remove);
  const [removingId, setRemovingId] = useState<string | null>(null);
  async function remove(id: string) {
    setRemovingId(id);
    try {
      await removeHolding({ id });
    } finally {
      setRemovingId(null);
    }
  }
  return (
    <CashManagementPanel
      cashHoldings={cashHoldings}
      totalValue={totalValue}
      canMutate
      onEdit={onEdit}
      onAdd={onAdd}
      onRemove={remove}
      removingId={removingId}
    />
  );
}

function HoldingsTable({
  holdings,
  canMutate,
  onEdit,
  onBuyMore,
  onRemove,
  removingId,
}: {
  holdings: EnrichedHolding[];
  canMutate: boolean;
  onEdit?: (holding: EnrichedHolding) => void;
  onBuyMore?: (holding: EnrichedHolding) => void;
  onRemove?: (id: string) => void;
  removingId?: string | null;
}) {
  return (
    <div className="trading-table-shell trading-portfolio-table-shell">
      <table className="trading-table trading-portfolio-table">
        <thead>
          <tr>
            <th>Holding</th>
            <th>Shares</th>
            <th>Avg cost</th>
            <th>Price</th>
            <th>5D</th>
            <th>52W</th>
            <th>Value</th>
            <th>P/L</th>
            <th>%</th>
            <th>Alert</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const tone = holding.totalPlBase >= 0 ? "positive" : "negative";
            return (
              <tr key={holding._id}>
                <td>
                  <div className="trading-portfolio-holding-cell">
                    <span
                      className={`trading-portfolio-logo ${holding.metadata?.logoUrl ? "has-logo" : "initials-only"}`}
                      aria-hidden={holding.metadata?.logoUrl ? undefined : true}
                    >
                      {holding.metadata?.logoUrl ? (
                        <>
                          <img
                            src={holding.metadata.logoUrl}
                            alt={
                              holding.metadata.logoAlt ??
                              `${holding.displaySymbol} logo`
                            }
                            loading="lazy"
                            decoding="async"
                          />
                          <span>{initialsForHolding(holding)}</span>
                        </>
                      ) : (
                        <span>{initialsForHolding(holding)}</span>
                      )}
                    </span>
                    <div>
                      <Link href={symbolHref(holding.symbol)}>
                        {holding.displaySymbol}
                      </Link>
                      <span>{holding.displayName}</span>
                    </div>
                  </div>
                </td>
                <td>{formatNumber(holding.quantity)}</td>
                <td>
                  {formatMoney(holding.averageCost, holding.displayCurrency)}
                </td>
                <td>
                  {holding.currentPrice == null
                    ? "—"
                    : formatMoney(
                        holding.currentPrice,
                        holding.displayCurrency,
                      )}
                  <small
                    className={`trading-portfolio-price-change ${holding.metadata?.tone ?? "neutral"}`}
                  >
                    {formatPercent(holding.dayChangePct)}
                  </small>
                </td>
                <td className="trading-portfolio-glimmer-cell">
                  <FiveDayGlimmer
                    values={holding.metadata?.dayPoints}
                    tone={holding.metadata?.tone}
                  />
                </td>
                <td>
                  <Week52Range metadata={holding.metadata} />
                </td>
                <td>
                  {formatMoney(holding.marketValueBase, BASE_CURRENCY)}
                  {holding.displayCurrency !== BASE_CURRENCY ? (
                    <small>
                      {formatMoney(
                        holding.marketValue,
                        holding.displayCurrency,
                      )}
                    </small>
                  ) : null}
                </td>
                <td className={tone}>
                  {formatMoney(holding.totalPlBase, BASE_CURRENCY)}
                  {holding.displayCurrency !== BASE_CURRENCY ? (
                    <small>
                      {formatMoney(holding.totalPl, holding.displayCurrency)}
                    </small>
                  ) : null}
                </td>
                <td className={tone}>{formatPercent(holding.totalPlPct)}</td>
                <td>
                  <span className="trading-portfolio-alert-cell">
                    <b>
                      Min{" "}
                      {holding.alertMinPrice
                        ? formatMoney(
                            holding.alertMinPrice,
                            holding.displayCurrency,
                          )
                        : "—"}
                    </b>
                    <b>
                      Max{" "}
                      {holding.alertMaxPrice
                        ? formatMoney(
                            holding.alertMaxPrice,
                            holding.displayCurrency,
                          )
                        : "—"}
                    </b>
                  </span>
                </td>
                <td>
                  <div className="trading-portfolio-row-actions">
                    <button
                      type="button"
                      className="trading-portfolio-edit"
                      onClick={() => onEdit?.(holding)}
                      disabled={!canMutate || holding._id.startsWith("sample-")}
                      aria-label={`Edit ${holding.displaySymbol}`}
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="trading-portfolio-buy-more"
                      onClick={() => onBuyMore?.(holding)}
                      disabled={!canMutate || holding._id.startsWith("sample-")}
                      aria-label={`Add purchase for ${holding.displaySymbol}`}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="trading-portfolio-remove"
                      onClick={() => onRemove?.(holding._id)}
                      disabled={
                        !canMutate ||
                        holding._id.startsWith("sample-") ||
                        removingId === holding._id
                      }
                      aria-label={`Remove ${holding.displaySymbol}`}
                    >
                      {removingId === holding._id ? "…" : "−"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LivePortfolioTable({
  holdings,
  metadata,
  onEdit,
  onBuyMore,
}: {
  holdings: EnrichedHolding[];
  metadata: Map<string, PortfolioMetadataItem>;
  onEdit: (holding: EnrichedHolding) => void;
  onBuyMore: (holding: EnrichedHolding) => void;
}) {
  void metadata;
  const removeHolding = useMutation(portfolioApi.remove);
  const [removingId, setRemovingId] = useState<string | null>(null);
  async function remove(id: string) {
    setRemovingId(id);
    try {
      await removeHolding({ id });
    } finally {
      setRemovingId(null);
    }
  }
  return (
    <HoldingsTable
      holdings={holdings}
      canMutate
      onEdit={onEdit}
      onBuyMore={onBuyMore}
      onRemove={remove}
      removingId={removingId}
    />
  );
}

function PortfolioLayout({
  holdings,
  isLive,
  isLoading,
}: {
  holdings: PortfolioHolding[];
  isLive: boolean;
  isLoading?: boolean;
}) {
  const [metadata, setMetadata] = useState<Map<string, PortfolioMetadataItem>>(
    new Map(),
  );
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [fxRates, setFxRates] = useState<Map<string, FxRate>>(() =>
    readFxCache([BASE_CURRENCY]),
  );
  const [fxLoading, setFxLoading] = useState(false);
  const [allocationDimension, setAllocationDimension] =
    useState<AllocationDimension>("sector");
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [addOpen, setAddOpen] = useState(false);
  const [cashFormOpen, setCashFormOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<EnrichedHolding | null>(null);
  const [buyMoreHolding, setBuyMoreHolding] = useState<EnrichedHolding | null>(
    null,
  );
  const [editCashHolding, setEditCashHolding] =
    useState<EnrichedHolding | null>(null);
  const [visibleBenchmarks, setVisibleBenchmarks] = useState<
    Record<BenchmarkKey, boolean>
  >({ portfolio: true, sp500: true, allworld: true, nasdaq: false });
  const [performanceRange, setPerformanceRange] =
    useState<PerformanceRange>("1Y");
  const [performanceData, setPerformanceData] =
    useState<PortfolioPerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  const symbols = useMemo(
    () =>
      holdings
        .filter((holding) => holding.assetType !== "cash")
        .map((holding) => normalizeSymbol(holding.symbol))
        .filter(Boolean)
        .sort(),
    [holdings],
  );
  const symbolsKey = symbols.join(",");
  const currencies = useMemo(
    () =>
      Array.from(
        new Set(
          holdings
            .map(
              (holding) =>
                holding.currency.trim().toUpperCase() || BASE_CURRENCY,
            )
            .filter(Boolean),
        ),
      ).sort(),
    [holdings],
  );
  const currenciesKey = currencies.join(",");

  useEffect(() => {
    if (!symbolsKey) {
      setMetadata(new Map());
      setMetadataLoading(false);
      return;
    }
    const requestedSymbols = symbolsKey.split(",").filter(Boolean);
    setMetadata(readMetadataCache(requestedSymbols));
    const controller = new AbortController();
    setMetadataLoading(true);
    fetch(
      `/api/trading/watchlist-metadata?symbols=${encodeURIComponent(symbolsKey)}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    )
      .then((response) => {
        if (!response.ok)
          throw new Error(`Metadata failed (${response.status})`);
        return response.json() as Promise<PortfolioMetadataResponse>;
      })
      .then((data) => {
        const items = data.items ?? [];
        writeMetadataCache(items, requestedSymbols);
        const next = new Map<string, PortfolioMetadataItem>();
        items.forEach((item, index) => {
          next.set(normalizeSymbol(item.symbol), item);
          if (requestedSymbols[index])
            next.set(normalizeSymbol(requestedSymbols[index]), item);
        });
        setMetadata(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMetadata(readMetadataCache(requestedSymbols));
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetadataLoading(false);
      });
    return () => controller.abort();
  }, [symbolsKey]);

  useEffect(() => {
    if (!currenciesKey) {
      setFxRates(readFxCache([BASE_CURRENCY]));
      setFxLoading(false);
      return;
    }
    const requestedCurrencies = currenciesKey.split(",").filter(Boolean);
    setFxRates(readFxCache(requestedCurrencies));
    const controller = new AbortController();
    setFxLoading(true);
    fetch(
      `/api/trading/fx?base=${encodeURIComponent(BASE_CURRENCY)}&currencies=${encodeURIComponent(currenciesKey)}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    )
      .then((response) => {
        if (!response.ok) throw new Error(`FX failed (${response.status})`);
        return response.json() as Promise<FxRatesResponse>;
      })
      .then((data) => {
        const rates = data.rates ?? [];
        writeFxCache(rates);
        const next = readFxCache(requestedCurrencies);
        rates.forEach((rate) => next.set(rate.from, rate));
        setFxRates(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setFxRates(readFxCache(requestedCurrencies));
      })
      .finally(() => {
        if (!controller.signal.aborted) setFxLoading(false);
      });
    return () => controller.abort();
  }, [currenciesKey]);

  const enriched = useMemo(
    () => enrichHoldings(holdings, metadata, fxRates),
    [holdings, metadata, fxRates],
  );
  const sortedHoldings = useMemo(
    () =>
      [...enriched].sort((a, b) => {
        if (sortKey === "value") return b.marketValueBase - a.marketValueBase;
        if (sortKey === "pl") return b.totalPlBase - a.totalPlBase;
        if (sortKey === "symbol")
          return a.displaySymbol.localeCompare(b.displaySymbol);
        return b.weight - a.weight;
      }),
    [enriched, sortKey],
  );
  const allocation = useMemo(
    () => allocationRows(enriched, allocationDimension),
    [enriched, allocationDimension],
  );
  const totalValue = enriched.reduce(
    (sum, holding) => sum + holding.marketValueBase,
    0,
  );
  const totalCost = enriched.reduce(
    (sum, holding) => sum + holding.costBasisBase,
    0,
  );
  const totalPl = totalValue - totalCost;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : null;
  const cashHoldings = useMemo(
    () => enriched.filter((holding) => holding.assetType === "cash"),
    [enriched],
  );
  const investmentHoldings = useMemo(
    () => enriched.filter((holding) => holding.assetType !== "cash"),
    [enriched],
  );
  const cashValue = cashHoldings.reduce(
    (sum, holding) => sum + holding.marketValueBase,
    0,
  );
  const fxTooltip = fxTooltipRows(Array.from(fxRates.values()));
  const largest = [...investmentHoldings].sort(
    (a, b) => b.weight - a.weight,
  )[0];
  const performanceHoldings = useMemo(
    () => performanceRequestPayload(investmentHoldings),
    [investmentHoldings],
  );
  const performanceHoldingsKey = useMemo(
    () =>
      performanceHoldings
        .map(
          (holding) =>
            `${holding.symbol}:${holding.quantity}:${holding.assetType}:${holding.fxRate}`,
        )
        .sort()
        .join("|"),
    [performanceHoldings],
  );
  const performanceRequestBody = useMemo(
    () =>
      JSON.stringify({
        range: performanceRange,
        holdings: performanceHoldings,
      }),
    [performanceHoldings, performanceRange],
  );

  useEffect(() => {
    if (!performanceHoldings.length) {
      setPerformanceData(null);
      setPerformanceLoading(false);
      setPerformanceError(null);
      return;
    }
    const controller = new AbortController();
    setPerformanceLoading(true);
    setPerformanceError(null);
    fetch("/api/trading/portfolio-performance", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: performanceRequestBody,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Performance failed (${response.status})`);
        return response.json() as Promise<PortfolioPerformanceResponse>;
      })
      .then((data) => setPerformanceData(data))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPerformanceError(
          error instanceof Error ? error.message : "Performance unavailable",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPerformanceLoading(false);
      });
    return () => controller.abort();
  }, [
    performanceHoldings.length,
    performanceHoldingsKey,
    performanceRequestBody,
  ]);

  const performanceSeries = performanceData?.series ?? [];
  const portfolioPerformance = performanceSeries.find(
    (entry) => entry.key === "portfolio",
  );
  const portfolioRangeChange = seriesChange(portfolioPerformance);
  const performanceCaption =
    portfolioPerformance?.note ??
    "Reconstructed from current holdings, current FX, and historical market prices.";

  return (
    <>
      <section className="trading-portfolio-command-bar">
        <div>
          <h1>Portfolio</h1>
          <p>
            {metadataLoading || fxLoading
              ? "Refreshing prices and FX…"
              : `Manual holdings · converted to ${BASE_CURRENCY}`}
          </p>
        </div>
        <div className="trading-portfolio-actions">
          <button
            type="button"
            className="trading-portfolio-add-icon-button"
            onClick={() => {
              setEditHolding(null);
              setBuyMoreHolding(null);
              setEditCashHolding(null);
              setCashFormOpen(false);
              setAddOpen((open) => !open);
            }}
            aria-expanded={addOpen}
            aria-label={addOpen ? "Close add holding" : "Add holding"}
          >
            {addOpen ? <X size={15} /> : <Plus size={16} />}
          </button>
        </div>
      </section>

      {addOpen ? (
        <PortfolioHoldingForm
          enabled={isLive}
          mode="add"
          onSaved={() => setAddOpen(false)}
          onCancel={() => setAddOpen(false)}
        />
      ) : null}
      {editHolding ? (
        <PortfolioHoldingForm
          enabled={isLive}
          mode="edit"
          holding={editHolding}
          onSaved={() => setEditHolding(null)}
          onCancel={() => setEditHolding(null)}
        />
      ) : null}
      {buyMoreHolding ? (
        <BuyMoreForm
          holding={buyMoreHolding}
          onSaved={() => setBuyMoreHolding(null)}
          onCancel={() => setBuyMoreHolding(null)}
        />
      ) : null}
      {cashFormOpen ? (
        <CashManagementForm
          enabled={isLive}
          mode="add"
          onSaved={() => setCashFormOpen(false)}
          onCancel={() => setCashFormOpen(false)}
        />
      ) : null}
      {editCashHolding ? (
        <CashManagementForm
          enabled={isLive}
          mode="edit"
          holding={editCashHolding}
          onSaved={() => setEditCashHolding(null)}
          onCancel={() => setEditCashHolding(null)}
        />
      ) : null}

      <section className="trading-portfolio-kpis">
        <article>
          <span>Total value</span>
          <strong>{formatMoney(totalValue, BASE_CURRENCY)}</strong>
          <em>{investmentHoldings.length} holdings</em>
        </article>
        <article>
          <span>Total P/L</span>
          <strong className={totalPl >= 0 ? "positive" : "negative"}>
            {formatMoney(totalPl, BASE_CURRENCY)}
          </strong>
          <em className={totalPl >= 0 ? "positive" : "negative"}>
            {formatPercent(totalPlPct)}
          </em>
        </article>
        <article>
          <span>Cash</span>
          <strong>{formatMoney(cashValue, BASE_CURRENCY)}</strong>
          <em>
            {totalValue > 0
              ? `${((cashValue / totalValue) * 100).toFixed(1)}%`
              : "—"}
          </em>
        </article>
        <article>
          <span>Largest position</span>
          <strong>{largest?.displaySymbol ?? "—"}</strong>
          <em>{largest ? `${largest.weight.toFixed(1)}%` : "—"}</em>
        </article>
        <article className="trading-portfolio-fx-kpi" tabIndex={0}>
          <span>Base currency</span>
          <strong>{BASE_CURRENCY}</strong>
          <em>
            {fxLoading ? "Updating FX…" : `${currencies.length} currencies`}
          </em>
          <div className="trading-portfolio-fx-tooltip" role="tooltip">
            {fxTooltip.map((row) => (
              <b key={row}>{row}</b>
            ))}
          </div>
        </article>
      </section>

      <section className="trading-portfolio-dashboard-grid">
        <article className="trading-portfolio-panel trading-portfolio-performance-panel">
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Performance</div>
              <p>
                {performanceLoading
                  ? "Loading market history…"
                  : performanceError
                    ? performanceError
                    : performanceCaption}
              </p>
            </div>
          </div>
          <div className="trading-portfolio-performance-toolbar">
            <div
              className="trading-range-tabs trading-portfolio-range-tabs"
              role="tablist"
              aria-label="Portfolio performance range"
            >
              {performanceRanges.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={performanceRange === range ? "active" : ""}
                  role="tab"
                  aria-selected={performanceRange === range}
                  onClick={() => setPerformanceRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
            <div className="trading-portfolio-benchmark-tabs">
              {(Object.keys(benchmarkLabels) as BenchmarkKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={visibleBenchmarks[key] ? "active" : ""}
                  style={{
                    ["--benchmark-color" as string]: benchmarkColors[key],
                  }}
                  onClick={() =>
                    setVisibleBenchmarks((current) => ({
                      ...current,
                      [key]: !current[key],
                    }))
                  }
                >
                  {benchmarkLabels[key]}
                  {key === "portfolio" ? (
                    <span>{formatPercent(portfolioRangeChange)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <PortfolioPerformanceChart
            visible={visibleBenchmarks}
            series={performanceSeries}
          />
          <p className="trading-financial-caption">
            Source: {sourceLabel(performanceSeries)} · {performanceRange} %
            change, excluding dividends and transaction-date cash-flow timing.
          </p>
        </article>

        <article className="trading-portfolio-panel trading-portfolio-allocation-panel">
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Allocation</div>
              <p>{allocationLabels[allocationDimension]}</p>
            </div>
          </div>
          <div className="trading-portfolio-allocation-tabs">
            {(Object.keys(allocationLabels) as AllocationDimension[]).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  className={key === allocationDimension ? "active" : ""}
                  onClick={() => setAllocationDimension(key)}
                >
                  {allocationLabels[key]}
                </button>
              ),
            )}
          </div>
          <div className="trading-portfolio-allocation-body">
            <DonutChart rows={allocation} />
            <div className="trading-portfolio-allocation-list">
              {allocation.map((row) => (
                <div key={row.label}>
                  <span>
                    <i style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <strong>{row.pct.toFixed(2)}%</strong>
                  <b>
                    <em
                      style={{ width: `${row.pct}%`, background: row.color }}
                    />
                  </b>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="trading-portfolio-panel trading-portfolio-holdings-panel">
        <div className="trading-section-head trading-portfolio-holdings-head">
          <div>
            <div className="trading-section-label">Holdings</div>
            <p>
              {isLoading
                ? "Loading Convex holdings…"
                : "Manual rows with live quote overlay and base-currency conversion."}
            </p>
          </div>
          <label className="trading-portfolio-holdings-sort">
            <span>Sort</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="weight">Weight</option>
              <option value="value">Value</option>
              <option value="pl">P/L</option>
              <option value="symbol">Symbol</option>
            </select>
          </label>
        </div>
        {isLoading ? (
          <div className="trading-portfolio-empty">Loading holdings…</div>
        ) : investmentHoldings.length ? (
          isLive ? (
            <LivePortfolioTable
              holdings={sortedHoldings.filter(
                (holding) => holding.assetType !== "cash",
              )}
              metadata={metadata}
              onEdit={(holding) => {
                setAddOpen(false);
                setCashFormOpen(false);
                setBuyMoreHolding(null);
                setEditCashHolding(null);
                setEditHolding(holding);
              }}
              onBuyMore={(holding) => {
                setAddOpen(false);
                setCashFormOpen(false);
                setEditHolding(null);
                setEditCashHolding(null);
                setBuyMoreHolding(holding);
              }}
            />
          ) : (
            <HoldingsTable
              holdings={sortedHoldings.filter(
                (holding) => holding.assetType !== "cash",
              )}
              canMutate={false}
            />
          )
        ) : (
          <div className="trading-portfolio-empty">
            No holdings yet. Add your first manual position.
          </div>
        )}
      </section>

      {isLive ? (
        <LiveCashManagementPanel
          cashHoldings={cashHoldings}
          totalValue={totalValue}
          onAdd={() => {
            setAddOpen(false);
            setEditHolding(null);
            setBuyMoreHolding(null);
            setEditCashHolding(null);
            setCashFormOpen(true);
          }}
          onEdit={(holding) => {
            setAddOpen(false);
            setCashFormOpen(false);
            setEditHolding(null);
            setBuyMoreHolding(null);
            setEditCashHolding(holding);
          }}
        />
      ) : (
        <CashManagementPanel
          cashHoldings={cashHoldings}
          totalValue={totalValue}
          canMutate={false}
        />
      )}

      <section className="trading-portfolio-bottom-grid">
        <article className="trading-portfolio-panel">
          <div className="trading-section-label">Upcoming earnings</div>
          <div className="trading-portfolio-earnings-list">
            {enriched
              .filter((holding) => holding.assetType !== "cash")
              .slice(0, 5)
              .map((holding, index) => (
                <div key={holding._id}>
                  <strong>{holding.displaySymbol}</strong>
                  <span>
                    {index === 0
                      ? "Provider date pending"
                      : `${index + 2} weeks · estimated`}
                  </span>
                  <em>{holding.weight.toFixed(1)}% weight</em>
                </div>
              ))}
          </div>
        </article>
        <article className="trading-portfolio-panel">
          <div className="trading-section-label">Closed positions</div>
          <div className="trading-portfolio-closed-placeholder">
            Closed positions archive comes after manual holdings are stable.
          </div>
        </article>
      </section>
    </>
  );
}

function LivePortfolioContent() {
  const liveHoldings = useQuery(portfolioApi.list, { userKey: DEMO_USER_KEY });
  const isLoading = liveHoldings === undefined;
  return (
    <PortfolioLayout
      holdings={isLoading ? [] : liveHoldings}
      isLive
      isLoading={isLoading}
    />
  );
}

export function PortfolioClient({ convexEnabled }: { convexEnabled: boolean }) {
  if (!convexEnabled)
    return <PortfolioLayout holdings={sampleHoldings} isLive={false} />;
  return <LivePortfolioContent />;
}
