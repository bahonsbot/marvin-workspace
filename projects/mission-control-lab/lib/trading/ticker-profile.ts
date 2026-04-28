import 'server-only';

import { getCachedTickerProfile, writeTickerProfileCache } from './cache';
import type { TickerProfile } from './contracts';
import { sampleTickerProfileSource } from './sources/sample';

const profileSources = [sampleTickerProfileSource];
const TICKER_PROFILE_TTL_MS = 15 * 60 * 1000;

export async function getTickerProfile(symbol: string): Promise<TickerProfile> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = await getCachedTickerProfile(normalizedSymbol, TICKER_PROFILE_TTL_MS);
  if (cached) return cached;

  for (const source of profileSources) {
    const result = await source.fetchProfile({ symbol: normalizedSymbol, now: new Date() });
    if (!result) continue;

    await writeTickerProfileCache(result.profile, TICKER_PROFILE_TTL_MS);
    return result.profile;
  }

  throw new Error(`No ticker profile source produced data for ${normalizedSymbol || 'unknown symbol'}`);
}
