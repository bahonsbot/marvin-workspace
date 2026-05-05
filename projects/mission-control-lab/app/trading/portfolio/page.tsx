import { MarketTapeClient } from '@/components/pages/trading/MarketTapeClient';
import { PortfolioClient } from '@/components/pages/trading/portfolio/PortfolioClient';
import { TradingPageFrame } from '@/components/pages/trading/shared';
import { ConvexClientProvider } from '@/components/pages/trading/watchlist/ConvexClientProvider';
import { getMarketTape } from '@/lib/trading/market-tape';

export default async function TradingPortfolioPage() {
  const marketTape = await getMarketTape();

  return (
    <TradingPageFrame
      title="Portfolio"
      description="Holdings, weights, P/L, allocation, benchmark context, and earnings watch."
      hideHeader
    >
      <MarketTapeClient initialData={marketTape} />
      <ConvexClientProvider>
        <PortfolioClient convexEnabled={Boolean(process.env.NEXT_PUBLIC_CONVEX_URL)} />
      </ConvexClientProvider>
    </TradingPageFrame>
  );
}
