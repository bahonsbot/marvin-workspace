import {
  tickerDetailSample,
  tickerFinancialOverviewSeries,
  tickerPriceSeries,
} from '@/components/pages/trading/trading-sample-data';
import type { TickerFinancialHighlight, TickerProfile, TickerProfileSourceMap, TickerSourceMeta } from '../contracts';
import type { TickerProfileSource } from '../sources';
import { withProfileSource } from '../sources';

const sampleAsOf = '2025-05-16T20:00:00.000Z';

function sampleSource(note: string): TickerSourceMeta {
  return {
    source: 'sample',
    asOf: sampleAsOf,
    freshness: 'sample',
    note,
  };
}

function buildSampleSourceMap(): TickerProfileSourceMap {
  return {
    quote: sampleSource('Static quote fixture. Replace with cached quote provider.'),
    profile: sampleSource('Static company profile fixture. Replace with provider-normalized profile data.'),
    prices: sampleSource('Static price-series fixture. Replace with cached OHLCV provider.'),
    financials: sampleSource('Static financial fixture. Replace with normalized statements/fundamentals.'),
    news: sampleSource('Static news fixture. Replace with server-side news adapter.'),
    resources: sampleSource('Static resource fixture. Replace with company IR / provider links.'),
    filings: sampleSource('Static SEC filing links. Replace with SEC EDGAR adapter.'),
  };
}

export function buildSampleTickerProfile(symbol: string): TickerProfile {
  const normalizedSymbol = symbol.trim().toUpperCase() || tickerDetailSample.symbol;
  const sourceMap = buildSampleSourceMap();
  const quoteTone = tickerDetailSample.change.startsWith('-') ? 'negative' : 'positive';

  return {
    symbol: normalizedSymbol,
    name: tickerDetailSample.name,
    exchange: tickerDetailSample.exchange,
    currency: 'USD',
    inWatchlist: tickerDetailSample.inWatchlist,
    quote: {
      price: tickerDetailSample.price,
      change: tickerDetailSample.change,
      changePct: tickerDetailSample.changePct,
      priceTime: tickerDetailSample.priceTime,
      currency: 'USD',
      tone: quoteTone,
      source: sourceMap.quote,
    },
    headerStats: tickerDetailSample.headerStats,
    tabs: tickerDetailSample.tabs,
    priceSeries: {
      values: tickerPriceSeries,
      ranges: tickerDetailSample.priceRanges,
      activeRange: '1Y',
      axis: tickerDetailSample.chartAxis,
      stats: tickerDetailSample.chartStats,
      source: sourceMap.prices,
    },
    companyProfile: {
      summary: tickerDetailSample.profile.summary,
      facts: tickerDetailSample.profile.facts,
      source: sourceMap.profile,
    },
    financialHighlights: tickerDetailSample.financialHighlights.map((item) => ({
      ...item,
      tone: item.tone as TickerFinancialHighlight['tone'],
      source: sourceMap.financials,
    })),
    recentNews: tickerDetailSample.recentNews.map((item) => ({
      ...item,
      sourceMeta: sourceMap.news,
    })),
    resources: tickerDetailSample.resources,
    financialOverview: tickerFinancialOverviewSeries,
    keyRatios: tickerDetailSample.keyRatios,
    sourceMap,
    asOf: sampleAsOf,
    freshness: 'sample',
  };
}

export const sampleTickerProfileSource: TickerProfileSource = {
  id: 'sample',
  label: 'Static sample ticker profile',
  async fetchProfile({ symbol }) {
    return withProfileSource(buildSampleTickerProfile(symbol), 'sample', sampleAsOf);
  },
};
