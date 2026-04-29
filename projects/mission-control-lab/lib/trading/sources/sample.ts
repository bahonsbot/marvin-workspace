import {
  tickerDetailSample,
  tickerPriceSeries,
} from '@/components/pages/trading/trading-sample-data';
import type {
  TickerBalanceSheetSnapshot,
  TickerCashDebtSnapshot,
  TickerFinancialHighlight,
  TickerProfile,
  TickerProfileFact,
  TickerProfileSourceMap,
  TickerSourceMeta,
} from '../contracts';
import type { TickerProfileSource } from '../sources';
import { withProfileSource } from '../sources';

const sampleAsOf = '2025-05-16T20:00:00.000Z';

interface SampleTickerIdentity {
  name: string;
  logoUrl?: string;
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
  cashDebt?: CashDebtInput;
  balanceSheet?: BalanceSheetInput[];
}

interface CashDebtInput {
  totalCash: number;
  totalDebt: number;
  freeCashFlow: number;
  operatingCashFlow: number;
  currentRatio: number;
  debtToEquity: number;
}

interface BalanceSheetInput {
  fiscalYear: string;
  totalAssets: number;
  totalLiabilities: number;
  shareholderEquity: number;
  cashAndEquivalents: number;
  totalDebt: number;
}

const sampleTickerIdentities: Record<string, SampleTickerIdentity> = {
  NVDA: {
    name: 'NVIDIA Corporation',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/NVIDIA_logo.svg/250px-NVIDIA_logo.svg.png',
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
    cashDebt: {
      totalCash: 31.44,
      totalDebt: 11.06,
      freeCashFlow: 28.09,
      operatingCashFlow: 33.73,
      currentRatio: 4.27,
      debtToEquity: 0.17,
    },
    balanceSheet: [
      { fiscalYear: '2021', totalAssets: 44.19, totalLiabilities: 17.58, shareholderEquity: 26.61, cashAndEquivalents: 19.30, totalDebt: 7.60 },
      { fiscalYear: '2022', totalAssets: 41.18, totalLiabilities: 19.08, shareholderEquity: 22.10, cashAndEquivalents: 13.30, totalDebt: 11.83 },
      { fiscalYear: '2023', totalAssets: 65.73, totalLiabilities: 22.05, shareholderEquity: 43.68, cashAndEquivalents: 26.00, totalDebt: 11.06 },
      { fiscalYear: '2024', totalAssets: 82.34, totalLiabilities: 27.93, shareholderEquity: 54.41, cashAndEquivalents: 31.44, totalDebt: 11.06 },
    ],
  },
  TSM: {
    name: 'Taiwan Semiconductor Manufacturing Company Limited',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/TSMC_wordmark.svg/250px-TSMC_wordmark.svg.png',
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
    cashDebt: {
      totalCash: 68.20,
      totalDebt: 30.76,
      freeCashFlow: 34.88,
      operatingCashFlow: 48.34,
      currentRatio: 2.39,
      debtToEquity: 0.28,
    },
    balanceSheet: [
      { fiscalYear: '2021', totalAssets: 117.87, totalLiabilities: 50.28, shareholderEquity: 67.59, cashAndEquivalents: 33.10, totalDebt: 21.30 },
      { fiscalYear: '2022', totalAssets: 147.44, totalLiabilities: 59.91, shareholderEquity: 87.53, cashAndEquivalents: 44.80, totalDebt: 24.20 },
      { fiscalYear: '2023', totalAssets: 165.72, totalLiabilities: 67.64, shareholderEquity: 98.08, cashAndEquivalents: 52.40, totalDebt: 27.10 },
      { fiscalYear: '2024', totalAssets: 189.11, totalLiabilities: 78.84, shareholderEquity: 110.27, cashAndEquivalents: 68.20, totalDebt: 30.76 },
    ],
  },
  MSFT: {
    name: 'Microsoft Corporation',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/250px-Microsoft_logo.svg.png',
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
    cashDebt: {
      totalCash: 80.98,
      totalDebt: 106.23,
      freeCashFlow: 74.12,
      operatingCashFlow: 118.55,
      currentRatio: 1.35,
      debtToEquity: 0.42,
    },
    balanceSheet: [
      { fiscalYear: '2021', totalAssets: 333.78, totalLiabilities: 191.79, shareholderEquity: 141.99, cashAndEquivalents: 130.33, totalDebt: 67.78 },
      { fiscalYear: '2022', totalAssets: 364.84, totalLiabilities: 198.30, shareholderEquity: 166.54, cashAndEquivalents: 104.75, totalDebt: 77.14 },
      { fiscalYear: '2023', totalAssets: 411.98, totalLiabilities: 205.75, shareholderEquity: 206.23, cashAndEquivalents: 111.26, totalDebt: 97.85 },
      { fiscalYear: '2024', totalAssets: 512.16, totalLiabilities: 243.69, shareholderEquity: 268.47, cashAndEquivalents: 80.98, totalDebt: 106.23 },
    ],
  },
  AAPL: {
    name: 'Apple Inc.',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/250px-Apple_logo_black.svg.png',
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
    cashDebt: {
      totalCash: 67.15,
      totalDebt: 108.04,
      freeCashFlow: 99.58,
      operatingCashFlow: 118.25,
      currentRatio: 0.87,
      debtToEquity: 1.87,
    },
    balanceSheet: [
      { fiscalYear: '2021', totalAssets: 351.00, totalLiabilities: 287.91, shareholderEquity: 63.09, cashAndEquivalents: 62.64, totalDebt: 124.72 },
      { fiscalYear: '2022', totalAssets: 352.76, totalLiabilities: 302.08, shareholderEquity: 50.68, cashAndEquivalents: 48.30, totalDebt: 111.11 },
      { fiscalYear: '2023', totalAssets: 352.58, totalLiabilities: 290.44, shareholderEquity: 62.14, cashAndEquivalents: 61.56, totalDebt: 108.04 },
      { fiscalYear: '2024', totalAssets: 364.98, totalLiabilities: 308.03, shareholderEquity: 56.95, cashAndEquivalents: 67.15, totalDebt: 108.04 },
    ],
  },
};

