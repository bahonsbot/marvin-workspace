import { AnalyticsWorkbenchClient } from '@/components/pages/trading/analytics/AnalyticsWorkbenchClient';
import { MarketTapeClient } from '@/components/pages/trading/MarketTapeClient';
import { TradingPageFrame } from '@/components/pages/trading/shared';
import { getMarketTape } from '@/lib/trading/market-tape';

export default async function TradingAnalyticsPage() {
  const marketTape = await getMarketTape();

  return (
    <TradingPageFrame
      title="Analytics"
      description="Generate a valuation thesis from ticker data, DefeatBeta fundamentals, market context, and Milou’s reasoning layer. Portfolio lens is intentionally left out for now."
      hideHeader
    >
      <MarketTapeClient initialData={marketTape} />
      <AnalyticsWorkbenchClient />
    </TradingPageFrame>
  );
}
