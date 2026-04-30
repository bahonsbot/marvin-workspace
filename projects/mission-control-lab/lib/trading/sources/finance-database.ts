import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { TickerProfileFact, TickerSourceMeta } from '../contracts';
import type { EodhdSearchResult } from './eodhd';

const INDEX_PATH = path.join(process.cwd(), 'data', 'trading', 'finance-database-symbol-index.json');
const MAX_SEARCH_RESULTS = 8;

export interface FinanceDatabaseIndexRow {
  symbol: string;
  name: string;
  currency?: string | null;
  sector?: string | null;
  industryGroup?: string | null;
  industry?: string | null;
  exchange?: string | null;
  market?: string | null;
  country?: string | null;
  website?: string | null;
  marketCapCategory?: string | null;
  isin?: string | null;
}

interface FinanceDatabaseIndex {
  generatedAt?: string;
  rowCount?: number;
  rows?: FinanceDatabaseIndexRow[];
}

let indexCache: FinanceDatabaseIndex | null | undefined;

function loadIndex() {
  if (indexCache !== undefined) return indexCache;
  indexCache = null;
  try {
    if (!existsSync(INDEX_PATH)) return indexCache;
    const parsed = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as FinanceDatabaseIndex;
    if (Array.isArray(parsed.rows)) indexCache = parsed;
  } catch {
    indexCache = null;
  }
  return indexCache;
}

export function hasFinanceDatabaseIndex() {
  return Boolean(loadIndex()?.rows?.length);
}

export function financeDatabaseSource(note = 'FinanceDatabase static equities reference index.'): TickerSourceMeta {
  const index = loadIndex();
  return {
    source: 'yahoo',
    asOf: index?.generatedAt ?? new Date().toISOString(),
    freshness: index?.rows?.length ? 'fresh' : 'missing',
    note,
  };
}

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function compactSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function scoreRow(row: FinanceDatabaseIndexRow, query: string) {
  const q = normalize(query);
  const symbol = normalize(row.symbol);
  const symbolCompact = compactSymbol(row.symbol);
  const qCompact = compactSymbol(query);
  const name = normalize(row.name);
  let score = 0;
  if (symbol === q || symbolCompact === qCompact) score += 160;
  if (symbol.startsWith(q)) score += 80;
  if (symbolCompact.startsWith(qCompact)) score += 60;
  if (name === q) score += 100;
  if (name.startsWith(q)) score += 55;
  if (name.includes(q) && q.length >= 3) score += 35;
  if (row.isin?.toUpperCase() === query.toUpperCase()) score += 140;
  if (row.country === 'United States') score += 6;
  if (row.country === 'Netherlands' || row.country === 'Taiwan' || row.country === 'Vietnam') score += 10;
  if (row.marketCapCategory === 'Large Cap' || row.marketCapCategory === 'Mega Cap') score += 8;
  return score;
}

function splitSymbol(symbol: string) {
  const parts = symbol.toUpperCase().split('.');
  if (parts.length === 1) return { code: parts[0], exchange: 'US' };
  return { code: parts[0], exchange: parts.slice(1).join('.') };
}

export function searchFinanceDatabase(query: string): EodhdSearchResult[] {
  const index = loadIndex();
  const rows = index?.rows ?? [];
  const trimmed = query.trim();
  if (!rows.length || trimmed.length < 1) return [];

  return rows
    .map((row) => ({ row, score: scoreRow(row, trimmed) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({ row }, indexPosition) => {
      const { code, exchange } = splitSymbol(row.symbol);
      return {
        Code: code,
        Exchange: exchange,
        Name: row.name,
        Type: row.marketCapCategory ? `Equity · ${row.marketCapCategory}` : 'Equity',
        Country: row.country ?? undefined,
        Currency: row.currency ?? undefined,
        ISIN: row.isin ?? undefined,
        isPrimary: indexPosition === 0,
      } satisfies EodhdSearchResult;
    });
}

export function findFinanceDatabaseProfile(symbol: string): FinanceDatabaseIndexRow | null {
  const rows = loadIndex()?.rows ?? [];
  if (!rows.length) return null;
  const normalized = symbol.toUpperCase();
  const compact = compactSymbol(symbol);
  return rows.find((row) => row.symbol.toUpperCase() === normalized || compactSymbol(row.symbol) === compact) ?? null;
}

export function financeDatabaseFacts(row: FinanceDatabaseIndexRow): TickerProfileFact[] {
  return [
    ['Sector', row.sector],
    ['Industry group', row.industryGroup],
    ['Industry', row.industry],
    ['Country', row.country],
    ['Market', row.market],
    ['Currency', row.currency],
    ['Market cap class', row.marketCapCategory],
    ['ISIN', row.isin],
    ['Website', row.website],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([label, value]) => ({ label, value }));
}
