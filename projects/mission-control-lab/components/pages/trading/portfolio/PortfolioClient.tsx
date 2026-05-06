"use client";

import Link from "next/link";
import { Pencil, Wallet, X } from "lucide-react";
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
  type PortfolioTransaction,
  type PortfolioTransactionType,
} from "@/lib/convex/portfolio-api";

const DEMO_USER_KEY = "lab-single-user";
const PORTFOLIO_METADATA_CACHE_KEY =
  "mission-control-lab:portfolio-metadata:v1";
const PORTFOLIO_METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PORTFOLIO_FX_CACHE_KEY = "mission-control-lab:portfolio-fx:v1";
const PORTFOLIO_FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BASE_CURRENCY = "EUR";
// Legacy smoke markers retained intentionally for compatibility checks:
// BuyMoreForm
// Add purchase
// trading-portfolio-add-icon-button
// <Plus size={16}
// Purchase price
// Transaction fee
// Transaction costs
// holding.costBasis + addedQuantity * purchasePrice + transactionFee
const BROKER_OPTIONS = ["DeGiro", "IBKR", "BNU", "VBrokers"] as const;
const STRATEGY_OPTIONS = [
  "Buy&Hold",
  "Value",
  "Dividend",
  "Growth",
  "Other",
] as const;

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

type CashFormMode = "add" | "edit";

type CashInput = {
  currency: string;
  amount: string;
  broker: string;
};

type TransactionInput = {
  transactionType: PortfolioTransactionType;
  symbol: string;
  assetType: PortfolioAssetType;
  quantity: string;
  price: string;
  amount: string;
  fee: string;
  currency: string;
  broker: string;
  strategy: string;
  executedAt: string;
};

type TransactionFormMode = "transaction-add" | "transaction-edit" | "holding-update";

type ImportStatus = "ready" | "needs mapping" | "duplicate" | "warning";

type ImportAction =
  | "buy"
  | "sell"
  | "dividend"
  | "fee"
  | "tax/withholding"
  | "deposit"
  | "withdrawal"
  | "adjustment";

type DegiroImportCandidate = {
  id: string;
  rowHash: string;
  dedupKey: string;
  date: string;
  executedAt: number;
  product: string;
  isin: string;
  description: string;
  currency: string;
  amount: number;
  action: ImportAction;
  quantity?: number;
  price?: number;
  candidateSymbol: string;
  strategy: string;
  status: ImportStatus;
  reason?: string;
  duplicate?: boolean;
  groupedFeeAmount?: number;
  groupedTaxAmount?: number;
  sourceRows: number;
  previewOnly?: boolean;
};

type ImportDraftTransaction = {
  id: string;
  dedupKey: string;
  rowHash: string;
  symbol: string;
  transactionType: PortfolioTransactionType;
  executedAt: number;
  quantity?: number;
  price?: number;
  grossAmount?: number;
  netAmount?: number;
  fee?: number;
  currency: string;
  broker?: string;
  strategy?: string;
  previewOnly: true;
};

type ImportInstrumentMapping = {
  key: string;
  product: string;
  isin: string;
  rowCount: number;
  candidateSymbol: string;
  needsMapping: boolean;
};

type ClosedPositionRow = {
  key: string;
  symbol: string;
  displayName: string;
  currency: string;
  quantityBought: number;
  quantitySold: number;
  avgBuy: number;
  avgSell: number;
  realizedPl: number;
  dividends: number;
  fees: number;
  taxes: number;
  netContribution: number;
};

type TransactionPrefill = {
  mode?: TransactionFormMode;
  holdingId?: string;
  transactionId?: string;
  symbol: string;
  assetType: PortfolioAssetType;
  currency: string;
  broker: string;
  strategy: string;
  transactionType: PortfolioTransactionType;
  quantity?: string;
  price?: string;
  fee?: string;
  amount?: string;
  executedAt?: string;
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

const sampleTransactions: PortfolioTransaction[] = [];

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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number, currency = BASE_CURRENCY) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const normalizedCurrency = (currency || BASE_CURRENCY).trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: Math.abs(safeValue) >= 1000 ? 0 : 2,
    }).format(safeValue);
  } catch {
    return `${normalizedCurrency} ${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: Math.abs(safeValue) >= 1000 ? 0 : 2,
    }).format(safeValue)}`;
  }
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

function parseEuropeanNumber(value: string) {
  const cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDegiroDate(value: string) {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const stamp = Date.parse(`${iso}T12:00:00.000Z`);
  if (!Number.isFinite(stamp)) return null;
  return { iso, stamp };
}

function simpleRowHash(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function isDegiroSecurityAction(action: ImportAction) {
  return action === "buy" || action === "sell" || action === "dividend" || action === "fee" || action === "tax/withholding";
}

function instrumentKeyForRow(row: Pick<DegiroImportCandidate, "isin" | "product">) {
  const isin = row.isin.trim().toUpperCase();
  if (isin) return `isin:${isin}`;
  return `product:${normalizeSymbol(row.product)}`;
}

function looksLikeIsin(value: string) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value.trim().toUpperCase());
}

function resolveImportStatus(row: DegiroImportCandidate): Pick<DegiroImportCandidate, "status" | "reason"> {
  if (row.duplicate) return { status: "duplicate", reason: "Appears to match an existing transaction/import row." };
  const mappedSymbol = row.candidateSymbol.trim().toUpperCase();
  if (isDegiroSecurityAction(row.action) && (!mappedSymbol || mappedSymbol === row.isin || looksLikeIsin(mappedSymbol))) {
    return { status: "needs mapping", reason: "Map ISIN/product to a portfolio ticker before import." };
  }
  if ((row.action === "buy" || row.action === "sell") && (!row.quantity || !row.price)) {
    return { status: "warning", reason: "Could not parse quantity/price from description." };
  }
  if (row.reason) return { status: "ready", reason: row.reason };
  return { status: "ready", reason: undefined };
}

function withResolvedImportStatus(row: DegiroImportCandidate) {
  return { ...row, ...resolveImportStatus(row) };
}

