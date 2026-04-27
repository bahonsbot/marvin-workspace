import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';
import { watchlistRows } from '@/components/pages/trading/trading-sample-data';

export default function TradingScreenerPage() {
  return (
    <PlaceholderPage title="Screener" description="Candidate filters, movers, dividend ideas, earnings names, and research queues.">
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Sample results</div>
        <div className="trading-table-shell">
          <table className="trading-table"><tbody>{watchlistRows.map((row) => <tr key={row.symbol}><td>{row.symbol}</td><td>{row.name}</td><td>{row.price}</td><td>{row.change}</td></tr>)}</tbody></table>
        </div>
      </section>
    </PlaceholderPage>
  );
}
