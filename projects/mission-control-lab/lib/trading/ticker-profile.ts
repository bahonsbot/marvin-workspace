import 'server-only';

import { getCachedTickerProfile, writeTickerProfileCache } from './cache';
import type { TickerProfile } from './contracts';
import { enrichTickerProfileWithReferenceData } from './sources/reference-enrichment';
import { hasRegisteredNonUsFilingsSymbol } from './sources/xbrl-filings';
import { eodhdTickerProfileSource } from './sources/eodhd';
import { sampleTickerProfileSource } from './sources/sample';
import { yahooTickerProfileSource } from './sources/yahoo';

const profileSources = [eodhdTickerProfileSource, yahooTickerProfileSource, sampleTickerProfileSource];
const TICKER_PROFILE_TTL_MS = 15 * 60 * 1000;


function hasAmbiguousCompanyProfile(profile: TickerProfile) {
  const summary = profile.companyProfile.summary.toLowerCase();
  return summary.includes(' may refer to:') ||
    summary.includes(' is a stock market index ') ||
    (summary.includes(' comprises ') && summary.includes(' companies traded on'));
}


function hasMissingUsYfinanceEnrichment(profile: TickerProfile) {
  if (!profile.symbol.toUpperCase().endsWith('.US')) return false;
  const estimatesMissing = profile.supplemental?.estimates.status === 'unavailable' || !(profile.supplemental?.estimates.metrics.length);
  const hasUnavailableHighlight = profile.financialHighlights.some((item) => item.status === 'unavailable' || item.value === 'Unavailable');
  const hasUnavailableRatio = profile.keyRatios.some((item) => item.status === 'unavailable' || item.value === 'Unavailable');
  return estimatesMissing || hasUnavailableHighlight || hasUnavailableRatio;
}

function shouldRefreshCachedReferenceData(profile: TickerProfile) {
  return hasRegisteredNonUsFilingsSymbol(profile.symbol) && profile.sourceMap.filings.source !== 'sec' && (
    profile.sourceMap.filings.freshness === 'missing' ||
    !profile.resources.some((group) => group.items.length)
  );
}


export async function getTickerProfile(symbol: string): Promise<TickerProfile> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = await getCachedTickerProfile(normalizedSymbol, TICKER_PROFILE_TTL_MS);
  if (cached) {
    if (!shouldRefreshCachedReferenceData(cached) && !hasAmbiguousCompanyProfile(cached) && !hasMissingUsYfinanceEnrichment(cached)) return cached;
    const enrichedCached = await enrichTickerProfileWithReferenceData(cached);
    await writeTickerProfileCache(enrichedCached, TICKER_PROFILE_TTL_MS);
    return enrichedCached;
  }

  for (const source of profileSources) {
    const result = await source.fetchProfile({ symbol: normalizedSymbol, now: new Date() });
    if (!result) continue;

    const enriched = await enrichTickerProfileWithReferenceData(result.profile);
    await writeTickerProfileCache(enriched, TICKER_PROFILE_TTL_MS);
    return enriched;
  }

  throw new Error(`No ticker profile source produced data for ${normalizedSymbol || 'unknown symbol'}`);
}