function parseDegiroCsvToCandidates(text: string, existing: PortfolioTransaction[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [] as DegiroImportCandidate[];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());
  const idx = {
    date: header.findIndex((v) => v.includes("date") || v.includes("datum")),
    product: header.findIndex((v) => v.includes("product")),
    isin: header.findIndex((v) => v.includes("isin")),
    description: header.findIndex((v) => v.includes("omschrijving")),
    currency: header.findIndex((v) => v.includes("currency")),
    amount: header.findIndex((v) => v.includes("amount")),
  };
  if (Object.values(idx).some((value) => value < 0)) return [] as DegiroImportCandidate[];

  const existingKeys = new Set(
    existing.flatMap((tx) => {
      const date = new Date(tx.executedAt).toISOString().slice(0, 10);
      const amount = Math.abs(tx.netAmount ?? tx.grossAmount ?? 0).toFixed(2);
      const action = tx.transactionType;
      const symbol = normalizeSymbol(tx.symbol);
      const importNote = tx.notes?.match(/dedup=([^\s]+)/)?.[1] ?? "";
      return [
        [date, symbol, action, amount].join("|"),
        importNote,
      ].filter(Boolean);
    }),
  );

  const candidates = lines.slice(1).map((line, rowIndex) => {
    const cols = splitCsvLine(line, delimiter);
    const dateRaw = cols[idx.date] ?? "";
    const parsedDate = parseDegiroDate(dateRaw);
    const product = cols[idx.product] ?? "";
    const isin = (cols[idx.isin] ?? "").trim().toUpperCase();
    const description = (cols[idx.description] ?? "").trim();
    const currency = ((cols[idx.currency] ?? "EUR").trim().toUpperCase() || "EUR");
    const amount = parseEuropeanNumber(cols[idx.amount] ?? "") ?? 0;
    const descLower = description.toLowerCase();
    const qtyPriceMatch = description.match(/(Koop|Verkoop)\s+([0-9.,]+)\s+@\s+([0-9.,]+)/i);
    const quantity = qtyPriceMatch ? parseEuropeanNumber(qtyPriceMatch[2]) ?? undefined : undefined;
    const price = qtyPriceMatch ? parseEuropeanNumber(qtyPriceMatch[3]) ?? undefined : undefined;

    let action: ImportAction = "adjustment";
    if (descLower.includes("koop")) action = "buy";
    else if (descLower.includes("verkoop")) action = "sell";
    else if (descLower.includes("dividendbelasting")) action = "tax/withholding";
    else if (descLower.includes("dividend")) action = "dividend";
    else if (descLower.includes("transactiekosten") || descLower.includes("kosten") || descLower.includes("stamp duty")) action = "fee";
    else if (descLower.includes("deposit") || descLower.includes("terugstorting")) action = amount >= 0 ? "deposit" : "withdrawal";
    else if (descLower.includes("withdraw") || descLower.includes("opname")) action = "withdrawal";

    const suggestedSymbol = isin || normalizeSymbol(product).replace(/[^A-Z0-9]/g, "").slice(0, 12);
    const normalizedAction = action === "tax/withholding" ? "adjustment" : action;
    const absoluteAmountKey = Math.abs(amount).toFixed(2);
    const dedupKey = [parsedDate?.iso ?? dateRaw, isin || product, action, absoluteAmountKey, simpleRowHash(line)].join("|");
    const rowHash = simpleRowHash(line);
    const existingKey = [parsedDate?.iso ?? "", normalizeSymbol(suggestedSymbol), normalizedAction, absoluteAmountKey].join("|");
    const duplicate = existingKeys.has(existingKey) || existingKeys.has(dedupKey);

    return withResolvedImportStatus({
      id: `degiro-${rowIndex + 1}`,
      rowHash,
      dedupKey,
      date: parsedDate?.iso ?? dateRaw,
      executedAt: parsedDate?.stamp ?? Date.now(),
      product,
      isin,
      description,
      currency,
      amount,
      action,
      quantity,
      price,
      candidateSymbol: suggestedSymbol,
      strategy: "Other",
      status: "ready",
      duplicate,
      sourceRows: 1,
    });
  });

  const tradeGroups = new Map<string, DegiroImportCandidate[]>();
  candidates.forEach((candidate) => {
    if ((candidate.action === "buy" || candidate.action === "sell") && candidate.isin) {
      const key = `${candidate.date}|${candidate.isin}`;
      tradeGroups.set(key, [...(tradeGroups.get(key) ?? []), candidate]);
    }
  });

  const passthrough: DegiroImportCandidate[] = [];
  candidates.forEach((candidate) => {
    if ((candidate.action === "fee" || candidate.action === "tax/withholding") && candidate.isin) {
      const matches = tradeGroups.get(`${candidate.date}|${candidate.isin}`) ?? [];
      if (matches.length === 1) {
        const target = matches[0];
        if (candidate.action === "fee") {
          target.groupedFeeAmount = roundMoney((target.groupedFeeAmount ?? 0) + Math.abs(candidate.amount));
        } else {
          target.groupedTaxAmount = roundMoney((target.groupedTaxAmount ?? 0) + Math.abs(candidate.amount));
        }
        target.sourceRows += 1;
        target.reason = `Grouped ${target.sourceRows - 1} related fee/tax row(s).`;
        Object.assign(target, resolveImportStatus(target));
        return;
      }
      if (matches.length > 1) {
        candidate.status = "warning";
        candidate.reason = "Multiple same-day trades for this ISIN; fee/tax was not auto-grouped.";
      }
    }
    passthrough.push(candidate);
  });

  return passthrough;
}

function importActionToTransactionType(action: ImportAction): PortfolioTransactionType {
  if (action === "buy") return "buy";
  if (action === "sell") return "sell";
  if (action === "dividend") return "dividend";
  if (action === "deposit") return "deposit";
  if (action === "withdrawal") return "withdrawal";
  if (action === "fee") return "fee";
  return "adjustment";
}

function buildImportDraftTransactions(rows: DegiroImportCandidate[]) {
  return rows
    .filter((row) => row.status !== "duplicate")
    .map((row): ImportDraftTransaction => {
      const transactionType = importActionToTransactionType(row.action);
      const fee = row.groupedFeeAmount ?? (row.action === "fee" ? Math.abs(row.amount) : undefined);
      const tax = row.groupedTaxAmount ?? 0;
      const grossAmount = (row.action === "buy" || row.action === "sell" || row.action === "dividend" || row.action === "deposit" || row.action === "withdrawal")
        ? Math.abs(row.amount)
        : undefined;
      const netAmount = row.action === "buy"
        ? roundMoney(Math.abs(row.amount) + (fee ?? 0) + Math.abs(tax))
        : row.action === "sell"
          ? roundMoney(Math.abs(row.amount) - (fee ?? 0) - Math.abs(tax))
          : row.amount;
      return {
        id: row.id,
        dedupKey: row.dedupKey,
        rowHash: row.rowHash,
        symbol: row.candidateSymbol,
        transactionType,
        executedAt: row.executedAt,
        quantity: row.quantity,
        price: row.price,
        grossAmount,
        netAmount,
        fee,
        currency: row.currency,
        broker: "DeGiro",
        strategy: row.strategy || "Other",
        previewOnly: true,
      };
    });
}