const fallbackCashDebt: CashDebtInput = {
  totalCash: 12.4,
  totalDebt: 8.1,
  freeCashFlow: 2.8,
  operatingCashFlow: 4.6,
  currentRatio: 1.4,
  debtToEquity: 0.55,
};

const fallbackBalanceSheet: BalanceSheetInput[] = [
  { fiscalYear: '2021', totalAssets: 24.2, totalLiabilities: 13.1, shareholderEquity: 11.1, cashAndEquivalents: 5.2, totalDebt: 6.9 },
  { fiscalYear: '2022', totalAssets: 26.8, totalLiabilities: 14.6, shareholderEquity: 12.2, cashAndEquivalents: 6.1, totalDebt: 7.4 },
  { fiscalYear: '2023', totalAssets: 29.4, totalLiabilities: 15.8, shareholderEquity: 13.6, cashAndEquivalents: 8.3, totalDebt: 7.9 },
  { fiscalYear: '2024', totalAssets: 31.5, totalLiabilities: 16.7, shareholderEquity: 14.8, cashAndEquivalents: 12.4, totalDebt: 8.1 },
];

function sampleSource(note: string): TickerSourceMeta {
  return {
    source: 'sample',
    asOf: sampleAsOf,
    freshness: 'sample',
    note,
  };
}

