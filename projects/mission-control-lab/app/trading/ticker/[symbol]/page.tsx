import { MiniLineChart, TabScaffold, TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import { performanceSeries } from '@/components/pages/trading/trading-sample-data';

export default async function TradingTickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  return (
    <TradingPageFrame title={upperSymbol} description="Ticker detail shell for quote, chart, financials, news, metrics, estimates, dividends, ownership, and filings.">
      <TabScaffold tabs={['Overview', 'Financials', 'News', 'Metrics', 'Estimates', 'Dividends', 'Ownership', 'SEC Filings']} />
      <section style={tradingCardStyle()}>
        <div className="trading-ticker-head"><div><span>Technology</span><h2>{upperSymbol} — Price history</h2></div><strong>$422.26 <em>-0.56%</em></strong></div>
        <MiniLineChart values={performanceSeries} />
      </section>
    </TradingPageFrame>
  );
}
