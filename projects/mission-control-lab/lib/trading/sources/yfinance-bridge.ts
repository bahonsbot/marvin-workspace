import 'server-only';

import { spawn } from 'node:child_process';
import path from 'node:path';
import type {
  TickerBalanceSheetSnapshot,
  TickerCashDebtSnapshot,
  TickerDisplayMetric,
  TickerFinancialHighlight,
  TickerFinancialOverview,
  TickerProfileFact,
  TickerSourceMeta,
} from '../contracts';

export interface YfinanceBridgeMetric {
  label: string;
  value: string;
  note?: string;
  status?: 'available' | 'partial' | 'unavailable';
}

export interface YfinanceBridgeResult {
  symbol: string;
  asOf: string;
  info?: Record<string, unknown>;
  facts?: TickerProfileFact[];
  headerStats?: YfinanceBridgeMetric[];
  keyRatios?: YfinanceBridgeMetric[];
  estimates?: YfinanceBridgeMetric[];
  ownership?: YfinanceBridgeMetric[];
  dividends?: YfinanceBridgeMetric[];
  fundamentals?: YfinanceBridgeFundamentals;
  sourceNote?: string;
  error?: string;
}
interface YfinanceYearValue {
  year?: string | null;
  value?: number | null;
}

interface YfinanceBalanceSheetAnnualRow {
  year: string;
  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;
  cash?: number | null;
  debt?: number | null;
}

interface YfinanceBridgeFundamentals {
  currency?: string;
  highlights?: {
    revenue?: YfinanceYearValue;
    netIncome?: YfinanceYearValue;
    grossProfit?: YfinanceYearValue;
    operatingIncome?: YfinanceYearValue;
    freeCashFlow?: YfinanceYearValue;
  };
  cashDebtSnapshot?: {
    year?: string | null;
    cash?: number | null;
    debt?: number | null;
    operatingCashFlow?: number | null;
    freeCashFlow?: number | null;
  };
  balanceSheet?: {
    latestYear?: string | null;
    assets?: number | null;
    liabilities?: number | null;
    equity?: number | null;
    cash?: number | null;
    debt?: number | null;
    annual?: YfinanceBalanceSheetAnnualRow[];
  };
  financialOverview?: {
    annual?: Array<{ year: string; revenue?: number | null; netIncome?: number | null }>;
  };
  ratios?: Array<{ label: string; value: string }>;
}

const YFINANCE_BRIDGE_TIMEOUT_MS = 12_000;
const YFINANCE_BRIDGE_SCRIPT = path.join(process.cwd(), 'scripts', 'trading_yfinance_bridge.py');

export function yfinanceSource(asOf: string, note = 'yfinance bridge over Yahoo Finance data.'): TickerSourceMeta {
  return {
    source: 'yahoo',
    asOf,
    freshness: 'fresh',
    note,
  };
}

export async function fetchYfinanceBridge(symbol: string): Promise<YfinanceBridgeResult | null> {
  return new Promise((resolve) => {
    const child = spawn('python3', [YFINANCE_BRIDGE_SCRIPT, symbol], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve(null);
    }, YFINANCE_BRIDGE_TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        if (stderr.trim()) console.warn('yfinance bridge failed', stderr.trim().slice(0, 240));
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as YfinanceBridgeResult;
        resolve(parsed.error ? null : parsed);
      } catch {
        resolve(null);
      }
    });
  });
}

export function bridgeMetricsToDisplay(metrics: YfinanceBridgeMetric[] | undefined, source: TickerSourceMeta): TickerDisplayMetric[] {
  return (metrics ?? []).map((metric) => ({
    label: metric.label,
    value: metric.value,
    note: metric.note,
    status: metric.status ?? (metric.value && metric.value !== 'Data unavailable' ? 'available' : 'unavailable'),
    source,
  }));
}

