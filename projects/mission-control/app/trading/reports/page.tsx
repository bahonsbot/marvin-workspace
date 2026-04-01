import { getMarketIntelDashboard } from '@/lib/adapters/marketIntel';
import { TradingPageFrame, formatTradingTime, tradingCardStyle } from '@/components/pages/trading/shared';

export const dynamic = 'force-dynamic';

export default async function TradingReportsPage() {
  const data = await getMarketIntelDashboard();

  return (
    <TradingPageFrame
      title="Reports"
      description="Compact reporting layer over the current Market Intel truth: verification accuracy, review backlog, and last update posture."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div style={tradingCardStyle()}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Weighted accuracy</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{data.accuracySnapshot.weightedAccuracy !== null ? `${data.accuracySnapshot.weightedAccuracy.toFixed(1)}%` : '—'}</div>
        </div>
        <div style={tradingCardStyle()}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Verified set</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{data.accuracySnapshot.correctCount + data.accuracySnapshot.incorrectCount + data.accuracySnapshot.duplicateCount}</div>
        </div>
        <div style={tradingCardStyle()}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Last refreshed</div>
          <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800 }}>{formatTradingTime(data.refreshedAt)}</div>
        </div>
      </div>

      <section style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Verification snapshot</h2>
        {[
          ['Correct', data.accuracySnapshot.correctCount],
          ['Incorrect', data.accuracySnapshot.incorrectCount],
          ['Duplicate', data.accuracySnapshot.duplicateCount],
          ['Pending', data.accuracySnapshot.pendingCount],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 650 }}>{label}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{value}</div>
          </div>
        ))}
      </section>
    </TradingPageFrame>
  );
}