function buildSampleLogoSource(identity: SampleTickerIdentity): TickerSourceMeta {
  return identity.logoUrl
    ? sampleSource('Wikimedia Commons logo fixture. Replace with live Wikipedia/Wikidata logo adapter when available.')
    : sampleSource('Logo provider pending; using ticker initials fallback.');
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

function unavailableFinancialHighlight(item: (typeof tickerDetailSample.financialHighlights)[number], source: TickerSourceMeta): TickerFinancialHighlight {
  return {
    label: item.label,
    value: 'Unavailable',
    delta: 'Provider required',
    tone: 'neutral',
    trend: [],
    source,
    status: 'unavailable',
    note: 'No reliable provider-backed value is available yet. Awaiting SEC concept coverage or a richer fundamentals provider.',
  };
}

function unavailableKeyRatio(ratio: { label: string }): TickerProfile['keyRatios'][number] {
  return {
    label: ratio.label,
    value: 'Unavailable',
    status: 'unavailable',
    note: 'Awaiting richer valuation/fundamentals provider such as FMP.',
  };
}

function formatBillions(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(Math.abs(value) >= 100 ? 0 : 1)}B`;
}

function buildCashDebtSnapshot(identity: SampleTickerIdentity, source: TickerSourceMeta): TickerCashDebtSnapshot {
  const data = identity.cashDebt ?? fallbackCashDebt;
  const total = Math.max(data.totalCash + data.totalDebt, 1);
  const netCash = data.totalCash - data.totalDebt;
  const netCashPositive = netCash >= 0;

  return {
    period: 'TTM · sample fundamentals',
    currency: 'USD',
    cashPercent: Math.round((data.totalCash / total) * 100),
    debtPercent: Math.round((data.totalDebt / total) * 100),
    totalCash: formatBillions(data.totalCash),
    totalDebt: formatBillions(data.totalDebt),
    netCash: formatBillions(Math.abs(netCash)),
    netCashLabel: netCashPositive ? 'Net Cash' : 'Net Debt',
    freeCashFlow: formatBillions(data.freeCashFlow),
    operatingCashFlow: formatBillions(data.operatingCashFlow),
    interpretation: netCashPositive ? 'Net cash position' : data.debtToEquity < 0.75 ? 'Debt exceeds cash, leverage remains moderate' : 'Levered balance sheet, watch refinancing risk',
    source,
  };
}

function buildBalanceSheetSnapshot(identity: SampleTickerIdentity, source: TickerSourceMeta): TickerBalanceSheetSnapshot {
  const annual = identity.balanceSheet ?? fallbackBalanceSheet;
  const data = identity.cashDebt ?? fallbackCashDebt;
  const latest = annual.at(-1) ?? fallbackBalanceSheet.at(-1)!;
  const netDebt = latest.totalDebt - latest.cashAndEquivalents;

  return {
    period: '2021 — 2024 · annual sample',
    currency: 'USD',
    kpis: [
      {
        label: 'Debt / Equity',
        value: `${data.debtToEquity.toFixed(2)}x`,
        caption: data.debtToEquity < 0.5 ? 'Conservative leverage' : data.debtToEquity < 1.5 ? 'Moderate leverage' : 'Levered capital stack',
        tone: data.debtToEquity < 1.5 ? 'positive' : 'negative',
      },
      {
        label: 'Current Ratio',
        value: `${data.currentRatio.toFixed(2)}x`,
        caption: data.currentRatio >= 1 ? 'Can cover short-term bills' : 'Tight short-term liquidity',
        tone: data.currentRatio >= 1 ? 'positive' : 'negative',
      },
      {
        label: netDebt <= 0 ? 'Net Cash' : 'Net Debt',
        value: formatBillions(Math.abs(netDebt)),
        caption: netDebt <= 0 ? 'Cash exceeds total debt' : 'Debt exceeds cash on hand',
        tone: netDebt <= 0 ? 'positive' : 'neutral',
      },
    ],
    annual,
    note: 'Assets minus liabilities equals shareholder equity. Cash vs debt shows whether the capital stack is getting cleaner or heavier.',
    source,
  };
}

function getIdentity(symbol: string): SampleTickerIdentity {
  return sampleTickerIdentities[symbol] ?? {
    ...sampleTickerIdentities.NVDA,
    logoUrl: undefined,
    cashDebt: fallbackCashDebt,
    balanceSheet: fallbackBalanceSheet,
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
    companyLogo: {
      url: identity.logoUrl ?? null,
      alt: `${identity.name} logo`,
      source: buildSampleLogoSource(identity),
      attribution: identity.logoUrl ? 'Wikimedia Commons' : undefined,
    },
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
    financialHighlights: tickerDetailSample.financialHighlights.map((item) => unavailableFinancialHighlight(item, sourceMap.financials)),
    cashDebtSnapshot: buildCashDebtSnapshot(identity, sourceMap.financials),
    balanceSheetSnapshot: buildBalanceSheetSnapshot(identity, sourceMap.financials),
    recentNews: identity.news.map((item) => ({
      ...item,
      sourceMeta: sourceMap.news,
    })),
    resources: tickerDetailSample.resources,
    financialOverview: {
      bars: [],
      status: 'unavailable',
      note: 'Revenue/net income chart retained as target layout; provider-backed fundamentals required.',
    },
    keyRatios: (identity.ratios ?? tickerDetailSample.keyRatios).map(unavailableKeyRatio),
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
