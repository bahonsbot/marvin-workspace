import { getMarketIntelDashboard } from '@/lib/adapters/marketIntel';
import { TradingPageFrame, formatTradingTime, tradingCardStyle } from '@/components/pages/trading/shared';

export const dynamic = 'force-dynamic';

export default async function TradingSignalsPage() {
  const data = await getMarketIntelDashboard();

  return (
    <TradingPageFrame
      title="Signals"
      description="Denser view over real execution candidates and tracked signals. No speculative fills or fake execution tape."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 14 }}>
        <section style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Execution candidates</h2>
          {data.executionCandidates.slice(0, 10).map((candidate) => (
            <article key={candidate.candidateId} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{candidate.primaryInstrument?.symbol ?? candidate.sourceTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Priority {candidate.executionPriority ?? '—'}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {candidate.category} · {candidate.sourceFeed} · {formatTradingTime(candidate.generatedAt)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
                {candidate.signalBriefing ?? candidate.reasoning ?? 'No reasoning text stored for this candidate.'}
              </div>
            </article>
          ))}
        </section>

        <section style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Tracked signals</h2>
          {data.trackedSignals.slice(0, 10).map((signal) => (
            <article key={signal.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{signal.title}</div>
                <div style={{ fontSize: 12, color: signal.verified ? 'var(--accent-mid)' : 'var(--warning)' }}>
                  {signal.verified ? signal.outcome : 'pending'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {signal.source} · {signal.feed} · {formatTradingTime(signal.addedAt)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
                {signal.verificationNote ?? signal.notes ?? signal.predictedOutcomes[0] ?? 'No verification note stored yet.'}
              </div>
            </article>
          ))}
        </section>
      </div>
    </TradingPageFrame>
  );
}
