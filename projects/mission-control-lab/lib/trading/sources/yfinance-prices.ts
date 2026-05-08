import 'server-only';

import { spawn } from 'node:child_process';
import path from 'node:path';

export type YfinancePricePoint = {
  date: string;
  close: number;
};

export type YfinancePriceHistory = {
  symbol: string;
  period: string;
  interval: string;
  asOf: string;
  points: YfinancePricePoint[];
  sourceNote?: string;
  error?: string;
};

const YFINANCE_PRICES_TIMEOUT_MS = 12_000;
const YFINANCE_PRICES_SCRIPT = path.join(process.cwd(), 'scripts', 'trading_yfinance_prices.py');

function isPricePoint(value: unknown): value is YfinancePricePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<YfinancePricePoint>;
  return typeof point.date === 'string' && typeof point.close === 'number' && Number.isFinite(point.close);
}

function normalizeHistory(value: unknown): YfinancePriceHistory | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<YfinancePriceHistory>;
  if (typeof payload.symbol !== 'string') return null;
  if (payload.error) return null;
  const points = Array.isArray(payload.points) ? payload.points.filter(isPricePoint) : [];
  return {
    symbol: payload.symbol,
    period: typeof payload.period === 'string' ? payload.period : '1y',
    interval: typeof payload.interval === 'string' ? payload.interval : '1d',
    asOf: typeof payload.asOf === 'string' ? payload.asOf : new Date().toISOString(),
    points,
    sourceNote: typeof payload.sourceNote === 'string' ? payload.sourceNote : undefined,
  };
}

export async function fetchYfinancePriceHistory(symbol: string, options: { period?: string; interval?: string; timeoutMs?: number } = {}): Promise<YfinancePriceHistory | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;
  const period = options.period ?? '1y';
  const interval = options.interval ?? '1d';
  return new Promise((resolve) => {
    const child = spawn('python3', [YFINANCE_PRICES_SCRIPT, normalized, period, interval], {
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
    }, options.timeoutMs ?? YFINANCE_PRICES_TIMEOUT_MS);

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
        if (stderr.trim()) console.warn('yfinance price bridge failed', stderr.trim().slice(0, 240));
        resolve(null);
        return;
      }
      try {
        resolve(normalizeHistory(JSON.parse(stdout)));
      } catch {
        resolve(null);
      }
    });
  });
}
