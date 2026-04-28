export type TickerFreshness = 'fresh' | 'stale' | 'sample' | 'missing';

export type TickerSourceName = 'sample' | 'cache' | 'yahoo' | 'sec' | 'wikipedia' | 'defeatbeta';

export interface TickerSourceMeta {
  source: TickerSourceName;
  asOf: string;
  freshness: TickerFreshness;
  note?: string;
}

export interface TickerDisplayMetric {
  label: string;
  value: string;
}

export interface TickerQuote {
  price: string;
  change: string;
  changePct: string;
  priceTime: string;
  currency: string;
  tone: 'positive' | 'negative' | 'neutral';
  source: TickerSourceMeta;
}

export interface TickerProfileFact {
  label: string;
  value: string;
}

export interface TickerCompanyProfile {
  summary: string;
  facts: TickerProfileFact[];
  source: TickerSourceMeta;
}

export interface TickerFinancialHighlight {
  label: string;
  value: string;
  delta: string;
  tone: 'positive' | 'negative' | 'neutral';
  trend: number[];
  source?: TickerSourceMeta;
}

export interface TickerNewsItem {
  source: string;
  time: string;
  title: string;
  summary: string;
  url?: string;
  sourceMeta?: TickerSourceMeta;
}

export interface TickerResourceItem {
  name: string;
  meta: string;
  href: string;
  source?: TickerSourceMeta;
}

export interface TickerResourceGroup {
  label: string;
  items: TickerResourceItem[];
}

export interface TickerFinancialBar {
  year: string;
  revenue: number;
  netIncome: number;
}

export interface TickerPriceSeries {
  values: number[];
  ranges: string[];
  activeRange: string;
  axis: string[];
  stats: TickerDisplayMetric[];
  source: TickerSourceMeta;
}

export interface TickerProfileSourceMap {
  quote: TickerSourceMeta;
  profile: TickerSourceMeta;
  prices: TickerSourceMeta;
  financials: TickerSourceMeta;
  news: TickerSourceMeta;
  resources: TickerSourceMeta;
  filings: TickerSourceMeta;
}

export interface TickerProfile {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  inWatchlist: boolean;
  quote: TickerQuote;
  headerStats: TickerDisplayMetric[];
  tabs: string[];
  priceSeries: TickerPriceSeries;
  companyProfile: TickerCompanyProfile;
  financialHighlights: TickerFinancialHighlight[];
  recentNews: TickerNewsItem[];
  resources: TickerResourceGroup[];
  financialOverview: TickerFinancialBar[];
  keyRatios: TickerDisplayMetric[];
  sourceMap: TickerProfileSourceMap;
  asOf: string;
  freshness: TickerFreshness;
}