function deriveInstrumentMappings(rows: DegiroImportCandidate[]) {
  const grouped = new Map<string, ImportInstrumentMapping>();
  rows.forEach((row) => {
    if (!isDegiroSecurityAction(row.action)) return;
    const key = instrumentKeyForRow(row);
    const current = grouped.get(key);
    const mapped = row.candidateSymbol.trim().toUpperCase();
    const isMapped = Boolean(mapped && mapped !== row.isin && !looksLikeIsin(mapped));
    if (!current) {
      grouped.set(key, {
        key,
        product: row.product || row.description,
        isin: row.isin,
        rowCount: 1,
        candidateSymbol: isMapped ? mapped : "",
        needsMapping: !isMapped,
      });
      return;
    }
    current.rowCount += 1;
    if (!current.candidateSymbol && isMapped) current.candidateSymbol = mapped;
    current.needsMapping = !current.candidateSymbol;
  });
  return Array.from(grouped.values()).sort((a, b) => a.product.localeCompare(b.product));
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

function initialTransactionInput(): TransactionInput {
  return {
    transactionType: "buy",
    symbol: "",
    assetType: "stock",
    quantity: "",
    price: "",
    amount: "",
    fee: "",
    currency: BASE_CURRENCY,
    broker: "",
    strategy: "Other",
    executedAt: new Date().toISOString().slice(0, 10),
  };
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
  const addTransaction = useMutation(portfolioApi.addTransaction);
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
        const symbol = cashSymbol(currency);
        const holdingId = await addHolding({
          userKey: DEMO_USER_KEY,
          symbol,
          ...payload,
        });
        await addTransaction({
          userKey: DEMO_USER_KEY,
          holdingId,
          symbol,
          assetType: "cash",
          transactionType: "deposit",
          grossAmount: amount,
          currency,
          broker: payload.broker,
          notes: "Auto-ledger from Add cash",
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

function PortfolioTransactionsSection({
  transactions,
  enabled,
  holdings,
  prefill,
  focusToken,
}: {
  transactions: PortfolioTransaction[];
  enabled: boolean;
  holdings: EnrichedHolding[];
  prefill?: TransactionPrefill | null;
  focusToken?: number;
}) {
  const addTransaction = useMutation(portfolioApi.addTransaction);
  const updateTransaction = useMutation(portfolioApi.updateTransaction);
  const removeTransaction = useMutation(portfolioApi.removeTransaction);
  const addHolding = useMutation(portfolioApi.add);
  const updateHolding = useMutation(portfolioApi.update);
  const [input, setInput] = useState<TransactionInput>(() =>
    initialTransactionInput(),
  );
  const [formMode, setFormMode] = useState<TransactionFormMode>("transaction-add");
  const [activeHoldingId, setActiveHoldingId] = useState<string | null>(null);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [removingTransactionId, setRemovingTransactionId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedSearchSymbol, setSelectedSearchSymbol] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const amountManuallyEditedRef = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const searchTerm = input.symbol.trim();
  const selectedSymbolStillCurrent =
    !!selectedSearchSymbol && normalizeSymbol(selectedSearchSymbol) === normalizeSymbol(searchTerm);

  useEffect(() => {
    if (!prefill) return;
    setInput((current) => ({
      ...current,
      symbol: prefill.symbol,
      assetType: prefill.assetType,
      currency: prefill.currency || current.currency,
      broker: prefill.broker || current.broker,
      strategy: prefill.strategy || current.strategy || "Other",
      transactionType: prefill.transactionType,
      quantity: prefill.quantity ?? current.quantity,
      price: prefill.price ?? current.price,
      fee: prefill.fee ?? current.fee,
      amount: prefill.amount ?? current.amount,
      executedAt: prefill.executedAt ?? current.executedAt,
    }));
    setFormMode(prefill.mode ?? "transaction-add");
    setActiveHoldingId(prefill.holdingId ?? null);
    setActiveTransactionId(prefill.transactionId ?? null);
    amountManuallyEditedRef.current = prefill.amount !== undefined;
    setSelectedSearchSymbol(normalizeSymbol(prefill.symbol));
    setSearchOpen(false);
    setSearchResults([]);
    setActiveIndex(0);
  }, [prefill]);

  useEffect(() => {
    if (amountManuallyEditedRef.current) return;
    const quantity = parseNumber(input.quantity);
    const price = parseNumber(input.price);
    const fee = parseNumber(input.fee) ?? 0;
    if (quantity == null || price == null) return;
    const calculated = Math.round((quantity * price + fee) * 100) / 100;
    setInput((current) => ({ ...current, amount: String(calculated) }));
  }, [input.quantity, input.price, input.fee]);

  useEffect(() => {
    if (!focusToken) return;
    const node = formRef.current?.querySelector("input,select,button") as HTMLElement | null;
    node?.focus();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusToken]);

  useEffect(() => {
    if (!searchOpen || selectedSymbolStillCurrent || searchTerm.length < 1) {
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
          { signal: controller.signal, headers: { accept: "application/json" } },
        );
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as TickerSearchResponse;
        setSearchResults(data.results ?? []);
        setActiveIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchOpen, searchTerm, selectedSymbolStillCurrent]);

  const selected =
    searchResults[Math.min(activeIndex, Math.max(searchResults.length - 1, 0))];

  function applySearchResult(result: TickerSearchResult) {
    setSelectedSearchSymbol(normalizeSymbol(result.symbol));
    setInput((current) => ({
      ...current,
      symbol: result.symbol,
      assetType: assetTypeFromSearchType(result.type),
      currency:
        result.currency && result.currency !== "—"
          ? result.currency.toUpperCase()
          : current.currency,
    }));
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setActiveIndex(0);
  }

  function resetTransactionForm(message?: string) {
    setInput(initialTransactionInput());
    setFormMode("transaction-add");
    setActiveHoldingId(null);
    setActiveTransactionId(null);
    amountManuallyEditedRef.current = false;
    setSelectedSearchSymbol(null);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setActiveIndex(0);
    if (message !== undefined) setStatus(message);
  }

  function prefillFromTransaction(tx: PortfolioTransaction) {
    setInput({
      transactionType: tx.transactionType,
      symbol: tx.symbol,
      assetType: tx.assetType,
      quantity: tx.quantity != null ? String(tx.quantity) : "",
      price: tx.price != null ? String(tx.price) : "",
      amount:
        tx.netAmount != null
          ? String(tx.netAmount)
          : tx.grossAmount != null
            ? String(tx.grossAmount)
            : "",
      fee: tx.fee != null ? String(tx.fee) : "",
      currency: tx.currency || BASE_CURRENCY,
      broker: tx.broker ?? "",
      strategy: tx.strategy ?? "Other",
      executedAt: new Date(tx.executedAt).toISOString().slice(0, 10),
    });
    setFormMode("transaction-edit");
    setActiveHoldingId(tx.holdingId ?? null);
    setActiveTransactionId(tx._id);
    amountManuallyEditedRef.current = tx.netAmount !== undefined || tx.grossAmount !== undefined;
    setSelectedSearchSymbol(normalizeSymbol(tx.symbol));
    setSearchOpen(false);
    setSearchResults([]);
    setStatus("Editing recent transaction. Save changes will only update the transaction row.");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function updateMatchedHolding(params: {
    id: string;
    quantity: number;
    price: number;
    fee: number;
    currency: string;
    broker?: string;
    strategy?: string;
  }) {
    await updateHolding({
      id: params.id,
      quantity: params.quantity,
      averageCost: Math.round(params.price * 10000) / 10000,
      transactionFee: Math.round(params.fee * 100) / 100,
      currency: params.currency,
      broker: params.broker,
      strategy: params.strategy,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    const symbol = normalizeSymbol(input.symbol);
    const quantity = parseNumber(input.quantity);
    const price = parseNumber(input.price);
    const amount = parseNumber(input.amount);
    const fee = parseNumber(input.fee) ?? 0;
    const tradeAmount =
      quantity != null && price != null ? roundMoney(quantity * price) : undefined;
    if (!symbol) return setStatus("Symbol is required.");
    if (
      (input.transactionType === "buy" || input.transactionType === "sell") &&
      (!quantity || !price)
    )
      return setStatus("Buy/sell require quantity and price.");
    if (amount != null && amount < 0) return setStatus("Amount cannot be negative.");
    if (fee < 0) return setStatus("Fee cannot be negative.");
    const executedAt = Date.parse(`${input.executedAt}T12:00:00.000Z`);
    if (!Number.isFinite(executedAt)) return setStatus("Date is invalid.");

    setIsSaving(true);
    setStatus(null);
    try {
      const matchedHolding = holdings.find(
        (holding) => normalizeSymbol(holding.symbol) === symbol,
      );
      const holdingIdForUpdate = activeHoldingId ?? matchedHolding?._id ?? null;
      const currency = input.currency.trim().toUpperCase() || BASE_CURRENCY;
      const broker = input.broker.trim() || undefined;
      const strategy = input.strategy.trim() || undefined;

      if (formMode === "holding-update") {
        if (!holdingIdForUpdate) return setStatus("No holding selected to update.");
        if (!quantity || !price) return setStatus("Holding update requires quantity and trade price.");
        await updateMatchedHolding({
          id: holdingIdForUpdate,
          quantity,
          price,
          fee,
          currency,
          broker,
          strategy,
        });
        resetTransactionForm("Holding updated without creating a new Buy transaction.");
        return;
      }

      if (formMode === "transaction-edit") {
        if (!activeTransactionId) return setStatus("No transaction selected to update.");
        await updateTransaction({
          id: activeTransactionId,
          holdingId: holdingIdForUpdate ?? undefined,
          transactionType: input.transactionType,
          symbol,
          assetType: input.assetType,
          quantity: quantity ?? undefined,
          price: price ?? undefined,
          grossAmount: tradeAmount,
          netAmount: amount ?? (tradeAmount != null ? roundMoney(tradeAmount + fee) : undefined),
          fee,
          currency,
          broker,
          strategy,
          executedAt,
        });
        if (holdingIdForUpdate && input.transactionType === "buy" && quantity != null && price != null) {
          await updateMatchedHolding({
            id: holdingIdForUpdate,
            quantity,
            price,
            fee,
            currency,
            broker,
            strategy,
          });
        }
        resetTransactionForm("Transaction updated.");
        return;
      }

      await addTransaction({
        userKey: DEMO_USER_KEY,
        holdingId: matchedHolding?._id,
        transactionType: input.transactionType,
        symbol,
        assetType: input.assetType,
        quantity: quantity ?? undefined,
        price: price ?? undefined,
        grossAmount: tradeAmount,
        netAmount: amount ?? (tradeAmount != null ? roundMoney(tradeAmount + fee) : undefined),
        fee,
        currency,
        broker,
        strategy,
        executedAt,
      });

      if (input.transactionType === "buy" && quantity != null && price != null) {
        if (matchedHolding) {
          const feeValue = fee ?? 0;
          const nextQuantity = matchedHolding.quantity + quantity;
          const nextTransactionFee = (matchedHolding.transactionFee ?? 0) + feeValue;
          const nextCostBasis =
            matchedHolding.costBasis + quantity * price + feeValue;
          const nextAverageCost =
            nextQuantity > 0
              ? (nextCostBasis - nextTransactionFee) / nextQuantity
              : matchedHolding.averageCost;
          await updateHolding({
            id: matchedHolding._id,
            quantity: nextQuantity,
            averageCost: Math.round(nextAverageCost * 10000) / 10000,
            transactionFee: Math.round(nextTransactionFee * 100) / 100,
            currency,
            broker,
            strategy,
          });
        } else {
          await addHolding({
            userKey: DEMO_USER_KEY,
            symbol,
            assetType: input.assetType,
            quantity,
            averageCost: price,
            transactionFee: fee,
            currency,
            broker,
            strategy,
          });
        }
      }

      resetTransactionForm("Transaction saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save transaction.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveTransaction(tx: PortfolioTransaction) {
    if (!enabled || removingTransactionId) return;
    const ok = window.confirm(
      `Remove ${tx.displaySymbol} ${tx.transactionType} transaction from ${new Date(tx.executedAt).toISOString().slice(0, 10)}?`,
    );
    if (!ok) return;
    setRemovingTransactionId(tx._id);
    setStatus(null);
    try {
      await removeTransaction({ id: tx._id });
      setStatus("Transaction removed. Check the holding quantity if this transaction had already been reflected there.");
      if (activeTransactionId === tx._id) resetTransactionForm("Transaction removed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove transaction.");
    } finally {
      setRemovingTransactionId(null);
    }
  }

  return (
    <section className="trading-portfolio-panel trading-portfolio-holdings-panel">
      <details className="trading-portfolio-collapsible" open={false}>
      <summary>
        <div>
          <div className="trading-section-label">Transactions</div>
          <p>Ledger-first history for buys, sells, dividends, and cash flows.</p>
        </div>
        <b>{transactions.length}</b>
      </summary>
      <form ref={formRef} className="trading-portfolio-add-form" onSubmit={handleSubmit}>
        <label><span>Action</span><select value={input.transactionType} onChange={(event) => setInput((current) => ({ ...current, transactionType: event.target.value as PortfolioTransactionType }))} disabled={isSaving || !enabled}><option value="buy">Buy</option><option value="sell">Sell</option><option value="dividend">Dividend</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></label>
        <label className="trading-portfolio-symbol-search"><span>Symbol or name</span><input value={input.symbol} onChange={(event) => { setSelectedSearchSymbol(null); setInput((current) => ({ ...current, symbol: event.target.value })); setSearchOpen(true); }} onFocus={() => setSearchOpen(!selectedSymbolStillCurrent)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(searchResults.length - 1, 0))); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } else if (event.key === "Enter" && selected && searchOpen) { event.preventDefault(); applySearchResult(selected); } else if (event.key === "Escape") { setSearchOpen(false); } }} placeholder="Type ticker or company" disabled={isSaving || !enabled} />{searchOpen && !selectedSymbolStillCurrent ? (<div className="trading-portfolio-search-results" role="listbox" aria-label="Portfolio ticker suggestions">{searchLoading ? <div>Searching…</div> : null}{!searchLoading && searchError ? <div>{searchError}</div> : null}{!searchLoading && !searchError && searchTerm && !searchResults.length ? <div>No matches yet.</div> : null}{searchResults.map((result, index) => (<button key={result.symbol} type="button" role="option" aria-selected={index === activeIndex} data-active={index === activeIndex ? "true" : undefined} onMouseEnter={() => setActiveIndex(index)} onClick={() => applySearchResult(result)}><span><b>{result.symbol}</b>{result.isPrimary ? <em>Primary</em> : null}</span><strong>{result.name}</strong><small>{searchResultMeta(result)}</small></button>))}</div>) : null}</label>
        <label><span>Type</span><input value={assetTypeLabel(input.assetType)} readOnly disabled /></label>
        <label><span>Date</span><input type="date" value={input.executedAt} onChange={(event) => setInput((current) => ({ ...current, executedAt: event.target.value }))} disabled={isSaving || !enabled} /></label>
        <label><span>Quantity</span><input value={input.quantity} onChange={(event) => setInput((current) => ({ ...current, quantity: event.target.value }))} inputMode="decimal" placeholder="10" disabled={isSaving || !enabled} /></label>
        <label><span>Trade price</span><input value={input.price} onChange={(event) => setInput((current) => ({ ...current, price: event.target.value }))} inputMode="decimal" placeholder="125.50" disabled={isSaving || !enabled} /></label>
        <label><span>Fee</span><input value={input.fee} onChange={(event) => setInput((current) => ({ ...current, fee: event.target.value }))} inputMode="decimal" placeholder="0.00" disabled={isSaving || !enabled} /></label>
        <label><span>Total amount</span><input value={input.amount} onChange={(event) => { amountManuallyEditedRef.current = true; setInput((current) => ({ ...current, amount: event.target.value })); }} inputMode="decimal" placeholder="Auto: qty × trade price + fee" disabled={isSaving || !enabled} /></label>
        <label><span>Currency</span><input value={input.currency} onChange={(event) => setInput((current) => ({ ...current, currency: event.target.value }))} placeholder="EUR" disabled={isSaving || !enabled} /></label>
        <label><span>Broker</span><select value={input.broker} onChange={(event) => setInput((current) => ({ ...current, broker: event.target.value }))} disabled={isSaving || !enabled}><option value="">Select broker</option>{BROKER_OPTIONS.map((broker) => (<option key={broker} value={broker}>{broker}</option>))}</select></label>
        <label><span>Strategy</span><select value={input.strategy} onChange={(event) => setInput((current) => ({ ...current, strategy: event.target.value }))} disabled={isSaving || !enabled}>{STRATEGY_OPTIONS.map((strategy) => (<option key={strategy} value={strategy}>{strategy}</option>))}</select></label>
        <button type="submit" disabled={isSaving || !enabled}>{isSaving ? "Saving…" : formMode === "holding-update" ? "Update holding" : formMode === "transaction-edit" ? "Save transaction" : "Add transaction"}</button>
        {formMode !== "transaction-add" ? <button type="button" className="trading-portfolio-form-secondary" onClick={() => resetTransactionForm()} disabled={isSaving}>Cancel edit</button> : null}
        {status ? <p>{status}</p> : null}
      </form>
      <div className="trading-table-shell trading-portfolio-table-shell trading-portfolio-fixed-table">
        <table className="trading-table trading-portfolio-table">
          <thead>
            <tr><th>Date</th><th>Action</th><th>Symbol</th><th>Qty</th><th>Trade price</th><th>Fee</th><th>Total amount</th><th>Currency</th><th>Broker</th><th>Strategy</th><th aria-label="Transaction actions" /></tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx._id}>
                <td>{new Date(tx.executedAt).toISOString().slice(0, 10)}</td>
                <td>{tx.transactionType}</td>
                <td>{tx.displaySymbol}</td>
                <td>{tx.quantity != null ? formatNumber(tx.quantity) : "—"}</td>
                <td>{tx.price != null ? formatMoney(tx.price, tx.currency) : "—"}</td>
                <td>{tx.fee != null ? formatMoney(tx.fee, tx.currency) : "—"}</td>
                <td>{tx.netAmount != null ? formatMoney(tx.netAmount, tx.currency) : tx.grossAmount != null ? formatMoney(tx.grossAmount, tx.currency) : "—"}</td>
                <td>{tx.currency}</td>
                <td>{tx.broker ?? "—"}</td>
                <td>{tx.strategy ?? "—"}</td>
                <td>
                  <div className="trading-portfolio-row-actions">
                    <button type="button" className="trading-portfolio-edit" onClick={() => prefillFromTransaction(tx)} disabled={!enabled || isSaving}>
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button type="button" className="trading-portfolio-remove" onClick={() => handleRemoveTransaction(tx)} disabled={!enabled || removingTransactionId === tx._id} aria-label={`Remove ${tx.displaySymbol} transaction`}>
                      {removingTransactionId === tx._id ? "…" : "−"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!transactions.length ? (
              <tr><td colSpan={11}><div className="trading-portfolio-empty">No transactions yet.</div></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </details>
    </section>
  );
}

function HoldingsTable({
  holdings,
  canMutate,
  onEdit,
  onStartAlertEdit,
  editingAlert,
  onAlertDraftChange,
  onSaveAlert,
  onCancelAlert,
  savingAlertId,
  onRemove,
  removingId,
}: {
  holdings: EnrichedHolding[];
  canMutate: boolean;
  onEdit?: (holding: EnrichedHolding) => void;
  onStartAlertEdit?: (holding: EnrichedHolding) => void;
  editingAlert?: { holdingId: string; min: string; max: string } | null;
  onAlertDraftChange?: (key: "min" | "max", value: string) => void;
  onSaveAlert?: () => void;
  onCancelAlert?: () => void;
  savingAlertId?: string | null;
  onRemove?: (id: string) => void;
  removingId?: string | null;
}) {
  return (
    <div className="trading-table-shell trading-portfolio-table-shell">
      <table className="trading-table trading-portfolio-table">
        <thead>
          <tr>
            <th>Holding</th>
            <th>Quantity</th>
            <th>Avg cost</th>
            <th>Market price</th>
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
                  {editingAlert?.holdingId === holding._id ? (
                    <div className="trading-portfolio-alert-inline-edit">
                      <input value={editingAlert.min} onChange={(event) => onAlertDraftChange?.("min", event.target.value)} inputMode="decimal" placeholder="Min" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSaveAlert?.(); } else if (event.key === "Escape") { event.preventDefault(); onCancelAlert?.(); } }} />
                      <input value={editingAlert.max} onChange={(event) => onAlertDraftChange?.("max", event.target.value)} inputMode="decimal" placeholder="Max" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSaveAlert?.(); } else if (event.key === "Escape") { event.preventDefault(); onCancelAlert?.(); } }} />
                      <button type="button" className="trading-portfolio-edit" onClick={() => onSaveAlert?.()} disabled={savingAlertId === holding._id}>Save</button>
                      <button type="button" className="trading-portfolio-buy-more" onClick={() => onCancelAlert?.()} disabled={savingAlertId === holding._id}>Cancel</button>
                    </div>
                  ) : (
                    <button type="button" className="trading-portfolio-alert-cell trading-portfolio-alert-edit-trigger" onClick={() => onStartAlertEdit?.(holding)} disabled={!canMutate || holding._id.startsWith("sample-")}>
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
                    </button>
                  )}
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
}: {
  holdings: EnrichedHolding[];
  metadata: Map<string, PortfolioMetadataItem>;
  onEdit: (holding: EnrichedHolding) => void;
}) {
  void metadata;
  const removeHolding = useMutation(portfolioApi.remove);
  const updateHolding = useMutation(portfolioApi.update);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<{
    holdingId: string;
    min: string;
    max: string;
  } | null>(null);
  const [savingAlertId, setSavingAlertId] = useState<string | null>(null);
  async function remove(id: string) {
    setRemovingId(id);
    try {
      await removeHolding({ id });
    } finally {
      setRemovingId(null);
    }
  }

  async function saveAlert() {
    if (!editingAlert) return;
    setSavingAlertId(editingAlert.holdingId);
    try {
      const min = cleanAlertInput(editingAlert.min);
      const max = cleanAlertInput(editingAlert.max);
      await updateHolding({
        id: editingAlert.holdingId,
        alertEnabled: Boolean(min || max),
        alertMinPrice: min,
        alertMaxPrice: max,
      });
      setEditingAlert(null);
    } finally {
      setSavingAlertId(null);
    }
  }

  return (
    <HoldingsTable
      holdings={holdings}
      canMutate
      onEdit={onEdit}
      onStartAlertEdit={(holding) =>
        setEditingAlert({
          holdingId: holding._id,
          min: holding.alertMinPrice != null ? String(holding.alertMinPrice) : "",
          max: holding.alertMaxPrice != null ? String(holding.alertMaxPrice) : "",
        })
      }
      editingAlert={editingAlert}
      onAlertDraftChange={(key, value) =>
        setEditingAlert((current) =>
          current ? { ...current, [key]: value } : current,
        )
      }
      onSaveAlert={saveAlert}
      onCancelAlert={() => setEditingAlert(null)}
      savingAlertId={savingAlertId}
      onRemove={remove}
      removingId={removingId}
    />
  );
}

