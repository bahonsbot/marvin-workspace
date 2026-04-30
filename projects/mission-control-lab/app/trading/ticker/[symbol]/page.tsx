import Link from 'next/link';
import { TickerPriceChart } from '@/components/pages/trading/TickerPriceChart';
import { TickerQuoteRefresh } from '@/components/pages/trading/TickerQuoteRefresh';
import { MarketTape, TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import { marketTape } from '@/components/pages/trading/trading-sample-data';
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
];

const unavailableHighlightSource = {
  source: 'sample' as const,
  asOf: new Date(0).toISOString(),
  freshness: 'missing' as const,
  note: 'No reliable provider-backed value is available yet. Keep the metric visible for future fundamentals coverage.',
};

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


function formatCaptionSource(source: TickerSourceMeta | undefined, options: { includeUpdated?: boolean } = {}) {
  if (!source) return 'Source: Provider pending';
  const label = source.source === 'eodhd' ? 'EODHD' : source.source === 'yahoo' ? 'Yahoo / yfinance' : source.source.toUpperCase();
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

function sourceList(metrics: Array<{ source?: TickerSourceMeta }> = [], fallback?: TickerSourceMeta) {
  const labels = new Set<string>();
  for (const metric of metrics) {
    if (!metric.source?.source) continue;
    labels.add(metric.source.source === 'eodhd' ? 'EODHD' : metric.source.source === 'yahoo' ? 'Yahoo / yfinance' : metric.source.source.toUpperCase());
  }
  if (!labels.size && fallback?.source) labels.add(fallback.source === 'eodhd' ? 'EODHD' : fallback.source === 'yahoo' ? 'Yahoo / yfinance' : fallback.source.toUpperCase());
  return labels.size ? `Sources: ${Array.from(labels).join(', ')}` : 'Sources: Provider pending';
}

function cleanProfileFacts(facts: TickerProfileFact[]) {
  return facts.filter((fact) => !['wikidata', 'industry group', 'company name'].includes(fact.label.toLowerCase()));
}

function profileFactValue(fact: TickerProfileFact) {
  if (fact.label.toLowerCase() !== 'website' || !fact.value || fact.value === 'Provider pending') return fact.value;
  const href = /^https?:\/\//i.test(fact.value) ? fact.value : `https://${fact.value}`;
  return <a href={href} target="_blank" rel="noreferrer">{fact.value.replace(/^https?:\/\//i, '')}</a>;
}

function titleFromProfile(tickerName: string, summary: string, facts: TickerProfileFact[]) {
  if (!tickerName.includes('.')) return tickerName;
  const companyName = facts.find((fact) => fact.label.toLowerCase() === 'company name')?.value;
  if (companyName) return companyName;
  const firstSentence = summary.split(/\.\s+/)[0]?.trim().replace(/\s+N\.\s*V\.?$/i, ' N.V.');
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
      delta: 'Provider required',
      tone: 'neutral' as const,
      trend: [],
      source: unavailableHighlightSource,
      status: 'unavailable' as const,
      note: 'Awaiting richer fundamentals provider such as FMP or a validated SEC concept mapping.',
    };
  });
}

function EmptySparkline({ label }: { label: string }) {
  return (
    <div className="trading-empty-sparkline" role="img" aria-label={`${label} data unavailable`}>
      <span>Data unavailable</span>
    </div>
  );
}

function TickerMark({ symbol, logoUrl, logoAlt }: { symbol: string; logoUrl: string | null; logoAlt: string }) {
  return (
    <div className={`trading-ticker-mark ${logoUrl ? 'has-logo' : 'initials-only'}`} aria-hidden={logoUrl ? undefined : true}>
      {logoUrl ? <img src={logoUrl} alt={logoAlt} loading="lazy" decoding="async" /> : <span>{symbol.slice(0, 2)}</span>}
    </div>
  );
}

