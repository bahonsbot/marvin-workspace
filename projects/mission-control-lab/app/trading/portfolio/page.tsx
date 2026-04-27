import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';
import { exposureRows, watchlistRows } from '@/components/pages/trading/trading-sample-data';

export default function TradingPortfolioPage() {
  return (
    <PlaceholderPage title="Portfolio" description="Holdings, weights, P/L, exposure, dividends, and eventual X-ray mode.">
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Sample holdings</div>
        <div className="trading-table-shell">
          <table className="trading-table">
            <tbody>
              {watchlistRows.map((row, index) => (
                <tr key={row.symbol}><td>{row.symbol}</td><td>{row.name}</td><td>{(12.8 - index * 1.4).toFixed(1)}%</td><td>{row.change}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="trading-exposure-list" style={{ marginTop: 16 }}>
          {exposureRows.map((row) => <div key={row.label} className="trading-exposure-row"><span>{row.label}</span><div><i style={{ width: row.value }} /></div><strong>{row.value}</strong></div>)}
        </div>
      </section>
    </PlaceholderPage>
  );
}
