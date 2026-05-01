import 'server-only';

import type { TickerProfile, TickerSupplementalData } from '../contracts';
import { financeDatabaseFacts, financeDatabaseSource, findFinanceDatabaseProfile } from './finance-database';
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
  const candidates = [normalized];
  if (normalized.endsWith('.US')) candidates.push(normalized.replace(/\.US$/, ''));
  return Array.from(new Set(candidates));
}

async function fetchFirstYfinance(symbol: string) {
  for (const candidate of yahooSymbolCandidates(symbol)) {
    const result = await fetchYfinanceBridge(candidate);
    if (result && ((result.headerStats?.length ?? 0) || (result.estimates?.length ?? 0) || (result.facts?.length ?? 0) || result.fundamentals)) return result;
  }
  return null;
}

export async function enrichTickerProfileWithReferenceData(profile: TickerProfile): Promise<TickerProfile> {
  const [financeDatabaseProfile, yfinanceData] = await Promise.all([
    Promise.resolve(findFinanceDatabaseProfile(profile.symbol)),
    fetchFirstYfinance(profile.symbol),
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

  const shouldBackfillFinancials = profile.sourceMap.financials.freshness === 'missing' && Boolean(yfinanceMetaSource);
  const yfinanceHighlights = shouldBackfillFinancials ? yfinanceFinancialHighlights(yfinanceData, yfinanceMetaSource!) : [];
  const yfinanceCashDebt = shouldBackfillFinancials ? yfinanceCashDebtSnapshot(yfinanceData, yfinanceMetaSource!) : null;
  const yfinanceBalanceSheet = shouldBackfillFinancials ? yfinanceBalanceSheetSnapshot(yfinanceData, yfinanceMetaSource!) : null;
  const yfinanceOverview = shouldBackfillFinancials ? yfinanceFinancialOverview(yfinanceData) : null;

  return {
    ...profile,
    headerStats: mergeHeaderStats(profile.headerStats, yfinanceData?.headerStats, yfinanceMetaSource ?? profile.sourceMap.profile),
    companyProfile,
    keyRatios: yfinanceMetaSource
      ? mergeKeyRatiosFromFundamentals(mergeKeyRatios(profile.keyRatios, yfinanceData?.keyRatios, yfinanceMetaSource), yfinanceData, yfinanceMetaSource)
      : profile.keyRatios,
    financialHighlights: yfinanceHighlights.length ? yfinanceHighlights : profile.financialHighlights,
    cashDebtSnapshot: yfinanceCashDebt ?? profile.cashDebtSnapshot,
    balanceSheetSnapshot: yfinanceBalanceSheet ?? profile.balanceSheetSnapshot,
    financialOverview: yfinanceOverview ?? profile.financialOverview,
    supplemental,
  };
}
