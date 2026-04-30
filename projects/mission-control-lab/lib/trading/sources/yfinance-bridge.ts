import 'server-only';

import { spawn } from 'node:child_process';
import path from 'node:path';
import type { TickerDisplayMetric, TickerProfileFact, TickerSourceMeta } from '../contracts';

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
  sourceNote?: string;
  error?: string;
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