export function mergeFacts(primary: TickerProfileFact[], extras: TickerProfileFact[]) {
  const seen = new Set(primary.map((fact) => fact.label.toLowerCase()));
  const merged = [...primary];
  for (const fact of extras) {
    if (!fact.value || fact.value === '—' || seen.has(fact.label.toLowerCase())) continue;
    merged.push(fact);
    seen.add(fact.label.toLowerCase());
  }
  return merged;
}

export function mergeHeaderStats(base: TickerDisplayMetric[], extras: YfinanceBridgeMetric[] | undefined, source: TickerSourceMeta) {
  const byLabel = new Map(base.map((metric) => [metric.label, metric]));
  for (const metric of bridgeMetricsToDisplay(extras, source)) {
    const current = byLabel.get(metric.label);
    if (!current || current.status === 'unavailable' || current.value === 'Provider pending' || current.value === '—') {
      byLabel.set(metric.label, metric);
    }
  }
  return Array.from(byLabel.values()).slice(0, 6);
}

export function mergeKeyRatios(base: TickerDisplayMetric[], extras: YfinanceBridgeMetric[] | undefined, source: TickerSourceMeta) {
  const byLabel = new Map(base.map((metric) => [metric.label, metric]));
  for (const metric of bridgeMetricsToDisplay(extras, source)) {
    const current = byLabel.get(metric.label);
    if (!current || current.status === 'unavailable' || current.value === 'Unavailable' || current.value === 'Provider pending') {
      byLabel.set(metric.label, metric);
    }
  }
  return Array.from(byLabel.values());
}

