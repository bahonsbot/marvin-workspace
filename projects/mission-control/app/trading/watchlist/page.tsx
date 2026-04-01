import { getMarketIntelDashboard } from '@/lib/adapters/marketIntel';
import { TradingPageFrame, formatTradingTime, tradingCardStyle } from '@/components/pages/trading/shared';

export const dynamic = 'force-dynamic';

export default async function TradingWatchlistPage() {
  const data = await getMarketIntelDashboard();

  return (
    <TradingPageFrame
      title="Watchlist"
      description="Shared manual watch candidates and research radar linkage. This remains file-backed truth, not a separate UI-only list."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 14 }}>
        <section style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Manual watch</h2>
          {data.manualWatch.items.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No manual watch items are currently stored in the shared file.</div>
          ) : (
            data.manualWatch.items.map((item) => (
              <article key={item.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{item.symbol}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-mid)' }}>{item.reviewStatus}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTradingTime(item.addedAt)} · {item.conviction} conviction</div>
                <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>{item.thesis}</div>
              </article>
            ))
          )}
        </section>

        <section style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Research radar linkage</h2>
          {data.researchRadar.items.slice(0, 10).map((item) => (
            <article key={item.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{item.symbol}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.origin}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {item.theme ?? 'No theme'} · {item.sourceCount} sources · {item.confidence}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
                {item.thesis ?? item.whyNow ?? item.notes[0] ?? 'No thesis text stored.'}
              </div>
            </article>
          ))}
        </section>
      </div>
    </TradingPageFrame>
  );
}
