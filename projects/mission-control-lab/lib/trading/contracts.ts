export type TickerFreshness = 'fresh' | 'stale' | 'sample' | 'missing';

export type TickerSourceName = 'sample' | 'cache' | 'yahoo' | 'eodhd' | 'sec' | 'wikipedia' | 'defeatbeta';

export interface TickerSourceMeta {
  source: TickerSourceName;
  asOf: string;
  freshness: TickerFreshness;
  note?: string;
}

export type TickerDataStatus = 'available' | 'partial' | 'unavailable';

export interface TickerDisplayMetric {
  label: string;
  value: string;
  status?: TickerDataStatus;
  note?: string;
  source?: TickerSourceMeta;
}

export interface TickerQuote {
  price: string;
  change: string;
  changePct: string;
  priceTime: string;
  currency: string;
  tone: 'positive' | 'negative' | 'neutral';
  source: TickerSourceMeta;
  symbol?: string;
  rawPrice?: number | null;
  rawChange?: number | null;
  rawChangePct?: number | null;
  updatedAt?: string | null;
  providerDelay?: string;
}

export interface TickerProfileFact {
  label: string;
  value: string;
}

export interface TickerCompanyLogo {
  url: string | null;
  alt: string;
  source: TickerSourceMeta;
  attribution?: string;
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
  status?: TickerDataStatus;
  note?: string;
}

export interface TickerNewsItem {
  source: string;
  time: string;
  title: string;
  summary: string;
  url?: string;
  sourceMeta?: TickerSourceMeta;
  relatedTickers?: string[];
  kind?: 'story' | 'video' | 'press-release' | 'news';
}

export interface TickerResourceItem {
  name: string;
  meta: string;
  href: string;
  source?: TickerSourceMeta;
  kind?: 'annual' | 'quarterly' | 'current' | 'event' | 'resource';
  form?: string;
  filedAt?: string;
  reportDate?: string;
  accession?: string;
  document?: string;
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

export interface TickerFinancialOverview {
  bars: TickerFinancialBar[];
  status: TickerDataStatus;
  note?: string;
}

export interface TickerCashDebtSnapshot {
  period: string;
  currency: string;
  cashPercent: number;
  debtPercent: number;
  totalCash: string;
  totalDebt: string;
  netCash: string;
  netCashLabel: 'Net Cash' | 'Net Debt';
  freeCashFlow: string;
  operatingCashFlow: string;
  interpretation: string;
  source: TickerSourceMeta;
}

export interface TickerBalanceSheetKpi {
  label: string;
  value: string;
  caption: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface TickerBalanceSheetYear {
  fiscalYear: string;
  totalAssets: number;
  totalLiabilities: number;
  shareholderEquity: number;
  cashAndEquivalents: number;
  totalDebt: number;
}

export interface TickerBalanceSheetSnapshot {
  period: string;
  currency: string;
  kpis: TickerBalanceSheetKpi[];
  annual: TickerBalanceSheetYear[];
  note: string;
  source: TickerSourceMeta;
}

export interface TickerPricePoint {
  time: string | number;
  value: number;
}

export interface TickerPriceRangeSeries {
  range: string;
  points: TickerPricePoint[];
  axis: string[];
  stats: TickerDisplayMetric[];
  source: TickerSourceMeta;
  status: TickerDataStatus;
  note?: string;
}

export interface TickerPriceSeries {
  values: number[];
  ranges: string[];
  activeRange: string;
  axis: string[];
  stats: TickerDisplayMetric[];
  source: TickerSourceMeta;
  rangeSeries?: Record<string, TickerPriceRangeSeries>;
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

export interface TickerSupplementalSection {
  status: TickerDataStatus;
  note: string;
  source: TickerSourceMeta;
  metrics: TickerDisplayMetric[];
}

export interface TickerSupplementalData {
  dividends: TickerSupplementalSection;
  technicals: TickerSupplementalSection;
  estimates: TickerSupplementalSection;
  ownership: TickerSupplementalSection;
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
  companyLogo: TickerCompanyLogo;
  companyProfile: TickerCompanyProfile;
  financialHighlights: TickerFinancialHighlight[];
  cashDebtSnapshot: TickerCashDebtSnapshot;
  balanceSheetSnapshot: TickerBalanceSheetSnapshot;
  recentNews: TickerNewsItem[];
  resources: TickerResourceGroup[];
  financialOverview: TickerFinancialOverview;
  keyRatios: TickerDisplayMetric[];
  supplemental?: TickerSupplementalData;
  sourceMap: TickerProfileSourceMap;
  asOf: string;
  freshness: TickerFreshness;
}
