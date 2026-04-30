import 'server-only';

import { getCachedTickerProfile, writeTickerProfileCache } from './cache';
import type { TickerProfile } from './contracts';
import { enrichTickerProfileWithReferenceData } from './sources/reference-enrichment';
import { eodhdTickerProfileSource } from './sources/eodhd';
import { sampleTickerProfileSource } from './sources/sample';
import { yahooTickerProfileSource } from './sources/yahoo';

const profileSources = [eodhdTickerProfileSource, yahooTickerProfileSource, sampleTickerProfileSource];
const TICKER_PROFILE_TTL_MS = 15 * 60 * 1000;

export async function getTickerProfile(symbol: string): Promise<TickerProfile> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = await getCachedTickerProfile(normalizedSymbol, TICKER_PROFILE_TTL_MS);
  if (cached) return cached;

  for (const source of profileSources) {
    const result = await source.fetchProfile({ symbol: normalizedSymbol, now: new Date() });
    if (!result) continue;

    const enriched = await enrichTickerProfileWithReferenceData(result.profile);
    await writeTickerProfileCache(enriched, TICKER_PROFILE_TTL_MS);
    return enriched;
  }

  throw new Error(`No ticker profile source produced data for ${normalizedSymbol || 'unknown symbol'}`);
}
