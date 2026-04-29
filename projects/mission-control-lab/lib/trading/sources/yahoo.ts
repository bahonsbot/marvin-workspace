import type {
  TickerBalanceSheetSnapshot,
  TickerCashDebtSnapshot,
  TickerDisplayMetric,
  TickerFinancialHighlight,
  TickerProfile,
  TickerProfileSourceMap,
  TickerSourceMeta,
} from '../contracts';
import type { TickerProfileSource } from '../sources';
import { withProfileSource } from '../sources';
import { buildSampleTickerProfile } from './sample';
import { fetchSecTickerFundamentals } from './sec';
import { fetchWikipediaCompanyLogo } from './wikipedia';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

interface YahooChartMeta {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  longName?: string;
  marketCap?: number;
  trailingPE?: number;
  averageVolume?: number;
  shortName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface YahooSearchResponse {
  quotes?: Array<{
    symbol?: string;
    longname?: string;
    shortname?: string;
    exchange?: string;
    exchDisp?: string;
    sector?: string;
    sectorDisp?: string;
    industry?: string;
    industryDisp?: string;
  }>;
}

const YAHOO_USER_AGENT = 'Mozilla/5.0 (compatible; MissionControlLab/1.0; +https://motiondisplay.cloud)';

function yahooSource(asOf: string, note: string): TickerSourceMeta {
  return {
    source: 'yahoo',
    asOf,
    freshness: 'fresh',
    note,
  };
}

function sampleFallbackSource(asOf: string, note: string): TickerSourceMeta {
  return {
    source: 'sample',
    asOf,
    freshness: 'sample',
    note,
  };
}

function buildYahooSourceMap(asOf: string): TickerProfileSourceMap {
  return {
    quote: yahooSource(asOf, 'Yahoo Finance chart endpoint. Cached server-side.'),
    profile: yahooSource(asOf, 'Yahoo Finance search/chart metadata with sample fallback for profile narrative.'),
    prices: yahooSource(asOf, 'Yahoo Finance chart endpoint. Cached server-side.'),
    financials: sampleFallbackSource(asOf, 'Sample financial modules retained until a fundamentals provider is enabled.'),
    news: sampleFallbackSource(asOf, 'Sample news retained until a news provider is enabled.'),
    resources: sampleFallbackSource(asOf, 'Static resource links retained until source adapters are enabled.'),
    filings: sampleFallbackSource(asOf, 'SEC adapter pending.'),
  };
}

function formatMoney(value: number | null | undefined, currency = 'USD') {
  if (value == null || Number.isNaN(value)) return '$—';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 100 ? 2 : 2,
  });
  return formatter.format(value);
}

function formatSigned(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}`;
}

function formatPct(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

function formatLarge(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString('en-US');
}

function formatAsOf(epochSeconds: number | undefined) {
  if (!epochSeconds) return new Date().toISOString();
  return new Date(epochSeconds * 1000).toISOString();
}

function chartAxisFromTimestamps(timestamps: number[]) {
  if (timestamps.length === 0) return [];
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const indices = [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1].map((ratio) => Math.min(timestamps.length - 1, Math.round((timestamps.length - 1) * ratio)));
  return Array.from(new Set(indices)).map((index) => formatter.format(new Date(timestamps[index] * 1000)));
}

function validNumbers(values: Array<number | null | undefined> | undefined) {
  return (values ?? []).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function compactPriceSeries(closes: Array<number | null | undefined>) {
  const valid = validNumbers(closes);
  if (valid.length <= 36) return valid.map((value) => Number(value.toFixed(2)));
  const output: number[] = [];
  const last = valid.length - 1;
  for (let index = 0; index < 36; index += 1) {
    const sourceIndex = Math.round((index / 35) * last);
    output.push(Number(valid[sourceIndex].toFixed(2)));
  }
  return output;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': YAHOO_USER_AGENT,
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchYahooChart(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const data = await fetchJson<YahooChartResponse>(url);
  return data?.chart?.result?.[0] ?? null;
}

async function fetchYahooSearch(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=0`;
  const data = await fetchJson<YahooSearchResponse>(url);
  const exact = data?.quotes?.find((quote) => quote.symbol?.toUpperCase() === symbol.toUpperCase());
  return exact ?? data?.quotes?.[0] ?? null;
}

function buildFinancialHighlights(sample: TickerProfile, sourceMap: TickerProfileSourceMap): TickerFinancialHighlight[] {
  return sample.financialHighlights.map((item) => ({ ...item, source: sourceMap.financials }));
}

function buildCashDebtSnapshot(sample: TickerProfile, sourceMap: TickerProfileSourceMap): TickerCashDebtSnapshot {
  return { ...sample.cashDebtSnapshot, source: sourceMap.financials };
}

function buildBalanceSheetSnapshot(sample: TickerProfile, sourceMap: TickerProfileSourceMap): TickerBalanceSheetSnapshot {
  return { ...sample.balanceSheetSnapshot, source: sourceMap.financials };
}

