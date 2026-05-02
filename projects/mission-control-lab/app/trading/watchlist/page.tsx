import { MarketTapeClient } from '@/components/pages/trading/MarketTapeClient';
import { TradingPageFrame } from '@/components/pages/trading/shared';
import { ConvexClientProvider } from '@/components/pages/trading/watchlist/ConvexClientProvider';
import { WatchlistClient } from '@/components/pages/trading/watchlist/WatchlistClient';
import { getMarketTape } from '@/lib/trading/market-tape';

export default async function TradingWatchlistPage() {
  const marketTape = await getMarketTape();

  return (
    <TradingPageFrame
      title="Watchlist"
      description="Tracked companies, thesis notes, alert levels, and ticker drilldowns."
      hideHeader
    >
      <MarketTapeClient initialData={marketTape} />
      <ConvexClientProvider>
        <WatchlistClient convexEnabled={Boolean(process.env.NEXT_PUBLIC_CONVEX_URL)} />
      </ConvexClientProvider>
    </TradingPageFrame>
  );
}
