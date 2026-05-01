import type {
  TickerBalanceSheetSnapshot,
  TickerCashDebtSnapshot,
  TickerDisplayMetric,
  TickerFinancialHighlight,
  TickerNewsItem,
  TickerPriceRangeSeries,
  TickerProfile,
  TickerProfileSourceMap,
  TickerSourceMeta,
  TickerSupplementalData,
} from '../contracts';
import type { TickerProfileSource } from '../sources';
import { withProfileSource } from '../sources';
import { buildEodhdDividendMetrics, buildEodhdTechnicalMetrics, eodhdSource, fetchEodhdMarketData } from './eodhd';
import { financeDatabaseFacts, financeDatabaseSource, findFinanceDatabaseProfile } from './finance-database';
import { buildSampleTickerProfile } from './sample';
import { fetchSecTickerFundamentals } from './sec';
import { fetchWikipediaCompanyLogo, fetchWikipediaCompanyProfile } from './wikipedia';
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
  news?: YahooNewsItem[];
}

interface YahooNewsItem {
  uuid?: string;
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  type?: string;
  relatedTickers?: string[];
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

function unavailableSource(asOf: string, note: string): TickerSourceMeta {
  return {
    source: 'sample',
    asOf,
    freshness: 'missing',
    note,
  };
}

function missingYahooSource(asOf: string, note: string): TickerSourceMeta {
  return {
    source: 'yahoo',
    asOf,
    freshness: 'missing',
    note,
  };
}

function buildYahooSourceMap(asOf: string): TickerProfileSourceMap {
  return {
    quote: yahooSource(asOf, 'Yahoo Finance chart endpoint. Cached server-side.'),
    profile: yahooSource(asOf, 'Yahoo Finance search/chart metadata with sample fallback for profile narrative.'),
    prices: yahooSource(asOf, 'Yahoo Finance chart endpoint. Cached server-side.'),
    financials: sampleFallbackSource(asOf, 'Sample financial modules retained until provider-backed statements are available.'),
    news: yahooSource(asOf, 'Yahoo Finance search news. Headlines are provider-backed; summaries are omitted unless supplied by a future news provider.'),
    resources: sampleFallbackSource(asOf, 'Provider-backed links are unavailable here; SEC is US-only and the non-US filings/resources adapter is not wired yet.'),
    filings: sampleFallbackSource(asOf, 'SEC filings are US-only; the non-US filings adapter is not wired yet.'),
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

const YAHOO_PRICE_RANGES = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'] as const;

const yahooRangeParams: Record<(typeof YAHOO_PRICE_RANGES)[number], { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  YTD: { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
};

async function fetchYahooChart(symbol: string, range: (typeof YAHOO_PRICE_RANGES)[number] = '1Y') {
  const params = yahooRangeParams[range];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${params.range}&interval=${params.interval}`;
  const data = await fetchJson<YahooChartResponse>(url);
  return data?.chart?.result?.[0] ?? null;
}

async function fetchYahooSearch(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=6`;
  const data = await fetchJson<YahooSearchResponse>(url);
  const exact = data?.quotes?.find((quote) => quote.symbol?.toUpperCase() === symbol.toUpperCase());
  return {
    quote: exact ?? data?.quotes?.[0] ?? null,
    news: data?.news ?? [],
  };
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
  const quote = search?.quote;
  const sector = quote?.sectorDisp || quote?.sector || sample.headerStats.find((item) => item.label === 'Sector')?.value || '—';
  const industry = quote?.industryDisp || quote?.industry || sample.headerStats.find((item) => item.label === 'Industry')?.value || '—';
  return [
    { label: 'Market Cap', value: meta.marketCap ? `$${formatLarge(meta.marketCap)}` : 'Provider pending', status: meta.marketCap ? 'available' : 'unavailable' },
    { label: 'P/E (TTM)', value: meta.trailingPE ? meta.trailingPE.toFixed(2) : 'Provider pending', status: meta.trailingPE ? 'available' : 'unavailable' },
    { label: 'Sector', value: sector },
    { label: 'Industry', value: industry },
  ];
}

function formatNewsTime(epochSeconds: number | undefined) {
  if (!epochSeconds) return 'Time pending';
  const diffMs = Date.now() - epochSeconds * 1000;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 60) return `${diffMinutes || 1}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(epochSeconds * 1000));
}

function newsKind(type: string | undefined): TickerNewsItem['kind'] {
  const normalized = type?.toUpperCase();
  if (normalized === 'VIDEO') return 'video';
  if (normalized === 'PRESS_RELEASE') return 'press-release';
  if (normalized === 'STORY') return 'story';
  return 'news';
}

function buildYahooNews(news: YahooNewsItem[], source: TickerSourceMeta): TickerNewsItem[] {
  return news
    .filter((item) => item.title && item.link)
    .slice(0, 6)
    .map((item) => ({
      source: item.publisher ?? 'Yahoo Finance',
      time: formatNewsTime(item.providerPublishTime),
      title: item.title!,
      summary: item.relatedTickers?.length
        ? `Related tickers: ${item.relatedTickers.slice(0, 6).join(', ')}`
        : 'Provider-backed headline from Yahoo Finance. Full article opens at source.',
      url: item.link,
      sourceMeta: source,
      relatedTickers: item.relatedTickers,
      kind: newsKind(item.type),
    }));
}

function buildUnavailableSupplemental(asOf: string): TickerSupplementalData {
  const estimates = unavailableSource(asOf, 'Current EODHD plan does not include Fundamental or Calendar APIs. Analyst estimates remain a manual broker-check slot until another provider is enabled.');
  const ownership = unavailableSource(asOf, 'Ownership requires a dedicated holdings/insider adapter. EODHD Extended does not include this as a clean fundamentals feed.');
  const dividends = unavailableSource(asOf, 'Dividend feed not available for this symbol yet.');
  const technicals = unavailableSource(asOf, 'Technical market-data feed not available for this symbol yet.');
  return {
    dividends: {
      status: 'unavailable',
      note: 'No provider-backed dividend history is available for this symbol yet.',
      source: dividends,
      metrics: [],
    },
    technicals: {
      status: 'unavailable',
      note: 'No provider-backed technical/range data is available for this symbol yet.',
      source: technicals,
      metrics: [],
    },
    estimates: {
      status: 'unavailable',
      note: 'Analyst estimates are not included in the current EODHD plan. Check broker apps manually for now.',
      source: estimates,
      metrics: [],
    },
    ownership: {
      status: 'unavailable',
      note: 'Ownership and insider activity need a dedicated provider before display.',
      source: ownership,
      metrics: [],
    },
  };
}

function buildMissingNews(symbol: string, source: TickerSourceMeta): TickerNewsItem[] {
  return [
    {
      source: 'Yahoo Finance',
      time: 'Provider pending',
      title: `${symbol.toUpperCase()} headlines unavailable`,
      summary: 'Yahoo Finance returned no usable linked headlines for this ticker. Keep the slot visible for a future news provider or retry after cache refresh.',
      sourceMeta: source,
      kind: 'news',
    },
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

function formatChartTime(epochSeconds: number, intraday = false) {
  if (intraday) return epochSeconds;
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

function formatAxisForRange(timestamps: number[], range: string) {
  if (timestamps.length === 0) return [];
  const intraday = range === '1D' || range === '5D';
  const formatter = intraday
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
    : new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const indices = [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1].map((ratio) => Math.min(timestamps.length - 1, Math.round((timestamps.length - 1) * ratio)));
  return Array.from(new Set(indices)).map((index) => formatter.format(new Date(timestamps[index] * 1000)));
}

function buildRangeStats(meta: YahooChartMeta, quote: { close?: Array<number | null>; open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; volume?: Array<number | null> }, currency: string) {
  const closes = validNumbers(quote.close);
  const highs = validNumbers(quote.high);
  const lows = validNumbers(quote.low);
  const volumes = validNumbers(quote.volume);
  const first = closes.at(0);
  const last = closes.at(-1);
  const change = first != null && last != null ? last - first : null;
  const changePct = change != null && first ? (change / first) * 100 : null;
  return [
    { label: 'Range Start', value: formatMoney(first, currency) },
    { label: 'Range End', value: formatMoney(last, currency) },
    { label: 'Range Change', value: change == null ? '$—' : `${formatSigned(change)} (${formatPct(changePct ?? 0)})` },
    { label: 'Range High', value: formatMoney(highs.length ? Math.max(...highs) : undefined, currency) },
    { label: 'Range Low', value: formatMoney(lows.length ? Math.min(...lows) : undefined, currency) },
    { label: 'Range Volume', value: formatLarge(volumes.reduce((sum, item) => sum + item, 0)) },
    { label: '52 Week Low', value: formatMoney(meta.fiftyTwoWeekLow, currency) },
    { label: '52 Week High', value: formatMoney(meta.fiftyTwoWeekHigh, currency) },
  ];
}

function buildRangeSeries(range: string, chart: NonNullable<Awaited<ReturnType<typeof fetchYahooChart>>>, source: TickerSourceMeta): TickerPriceRangeSeries | null {
  const quote = chart.indicators?.quote?.[0];
  const meta = chart.meta ?? {};
  const timestamps = chart.timestamp ?? [];
  if (!quote?.close?.length || timestamps.length === 0) return null;
  const intraday = range === '1D' || range === '5D';
  const points = timestamps
    .map((timestamp, index) => {
      const close = quote.close?.[index];
      if (typeof close !== 'number' || !Number.isFinite(close)) return null;
      return { time: formatChartTime(timestamp, intraday), value: Number(close.toFixed(2)) };
    })
    .filter((item): item is { time: string | number; value: number } => Boolean(item))
    .sort((a, b) => (typeof a.time === 'number' ? a.time : Date.parse(a.time) / 1000) - (typeof b.time === 'number' ? b.time : Date.parse(b.time) / 1000));
  const dedupedPoints = Array.from(new Map(points.map((point) => [point.time, point])).values());
  if (dedupedPoints.length === 0) return null;
  return {
    range,
    points: dedupedPoints,
    axis: formatAxisForRange(timestamps, range),
    stats: buildRangeStats(meta, quote, meta.currency || 'USD'),
    source,
    status: 'available',
  };
}

async function fetchYahooRangeSeries(symbol: string, source: TickerSourceMeta) {
  const entries = await Promise.all(
    YAHOO_PRICE_RANGES.map(async (range) => {
      const chart = await fetchYahooChart(symbol, range);
      if (!chart) return null;
      const series = buildRangeSeries(range, chart, source);
      return series ? [range, series] as const : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [(typeof YAHOO_PRICE_RANGES)[number], TickerPriceRangeSeries] => Boolean(entry)));
}

export const yahooTickerProfileSource: TickerProfileSource = {
  id: 'yahoo',
  label: 'Yahoo Finance chart/search adapter',
  async fetchProfile({ symbol }) {
    const [chart, search] = await Promise.all([fetchYahooChart(symbol, '1Y'), fetchYahooSearch(symbol)]);
    const meta = chart?.meta;
    const quote = chart?.indicators?.quote?.[0];
    if (!meta || !quote?.close?.length || meta.instrumentType !== 'EQUITY') return null;

    const sample = buildSampleTickerProfile(symbol);
    const financeDatabaseProfile = findFinanceDatabaseProfile(symbol);
    const asOf = formatAsOf(meta.regularMarketTime);
    const sourceMap = buildYahooSourceMap(asOf);
    const closes = validNumbers(quote.close);
    const price = meta.regularMarketPrice ?? closes.at(-1);
    const previousClose = closes.length >= 2 ? closes.at(-2) : meta.previousClose;
    const change = price != null && previousClose != null ? price - previousClose : 0;
    const changePct = previousClose ? (change / previousClose) * 100 : 0;
    const tone = change < 0 ? 'negative' : change > 0 ? 'positive' : 'neutral';
    const searchQuote = search?.quote;
    const name = meta.longName || searchQuote?.longname || meta.shortName || searchQuote?.shortname || sample.name;
    const exchange = searchQuote?.exchDisp || meta.fullExchangeName || meta.exchangeName || sample.exchange;
    const eodhdSymbol = searchQuote?.symbol && !symbol.includes('.') ? searchQuote.symbol : symbol;
    const [companyLogoResult, companyProfileResult, yahooRangeSeries, eodhdMarketData, secFundamentals, yfinanceData] = await Promise.all([
      fetchWikipediaCompanyLogo(symbol, name),
      fetchWikipediaCompanyProfile(symbol, name, sample.companyProfile.facts),
      fetchYahooRangeSeries(symbol, sourceMap.prices),
      fetchEodhdMarketData(eodhdSymbol),
      fetchSecTickerFundamentals(symbol, sample),
      fetchYfinanceBridge(symbol),
    ]);
    const companyLogo = companyLogoResult ?? sample.companyLogo;
    const yfinanceMetaSource = yfinanceData ? yfinanceSource(yfinanceData.asOf, yfinanceData.sourceNote) : null;
    const companyProfile = companyProfileResult?.profile ?? { ...sample.companyProfile, source: sourceMap.profile };
    if (financeDatabaseProfile) {
      companyProfile.facts = mergeFacts(companyProfile.facts, financeDatabaseFacts(financeDatabaseProfile));
      if (!companyProfileResult) companyProfile.source = financeDatabaseSource('FinanceDatabase static equities index used for company reference facts.');
    }
    if (yfinanceData?.facts?.length) {
      companyProfile.facts = mergeFacts(companyProfile.facts, yfinanceData.facts);
      if (!companyProfileResult && yfinanceMetaSource) companyProfile.source = yfinanceMetaSource;
    }
    if (companyProfileResult) {
      sourceMap.profile = companyProfileResult.profile.source;
    }
    if (secFundamentals) {
      sourceMap.financials = secFundamentals.source;
      sourceMap.resources = secFundamentals.source;
      sourceMap.filings = secFundamentals.source;
    }
    const providerRangeSeries = eodhdMarketData?.priceSeries?.rangeSeries ?? yahooRangeSeries;
    if (eodhdMarketData?.priceSeries) {
      sourceMap.prices = eodhdMarketData.source;
      sourceMap.news = eodhdMarketData.news.length ? eodhdMarketData.source : sourceMap.news;
    }
    const yahooNews = buildYahooNews(search.news, sourceMap.news);
    const providerNews = eodhdMarketData?.news.length ? eodhdMarketData.news : yahooNews;
    if (!providerNews.length) {
      sourceMap.news = missingYahooSource(asOf, 'Market-data providers returned no usable linked headlines for this ticker. No sample headlines are shown for provider-backed symbols.');
    }
    const supplemental = buildUnavailableSupplemental(asOf);
    if (yfinanceMetaSource) {
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
    }
    if (eodhdMarketData) {
      const dividendMetrics = buildEodhdDividendMetrics(eodhdMarketData);
      supplemental.dividends = {
        status: dividendMetrics.some((metric) => metric.status === 'available') ? 'available' : 'unavailable',
        note: 'Historical dividends from EODHD Extended. Upcoming calendar events are not included in this plan.',
        source: eodhdMarketData.source,
        metrics: dividendMetrics,
      };
      const technicalMetrics = buildEodhdTechnicalMetrics(eodhdMarketData, meta.currency || sample.currency);
      supplemental.technicals = {
        status: technicalMetrics.some((metric) => metric.status === 'available') ? 'available' : 'unavailable',
        note: 'Range-derived technical context from EODHD EOD/intraday data.',
        source: eodhdMarketData.source,
        metrics: technicalMetrics,
      };
    } else {
      supplemental.dividends.source = eodhdSource(asOf, 'EODHD token missing or provider returned no rows for this symbol.', 'missing');
      supplemental.technicals.source = eodhdSource(asOf, 'EODHD token missing or provider returned no rows for this symbol.', 'missing');
    }

    const yfinanceFinancialsMissingOnly = !secFundamentals && yfinanceMetaSource;
    const yfinanceHighlights = yfinanceFinancialsMissingOnly ? yfinanceFinancialHighlights(yfinanceData, yfinanceMetaSource) : [];
    const yfinanceCashDebt = yfinanceFinancialsMissingOnly ? yfinanceCashDebtSnapshot(yfinanceData, yfinanceMetaSource) : null;
    const yfinanceBalanceSheet = yfinanceFinancialsMissingOnly ? yfinanceBalanceSheetSnapshot(yfinanceData, yfinanceMetaSource) : null;
    const yfinanceOverview = yfinanceFinancialsMissingOnly ? yfinanceFinancialOverview(yfinanceData) : null;

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
      headerStats: mergeHeaderStats(buildHeaderStats(sample, search, meta), yfinanceData?.headerStats, yfinanceMetaSource ?? sourceMap.profile),
      companyLogo,
      priceSeries: {
        ...sample.priceSeries,
        values: eodhdMarketData?.priceSeries?.values ?? compactPriceSeries(quote.close),
        ranges: eodhdMarketData?.priceSeries?.ranges ?? (YAHOO_PRICE_RANGES.filter((range) => providerRangeSeries[range]).length ? YAHOO_PRICE_RANGES.filter((range) => providerRangeSeries[range]) : sample.priceSeries.ranges),
        activeRange: eodhdMarketData?.priceSeries?.activeRange ?? (providerRangeSeries['1Y'] ? '1Y' : Object.keys(providerRangeSeries)[0] ?? sample.priceSeries.activeRange),
        axis: eodhdMarketData?.priceSeries?.axis ?? providerRangeSeries['1Y']?.axis ?? chartAxisFromTimestamps(chart.timestamp ?? []),
        stats: eodhdMarketData?.priceSeries?.stats ?? providerRangeSeries['1Y']?.stats ?? buildChartStats(meta, quote),
        source: sourceMap.prices,
        rangeSeries: providerRangeSeries,
      },
      companyProfile,
      financialHighlights: secFundamentals?.financialHighlights ?? (yfinanceHighlights.length ? yfinanceHighlights : buildFinancialHighlights(sample, sourceMap)),
      cashDebtSnapshot: secFundamentals?.cashDebtSnapshot ?? (yfinanceCashDebt ?? buildCashDebtSnapshot(sample, sourceMap)),
      balanceSheetSnapshot: secFundamentals?.balanceSheetSnapshot ?? (yfinanceBalanceSheet ?? buildBalanceSheetSnapshot(sample, sourceMap)),
      recentNews: providerNews.length ? providerNews : buildMissingNews(symbol, sourceMap.news),
      resources: secFundamentals?.resources ?? sample.resources.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, source: sourceMap.resources })),
      })),
      financialOverview: secFundamentals?.financialOverview ?? (yfinanceOverview ?? sample.financialOverview),
      keyRatios: secFundamentals?.keyRatios ?? (
        yfinanceMetaSource
          ? mergeKeyRatiosFromFundamentals(mergeKeyRatios(sample.keyRatios, yfinanceData?.keyRatios, yfinanceMetaSource), yfinanceData, yfinanceMetaSource)
          : sample.keyRatios
      ),
      supplemental,
      sourceMap,
      asOf,
      freshness: 'fresh',
    };

    return withProfileSource(profile, 'yahoo', asOf);
  },
};
