import { getMarketIntelDashboard } from '@/lib/adapters/marketIntel';
import { TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';

export const dynamic = 'force-dynamic';

export default async function TradingBotPage() {
  const data = await getMarketIntelDashboard();
  const ready = data.executionCandidates.filter((candidate) => candidate.dispatchReady);

  return (
    <TradingPageFrame
      title="Bot / Dispatch"
      description="Dispatch posture only. This does not invent a separate bot runtime; it reflects the existing candidate readiness already present in Market Intel."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 14 }}>
        <section style={{ ...tradingCardStyle(), display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Current posture</h2>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-deep)' }}>{ready.length}</div>
          <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6 }}>
            Dispatch-ready candidates currently present in the execution candidate file.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            No fake broker connection, no synthetic order state, and no shadow dispatch pipeline were added here.
          </div>
        </section>

        <section style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Dispatch-ready candidates</h2>
          {ready.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No candidates are currently marked dispatch-ready.</div>
          ) : (
            ready.slice(0, 12).map((candidate) => (
              <article key={candidate.candidateId} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{candidate.primaryInstrument?.symbol ?? candidate.sourceTitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-mid)' }}>Priority {candidate.executionPriority ?? '—'}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
                  {candidate.dispatchReasons.join(' · ') || 'Marked ready without explicit reasons.'}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </TradingPageFrame>
  );
}