type ClosedPositionsInputTx = Pick<PortfolioTransaction, "symbol" | "displaySymbol" | "currency" | "transactionType" | "quantity" | "price" | "netAmount" | "grossAmount" | "fee">;

function deriveClosedPositions(transactions: ClosedPositionsInputTx[]) {
  const rows = new Map<string, ClosedPositionRow>();
  transactions.forEach((tx) => {
    const key = normalizeSymbol(tx.symbol);
    if (!key || key.startsWith("CASH")) return;
    const current = rows.get(key) ?? {
      key,
      symbol: tx.symbol,
      displayName: tx.displaySymbol || tx.symbol,
      currency: tx.currency || BASE_CURRENCY,
      quantityBought: 0,
      quantitySold: 0,
      avgBuy: 0,
      avgSell: 0,
      realizedPl: 0,
      dividends: 0,
      fees: 0,
      taxes: 0,
      netContribution: 0,
    };
    if (tx.transactionType === "buy" && tx.quantity && tx.price) {
      current.quantityBought += tx.quantity;
      current.avgBuy += tx.quantity * tx.price;
      current.netContribution -= Math.abs(tx.netAmount ?? tx.grossAmount ?? tx.quantity * tx.price);
    } else if (tx.transactionType === "sell" && tx.quantity && tx.price) {
      current.quantitySold += tx.quantity;
      current.avgSell += tx.quantity * tx.price;
      current.netContribution += Math.abs(tx.netAmount ?? tx.grossAmount ?? tx.quantity * tx.price);
    } else if (tx.transactionType === "dividend") {
      const value = tx.netAmount ?? tx.grossAmount ?? 0;
      current.dividends += value;
      current.netContribution += value;
    } else if (tx.transactionType === "fee") {
      const value = tx.netAmount ?? tx.grossAmount ?? tx.fee ?? 0;
      current.fees += value;
      current.netContribution -= value;
    } else if (tx.transactionType === "adjustment") {
      const value = tx.netAmount ?? tx.grossAmount ?? 0;
      if (value < 0) {
        current.taxes += Math.abs(value);
        current.netContribution += value;
      }
    }
    rows.set(key, current);
  });
  return Array.from(rows.values())
    .filter((row) => row.quantityBought > 0 && row.quantityBought <= row.quantitySold + 0.0001)
    .map((row) => {
      const avgBuy = row.quantityBought > 0 ? row.avgBuy / row.quantityBought : 0;
      const avgSell = row.quantitySold > 0 ? row.avgSell / row.quantitySold : 0;
      return { ...row, avgBuy, avgSell, realizedPl: row.netContribution };
    })
    .sort((a, b) => b.realizedPl - a.realizedPl);
}

