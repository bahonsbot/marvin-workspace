import Link from 'next/link';
import { MarketTapeClient } from '@/components/pages/trading/MarketTapeClient';
import { TickerPriceChart } from '@/components/pages/trading/TickerPriceChart';
import { TickerQuoteRefresh } from '@/components/pages/trading/TickerQuoteRefresh';
import { TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import { getMarketTape } from '@/lib/trading/market-tape';
import { getTickerProfile } from '@/lib/trading/ticker-profile';
import type { TickerBalanceSheetSnapshot, TickerDataStatus, TickerDisplayMetric, TickerFinancialHighlight, TickerFinancialOverview, TickerProfileFact, TickerSourceMeta, TickerSupplementalSection } from '@/lib/trading/contracts';

type SparklineTone = 'positive' | 'negative' | 'neutral';

type SectionNavItem = { label: string; href: string; status?: TickerDataStatus; note?: string };

const requiredFinancialHighlights = [
  'Revenue',
  'Net Income',
  'Gross Margin',
  'Operating Margin',
  'EPS',
  'Free Cash Flow',
  'ROE',
  'ROIC',
  'Debt / Equity',
  'Current Ratio',
];

const unavailableHighlightSource = {
  source: 'sample' as const,
  asOf: new Date(0).toISOString(),
  freshness: 'missing' as const,
  note: 'No reliable provider-backed value is available yet. Keep the metric visible for future fundamentals coverage.',
};

const financeGlossaryItems = [
  {
    term: 'P/E',
    meaning: 'Price divided by earnings per share. A quick valuation check, but weak when earnings are cyclical or temporarily depressed.',
  },
  {
    term: 'Forward P/E',
    meaning: 'Price divided by expected earnings. Useful for expectations, fragile when analyst forecasts move.',
  },
  {
    term: 'EV / EBITDA',
    meaning: 'Enterprise value versus operating earnings before depreciation and amortization. Helps compare companies with different debt loads.',
  },
  {
    term: 'Gross margin',
    meaning: 'Revenue left after direct production costs. Higher margins usually mean stronger pricing power or better cost control.',
  },
  {
    term: 'Operating margin',
    meaning: 'Profitability after operating costs, before interest and taxes. Good for judging core business efficiency.',
  },
  {
    term: 'EPS',
    meaning: 'Earnings per share. The profit assigned to each share, useful but easy to distort with buybacks or one-off items.',
  },
  {
    term: 'Free cash flow',
    meaning: 'Cash left after operations and capital spending. Often cleaner than accounting profit for debt, dividends, and reinvestment capacity.',
  },
  {
    term: 'ROE / ROIC',
    meaning: 'Returns on equity or invested capital. They show how efficiently management turns capital into profit.',
  },
  {
    term: 'Debt / Equity',
    meaning: 'Debt compared with shareholder equity. Higher values can amplify returns, but also increase refinancing and downturn risk.',
  },
  {
    term: 'Current ratio',
    meaning: 'Current assets divided by current liabilities. A rough liquidity check for near-term obligations.',
  },
];

function makeSectionNav(): SectionNavItem[] {
  return [
    { label: 'Overview', href: '#overview' },
    { label: 'Price', href: '#price-history' },
    { label: 'Profile', href: '#company-profile', status: 'partial', note: 'Provider enrichment pending' },
    { label: 'Financials', href: '#financial-highlights' },
    { label: 'Balance Sheet', href: '#balance-sheet' },
    { label: 'News', href: '#recent-news', status: 'partial', note: 'Provider decision pending' },
    { label: 'Filings', href: '#resources' },
    { label: 'Ratios', href: '#key-ratios', status: 'partial' },
    { label: 'Estimates', href: '#estimates', status: 'unavailable' },
    { label: 'Dividends', href: '#dividends', status: 'unavailable' },
    { label: 'Ownership', href: '#ownership', status: 'unavailable' },
    { label: 'Glossary', href: '#finance-glossary' },
  ];
}

function SectionJumpNav({ items }: { items: SectionNavItem[] }) {
  return (
    <nav className="trading-section-jump-row" aria-label="Ticker page sections">
      {items.map((item, index) => (
        <a key={item.href} href={item.href} className={`${index === 0 ? 'active' : ''} ${item.status === 'unavailable' ? 'unavailable' : ''}`} title={item.note}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}


function sourceLabel(source: TickerSourceMeta['source']) {
  if (source === 'eodhd') return 'EODHD';
  if (source === 'yahoo') return 'Yahoo Finance';
  if (source === 'yfinance') return 'yfinance';
  if (source === 'xbrl') return 'filings.xbrl.org';
  if (source === 'dart') return 'DART';
  if (source === 'mops') return 'MOPS';
  return source.toUpperCase();
}

function formatCaptionSource(source: TickerSourceMeta | undefined, options: { includeUpdated?: boolean } = {}) {
  if (!source) return 'Source: Provider pending';
  const label = sourceLabel(source.source);
  if (!options.includeUpdated || !source.asOf) return `Source: ${label}`;
  const date = new Date(source.asOf);
  if (Number.isNaN(date.getTime())) return `Source: ${label}`;
  const updated = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
  return `Source: ${label} · Updated: ${updated}`;
}



function normalizeCompanyName(value: string) {
  return value.replace(/\s+N\.\s*V\.?/gi, ' N.V.').replace(/\s+/g, ' ').trim();
}

function profileSummaryText(summary: string, displayName: string) {
  const normalizedSummary = normalizeCompanyName(summary);
  const normalizedName = normalizeCompanyName(displayName);
  if (!normalizedSummary || normalizedSummary === normalizedName) return null;
  return normalizedSummary;
}

function metricCurrency(metrics: TickerDisplayMetric[] = []) {
  for (const metric of metrics) {
    const match = /^([A-Z]{3})\s+/.exec(metric.value);
    if (match) return match[1];
  }
  return null;
}

function normalizeMetricCurrencies(metrics: TickerDisplayMetric[], currency?: string) {
  if (!currency) return metrics;
  return metrics.map((metric) => ({ ...metric, value: metric.value.replace(/^[A-Z]{3}\s+/, `${currency} `) }));
}

function normalizeSupplementalCurrencies(section: TickerSupplementalSection | undefined, currency?: string): TickerSupplementalSection | undefined {
  if (!section || !currency) return section;
  return { ...section, metrics: normalizeMetricCurrencies(section.metrics, currency) };
}

function sourceList(metrics: Array<{ source?: TickerSourceMeta }> = [], fallback?: TickerSourceMeta) {
  const labels = new Set<string>();
  for (const metric of metrics) {
    if (!metric.source?.source) continue;
    labels.add(sourceLabel(metric.source.source));
  }
  if (!labels.size && fallback?.source) labels.add(sourceLabel(fallback.source));
  return labels.size ? `Sources: ${Array.from(labels).join(', ')}` : 'Sources: Provider pending';
}


function compactSourceList(metrics: Array<{ source?: TickerSourceMeta; status?: TickerDataStatus }> = [], fallback?: TickerSourceMeta) {
  const eligible = metrics.filter((metric) => metric.status !== 'unavailable' && metric.source?.source !== 'sample');
  return sourceList(eligible, eligible.length ? undefined : fallback).replace('Sources:', 'Source:');
}

function cleanYearLabel(value: string) {
  return value.slice(0, 4);
}

function keyRatioHighlightKey(label: string) {
  const normalized = normalizeHighlightLabel(label);
  if (normalized === 'return on equity') return 'roe';
  return normalized;
}

function highlightedRatioLabels(metrics: TickerFinancialHighlight[]) {
  return new Set(buildFinancialHighlightSlots(metrics)
    .filter((metric) => metric.status !== 'unavailable' && metric.value !== 'Unavailable')
    .map((metric) => normalizeHighlightLabel(metric.label)));
}

function cleanProfileFacts(facts: TickerProfileFact[]) {
  const hidden = new Set(['wikidata', 'industry group', 'company name', 'quote type', 'sector', 'industry', 'currency']);
  const preferred = new Map<string, TickerProfileFact>();
  for (const fact of facts) {
    const key = fact.label.trim().toLowerCase();
    if (hidden.has(key)) continue;
    const current = preferred.get(key);
    if (!current || current.value === 'Provider pending' || current.value.length > fact.value.length) preferred.set(key, fact);
  }
  return Array.from(preferred.values());
}

function profileFactValue(fact: TickerProfileFact) {
  if (fact.label.toLowerCase() !== 'website' || !fact.value || fact.value === 'Provider pending') return fact.value;
  const href = /^https?:\/\//i.test(fact.value) ? fact.value : `https://${fact.value}`;
  return <a href={href} target="_blank" rel="noreferrer">{fact.value.replace(/^https?:\/\//i, '')}</a>;
}

function titleFromProfile(tickerName: string, summary: string, facts: TickerProfileFact[]) {
  if (!tickerName.includes('.')) return tickerName;
  const companyName = facts.find((fact) => fact.label.toLowerCase() === 'company name')?.value;
  if (companyName) return normalizeCompanyName(companyName);
  const firstSentence = normalizeCompanyName(summary.split(/\.\s+/)[0] ?? '');
  if (firstSentence && firstSentence.length <= 80 && !firstSentence.includes('Provider-backed')) return firstSentence;
  return tickerName;
}

function normalizeHeaderStats(stats: TickerDisplayMetric[], facts: TickerProfileFact[]) {
  const quoteType = facts.find((fact) => fact.label.toLowerCase() === 'quote type')?.value;
  return stats.map((stat) => {
    if (stat.label !== 'Type') return stat;
    if (!quoteType || quoteType === 'Provider pending') return stat;
    const value = quoteType.toLowerCase() === 'equity' ? 'Equity' : quoteType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return { ...stat, value, status: 'available' as const, note: undefined };
  });
}

function stripMetricSourceNotes(metrics: TickerDisplayMetric[]) {
  return metrics.map((metric) => ({ ...metric, note: undefined, source: undefined }));
}

function EmptySectionState({ note = 'Data not available' }: { note?: string }) {
  return (
    <div className="trading-section-empty-state">
      <strong>Data not available</strong>
      {note !== 'Data not available' ? <p>{note}</p> : null}
    </div>
  );
}

function normalizeHighlightLabel(label: string) {
  return label.replace(/\s*\(TTM\)/gi, '').trim().toLowerCase();
}

function buildFinancialHighlightSlots(metrics: TickerFinancialHighlight[]) {
  const byLabel = new Map(metrics.map((metric) => [normalizeHighlightLabel(metric.label), metric]));
  return requiredFinancialHighlights.map((label) => {
    const metric = byLabel.get(normalizeHighlightLabel(label));
    if (metric) return { ...metric, label: metric.label.replace(/\s*\(TTM\)/gi, '') };
    return {
      label,
      value: 'Unavailable',
      delta: '',
      tone: 'neutral' as const,
      trend: [],
      source: unavailableHighlightSource,
      status: 'unavailable' as const,
      note: undefined,
    };
  });
}

function EmptySparkline({ label }: { label: string }) {
  return (
    <div className="trading-empty-sparkline" role="img" aria-label={`${label} trend unavailable`} />
  );
}

function TickerMark({ symbol, logoUrl, logoAlt }: { symbol: string; logoUrl: string | null; logoAlt: string }) {
  return (
    <div className={`trading-ticker-mark ${logoUrl ? 'has-logo' : 'initials-only'}`} aria-hidden={logoUrl ? undefined : true}>
      {logoUrl ? <img src={logoUrl} alt={logoAlt} loading="lazy" decoding="async" /> : <span>{symbol.slice(0, 2)}</span>}
    </div>
  );
}

function SmallSparkline({ values, years = [], tone = 'positive' }: { values: number[]; years?: string[]; tone?: SparklineTone }) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (cleanValues.length < 2) return <EmptySparkline label="trend" />;
  const width = 112;
  const height = 34;
  const max = Math.max(...cleanValues);
  const min = Math.min(...cleanValues);
  const points = cleanValues
    .map((value, index) => {
      const x = (index / Math.max(cleanValues.length - 1, 1)) * (width - 4) + 2;
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPoints = `2,${height - 3} ${points} ${width - 2},${height - 3}`;
  const firstYear = years[0] ? cleanYearLabel(years[0]) : null;
  const lastYear = years.at(-1) ? cleanYearLabel(years.at(-1)!) : null;

  return (
    <div className="trading-small-sparkline-wrap">
      <svg className={`trading-small-sparkline ${tone}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polygon points={areaPoints} />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {firstYear && lastYear ? (
        <div className="trading-highlight-years" aria-hidden="true">
          <span>{firstYear}</span>
          <span>{lastYear}</span>
        </div>
      ) : null}
    </div>
  );
}


function StackedRatioBar({ cashPercent, debtPercent }: { cashPercent: number; debtPercent: number }) {
  return (
    <div className="trading-cash-debt-ratio" aria-label={`Cash ${cashPercent} percent, debt ${debtPercent} percent`}>
      <div className="trading-cash-debt-ratio-labels">
        <span>Cash {cashPercent}%</span>
        <span>Debt {debtPercent}%</span>
      </div>
      <div className="trading-cash-debt-bar" aria-hidden="true">
        <i style={{ width: `${cashPercent}%` }} />
        <b style={{ width: `${debtPercent}%` }} />
      </div>
    </div>
  );
}

function BalanceSheetBars({ snapshot }: { snapshot: TickerBalanceSheetSnapshot }) {
  const max = Math.max(
    ...snapshot.annual.flatMap((item) => [item.totalAssets, item.totalLiabilities, item.shareholderEquity, item.cashAndEquivalents, item.totalDebt]),
    1,
  );

  return (
    <div className="trading-balance-sheet-stack">
      <div className="trading-balance-bars" aria-label="Annual assets, liabilities, and shareholder equity chart">
        {snapshot.annual.map((item) => (
          <div key={item.fiscalYear} className="trading-balance-bars-group">
            <div className="trading-balance-bars-triplet">
              <i style={{ height: `${(item.totalAssets / max) * 100}%` }} aria-label={`${item.fiscalYear} assets`} />
              <b style={{ height: `${(item.totalLiabilities / max) * 100}%` }} aria-label={`${item.fiscalYear} liabilities`} />
              <em style={{ height: `${(item.shareholderEquity / max) * 100}%` }} aria-label={`${item.fiscalYear} equity`} />
            </div>
            <span>{item.fiscalYear}</span>
          </div>
          ))}
      </div>

      <div className="trading-cash-debt-trend" aria-label="Annual cash versus debt chart">
        {snapshot.annual.map((item) => (
          <div key={item.fiscalYear} className="trading-cash-debt-trend-group">
            <div>
              <i style={{ height: `${(item.cashAndEquivalents / max) * 100}%` }} aria-label={`${item.fiscalYear} cash and equivalents`} />
              <b style={{ height: `${(item.totalDebt / max) * 100}%` }} aria-label={`${item.fiscalYear} total debt`} />
            </div>
            <span>{item.fiscalYear}</span>
          </div>
          ))}
      </div>
    </div>
  );
}

function cleanEstimateValue(value: string) {
  return value.replace(/^[A-Z]{3}\s+/, '');
}

function parseNumber(value: string) {
  const cleaned = value.replace(/^[A-Z]{3}\s+/, '').replace(/,/g, '').replace(/%$/, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRecommendationTrend(value: string) {
  const labels: Record<string, string> = {
    strongBuy: 'Strong buy',
    buy: 'Buy',
    hold: 'Hold',
    sell: 'Sell',
    strongSell: 'Strong sell',
  };
  return value.split('·').map((part) => {
    const [rawKey, rawValue] = part.trim().split(':').map((item) => item.trim());
    const count = Number(rawValue);
    return { key: rawKey, label: labels[rawKey] ?? rawKey, count: Number.isFinite(count) ? count : 0 };
  }).filter((item) => item.key);
}

function EstimatesPanel({ section }: { section?: TickerSupplementalSection }) {
  if (!section || !section.metrics.length) {
    return <EmptySectionState note={section?.note ?? 'Provider-backed data is not available for this module yet.'} />;
  }

  const metrics = stripMetricSourceNotes(section.metrics);
  const targetMetrics = metrics
    .filter((metric) => metric.label.toLowerCase().startsWith('target '))
    .map((metric) => ({ ...metric, numeric: parseNumber(metric.value) }))
    .filter((metric) => metric.numeric != null) as Array<TickerDisplayMetric & { numeric: number }>;
  const sortedTargets = [...targetMetrics].sort((a, b) => a.numeric - b.numeric);
  const minTarget = sortedTargets[0]?.numeric ?? 0;
  const maxTarget = sortedTargets.at(-1)?.numeric ?? 1;
  const meanTarget = targetMetrics.find((metric) => metric.label === 'Target mean');
  const recommendation = metrics.find((metric) => metric.label === 'Recommendation');
  const analystCount = metrics.find((metric) => metric.label === 'Analyst count');
  const trendMetric = metrics.find((metric) => metric.label === 'Recommendation trend');
  const trend = trendMetric ? parseRecommendationTrend(trendMetric.value) : [];
  const trendTotal = trend.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="trading-estimates-panel">
      <div className="trading-estimate-summary-row compact">
        <div>
          <span>Consensus</span>
          <strong>{recommendation?.value ?? 'Unavailable'}</strong>
        </div>
        <div>
          <span>Analysts</span>
          <strong>{analystCount?.value ?? '—'}</strong>
        </div>
        {meanTarget ? (
          <div>
            <span>Mean</span>
            <strong>{cleanEstimateValue(meanTarget.value)}</strong>
          </div>
        ) : null}
      </div>

      {sortedTargets.length ? (
        <div className="trading-estimate-range-card">
          <div className="trading-estimate-range-head">
            <span>Price target range</span>
          </div>
          <div className="trading-estimate-range-rail" aria-label="Analyst target range">
            {[sortedTargets[0], meanTarget, sortedTargets.at(-1)].filter(Boolean).map((metric) => {
              const left = maxTarget === minTarget ? 50 : ((metric!.numeric - minTarget) / (maxTarget - minTarget)) * 100;
              return <i key={metric!.label} style={{ left: `${left}%` }} title={`${metric!.label}: ${metric!.value}`} />;
            })}
          </div>
          <dl className="trading-estimate-target-table ordered">
            {[sortedTargets[0], meanTarget, sortedTargets.at(-1)].filter(Boolean).map((metric) => (
              <div key={metric!.label}>
                <dt>{metric!.label.replace('Target ', '').replace(/^./, (letter) => letter.toUpperCase())}</dt>
                <dd>{cleanEstimateValue(metric!.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {trend.length ? (
        <div className="trading-recommendation-stack">
          <div className="trading-recommendation-bar tall" aria-label="Recommendation trend">
            {trend.map((item) => (
              <i key={item.key} className={`rec-${item.key}`} style={{ width: `${trendTotal ? (item.count / trendTotal) * 100 : 0}%` }} title={`${item.label}: ${item.count}`}>
                <span>{item.count ? `${item.label} ${item.count}` : ''}</span>
              </i>
            ))}
          </div>
        </div>
      ) : null}

      <p className="trading-financial-caption">{sourceList(section.metrics, section.source)}</p>
    </div>
  );
}

function EpsPanel({ section }: { section?: TickerSupplementalSection }) {
  const metrics = stripMetricSourceNotes(section?.metrics ?? []).filter((metric) => metric.label.toLowerCase().startsWith('eps'));
  if (!metrics.length) return <EmptySectionState note="EPS estimates are not available from the current provider." />;
  return (
    <>
      <dl className="trading-estimate-eps-row standalone">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label.replace('EPS ', '')}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
      <p className="trading-financial-caption">{sourceList(section?.metrics ?? [], section?.source)}</p>
    </>
  );
}

function SupplementalDataPanel({ section }: { section?: TickerSupplementalSection }) {
  if (!section || !section.metrics.length) {
    return <EmptySectionState note={section?.note ?? 'Provider-backed data is not available for this module yet.'} />;
  }

  const metrics = stripMetricSourceNotes(section.metrics);

  return (
    <>
      <dl className="trading-supplemental-metric-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className={metric.status === 'unavailable' ? 'is-unavailable' : undefined}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            {metric.note ? <p>{metric.note}</p> : null}
          </div>
        ))}
      </dl>
      <p className="trading-financial-caption">{sourceList(section.metrics, section.source)}</p>
    </>
  );
}

function FinancialBarChart({ overview }: { overview: TickerFinancialOverview }) {
  const series = overview.bars;
  const max = Math.max(...series.map((item) => Math.max(Math.abs(item.revenue), Math.abs(item.netIncome))), 1);
  return (
    <>
      <div className={`trading-financial-bars ${series.length ? '' : 'is-empty'}`} aria-label="Annual revenue and net income chart">
        {series.length ? series.map((item) => (
          <div key={item.year} className="trading-financial-bar-group">
            <div className="trading-financial-bars-pair">
              <i style={{ height: `${Math.max((Math.abs(item.revenue) / max) * 100, 2)}%` }} aria-label={`${item.year} revenue`} />
              <b style={{ height: `${Math.max((Math.abs(item.netIncome) / max) * 100, 2)}%` }} aria-label={`${item.year} net income`} data-negative={item.netIncome < 0 ? 'true' : undefined} />
            </div>
            <span>{item.year}</span>
          </div>
        )) : <div className="trading-chart-unavailable">Data unavailable</div>}
      </div>
    </>
  );
}

export default async function TradingTickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  const [profileResult, marketTapeResult] = await Promise.allSettled([getTickerProfile(upperSymbol), getMarketTape()]);
  const ticker = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const marketTape = marketTapeResult.status === 'fulfilled' ? marketTapeResult.value : null;

  if (!ticker) {
    return (
      <TradingPageFrame
        title="Ticker not supported yet"
        description={`${upperSymbol} did not resolve through the active market-data providers. No placeholder company profile is shown.`}
        hideHeader
      >
        {marketTape ? <MarketTapeClient initialData={marketTape} /> : null}

        <Link href="/trading" className="trading-ticker-back">
          ← Back to Overview
        </Link>

        <section id="overview" className="trading-ticker-quote-panel">
          <div className="trading-ticker-identity">
            <TickerMark symbol={upperSymbol} logoUrl={null} logoAlt={`${upperSymbol} logo`} />
            <div>
              <h1>Ticker not supported yet</h1>
              <p>{upperSymbol} <span>·</span> Provider-backed data unavailable</p>
            </div>
          </div>
        </section>

        <section style={tradingCardStyle({ minHeight: 260, maxHeight: 'none' })}>
          <div className="trading-section-label">Unsupported symbol</div>
          <EmptySectionState note="This ticker did not resolve through EODHD, Yahoo/yfinance, SEC, or the official non-US filings adapters. Try the provider-backed symbol if this is an alias or alternate listing, for example INGA.AS instead of ING.AS." />
        </section>
      </TradingPageFrame>
    );
  }

  const rawProfileFacts = ticker.companyProfile.facts;
  const profileFacts = cleanProfileFacts(rawProfileFacts);
  const displayName = titleFromProfile(ticker.name, ticker.companyProfile.summary, rawProfileFacts);
  const headerStats = normalizeHeaderStats(ticker.headerStats, rawProfileFacts);
  const profileFactsByLabel = new Map(profileFacts.map((fact) => [fact.label.toLowerCase(), fact]));
  for (const stat of headerStats) {
    const key = stat.label.toLowerCase();
    if (key === 'country' && stat.value && stat.value !== 'Provider pending') {
      profileFactsByLabel.set(key, { label: stat.label, value: stat.value });
    }
  }
  const displayProfileFacts = Array.from(profileFactsByLabel.values()).filter((fact) => !['sector', 'industry', 'currency'].includes(fact.label.trim().toLowerCase()));
  const financialHighlightSlots = buildFinancialHighlightSlots(ticker.financialHighlights);
  const visibleHighlightRatioLabels = highlightedRatioLabels(ticker.financialHighlights);
  const keyRatios = stripMetricSourceNotes(ticker.keyRatios).filter((ratio) => !visibleHighlightRatioLabels.has(keyRatioHighlightKey(ratio.label)));
  const hasResources = ticker.resources.some((group) => group.items.length);
  const profileSummary = profileSummaryText(ticker.companyProfile.summary, displayName);
  const displayCurrency = ticker.currency || metricCurrency(ticker.supplemental?.estimates.metrics) || metricCurrency(ticker.supplemental?.dividends.metrics) || undefined;
  const priceRangeSeries = ticker.priceSeries.rangeSeries
    ? Object.fromEntries(Object.entries(ticker.priceSeries.rangeSeries).map(([range, series]) => [range, { ...series, stats: normalizeMetricCurrencies(series.stats, displayCurrency) }]))
    : undefined;
  const estimatesSection = normalizeSupplementalCurrencies(ticker.supplemental?.estimates, displayCurrency);
  const dividendsSection = normalizeSupplementalCurrencies(ticker.supplemental?.dividends, displayCurrency);
  const technicalsSection = normalizeSupplementalCurrencies(ticker.supplemental?.technicals, displayCurrency);


  return (
    <TradingPageFrame
      title={`${ticker.name} (${upperSymbol})`}
      description="Static BOILER ROOM ticker research object. Live provider wiring comes later through a server-side cached ticker profile adapter."
      hideHeader
    >
      {marketTape ? <MarketTapeClient initialData={marketTape} /> : null}

      <Link href="/trading" className="trading-ticker-back">
        ← Back to Overview
      </Link>

      <section id="overview" className="trading-ticker-quote-panel">
        <div className="trading-ticker-identity">
          <TickerMark symbol={upperSymbol} logoUrl={ticker.companyLogo.url} logoAlt={ticker.companyLogo.alt} />
          <div>
            <h1>{displayName}</h1>
            <p>
              {upperSymbol} <span>·</span> {ticker.exchange}
            </p>
          </div>
        </div>

        <TickerQuoteRefresh initialQuote={ticker.quote} symbol={ticker.symbol} />

        <dl className="trading-ticker-stat-strip">
          {headerStats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="trading-ticker-tabs-row">
        <SectionJumpNav items={makeSectionNav()} />
        <button type="button" className={`trading-watchlist-toggle ${ticker.inWatchlist ? 'in-watchlist' : 'not-watched'}`}>
          {ticker.inWatchlist ? '− Watchlist' : '+ Watchlist'}
        </button>
      </div>

      <div className="trading-ticker-primary-grid">
        <section id="price-history" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-section-head trading-ticker-chart-head">
            <div>
              <div className="trading-section-label">Price history</div>
            </div>
          </div>
          <TickerPriceChart ranges={ticker.priceSeries.ranges} activeRange={ticker.priceSeries.activeRange} rangeSeries={priceRangeSeries} />
        </section>

        <section id="company-profile" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-section-label">Company profile</div>
          {profileSummary ? <p className="trading-ticker-profile-copy">{profileSummary}</p> : null}
          <dl className="trading-profile-facts">
            {displayProfileFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{profileFactValue(fact)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section id="financial-highlights" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-section-head">
          <div>
            <div className="trading-section-label">Financial highlights</div>
          </div>
          <span className="trading-ticker-source-note">{compactSourceList(financialHighlightSlots, ticker.sourceMap.financials)}</span>
        </div>
        <div className="trading-financial-highlight-grid">
          {financialHighlightSlots.map((metric) => (
            <article key={metric.label} className={`trading-financial-highlight-card ${metric.status === 'unavailable' ? 'is-unavailable' : ''}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              {metric.status !== 'unavailable' && metric.delta ? <em className={metric.tone}>{metric.delta}</em> : null}
              {metric.status !== 'unavailable' && metric.trend.length ? <SmallSparkline values={metric.trend} years={metric.trendYears} tone={metric.tone as SparklineTone} /> : null}
            </article>
          ))}
        </div>
      </section>

      <div className="trading-ticker-balance-grid">
        <section id="cash-debt" style={tradingCardStyle({ minHeight: 360, maxHeight: 'none' })}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Cash & Debt</div>
              <h2>{ticker.cashDebtSnapshot.interpretation}</h2>
            </div>
            <span className="trading-ticker-source-note">{ticker.cashDebtSnapshot.period}</span>
          </div>
          <StackedRatioBar cashPercent={ticker.cashDebtSnapshot.cashPercent} debtPercent={ticker.cashDebtSnapshot.debtPercent} />
          <dl className="trading-cash-debt-list">
            <div>
              <dt>Total Cash</dt>
              <dd>{ticker.cashDebtSnapshot.totalCash}</dd>
            </div>
            <div>
              <dt>Total Debt</dt>
              <dd>{ticker.cashDebtSnapshot.totalDebt}</dd>
            </div>
            <div>
              <dt>{ticker.cashDebtSnapshot.netCashLabel}</dt>
              <dd>{ticker.cashDebtSnapshot.netCash}</dd>
            </div>
            <div>
              <dt>Free Cash Flow</dt>
              <dd>{ticker.cashDebtSnapshot.freeCashFlow}</dd>
            </div>
            <div>
              <dt>Operating Cash Flow</dt>
              <dd>{ticker.cashDebtSnapshot.operatingCashFlow}</dd>
            </div>
          </dl>
          <p className="trading-financial-caption">{formatCaptionSource(ticker.cashDebtSnapshot.source)}</p>
        </section>

        <section id="balance-sheet" style={tradingCardStyle({ minHeight: 420, maxHeight: 'none' })}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Balance sheet</div>
              <h2>Assets, liabilities, equity</h2>
            </div>
            <div className="trading-financial-legend trading-balance-legend" aria-hidden="true">
              <span><i /> Assets</span>
              <span><b /> Liabilities</span>
              <span><em /> Equity</span>
            </div>
          </div>
          <div className="trading-balance-kpi-grid">
            {ticker.balanceSheetSnapshot.kpis.map((kpi) => (
              <article key={kpi.label} className={kpi.tone}>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <p>{kpi.caption}</p>
              </article>
            ))}
          </div>
          <BalanceSheetBars snapshot={ticker.balanceSheetSnapshot} />
          <p className="trading-financial-caption">{formatCaptionSource(ticker.balanceSheetSnapshot.source)}</p>
        </section>
      </div>

      <div className="trading-ticker-secondary-grid">
        <section id="recent-news" style={tradingCardStyle({ minHeight: 360, maxHeight: 'none' })}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Recent news</div>
            </div>
            <Link href="/trading/news" className="trading-text-link">
              View all →
            </Link>
          </div>
          <div className="trading-ticker-news-list">
            {ticker.recentNews.map((item) => (
              <article key={item.title}>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" aria-label={`${item.title} source link`}>
                    <span>{item.source} · {item.time}{item.kind === 'video' ? ' · Video' : ''}</span>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </a>
                ) : (
                  <>
                    <span>{item.source} · {item.time}</span>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="resources" style={tradingCardStyle({ minHeight: 360, maxHeight: 'none' })}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Filings & reports</div>
            </div>
            <span className="trading-ticker-source-note">{hasResources ? formatCaptionSource(ticker.sourceMap.filings) : 'Data not available'}</span>
          </div>
          {hasResources ? (
            <div className="trading-resource-list">
              {ticker.resources.map((group) => (
                <div key={group.label}>
                  {group.label !== 'SEC filings' ? <h3>{group.label}</h3> : null}
                  {group.items.map((item) => (
                    <a
                      key={`${item.name}-${item.href}`}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${item.name} source link`}
                      className={item.kind ? `filing-${item.kind}` : undefined}
                    >
                      <i>{item.form ?? item.kind ?? 'LINK'}</i>
                      <span>{item.name}</span>
                      <em>{item.meta}</em>
                      <b>↗</b>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          ) : <EmptySectionState />}
        </section>
      </div>

      <div className="trading-ticker-lower-grid">
        <section id="financial-overview" style={tradingCardStyle({ minHeight: 330, maxHeight: 'none' })}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Financials overview</div>
              <h2>Revenue vs net income</h2>
            </div>
            <div className="trading-financial-legend" aria-hidden="true">
              <span><i /> Revenue</span>
              <span><b /> Net income</span>
            </div>
          </div>
          <FinancialBarChart overview={ticker.financialOverview} />
        </section>

        <section id="key-ratios" style={tradingCardStyle({ minHeight: 330, maxHeight: 'none' })}>
          <div className="trading-section-label">Key ratios (TTM)</div>
          <dl className="trading-key-ratio-grid">
            {keyRatios.map((ratio) => (
              <div key={ratio.label}>
                <dt>{ratio.label}</dt>
                <dd className={ratio.status === 'unavailable' ? 'unavailable' : undefined}>{ratio.value}</dd>
              </div>
            ))}
          </dl>
          <p className="trading-financial-caption">{sourceList(ticker.keyRatios.filter((ratio) => !visibleHighlightRatioLabels.has(keyRatioHighlightKey(ratio.label))), ticker.sourceMap.financials)}</p>
        </section>
      </div>

      <section id="finance-glossary" className="trading-finance-glossary" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-section-head">
          <div>
            <div className="trading-section-label">Finance glossary</div>
            <h2>Small notes for reading the numbers</h2>
          </div>
          <span className="trading-ticker-source-note">Educational context, not investment advice</span>
        </div>
        <dl className="trading-glossary-grid">
          {financeGlossaryItems.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="trading-ticker-placeholder-grid trading-ticker-provider-grid">
        <section id="estimates" style={tradingCardStyle({ minHeight: 190, maxHeight: 'none' })}>
          <div className="trading-section-label">Estimates</div>
          <EstimatesPanel section={estimatesSection} />
        </section>
        <section id="eps" style={tradingCardStyle({ minHeight: 214, maxHeight: 'none' })}>
          <div className="trading-section-label">EPS estimates</div>
          <EpsPanel section={estimatesSection} />
        </section>
        <section id="dividends" style={tradingCardStyle({ minHeight: 214, maxHeight: 'none' })}>
          <div className="trading-section-label">Dividends</div>
          <SupplementalDataPanel section={dividendsSection} />
        </section>
        <section id="ownership" style={tradingCardStyle({ minHeight: 214, maxHeight: 'none' })}>
          <div className="trading-section-label">Ownership</div>
          <SupplementalDataPanel section={ticker.supplemental?.ownership} />
        </section>
        <section id="technicals" style={tradingCardStyle({ minHeight: 214, maxHeight: 'none' })}>
          <div className="trading-section-label">Technicals</div>
          <SupplementalDataPanel section={technicalsSection} />
        </section>
      </div>
    </TradingPageFrame>
  );
}
