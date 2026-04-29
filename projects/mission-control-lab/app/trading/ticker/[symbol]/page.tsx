import Link from 'next/link';
import { MarketTape, MiniLineChart, TabScaffold, TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import { marketTape } from '@/components/pages/trading/trading-sample-data';
import { getTickerProfile } from '@/lib/trading/ticker-profile';
import type { TickerBalanceSheetSnapshot, TickerFinancialBar } from '@/lib/trading/contracts';

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

function FinancialBarChart({ series }: { series: TickerFinancialBar[] }) {
  const max = Math.max(...series.map((item) => Math.max(item.revenue, item.netIncome)));
  return (
    <div className="trading-financial-bars" aria-label="Annual revenue and net income chart">
      {series.map((item) => (
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
  const ticker = await getTickerProfile(upperSymbol);

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
        </div>

        <div className="trading-ticker-price-block">
          <strong>{ticker.quote.price}</strong>
          <em className={ticker.quote.tone}>{ticker.quote.change} ({ticker.quote.changePct})</em>
          <span>{ticker.quote.priceTime}</span>
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

      <div className="trading-ticker-tabs-row">
        <TabScaffold tabs={ticker.tabs} />
        <button type="button" className={`trading-watchlist-toggle ${ticker.inWatchlist ? 'in-watchlist' : 'not-watched'}`}>
          {ticker.inWatchlist ? '− Watchlist' : '+ Watchlist'}
        </button>
      </div>

      <div className="trading-ticker-primary-grid">
        <section style={tradingCardStyle({ minHeight: 410, maxHeight: 'none' })}>
          <div className="trading-section-head trading-ticker-chart-head">
            <div>
              <div className="trading-section-label">Price history</div>
              <h2>{upperSymbol} performance</h2>
            </div>
            <div className="trading-range-tabs trading-ticker-range-tabs" role="tablist" aria-label="Ticker price range">
              {ticker.priceSeries.ranges.map((range) => (
                <button key={range} type="button" className={range === ticker.priceSeries.activeRange ? 'active' : ''} role="tab" aria-selected={range === ticker.priceSeries.activeRange}>
                  {range}
                </button>
              ))}
            </div>
          </div>
          <MiniLineChart values={ticker.priceSeries.values} />
          <div className="trading-ticker-chart-axis" aria-hidden="true">
            {ticker.priceSeries.axis.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <dl className="trading-ticker-chart-stats">
            {ticker.priceSeries.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 410, maxHeight: 'none' })}>
          <div className="trading-section-label">Company profile</div>
          <p className="trading-ticker-profile-copy">{ticker.companyProfile.summary}</p>
          <dl className="trading-profile-facts">
            {ticker.companyProfile.facts.map((fact) => (
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
          <span className="trading-ticker-source-note">{ticker.sourceMap.financials.freshness} · {ticker.sourceMap.financials.source} · contract-ready</span>
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

      <div className="trading-ticker-balance-grid">
        <section style={tradingCardStyle({ minHeight: 360, maxHeight: 'none' })}>
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
          <p className="trading-financial-caption">{ticker.cashDebtSnapshot.source.freshness} · {ticker.cashDebtSnapshot.source.source}: {ticker.cashDebtSnapshot.source.note}</p>
        </section>

        <section style={tradingCardStyle({ minHeight: 420, maxHeight: 'none' })}>
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
          <p className="trading-financial-caption">{ticker.balanceSheetSnapshot.note}</p>
        </section>
      </div>

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
          <FinancialBarChart series={ticker.financialOverview} />
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