function buildHeaderStats(sample: TickerProfile, search: Awaited<ReturnType<typeof fetchYahooSearch>>, meta: YahooChartMeta): TickerDisplayMetric[] {
  const sector = search?.sectorDisp || search?.sector || sample.headerStats.find((item) => item.label === 'Sector')?.value || '—';
  const industry = search?.industryDisp || search?.industry || sample.headerStats.find((item) => item.label === 'Industry')?.value || '—';
  return [
    { label: 'Market Cap', value: meta.marketCap ? `$${formatLarge(meta.marketCap)}` : sample.headerStats.find((item) => item.label === 'Market Cap')?.value ?? 'Provider pending' },
    { label: 'P/E (TTM)', value: meta.trailingPE ? meta.trailingPE.toFixed(2) : sample.headerStats.find((item) => item.label === 'P/E (TTM)')?.value ?? 'Provider pending' },
    { label: 'Sector', value: sector },
    { label: 'Industry', value: industry },
  ];
}

function buildChartStats(meta: YahooChartMeta, quote: { close?: Array<number | null>; open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; volume?: Array<number | null> }) {
  const lastNumber = (values?: Array<number | null>) => validNumbers(values).at(-1);
  return [
    { label: 'Open', value: formatMoney(lastNumber(quote.open), meta.currency || 'USD') },
    { label: 'High', value: formatMoney(meta.regularMarketDayHigh ?? lastNumber(quote.high), meta.currency || 'USD') },
    { label: 'Low', value: formatMoney(meta.regularMarketDayLow ?? lastNumber(quote.low), meta.currency || 'USD') },
    { label: 'Prev Close', value: formatMoney(meta.previousClose ?? meta.chartPreviousClose, meta.currency || 'USD') },
    { label: 'Volume', value: formatLarge(meta.regularMarketVolume ?? lastNumber(quote.volume)) },
    { label: 'Avg Volume (30D)', value: formatLarge(meta.averageVolume) },
    { label: '52 Week Low', value: formatMoney(meta.fiftyTwoWeekLow, meta.currency || 'USD') },
    { label: '52 Week High', value: formatMoney(meta.fiftyTwoWeekHigh, meta.currency || 'USD') },
  ];
}

export const yahooTickerProfileSource: TickerProfileSource = {
  id: 'yahoo',
  label: 'Yahoo Finance chart/search adapter',
  async fetchProfile({ symbol }) {
    const [chart, search] = await Promise.all([fetchYahooChart(symbol), fetchYahooSearch(symbol)]);
    const meta = chart?.meta;
    const quote = chart?.indicators?.quote?.[0];
    if (!meta || !quote?.close?.length || meta.instrumentType !== 'EQUITY') return null;

    const sample = buildSampleTickerProfile(symbol);
    const asOf = formatAsOf(meta.regularMarketTime);
    const sourceMap = buildYahooSourceMap(asOf);
    const closes = validNumbers(quote.close);
    const price = meta.regularMarketPrice ?? closes.at(-1);
    const previousClose = closes.length >= 2 ? closes.at(-2) : meta.previousClose;
    const change = price != null && previousClose != null ? price - previousClose : 0;
    const changePct = previousClose ? (change / previousClose) * 100 : 0;
    const tone = change < 0 ? 'negative' : change > 0 ? 'positive' : 'neutral';
    const name = meta.longName || search?.longname || meta.shortName || search?.shortname || sample.name;
    const exchange = search?.exchDisp || meta.fullExchangeName || meta.exchangeName || sample.exchange;
    const companyLogo = (await fetchWikipediaCompanyLogo(symbol, name)) ?? sample.companyLogo;
    const secFundamentals = await fetchSecTickerFundamentals(symbol, sample);
    if (secFundamentals) {
      sourceMap.financials = secFundamentals.source;
      sourceMap.resources = secFundamentals.source;
      sourceMap.filings = secFundamentals.source;
    }

    const profile: TickerProfile = {
      ...sample,
      symbol: meta.symbol || symbol,
      name,
      exchange,
      currency: meta.currency || sample.currency,
      quote: {
        price: formatMoney(price, meta.currency || sample.currency),
        change: formatSigned(change),
        changePct: formatPct(changePct),
        priceTime: `Yahoo · ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(asOf))}`,
        currency: meta.currency || sample.currency,
        tone,
        source: sourceMap.quote,
      },
      headerStats: buildHeaderStats(sample, search, meta),
      companyLogo,
      priceSeries: {
        ...sample.priceSeries,
        values: compactPriceSeries(quote.close),
        axis: chartAxisFromTimestamps(chart.timestamp ?? []),
        stats: buildChartStats(meta, quote),
        source: sourceMap.prices,
      },
      companyProfile: {
        ...sample.companyProfile,
        source: sourceMap.profile,
      },
      financialHighlights: secFundamentals?.financialHighlights ?? buildFinancialHighlights(sample, sourceMap),
      cashDebtSnapshot: secFundamentals?.cashDebtSnapshot ?? buildCashDebtSnapshot(sample, sourceMap),
      balanceSheetSnapshot: secFundamentals?.balanceSheetSnapshot ?? buildBalanceSheetSnapshot(sample, sourceMap),
      recentNews: sample.recentNews.map((item) => ({ ...item, sourceMeta: sourceMap.news })),
      resources: secFundamentals?.resources ?? sample.resources.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, source: sourceMap.resources })),
      })),
      financialOverview: secFundamentals?.financialOverview ?? sample.financialOverview,
      keyRatios: secFundamentals?.keyRatios ?? sample.keyRatios,
      sourceMap,
      asOf,
      freshness: 'fresh',
    };

    return withProfileSource(profile, 'yahoo', asOf);
  },
};