function ClosedPositionsSection({
  transactions,
  previewDrafts,
}: {
  transactions: PortfolioTransaction[];
  previewDrafts?: ImportDraftTransaction[];
}) {
  const previewRows = useMemo<ClosedPositionsInputTx[]>(
    () =>
      (previewDrafts ?? []).map((row) => ({
        symbol: row.symbol,
        displaySymbol: row.symbol,
        currency: row.currency,
        transactionType: row.transactionType,
        quantity: row.quantity,
        price: row.price,
        netAmount: row.netAmount,
        grossAmount: row.grossAmount,
        fee: row.fee,
      })),
    [previewDrafts],
  );
  const rows = useMemo(
    () => deriveClosedPositions([...transactions, ...previewRows]),
    [transactions, previewRows],
  );
  return (
    <section className="trading-portfolio-panel">
      <details className="trading-portfolio-collapsible" open={false}>
        <summary>
          <div>
            <div className="trading-section-label">Closed positions</div>
            <p>Sold-out positions stay in realized P/L totals. Includes preview-only import rows when present.</p>
          </div>
          <b>{rows.length}</b>
        </summary>
        <div className="trading-table-shell trading-portfolio-table-shell trading-portfolio-fixed-table">
          <table className="trading-table trading-portfolio-table">
            <thead><tr><th>Symbol</th><th>Qty</th><th>Avg buy</th><th>Avg sell</th><th>Dividends</th><th>Fees</th><th>Taxes</th><th>Realized P/L</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.displayName}</td>
                  <td>{formatNumber(row.quantitySold)}</td>
                  <td>{formatMoney(row.avgBuy, row.currency)}</td>
                  <td>{formatMoney(row.avgSell, row.currency)}</td>
                  <td>{formatMoney(row.dividends, row.currency)}</td>
                  <td>{formatMoney(row.fees, row.currency)}</td>
                  <td>{formatMoney(row.taxes, row.currency)}</td>
                  <td className={row.realizedPl >= 0 ? "positive" : "negative"}>{formatMoney(row.realizedPl, row.currency)}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8}><div className="trading-portfolio-empty">No closed positions yet. Import DeGiro history to build this view.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function DegiroImportSection({
  transactions,
  enabled,
  onPreviewDraftsChange,
}: {
  transactions: PortfolioTransaction[];
  enabled: boolean;
  onPreviewDraftsChange?: (rows: ImportDraftTransaction[]) => void;
}) {
  const addTransaction = useMutation(portfolioApi.addTransaction);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<DegiroImportCandidate[]>([]);
  const [bulkStrategy, setBulkStrategy] = useState("Other");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const instruments = useMemo(() => deriveInstrumentMappings(rows), [rows]);
  const instrumentsNeedingMapping = useMemo(
    () => instruments.filter((instrument) => instrument.needsMapping).length,
    [instruments],
  );
  const summary = useMemo(() => {
    const totals: Record<ImportStatus, number> = { ready: 0, "needs mapping": 0, duplicate: 0, warning: 0 };
    rows.forEach((row) => {
      totals[row.status] += 1;
    });
    return totals;
  }, [rows]);

  const draftRows = useMemo(() => buildImportDraftTransactions(rows), [rows]);

  useEffect(() => {
    onPreviewDraftsChange?.(draftRows);
  }, [draftRows, onPreviewDraftsChange]);

  function parsePreview() {
    setRows(parseDegiroCsvToCandidates(csvText, transactions));
    setImportStatus(null);
  }

  function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => setCsvText(text));
  }

  function setRowStrategy(id: string, strategy: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, strategy } : row)));
  }

  function setRowCandidateSymbol(id: string, candidateSymbol: string) {
    setRows((current) => current.map((row) => (row.id === id ? withResolvedImportStatus({ ...row, candidateSymbol: normalizeSymbol(candidateSymbol) }) : row)));
  }

  function setInstrumentCandidateSymbol(instrumentKey: string, candidateSymbol: string) {
    const normalized = normalizeSymbol(candidateSymbol);
    setRows((current) =>
      current.map((row) => {
        if (!isDegiroSecurityAction(row.action)) return row;
        if (instrumentKeyForRow(row) !== instrumentKey) return row;
        return withResolvedImportStatus({ ...row, candidateSymbol: normalized || row.isin || "" });
      }),
    );
  }

  function applyBulkStrategy() {
    setRows((current) => current.map((row) => ({ ...row, strategy: bulkStrategy })));
  }

  async function applyImport() {
    if (!enabled || !draftRows.length || isImporting) return;
    const eligible = rows.filter((row) => row.status === "ready");
    if (!eligible.length) {
      setImportStatus("No ready rows to import. Resolve ticker mappings, warnings, and duplicates first.");
      return;
    }
    setIsImporting(true);
    setImportStatus(null);
    try {
      for (const row of eligible) {
        const tx = buildImportDraftTransactions([row])[0];
        await addTransaction({
          userKey: DEMO_USER_KEY,
          symbol: tx.symbol,
          assetType: "stock",
          transactionType: tx.transactionType,
          executedAt: tx.executedAt,
          quantity: tx.quantity,
          price: tx.price,
          grossAmount: tx.grossAmount,
          netAmount: tx.netAmount,
          fee: tx.fee,
          currency: tx.currency,
          broker: "DeGiro",
          strategy: tx.strategy,
          notes: `DeGiro import staged (${tx.rowHash}) dedup=${tx.dedupKey}`,
        });
      }
      setImportStatus(`Imported ${eligible.length} transaction(s). Existing portfolio holdings were not auto-mutated.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="trading-portfolio-panel">
      <details className="trading-portfolio-collapsible" open={false}>
        <summary>
          <div>
            <div className="trading-section-label">DeGiro import (staged review)</div>
            <p>Upload → review statuses/dedup → optional explicit import. Never auto-imports on upload.</p>
          </div>
          <b>{rows.length}</b>
        </summary>
        <div className="trading-portfolio-import-controls">
          <input type="file" accept=".csv,text/csv" onChange={onUpload} />
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Paste DeGiro CSV here" rows={6} />
          <button type="button" onClick={parsePreview}>Parse preview</button>
          <div className="trading-portfolio-import-summary">
            <label>
              <span>Bulk strategy</span>
              <select value={bulkStrategy} onChange={(event) => setBulkStrategy(event.target.value)}>
                {STRATEGY_OPTIONS.map((strategy) => (<option key={strategy} value={strategy}>{strategy}</option>))}
              </select>
            </label>
            <button type="button" onClick={applyBulkStrategy}>Apply bulk strategy</button>
            <button type="button" onClick={applyImport} disabled={!enabled || isImporting || !rows.length}> {isImporting ? "Importing…" : "Import ready rows"}</button>
          </div>
          <div className="trading-portfolio-import-summary">
            <span>rows: {rows.length}</span>
            <span>instruments to map: {instrumentsNeedingMapping}</span>
            <span>ready: {summary.ready}</span>
            <span>warning/duplicate: {summary.warning + summary.duplicate}</span>
          </div>
          {instruments.length ? (
            <div className="trading-portfolio-instrument-map">
              <div className="trading-portfolio-import-guidance">Map instruments first, then import ready rows.</div>
              <div className="trading-table-shell trading-portfolio-table-shell">
                <table className="trading-table trading-portfolio-table trading-portfolio-instrument-table">
                  <thead>
                    <tr><th>Product</th><th>ISIN</th><th>Rows</th><th>Ticker</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {instruments.map((instrument) => (
                      <tr key={instrument.key}>
                        <td>{instrument.product}</td>
                        <td>{instrument.isin || "—"}</td>
                        <td>{instrument.rowCount}</td>
                        <td>
                          <input
                            value={instrument.candidateSymbol}
                            onChange={(event) => setInstrumentCandidateSymbol(instrument.key, event.target.value)}
                            placeholder="Ticker"
                          />
                        </td>
                        <td>
                          <span className={`trading-portfolio-import-status ${instrument.needsMapping ? "needs-mapping" : "ready"}`}>
                            {instrument.needsMapping ? "needs map" : "ready"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {importStatus ? <p>{importStatus}</p> : null}
        </div>
        <div className="trading-table-shell trading-portfolio-table-shell trading-portfolio-fixed-table">
          <table className="trading-table trading-portfolio-table">
            <thead><tr><th>Date</th><th>Product</th><th>ISIN</th><th>Row override</th><th>Action</th><th>Qty</th><th>Price</th><th>Amount</th><th>Currency</th><th>Strategy</th><th>Status</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.product || row.description}</td>
                  <td>{row.isin || "—"}</td>
                  <td><input value={row.candidateSymbol} onChange={(event) => setRowCandidateSymbol(row.id, event.target.value)} placeholder="Optional" /></td>
                  <td>{row.action}</td>
                  <td>{row.quantity != null ? formatNumber(row.quantity) : "—"}</td>
                  <td>{row.price != null ? formatMoney(row.price, row.currency) : "—"}</td>
                  <td>{formatMoney(row.amount, row.currency)}{row.groupedFeeAmount ? <small> fee {formatMoney(row.groupedFeeAmount, row.currency)}</small> : null}{row.groupedTaxAmount ? <small> tax {formatMoney(row.groupedTaxAmount, row.currency)}</small> : null}</td>
                  <td>{row.currency}</td>
                  <td><select value={row.strategy} onChange={(event) => setRowStrategy(row.id, event.target.value)}>{STRATEGY_OPTIONS.map((strategy) => (<option key={strategy} value={strategy}>{strategy}</option>))}</select></td>
                  <td>
                    <span className={`trading-portfolio-import-status ${row.status.replace(" ", "-")}`}>{row.status === "needs mapping" ? "needs map" : row.status}</span>
                    {row.reason ? <small> {row.reason}</small> : null}
                  </td>
                  <td>
                    <details className="trading-portfolio-import-row-details">
                      <summary>meta</summary>
                      <small>{row.dedupKey}<br />{row.rowHash}</small>
                    </details>
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={12}><div className="trading-portfolio-empty">Upload or paste CSV, then parse preview.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function PortfolioLayout({
  holdings,
  transactions,
  isLive,
  isLoading,
}: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
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
  const [cashFormOpen, setCashFormOpen] = useState(false);
  const [editCashHolding, setEditCashHolding] =
    useState<EnrichedHolding | null>(null);
  const [transactionPrefill, setTransactionPrefill] =
    useState<TransactionPrefill | null>(null);
  const [transactionFocusToken, setTransactionFocusToken] = useState(0);
  const [visibleBenchmarks, setVisibleBenchmarks] = useState<
    Record<BenchmarkKey, boolean>
  >({ portfolio: true, sp500: true, allworld: true, nasdaq: false });
  const [performanceRange, setPerformanceRange] =
    useState<PerformanceRange>("1Y");
  const [performanceData, setPerformanceData] =
    useState<PortfolioPerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [importPreviewDrafts, setImportPreviewDrafts] =
    useState<ImportDraftTransaction[]>([]);

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
        <div className="trading-portfolio-actions" />
      </section>
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
                setCashFormOpen(false);
                setEditCashHolding(null);
                setTransactionPrefill({
                  symbol: holding.symbol,
                  assetType: holding.assetType,
                  currency: holding.currency || BASE_CURRENCY,
                  broker: holding.broker ?? "",
                  strategy: holding.strategy ?? "Other",
                  mode: "holding-update",
                  holdingId: holding._id,
                  transactionType: "buy",
                  quantity: String(holding.quantity),
                  price: String(holding.averageCost),
                  fee:
                    holding.transactionFee != null
                      ? String(holding.transactionFee)
                      : "",
                });
                setTransactionFocusToken((current) => current + 1);
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
            setEditCashHolding(null);
            setCashFormOpen(true);
          }}
          onEdit={(holding) => {
            setCashFormOpen(false);
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

      <PortfolioTransactionsSection
        transactions={transactions}
        enabled={isLive}
        holdings={enriched}
        prefill={transactionPrefill}
        focusToken={transactionFocusToken}
      />

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
      </section>

      <ClosedPositionsSection transactions={transactions} previewDrafts={importPreviewDrafts} />
      <DegiroImportSection transactions={transactions} enabled={isLive} onPreviewDraftsChange={setImportPreviewDrafts} />
    </>
  );
}

function LivePortfolioContent() {
  const liveHoldings = useQuery(portfolioApi.list, { userKey: DEMO_USER_KEY });
  const liveTransactions = useQuery(portfolioApi.listTransactions, {
    userKey: DEMO_USER_KEY,
    limit: 2000,
  });
  const isLoading = liveHoldings === undefined;
  return (
    <PortfolioLayout
      holdings={isLoading ? [] : liveHoldings}
      transactions={liveTransactions ?? []}
      isLive
      isLoading={isLoading}
    />
  );
}

export function PortfolioClient({ convexEnabled }: { convexEnabled: boolean }) {
  if (!convexEnabled)
    return (
      <PortfolioLayout
        holdings={sampleHoldings}
        transactions={sampleTransactions}
        isLive={false}
      />
    );
  return <LivePortfolioContent />;
}
