import {
  tickerDetailSample,
  tickerFinancialOverviewSeries,
  tickerPriceSeries,
} from '@/components/pages/trading/trading-sample-data';
import type { TickerFinancialHighlight, TickerProfile, TickerProfileFact, TickerProfileSourceMap, TickerSourceMeta } from '../contracts';
import type { TickerProfileSource } from '../sources';
import { withProfileSource } from '../sources';

const sampleAsOf = '2025-05-16T20:00:00.000Z';

interface SampleTickerIdentity {
  name: string;
  exchange: string;
  marketCap: string;
  pe: string;
  sector: string;
  industry: string;
  price: string;
  change: string;
  changePct: string;
  summary: string;
  facts: TickerProfileFact[];
  news: Array<{ source: string; time: string; title: string; summary: string }>;
  ratios?: Array<{ label: string; value: string }>;
}

const sampleTickerIdentities: Record<string, SampleTickerIdentity> = {
  NVDA: {
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    marketCap: '$2.54T',
    pe: '58.21',
    sector: 'Technology',
    industry: 'Semiconductors',
    price: '$1,037.89',
    change: '+18.62',
    changePct: '+1.83%',
    summary:
      'NVIDIA designs accelerated computing platforms, graphics processors, networking systems, and software used across gaming, data center, professional visualization, automotive, and AI infrastructure markets.',
    facts: tickerDetailSample.profile.facts,
    news: tickerDetailSample.recentNews,
    ratios: tickerDetailSample.keyRatios,
  },
  TSM: {
    name: 'Taiwan Semiconductor Manufacturing Company Limited',
    exchange: 'NYSE',
    marketCap: '$946.40B',
    pe: '27.84',
    sector: 'Technology',
    industry: 'Semiconductor Foundry',
    price: '$183.42',
    change: '+2.14',
    changePct: '+1.18%',
    summary:
      'Taiwan Semiconductor Manufacturing Company manufactures advanced logic chips and specialty semiconductors for fabless designers, device makers, and high-performance computing customers worldwide.',
    facts: [
      { label: 'Founded', value: '1987' },
      { label: 'Headquarters', value: 'Hsinchu, Taiwan' },
      { label: 'CEO', value: 'C. C. Wei' },
      { label: 'Employees', value: '76,000' },
      { label: 'Website', value: 'tsmc.com' },
      { label: 'Next Earnings', value: 'Jul 17, 2025 · Before Market' },
    ],
    news: [
      {
        source: 'Nikkei Asia',
        time: '3h ago',
        title: 'TSMC capacity remains tight as AI accelerator demand expands',
        summary: 'Advanced packaging and leading-edge node supply remain the key bottlenecks investors are tracking.',
      },
      {
        source: 'Reuters',
        time: '8h ago',
        title: 'Taiwan chip exports rise with high-performance computing demand',
        summary: 'Foundry revenue expectations continue to be led by AI, smartphones, and data center silicon.',
      },
      {
        source: 'Digitimes',
        time: '1d ago',
        title: 'Customers reserve next-generation process capacity earlier than usual',
        summary: 'Long-cycle capacity planning remains central to the foundry pricing and margin debate.',
      },
    ],
    ratios: [
      { label: 'P/E Ratio', value: '27.84' },
      { label: 'Forward P/E', value: '21.60' },
      { label: 'PEG Ratio', value: '1.02' },
      { label: 'Price / Sales', value: '10.21' },
      { label: 'EV / EBITDA', value: '17.48' },
      { label: 'Price / Book', value: '7.26' },
      { label: 'Current Ratio', value: '2.39' },
      { label: 'Quick Ratio', value: '2.12' },
    ],
  },
  MSFT: {
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    marketCap: '$3.16T',
    pe: '36.60',
    sector: 'Technology',
    industry: 'Software · Infrastructure',
    price: '$422.26',
    change: '-2.36',
    changePct: '-0.56%',
    summary:
      'Microsoft develops software, cloud infrastructure, productivity tools, gaming platforms, and AI services for consumers, enterprises, developers, and public-sector customers globally.',
    facts: [
      { label: 'Founded', value: '1975' },
      { label: 'Headquarters', value: 'Redmond, WA, USA' },
      { label: 'CEO', value: 'Satya Nadella' },
      { label: 'Employees', value: '228,000' },
      { label: 'Website', value: 'microsoft.com' },
      { label: 'Next Earnings', value: 'Jul 29, 2025 · After Market' },
    ],
    news: [
      {
        source: 'Wall Street Journal',
        time: '2h ago',
        title: 'Microsoft cloud growth steadies as AI workload demand rises',
        summary: 'Azure demand and capital spending discipline remain the main investor focus heading into the next quarter.',
      },
      {
        source: 'CNBC',
        time: '6h ago',
        title: 'Microsoft expands Copilot tools for enterprise developers',
        summary: 'Management continues to bundle AI features across productivity, developer, and infrastructure products.',
      },
      {
        source: 'Reuters',
        time: '1d ago',
        title: 'Regulators review cloud software practices across large platforms',
        summary: 'Cloud competition and platform bundling remain recurring policy watch items.',
      },
    ],
    ratios: [
      { label: 'P/E Ratio', value: '36.60' },
      { label: 'Forward P/E', value: '30.12' },
      { label: 'PEG Ratio', value: '2.21' },
      { label: 'Price / Sales', value: '12.74' },
      { label: 'EV / EBITDA', value: '24.08' },
      { label: 'Price / Book', value: '11.52' },
      { label: 'Current Ratio', value: '1.35' },
      { label: 'Quick Ratio', value: '1.18' },
    ],
  },
  AAPL: {
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    marketCap: '$3.01T',
    pe: '31.90',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    price: '$196.58',
    change: '+1.07',
    changePct: '+0.55%',
    summary:
      'Apple designs consumer devices, operating systems, services, chips, and digital platforms across iPhone, Mac, iPad, wearables, payments, media, and subscription ecosystems.',
    facts: [
      { label: 'Founded', value: '1976' },
      { label: 'Headquarters', value: 'Cupertino, CA, USA' },
      { label: 'CEO', value: 'Tim Cook' },
      { label: 'Employees', value: '161,000' },
      { label: 'Website', value: 'apple.com' },
      { label: 'Next Earnings', value: 'Aug 1, 2025 · After Market' },
    ],
    news: [
      {
        source: 'Bloomberg',
        time: '4h ago',
        title: 'Apple services revenue offsets softer hardware comparisons',
        summary: 'Investors are watching gross margin resilience, China demand, and the timing of device-level AI upgrades.',
      },
      {
        source: 'Financial Times',
        time: '9h ago',
        title: 'Apple supplier checks point to stable premium smartphone demand',
        summary: 'Channel inventory and product-cycle expectations remain central to the near-term setup.',
      },
      {
        source: 'Reuters',
        time: '1d ago',
        title: 'App-store policy changes stay in focus after regulatory pressure',
        summary: 'Services monetization remains strong, but regulatory headlines continue to shape the multiple debate.',
      },
    ],
  },
};

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
    quote: sampleSource('Static symbol-aware quote fixture. Replace with cached quote provider.'),
    profile: sampleSource('Static symbol-aware company profile fixture. Replace with provider-normalized profile data.'),
    prices: sampleSource('Static price-series fixture. Replace with cached OHLCV provider.'),
    financials: sampleSource('Static financial fixture. Replace with normalized statements/fundamentals.'),
    news: sampleSource('Static symbol-aware news fixture. Replace with server-side news adapter.'),
    resources: sampleSource('Static resource fixture. Replace with company IR / provider links.'),
    filings: sampleSource('Static SEC filing links. Replace with SEC EDGAR adapter.'),
  };
}