function formatBillions(raw: number | null | undefined) {
  if (raw == null || !Number.isFinite(raw)) return '$—';
  const value = raw / 1_000_000_000;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}$${abs >= 100 ? abs.toFixed(0) : abs.toFixed(1)}B`;
}

function ratio(raw: number | null | undefined) {
  if (raw == null || !Number.isFinite(raw)) return '—';
  return `${raw.toFixed(2)}x`;
}

export function yfinanceFinancialHighlights(data: YfinanceBridgeResult | null, source: TickerSourceMeta): TickerFinancialHighlight[] {
  const h = data?.fundamentals?.highlights;
  if (!h) return [];
  const items: Array<{ label: string; node?: YfinanceYearValue }> = [
    { label: 'Revenue', node: h.revenue },
    { label: 'Net Income', node: h.netIncome },
    { label: 'Gross Profit', node: h.grossProfit },
    { label: 'Operating Income', node: h.operatingIncome },
    { label: 'Free Cash Flow', node: h.freeCashFlow },
  ];
  return items.flatMap((item) => {
    const year = item.node?.year;
    const value = item.node?.value;
    if (!year || value == null || !Number.isFinite(value)) return [];
    return [{
      label: item.label,
      value: formatBillions(value),
      delta: 'Derived from annual yfinance statements.',
      tone: 'neutral',
      trend: [],
      source,
      status: 'available',
      note: `${year} FY from yfinance annual statements.`,
    }];
  });
}

export function yfinanceCashDebtSnapshot(data: YfinanceBridgeResult | null, source: TickerSourceMeta): TickerCashDebtSnapshot | null {
  const node = data?.fundamentals?.cashDebtSnapshot;
  if (!node?.year) return null;
  const cash = node.cash ?? null;
  const debt = node.debt ?? null;
  if (cash == null || debt == null) return null;
  const total = Math.max(cash + debt, 1);
  const netCash = cash - debt;
  return {
    period: `${node.year} FY · yfinance annual statements`,
    currency: data?.fundamentals?.currency || 'USD',
    cashPercent: Math.round((cash / total) * 100),
    debtPercent: Math.round((debt / total) * 100),
    totalCash: formatBillions(cash),
    totalDebt: formatBillions(debt),
    netCash: formatBillions(Math.abs(netCash)),
    netCashLabel: netCash >= 0 ? 'Net Cash' : 'Net Debt',
    freeCashFlow: formatBillions(node.freeCashFlow),
    operatingCashFlow: formatBillions(node.operatingCashFlow),
    interpretation: netCash >= 0 ? 'Net cash position' : 'Debt exceeds cash; watch leverage and refinancing risk',
    source,
  };
}

export function yfinanceBalanceSheetSnapshot(data: YfinanceBridgeResult | null, source: TickerSourceMeta): TickerBalanceSheetSnapshot | null {
  const balance = data?.fundamentals?.balanceSheet;
  if (!balance?.latestYear || balance.assets == null || balance.liabilities == null || balance.equity == null) return null;
  const annual = (balance.annual ?? []).filter((item) => item.year).slice(-4).map((item) => ({
    fiscalYear: item.year,
    totalAssets: Number(item.assets ?? 0),
    totalLiabilities: Number(item.liabilities ?? 0),
    shareholderEquity: Number(item.equity ?? 0),
    cashAndEquivalents: Number(item.cash ?? 0),
    totalDebt: Number(item.debt ?? 0),
  }));
  const currentRatioValue = (balance.liabilities ?? 0) > 0 ? (balance.assets ?? 0) / (balance.liabilities ?? 1) : null;
  const debtToEquityValue = (balance.equity ?? 0) > 0 ? (balance.debt ?? 0) / (balance.equity ?? 1) : null;
  return {
    period: `${balance.latestYear} FY · yfinance annual statements`,
    currency: data?.fundamentals?.currency || 'USD',
    kpis: [
      { label: 'Assets', value: formatBillions(balance.assets), caption: `FY ${balance.latestYear}`, tone: 'neutral' },
      { label: 'Liabilities', value: formatBillions(balance.liabilities), caption: `FY ${balance.latestYear}`, tone: 'neutral' },
      { label: 'Equity', value: formatBillions(balance.equity), caption: `FY ${balance.latestYear}`, tone: 'neutral' },
      { label: 'Cash', value: formatBillions(balance.cash), caption: 'Cash and equivalents', tone: 'positive' },
      { label: 'Debt', value: formatBillions(balance.debt), caption: 'Current + long-term debt', tone: 'negative' },
      { label: 'Current Ratio', value: ratio(currentRatioValue), caption: 'Assets / liabilities (proxy)', tone: 'neutral' },
      { label: 'Debt / Equity', value: ratio(debtToEquityValue), caption: 'Debt / equity', tone: 'neutral' },
    ],
    annual,
    note: 'Provider-backed annual balance-sheet rows from yfinance. SEC concepts are US-only; non-US filings adapter is not wired yet.',
    source,
  };
}

export function yfinanceFinancialOverview(data: YfinanceBridgeResult | null): TickerFinancialOverview | null {
  const annual = data?.fundamentals?.financialOverview?.annual ?? [];
  const bars = annual
    .filter((item) => item.year && item.revenue != null && item.netIncome != null)
    .slice(-4)
    .map((item) => ({
      year: item.year,
      revenue: Number(((item.revenue ?? 0) / 1_000_000_000).toFixed(1)),
      netIncome: Number(((item.netIncome ?? 0) / 1_000_000_000).toFixed(1)),
    }));
  if (!bars.length) return null;
  return {
    bars,
    status: bars.length >= 3 ? 'available' : 'partial',
    note: 'Annual revenue/net income bars from yfinance statements.',
  };
}

export function mergeKeyRatiosFromFundamentals(base: TickerDisplayMetric[], data: YfinanceBridgeResult | null, source: TickerSourceMeta) {
  const byLabel = new Map(base.map((metric) => [metric.label, metric]));
  for (const ratioMetric of data?.fundamentals?.ratios ?? []) {
    const metric: TickerDisplayMetric = { label: ratioMetric.label, value: ratioMetric.value, status: 'available', source, note: 'yfinance fundamentals ratio.' };
    const current = byLabel.get(metric.label);
    if (!current || current.status === 'unavailable' || current.value === 'Unavailable' || current.value === 'Provider pending') {
      byLabel.set(metric.label, metric);
    }
  }
  return Array.from(byLabel.values());
}
