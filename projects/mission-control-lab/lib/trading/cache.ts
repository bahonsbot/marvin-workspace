import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TickerProfile } from './contracts';

const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';
const CACHE_DIR = path.join(WORKSPACE_ROOT, 'projects', 'mission-control-lab', 'data', 'trading', 'ticker-profiles');
const DEFAULT_TTL_MS = 15 * 60 * 1000;

export interface TickerProfileCacheEntry {
  schemaVersion: 1;
  symbol: string;
  cachedAt: string;
  ttlMs: number;
  profile: TickerProfile;
}

export interface TickerProfileCacheRead {
  entry: TickerProfileCacheEntry;
  isFresh: boolean;
  ageMs: number;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
}

function cachePath(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  const safeFile = normalized.replace(/\./g, '_');
  const target = path.join(CACHE_DIR, `${safeFile}.json`);
  const relative = path.relative(CACHE_DIR, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

export async function readTickerProfileCache(symbol: string, ttlMs = DEFAULT_TTL_MS): Promise<TickerProfileCacheRead | null> {
  const target = cachePath(symbol);
  if (!target) return null;

  try {
    const raw = await fs.readFile(target, 'utf8');
    const entry = JSON.parse(raw) as TickerProfileCacheEntry;
    if (entry.schemaVersion !== 1 || entry.symbol !== normalizeSymbol(symbol) || !entry.profile) return null;

    const cachedAtMs = Date.parse(entry.cachedAt);
    if (Number.isNaN(cachedAtMs)) return null;

    const effectiveTtl = entry.ttlMs || ttlMs;
    const ageMs = Date.now() - cachedAtMs;
    return {
      entry,
      ageMs,
      isFresh: ageMs <= effectiveTtl,
    };
  } catch {
    return null;
  }
}

export async function writeTickerProfileCache(profile: TickerProfile, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  const target = cachePath(profile.symbol);
  if (!target) return;

  const entry: TickerProfileCacheEntry = {
    schemaVersion: 1,
    symbol: normalizeSymbol(profile.symbol),
    cachedAt: new Date().toISOString(),
    ttlMs,
    profile,
  };

  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

export async function getCachedTickerProfile(symbol: string, ttlMs = DEFAULT_TTL_MS): Promise<TickerProfile | null> {
  const read = await readTickerProfileCache(symbol, ttlMs);
  return read?.isFresh ? read.entry.profile : null;
}