function getIdentity(symbol: string): SampleTickerIdentity {
  return sampleTickerIdentities[symbol] ?? {
    ...sampleTickerIdentities.NVDA,
    name: `${symbol} Holdings`,
    price: '$—',
    change: '+0.00',
    changePct: '+0.00%',
    marketCap: 'Sample',
    pe: 'Sample',
    industry: 'Sample profile',
    summary: `${symbol} is shown with placeholder research data until a live provider adapter is enabled for this ticker.`,
    facts: [
      { label: 'Founded', value: 'Sample' },
      { label: 'Headquarters', value: 'Provider pending' },
      { label: 'CEO', value: 'Provider pending' },
      { label: 'Employees', value: 'Provider pending' },
      { label: 'Website', value: 'Provider pending' },
      { label: 'Next Earnings', value: 'Provider pending' },
    ],
    news: [
      {
        source: 'Sample desk',
        time: 'now',
        title: `${symbol} awaits live provider wiring`,
        summary: 'The ticker profile contract is ready; live market and company data adapters are intentionally not enabled yet.',
      },
    ],
  };
}

export function buildSampleTickerProfile(symbol: string): TickerProfile {
  const normalizedSymbol = symbol.trim().toUpperCase() || tickerDetailSample.symbol;
  const identity = getIdentity(normalizedSymbol);
  const sourceMap = buildSampleSourceMap();
  const quoteTone = identity.change.startsWith('-') ? 'negative' : identity.change === '+0.00' ? 'neutral' : 'positive';

  return {
    symbol: normalizedSymbol,
    name: identity.name,
    exchange: identity.exchange,
    currency: 'USD',
    inWatchlist: tickerDetailSample.inWatchlist,
    quote: {
      price: identity.price,
      change: identity.change,
      changePct: identity.changePct,
      priceTime: tickerDetailSample.priceTime,
      currency: 'USD',
      tone: quoteTone,
      source: sourceMap.quote,
    },
    headerStats: [
      { label: 'Market Cap', value: identity.marketCap },
      { label: 'P/E (TTM)', value: identity.pe },
      { label: 'Sector', value: identity.sector },
      { label: 'Industry', value: identity.industry },
    ],
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
      summary: identity.summary,
      facts: identity.facts,
      source: sourceMap.profile,
    },
    financialHighlights: tickerDetailSample.financialHighlights.map((item) => ({
      ...item,
      tone: item.tone as TickerFinancialHighlight['tone'],
      source: sourceMap.financials,
    })),
    recentNews: identity.news.map((item) => ({
      ...item,
      sourceMeta: sourceMap.news,
    })),
    resources: tickerDetailSample.resources,
    financialOverview: tickerFinancialOverviewSeries,
    keyRatios: identity.ratios ?? tickerDetailSample.keyRatios,
    sourceMap,
    asOf: sampleAsOf,
    freshness: 'sample',
  };
}

export const sampleTickerProfileSource: TickerProfileSource = {
  id: 'sample',
  label: 'Static symbol-aware ticker profile',
  async fetchProfile({ symbol }) {
    return withProfileSource(buildSampleTickerProfile(symbol), 'sample', sampleAsOf);
  },
};
