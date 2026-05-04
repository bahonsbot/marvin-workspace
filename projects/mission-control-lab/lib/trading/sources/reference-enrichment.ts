import 'server-only';

import type { TickerProfile, TickerSupplementalData } from '../contracts';
import { financeDatabaseFacts, financeDatabaseSource, findFinanceDatabaseProfile } from './finance-database';
import { fetchNonUsFilingsResources } from './xbrl-filings';
import {
  bridgeMetricsToDisplay,
  fetchYfinanceBridge,
  mergeFacts,
  mergeHeaderStats,
  mergeKeyRatios,
  mergeKeyRatiosFromFundamentals,
  yfinanceBalanceSheetSnapshot,
  yfinanceCashDebtSnapshot,
  yfinanceFinancialHighlights,
  yfinanceFinancialOverview,
  yfinanceSource,
} from './yfinance-bridge';

function yahooSymbolCandidates(symbol: string) {
  const normalized = symbol.toUpperCase();
  const candidates = normalized.endsWith('.US')
    ? [normalized.replace(/\.US$/, ''), normalized]
    : [normalized];
  return Array.from(new Set(candidates));
}

function hasUsableYfinanceData(result: Awaited<ReturnType<typeof fetchYfinanceBridge>>) {
  if (!result) return false;
  return Boolean(
    (result.headerStats?.length ?? 0) ||
    (result.estimates?.length ?? 0) ||
    (result.facts?.length ?? 0) ||
    (result.keyRatios?.length ?? 0) ||
    (result.ownership?.length ?? 0) ||
    (result.dividends?.length ?? 0) ||
    result.fundamentals?.highlights?.revenue?.value != null ||
    result.fundamentals?.highlights?.eps?.value != null
  );
}

async function fetchFirstYfinance(symbol: string) {
  for (const candidate of yahooSymbolCandidates(symbol)) {
    const result = await fetchYfinanceBridge(candidate);
    if (hasUsableYfinanceData(result)) return result;
  }
  return null;
}

function mergeFinancialHighlights(primary: TickerProfile['financialHighlights'], supplemental: TickerProfile['financialHighlights']) {
  if (!supplemental.length) return primary;
  const byLabel = new Map(primary.map((item) => [item.label, item]));
  for (const item of supplemental) {
    const existing = byLabel.get(item.label);
    if (!existing || existing.status === 'unavailable' || existing.value === 'Unavailable') {
      byLabel.set(item.label, item);
    }
  }
  return Array.from(byLabel.values());
}

function factValue(facts: TickerProfile['companyProfile']['facts'], label: string) {
  return facts.find((fact) => fact.label.trim().toLowerCase() === label.trim().toLowerCase())?.value ?? null;
}