function SmallSparkline({ values, tone = 'positive' }: { values: number[]; tone?: SparklineTone }) {
  const width = 112;
  const height = 34;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * (width - 4) + 2;
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg className={`trading-small-sparkline ${tone}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function SupplementalDataPanel({ section, visual = false }: { section?: TickerSupplementalSection; visual?: boolean }) {
  if (!section || !section.metrics.length) {
    return <EmptySectionState note={section?.note ?? 'Provider-backed data is not available for this module yet.'} />;
  }

  const metrics = stripMetricSourceNotes(section.metrics);
  const targetMetrics = metrics.filter((metric) => metric.label.toLowerCase().startsWith('target '));
  const recommendation = metrics.find((metric) => metric.label === 'Recommendation');
  const analystCount = metrics.find((metric) => metric.label === 'Analyst count');
  const epsMetrics = metrics.filter((metric) => metric.label.toLowerCase().startsWith('eps'));
  const otherMetrics = metrics.filter((metric) => !targetMetrics.includes(metric) && metric !== recommendation && metric !== analystCount && !epsMetrics.includes(metric));

  if (visual && (targetMetrics.length || recommendation || epsMetrics.length)) {
    return (
      <>
        {targetMetrics.length ? (
          <div className="trading-estimate-target-strip">
            {targetMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label.replace('Target ', '')}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        ) : null}
        {recommendation || analystCount ? (
          <div className="trading-estimate-consensus">
            {recommendation ? <strong>{recommendation.value}</strong> : null}
            {analystCount ? <span>{analystCount.value} analysts</span> : null}
          </div>
        ) : null}
        {epsMetrics.length ? (
          <dl className="trading-supplemental-metric-grid compact">
            {epsMetrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {otherMetrics.length ? (
          <dl className="trading-supplemental-metric-grid compact">
            {otherMetrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="trading-financial-caption">{sourceList(section.metrics, section.source)}</p>
      </>
    );
  }

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
  const ticker = await getTickerProfile(upperSymbol);
  const profileFacts = cleanProfileFacts(ticker.companyProfile.facts);
  const displayName = titleFromProfile(ticker.name, ticker.companyProfile.summary, profileFacts);
  const headerStats = normalizeHeaderStats(ticker.headerStats, profileFacts);
  const hasResources = ticker.resources.some((group) => group.items.length);


  return (
    <TradingPageFrame
      title={`${ticker.name} (${upperSymbol})`}
      description="Static BOILER ROOM ticker research object. Live provider wiring comes later through a server-side cached ticker profile adapter."
      hideHeader
    >
      <MarketTape items={marketTape} />

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
          <TickerPriceChart ranges={ticker.priceSeries.ranges} activeRange={ticker.priceSeries.activeRange} rangeSeries={ticker.priceSeries.rangeSeries} />
        </section>

        <section id="company-profile" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-section-label">Company profile</div>
          <p className="trading-ticker-profile-copy">{ticker.companyProfile.summary}</p>
          <dl className="trading-profile-facts">
            {profileFacts.map((fact) => (
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
          <span className="trading-ticker-source-note">{formatCaptionSource(ticker.sourceMap.financials)}</span>
        </div>
        <div className="trading-financial-highlight-grid">
          {buildFinancialHighlightSlots(ticker.financialHighlights).map((metric) => (
            <article key={metric.label} className={`trading-financial-highlight-card ${metric.status === 'unavailable' ? 'is-unavailable' : ''}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <em className={metric.tone}>{metric.delta}</em>
              {metric.trend.length ? <SmallSparkline values={metric.trend} tone={metric.tone as SparklineTone} /> : <EmptySparkline label={metric.label} />}
              {metric.note ? <p>{metric.note}</p> : null}
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
              <h2>{ticker.balanceSheetSnapshot.period}</h2>
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
                    <a key={`${item.name}-${item.href}`} href={item.href} aria-label={`${item.name} source link`} className={item.kind ? `filing-${item.kind}` : undefined}>
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
            {stripMetricSourceNotes(ticker.keyRatios).map((ratio) => (
              <div key={ratio.label}>
                <dt>{ratio.label}</dt>
                <dd className={ratio.status === 'unavailable' ? 'unavailable' : undefined}>{ratio.value}</dd>
              </div>
            ))}
          </dl>
          <p className="trading-financial-caption">{sourceList(ticker.keyRatios, ticker.sourceMap.financials)}</p>
        </section>
      </div>

      <div className="trading-ticker-placeholder-grid trading-ticker-provider-grid">
        <section id="estimates" style={tradingCardStyle({ minHeight: 190, maxHeight: 'none' })}>
          <div className="trading-section-label">Estimates</div>
          <SupplementalDataPanel section={ticker.supplemental?.estimates} visual />
        </section>
        <section id="dividends" style={tradingCardStyle({ minHeight: 190, maxHeight: 'none' })}>
          <div className="trading-section-label">Dividends</div>
          <SupplementalDataPanel section={ticker.supplemental?.dividends} />
        </section>
        <section id="ownership" style={tradingCardStyle({ minHeight: 190, maxHeight: 'none' })}>
          <div className="trading-section-label">Ownership</div>
          <SupplementalDataPanel section={ticker.supplemental?.ownership} />
        </section>
        <section id="technicals" style={tradingCardStyle({ minHeight: 190, maxHeight: 'none' })}>
          <div className="trading-section-label">Technicals</div>
          <SupplementalDataPanel section={ticker.supplemental?.technicals} />
        </section>
      </div>
    </TradingPageFrame>
  );
}
