import Link from 'next/link';
import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';
import { watchlistRows } from '@/components/pages/trading/trading-sample-data';

export default function TradingWatchlistPage() {
  return (
    <PlaceholderPage title="Watchlist" description="Tracked companies, thesis notes, alert levels, and ticker drilldowns.">
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Pinned names</div>
        <div className="trading-table-shell">
          <table className="trading-table">
            <thead><tr><th>Symbol</th><th>Name</th><th>Price</th><th>Move</th><th>Thesis</th></tr></thead>
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
    </PlaceholderPage>
  );
}
