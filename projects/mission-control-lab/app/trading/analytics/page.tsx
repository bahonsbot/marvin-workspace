import { MiniLineChart, PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';
import { analyticsTabs, performanceSeries } from '@/components/pages/trading/trading-sample-data';

export default function TradingAnalyticsPage() {
  return (
    <PlaceholderPage title="Analytics" description="Performance, attribution, exposure, dividends, charts, and technicals in one tabbed room." tabs={analyticsTabs}>
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Performance preview</div>
        <MiniLineChart values={performanceSeries} />
      </section>
    </PlaceholderPage>
  );
}
