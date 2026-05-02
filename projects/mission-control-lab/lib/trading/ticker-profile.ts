import 'server-only';

import { getCachedTickerProfile, writeTickerProfileCache } from './cache';
import type { TickerProfile } from './contracts';
import { enrichTickerProfileWithReferenceData } from './sources/reference-enrichment';
import { fetchNonUsFilingsResources, hasRegisteredNonUsFilingsSymbol } from './sources/xbrl-filings';
import { eodhdTickerProfileSource } from './sources/eodhd';
import { sampleTickerProfileSource } from './sources/sample';
import { yahooTickerProfileSource } from './sources/yahoo';

const profileSources = [eodhdTickerProfileSource, yahooTickerProfileSource, sampleTickerProfileSource];
const TICKER_PROFILE_TTL_MS = 15 * 60 * 1000;

async function replaceSampleResourcesForDisclosureSymbol(profile: TickerProfile) {
  if (!hasRegisteredNonUsFilingsSymbol(profile.symbol)) return profile;
  if (profile.sourceMap.filings.source !== 'sample' && profile.sourceMap.resources.source !== 'sample') return profile;
  const nonUsFilings = await fetchNonUsFilingsResources(profile);
  if (!nonUsFilings) return profile;
  return {
    ...profile,
    resources: nonUsFilings.resources,
    sourceMap: {
      ...profile.sourceMap,
      resources: nonUsFilings.source,
      filings: nonUsFilings.source,
    },
  };
}


function hasAmbiguousCompanyProfile(profile: TickerProfile) {
  const summary = profile.companyProfile.summary.toLowerCase();
  return summary.includes(' may refer to:') ||
    summary.includes(' is a stock market index ') ||
    summary.includes(' is covered by eodhd market-data endpoints') ||
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
    profile.sourceMap.filings.freshness === 'sample' ||
    profile.sourceMap.filings.source === 'dart' ||
    profile.sourceMap.filings.source === 'mops' ||
    !profile.resources.some((group) => group.items.length)
  );
}


async function fetchFreshTickerProfile(normalizedSymbol: string) {
  for (const source of profileSources) {
    const result = await source.fetchProfile({ symbol: normalizedSymbol, now: new Date() });
    if (!result) continue;

    const enriched = await replaceSampleResourcesForDisclosureSymbol(await enrichTickerProfileWithReferenceData(result.profile));
    await writeTickerProfileCache(enriched, TICKER_PROFILE_TTL_MS);
    return enriched;
  }

  throw new Error(`No ticker profile source produced data for ${normalizedSymbol || 'unknown symbol'}`);
}

export async function getTickerProfile(symbol: string): Promise<TickerProfile> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = await getCachedTickerProfile(normalizedSymbol, TICKER_PROFILE_TTL_MS);
  if (cached) {
    if (hasAmbiguousCompanyProfile(cached)) return fetchFreshTickerProfile(normalizedSymbol);
    if (!shouldRefreshCachedReferenceData(cached) && !hasMissingUsYfinanceEnrichment(cached)) return cached;
    const enrichedCached = await enrichTickerProfileWithReferenceData(cached);
    await writeTickerProfileCache(enrichedCached, TICKER_PROFILE_TTL_MS);
    return enrichedCached;
  }

  return fetchFreshTickerProfile(normalizedSymbol);
}