function normalizeIdentity(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function isTickerLikeName(value: string | null | undefined, symbol: string) {
  const normalizedValue = normalizeIdentity(value).toUpperCase();
  if (!normalizedValue) return true;
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return true;
  if (normalizedValue === normalizedSymbol) return true;
  if (normalizedValue === normalizedSymbol.split('.')[0]) return true;
  return false;
}

function isFundLikeQuoteType(value: string | null | undefined) {
  const normalized = normalizeIdentity(value).toUpperCase();
  return ['ETF', 'ETN', 'FUND', 'TRUST', 'MUTUAL FUND', 'UCITS'].some((token) => normalized.includes(token));
}

function isGenericProfileSummary(summary: string) {
  const normalized = summary.toLowerCase();
  return normalized.includes('is covered by eodhd market-data endpoints')
    || normalized.includes('verified company summary is not available yet')
    || normalized.includes('verified fund strategy summary is not available yet');
}

function fallbackSummary(name: string, quoteType: string | null | undefined, exchange: string) {
  if (isFundLikeQuoteType(quoteType)) {
    const kind = normalizeIdentity(quoteType)?.toLowerCase() || 'fund';
    return `${name} is a listed ${kind} on ${exchange}. Price history and market metadata are available, but a verified fund strategy summary is not available yet.`;
  }
  return `${name} trades on ${exchange}. Price history and market metadata are available, but a verified company summary is not available yet.`;
}

export async function enrichTickerProfileWithReferenceData(profile: TickerProfile): Promise<TickerProfile> {
  const shouldFetchNonUsFilings = profile.sourceMap.filings.source !== 'sec' && (
    profile.sourceMap.filings.freshness === 'missing' ||
    profile.sourceMap.filings.freshness === 'sample' ||
    profile.sourceMap.filings.source === 'xbrl' ||
    profile.sourceMap.filings.source === 'dart' ||
    profile.sourceMap.filings.source === 'mops' ||
    !profile.resources.some((group) => group.items.length)
  );

  const [financeDatabaseProfile, yfinanceData, nonUsFilings] = await Promise.all([
    Promise.resolve(findFinanceDatabaseProfile(profile.symbol)),
    fetchFirstYfinance(profile.symbol),
    shouldFetchNonUsFilings ? fetchNonUsFilingsResources(profile) : Promise.resolve(null),
  ]);

  const yfinanceMetaSource = yfinanceData ? yfinanceSource(yfinanceData.asOf, yfinanceData.sourceNote) : null;
  const companyProfile = { ...profile.companyProfile, facts: [...profile.companyProfile.facts] };
  if (financeDatabaseProfile) {
    companyProfile.facts = mergeFacts(companyProfile.facts, financeDatabaseFacts(financeDatabaseProfile));
    if (companyProfile.source.freshness === 'missing') {
      companyProfile.source = financeDatabaseSource('FinanceDatabase static equities index used for company reference facts.');
    }
  }
  if (yfinanceData?.facts?.length) {
    companyProfile.facts = mergeFacts(companyProfile.facts, yfinanceData.facts);
    if (companyProfile.source.freshness === 'missing' && yfinanceMetaSource) {
      companyProfile.source = yfinanceMetaSource;
    }
  }

  const companyNameFact = normalizeIdentity(factValue(companyProfile.facts, 'Company Name'));
  const quoteTypeFact = factValue(companyProfile.facts, 'Quote Type') ?? factValue(companyProfile.facts, 'Instrument Type');
  const promotedName = !isTickerLikeName(companyNameFact, profile.symbol)
    ? companyNameFact
    : normalizeIdentity(profile.name);
  const displayName = !isTickerLikeName(promotedName, profile.symbol) ? promotedName : profile.symbol;
  if (isGenericProfileSummary(companyProfile.summary)) {
    companyProfile.summary = fallbackSummary(displayName, quoteTypeFact, profile.exchange);
  }

  let supplemental: TickerSupplementalData | undefined = profile.supplemental ? {
    dividends: profile.supplemental.dividends,
    technicals: profile.supplemental.technicals,
    estimates: profile.supplemental.estimates,
    ownership: profile.supplemental.ownership,
  } : undefined;

  if (yfinanceMetaSource) {
    supplemental ??= {
      dividends: { status: 'unavailable', note: 'Dividend data unavailable.', source: yfinanceMetaSource, metrics: [] },
      technicals: { status: 'unavailable', note: 'Technical data unavailable.', source: yfinanceMetaSource, metrics: [] },
      estimates: { status: 'unavailable', note: 'Estimate data unavailable.', source: yfinanceMetaSource, metrics: [] },
      ownership: { status: 'unavailable', note: 'Ownership data unavailable.', source: yfinanceMetaSource, metrics: [] },
    };

    const estimateMetrics = bridgeMetricsToDisplay(yfinanceData?.estimates, yfinanceMetaSource);
    if (estimateMetrics.length) {
      supplemental.estimates = {
        status: estimateMetrics.some((metric) => metric.status === 'available') ? 'available' : 'partial',
        note: 'Analyst estimates, price targets, and recommendation trend from yfinance/Yahoo Finance.',
        source: yfinanceMetaSource,
        metrics: estimateMetrics,
      };
    }

    const ownershipMetrics = bridgeMetricsToDisplay(yfinanceData?.ownership, yfinanceMetaSource);
    if (ownershipMetrics.length) {
      supplemental.ownership = {
        status: ownershipMetrics.some((metric) => metric.status === 'available') ? 'available' : 'partial',
        note: 'Ownership summary from yfinance/Yahoo Finance holder endpoints.',
        source: yfinanceMetaSource,
        metrics: ownershipMetrics,
      };
    }

    const dividendMetrics = bridgeMetricsToDisplay(yfinanceData?.dividends, yfinanceMetaSource);
    if (dividendMetrics.length && (!supplemental.dividends.metrics.length || supplemental.dividends.status === 'unavailable')) {
      supplemental.dividends = {
        status: dividendMetrics.some((metric) => metric.status === 'available') ? 'available' : 'partial',
        note: 'Dividend summary from yfinance/Yahoo Finance.',
        source: yfinanceMetaSource,
        metrics: dividendMetrics,
      };
    }
  }

  const shouldBackfillFinancials = Boolean(yfinanceMetaSource);
  const yfinanceHighlights = shouldBackfillFinancials ? yfinanceFinancialHighlights(yfinanceData, yfinanceMetaSource!) : [];
  const yfinanceCashDebt = shouldBackfillFinancials ? yfinanceCashDebtSnapshot(yfinanceData, yfinanceMetaSource!) : null;
  const yfinanceBalanceSheet = shouldBackfillFinancials ? yfinanceBalanceSheetSnapshot(yfinanceData, yfinanceMetaSource!) : null;
  const yfinanceOverview = shouldBackfillFinancials ? yfinanceFinancialOverview(yfinanceData) : null;

  const sourceMap = nonUsFilings ? {
    ...profile.sourceMap,
    resources: nonUsFilings.source,
    filings: nonUsFilings.source,
  } : profile.sourceMap;
  const resources = nonUsFilings?.resources ?? (
    profile.sourceMap.resources.freshness === 'sample' || profile.sourceMap.filings.freshness === 'sample'
      ? []
      : profile.resources
  );

  return {
    ...profile,
    name: displayName,
    headerStats: mergeHeaderStats(profile.headerStats, yfinanceData?.headerStats, yfinanceMetaSource ?? profile.sourceMap.profile),
    companyProfile,
    keyRatios: yfinanceMetaSource
      ? mergeKeyRatiosFromFundamentals(mergeKeyRatios(profile.keyRatios, yfinanceData?.keyRatios, yfinanceMetaSource), yfinanceData, yfinanceMetaSource)
      : profile.keyRatios,
    financialHighlights: mergeFinancialHighlights(profile.financialHighlights, yfinanceHighlights),
    cashDebtSnapshot: yfinanceCashDebt ?? profile.cashDebtSnapshot,
    balanceSheetSnapshot: yfinanceBalanceSheet ?? profile.balanceSheetSnapshot,
    financialOverview: yfinanceOverview ?? profile.financialOverview,
    resources,
    sourceMap,
    supplemental,
  };
}
