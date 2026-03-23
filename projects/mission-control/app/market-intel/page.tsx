import { PageScaffold } from '@/components/shared/PageScaffold';
import { MarketIntelDashboard } from '@/components/market-intel/MarketIntelDashboard';
import { getMarketIntelDashboard } from '@/lib/adapters/marketIntel';

export const dynamic = 'force-dynamic';

export default async function MarketIntelPage() {
  const dashboard = await getMarketIntelDashboard();

  return (
    <PageScaffold title="Market Intel">
      <MarketIntelDashboard data={dashboard} />
    </PageScaffold>
  );
}
