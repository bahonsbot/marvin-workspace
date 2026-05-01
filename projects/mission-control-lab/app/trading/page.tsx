import Link from 'next/link';
import { MarketTape, MiniLineChart, TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import {
  earningsPreview,
  healthItems,
  newsPreview,
  performanceAxisLabels,
  performanceRangeTabs,
  performanceSeries,
  pinnedWatchlists,
  portfolioSnapshot,
  topMoverRows,
} from '@/components/pages/trading/trading-sample-data';
import { getMarketTape } from '@/lib/trading/market-tape';

function HealthIcon({ type }: { type: string }) {
  if (type === 'concentration') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.4" />
      </svg>
    );
  }
  if (type === 'alignment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l7 4v5c0 4-3 6.5-7 7-4-.5-7-3-7-7V8l7-4z" />
        <path d="M8.5 12.2l2.2 2.2 4.8-5" />
      </svg>
    );
  }
  if (type === 'risk') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h16" />
        <path d="M7 15l3-4 3 2 4-6" />
        <path d="M17 7h-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v16" />
      <path d="M4 12h16" />
      <path d="M7 7l10 10" />
      <path d="M17 7L7 17" />
    </svg>
  );
}

function TrendSparkline({ values }: { values: number[] }) {
  const width = 72;
  const height = 24;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const rising = values[values.length - 1] >= values[0];

  return (
    <svg className="trading-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={rising ? '#16B45F' : '#FF3B3B'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function TradingOverviewPage() {
  const marketTape = await getMarketTape();

  return (
    <TradingPageFrame
      title="Trading Overview"
      description="BOILER ROOM home base for portfolio posture, watchlists, market context, and the next names that deserve attention."
      hideHeader
    >
      <MarketTape items={marketTape.items} status={marketTape.status} />

      <section className="trading-overview-hero">
        <div className="trading-overview-hero-head">
          <div>
            <div className="trading-section-label">Total account value</div>
            <div className="trading-account-value">{portfolioSnapshot.value}</div>
          </div>
          <p>Last updated {portfolioSnapshot.updatedAt}</p>
        </div>

        <div className="trading-overview-hero-grid">
          <div className="trading-account-metric-stack">
            <article>
              <span>Day P/L</span>
              <strong className="negative">{portfolioSnapshot.dayChange}</strong>
              <em className="negative">{portfolioSnapshot.dayChangePct}</em>
            </article>
            <article>
              <span>All-time P/L</span>
              <strong className="positive">{portfolioSnapshot.totalGain}</strong>
              <em className="positive">{portfolioSnapshot.totalGainPct}</em>
            </article>
          </div>

          <div className="trading-performance-panel">
            <div className="trading-performance-panel-head">
              <div className="trading-range-tabs" role="tablist" aria-label="Performance range">
                {performanceRangeTabs.map((tab, index) => (
                  <button key={tab} type="button" className={index === 4 ? 'active' : ''} role="tab" aria-selected={index === 4}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <MiniLineChart values={performanceSeries} />
            <div className="trading-performance-axis" aria-hidden="true">
              {performanceAxisLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="trading-lower-grid">
        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Portfolio health</div>
            </div>
            <Link href="/trading/health" className="trading-text-link">
              Full dashboard →
            </Link>
          </div>
          <div className="trading-health-list">
            {healthItems.map((item) => (
              <div key={item.label} className="trading-health-row">
                <div className={`trading-health-icon ${item.tone}`} aria-hidden="true">
                  <HealthIcon type={item.icon} />
                </div>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.summary}</strong>
                  <p>{item.detail}</p>
                </div>
                <em className={`trading-health-badge ${item.tone}`}>{item.value}</em>
              </div>
            ))}
          </div>
        </section>

        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Pinned watchlists</div>
            </div>
            <Link href="/trading/watchlist" className="trading-text-link">
              View all →
            </Link>
          </div>

          <div className="trading-watchlists-stack">
            {pinnedWatchlists.map((watchlist) => (
              <article key={watchlist.name} className="trading-watchlist-block">
                <header>
                  <strong>{watchlist.name}</strong>
                  <span>{watchlist.itemCount} items</span>
                </header>
                <div className="trading-table-shell">
                  <table className="trading-table trading-watchlist-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Move</th>
                        <th>%</th>
                        <th>Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watchlist.rows.map((row) => {
                        const negativeMove = row.changePct.startsWith('-');
                        return (
                          <tr key={row.symbol}>
                            <td>
                              <Link href={`/trading/ticker/${row.symbol}`}>{row.symbol}</Link>
                            </td>
                            <td>{row.name}</td>
                            <td>{row.price}</td>
                            <td className={negativeMove ? 'negative' : 'positive'}>{row.change}</td>
                            <td className={negativeMove ? 'negative' : 'positive'}>{row.changePct}</td>
                            <td>
                              <TrendSparkline values={row.trend} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="trading-insight-grid">
        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Top movers</div>
            </div>
            <Link href="/trading/screener" className="trading-text-link">
              Open Screener →
            </Link>
          </div>
          <div className="trading-table-shell">
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Move</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {topMoverRows.map((row) => (
                  <tr key={row.symbol}>
                    <td>
                      <Link href={`/trading/ticker/${row.symbol}`}>{row.symbol}</Link>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.price}</td>
                    <td className={row.changePct.startsWith('-') ? 'negative' : 'positive'}>{row.changePct}</td>
                    <td>{row.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Earnings</div>
            </div>
            <Link href="/trading/news" className="trading-text-link">
              Calendar →
            </Link>
          </div>
          <div className="trading-news-list">
            {earningsPreview.map((item) => (
              <article key={item.symbol}>
                <strong>{item.symbol}</strong>
                <p>{item.when}</p>
                <p>{item.estimate}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">News pulse</div>
            </div>
            <Link href="/trading/news" className="trading-text-link">
              Open News →
            </Link>
          </div>
          <div className="trading-news-list">
            {newsPreview.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>
                  {item.source} · {item.time}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </TradingPageFrame>
  );
}
