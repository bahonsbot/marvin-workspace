import Link from 'next/link';
import { MarketTape, MiniLineChart, TradingPageFrame, TradingSectionLink, tradingCardStyle } from '@/components/pages/trading/shared';
import { exposureRows, healthItems, marketTape, newsItems, performanceSeries, portfolioSnapshot, watchlistRows } from '@/components/pages/trading/trading-sample-data';

export default function TradingOverviewPage() {
  return (
    <TradingPageFrame
      title="Trading Overview"
      description="Atreus-style command room for portfolio posture, watchlists, market context, and the next things that need attention. Static first, data later."
    >
      <MarketTape items={marketTape} />

      <div className="trading-overview-grid">
        <section className="trading-account-panel">
          <div className="trading-section-label">Account value</div>
          <div className="trading-account-value">{portfolioSnapshot.value}</div>
          <div className="trading-account-metrics">
            <span>Day P/L <strong className="negative">{portfolioSnapshot.dayChange} ({portfolioSnapshot.dayChangePct})</strong></span>
            <span>Total P/L <strong className="positive">{portfolioSnapshot.totalGain} ({portfolioSnapshot.totalGainPct})</strong></span>
            <span>Cash <strong>{portfolioSnapshot.cash}</strong></span>
          </div>
          <MiniLineChart values={performanceSeries} />
        </section>

        <aside className="trading-health-panel">
          <div className="trading-section-label">Health snapshot</div>
          <div className="trading-health-list">
            {healthItems.map((item) => (
              <div key={item.label} className="trading-health-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
          <Link href="/trading/health" className="trading-text-link">Open Health →</Link>
        </aside>
      </div>

      <div className="trading-lower-grid">
        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Watchlist</div>
              <h2>Names on deck</h2>
            </div>
            <Link href="/trading/watchlist" className="trading-text-link">Manage →</Link>
          </div>
          <div className="trading-table-shell">
            <table className="trading-table">
              <thead>
                <tr><th>Symbol</th><th>Name</th><th>Price</th><th>Move</th><th>Thesis</th></tr>
              </thead>
              <tbody>
                {watchlistRows.map((row) => (
                  <tr key={row.symbol}>
                    <td><Link href={`/trading/ticker/${row.symbol}`}>{row.symbol}</Link></td>
                    <td>{row.name}</td>
                    <td>{row.price}</td>
                    <td className={row.change.startsWith('-') ? 'negative' : 'positive'}>{row.change}</td>
                    <td>{row.thesis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={tradingCardStyle()}>
          <div className="trading-section-label">Exposure</div>
          <h2>Allocation preview</h2>
          <div className="trading-exposure-list">
            {exposureRows.map((row) => (
              <div key={row.label} className="trading-exposure-row">
                <span>{row.label}</span>
                <div><i style={{ width: row.value }} /></div>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <Link href="/trading/analytics" className="trading-text-link">Open Analytics →</Link>
        </section>
      </div>

      <div className="trading-lower-grid trading-lower-grid-compact">
        <section style={tradingCardStyle()}>
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">News / calendar</div>
              <h2>What changed</h2>
            </div>
            <Link href="/trading/news" className="trading-text-link">Open News →</Link>
          </div>
          <div className="trading-news-list">
            {newsItems.map((item) => (
              <article key={item.title}>
                <span>{item.tag}</span>
                <strong>{item.title}</strong>
                <p>{item.source} · {item.time}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="trading-link-grid">
          <TradingSectionLink href="/trading/portfolio" title="Portfolio" body="Holdings, weights, P/L, exposure, and X-ray mode." />
          <TradingSectionLink href="/trading/screener" title="Screener" body="Candidate filters, movers, and names worth researching." />
          <TradingSectionLink href="/trading/bots" title="Bots" body="Read-only automation posture before execution controls exist." />
        </section>
      </div>
    </TradingPageFrame>
  );
}
