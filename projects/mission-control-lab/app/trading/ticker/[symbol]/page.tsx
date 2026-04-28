import Link from 'next/link';
import { MarketTape, MiniLineChart, TabScaffold, TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import {
  marketTape,
  tickerDetailSample,
  tickerFinancialOverviewSeries,
  tickerPriceSeries,
} from '@/components/pages/trading/trading-sample-data';

type SparklineTone = 'positive' | 'negative' | 'neutral';

function TickerMark({ symbol }: { symbol: string }) {
  return (
    <div className="trading-ticker-mark" aria-hidden="true">
      <span>{symbol.slice(0, 2)}</span>
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

function FinancialBarChart() {
  const max = Math.max(...tickerFinancialOverviewSeries.map((item) => Math.max(item.revenue, item.netIncome)));
  return (
    <div className="trading-financial-bars" aria-label="Sample annual revenue and net income chart">
      {tickerFinancialOverviewSeries.map((item) => (
        <div key={item.year} className="trading-financial-bar-group">
          <div className="trading-financial-bars-pair">
            <i style={{ height: `${(item.revenue / max) * 100}%` }} aria-label={`${item.year} revenue`} />
            <b style={{ height: `${(item.netIncome / max) * 100}%` }} aria-label={`${item.year} net income`} />
          </div>
          <span>{item.year}</span>
        </div>
      ))}
    </div>
  );
}

export default async function TradingTickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  const ticker = { ...tickerDetailSample, symbol: upperSymbol };

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

      <section className="trading-ticker-quote-panel">
        <div className="trading-ticker-identity">
          <TickerMark symbol={upperSymbol} />
          <div>
            <h1>{ticker.name}</h1>
            <p>
              {upperSymbol} <span>·</span> {ticker.exchange}
            </p>
          </div>
          <button type="button">＋ Follow</button>
        </div>

        <div className="trading-ticker-price-block">
          <strong>{ticker.price}</strong>
          <em className="positive">{ticker.change} ({ticker.changePct})</em>
          <span>{ticker.priceTime}</span>
        </div>

        <dl className="trading-ticker-stat-strip">
          {ticker.headerStats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TabScaffold tabs={ticker.tabs} />

      <div className="trading-ticker-primary-grid">
        <section style={tradingCardStyle({ minHeight: 410, maxHeight: 'none' })}>
          <div className="trading-section-head trading-ticker-chart-head">
            <div>
              <div className="trading-section-label">Price history</div>
              <h2>{upperSymbol} performance</h2>
            </div>
            <div className="trading-range-tabs trading-ticker-range-tabs" role="tablist" aria-label="Ticker price range">
              {ticker.priceRanges.map((range) => (
                <button key={range} type="button" className={range === '1Y' ? 'active' : ''} role="tab" aria-selected={range === '1Y'}>
                  {range}
                </button>
              ))}
            </div>
          </div>
          <MiniLineChart values={tickerPriceSeries} />
          <div className="trading-ticker-chart-axis" aria-hidden="true">
            {ticker.chartAxis.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <dl className="trading-ticker-chart-stats">
            {ticker.chartStats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 410, maxHeight: 'none' })}>
          <div className="trading-section-label">Company profile</div>
          <p className="trading-ticker-profile-copy">{ticker.profile.summary}</p>
          <dl className="trading-profile-facts">
            {ticker.profile.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-section-head">
          <div>
            <div className="trading-section-label">Financial highlights</div>
          </div>
          <span className="trading-ticker-source-note">Static sample · source-ready contract later</span>
        </div>
        <div className="trading-financial-highlight-grid">
          {ticker.financialHighlights.map((metric) => (
            <article key={metric.label} className="trading-financial-highlight-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <em className={metric.tone}>{metric.delta}</em>
              <SmallSparkline values={metric.trend} tone={metric.tone as SparklineTone} />
            </article>
          ))}
        </div>
      </section>

      <div className="trading-ticker-secondary-grid">
        <section style={tradingCardStyle({ minHeight: 360, maxHeight: 'none' })}>
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
                <span>{item.source} · {item.time}</span>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={tradingCardStyle({ minHeight: 360, maxHeight: 'none' })}>
          <div className="trading-section-label">Resources</div>
          <div className="trading-resource-list">
            {ticker.resources.map((group) => (
              <div key={group.label}>
                <h3>{group.label}</h3>
                {group.items.map((item) => (
                  <a key={item.name} href={item.href} aria-label={`${item.name} placeholder link`}>
                    <span>{item.name}</span>
                    <em>{item.meta}</em>
                    <b>↗</b>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="trading-ticker-lower-grid">
        <section style={tradingCardStyle({ minHeight: 330, maxHeight: 'none' })}>
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
          <FinancialBarChart />
        </section>

        <section style={tradingCardStyle({ minHeight: 330, maxHeight: 'none' })}>
          <div className="trading-section-label">Key ratios (TTM)</div>
          <dl className="trading-key-ratio-grid">
            {ticker.keyRatios.map((ratio) => (
              <div key={ratio.label}>
                <dt>{ratio.label}</dt>
                <dd>{ratio.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </TradingPageFrame>
  );
}
