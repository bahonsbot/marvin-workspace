import Link from 'next/link';
import { getMarketIntelDashboard } from '@/lib/adapters/marketIntel';
import { TradingPageFrame, TradingKpiGrid, TradingSectionLink, tradingCardStyle, formatTradingTime } from '@/components/pages/trading/shared';

export const dynamic = 'force-dynamic';

export default async function TradingOverviewPage() {
  const data = await getMarketIntelDashboard();
  const leadSignals = data.trackedSignals.slice(0, 4);
  const manualWatch = data.manualWatch.items.slice(0, 4);

  return (
    <TradingPageFrame
      title="Trading Overview"
      description="Bounded trading shell over the existing Market Intel adapters. Signals, manual watch, market context, and dispatch posture stay truthful to the current runtime files."
    >
      <TradingKpiGrid data={data} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14 }}>
        <div style={{ ...tradingCardStyle(), display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Market context</div>
            <h2 style={{ margin: '8px 0 0', fontSize: 22 }}>Snapshot posture</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {data.marketContext.indices.slice(0, 4).map((quote) => (
              <div key={quote.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, background: 'rgba(255,255,255,0.65)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{quote.label}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 750 }}>{quote.price !== null ? quote.price.toFixed(2) : '—'}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: (quote.changePct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {quote.changePct === null ? 'Unavailable' : `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{data.marketContext.note}</div>
        </div>

        <div style={{ ...tradingCardStyle(), display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Dispatch posture</div>
            <h2 style={{ margin: '8px 0 0', fontSize: 22 }}>Ready names</h2>
          </div>
          {data.executionCandidates.filter((candidate) => candidate.dispatchReady).slice(0, 4).map((candidate) => (
            <div key={candidate.candidateId} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, background: 'rgba(255,255,255,0.65)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 700 }}>{candidate.primaryInstrument?.symbol ?? candidate.sourceTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--accent-mid)' }}>{candidate.executionPriority ?? '—'}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-body)', lineHeight: 1.55 }}>
                {candidate.signalBriefing ?? candidate.reasoning ?? 'Dispatch-ready candidate with no briefing text present.'}
              </div>
            </div>
          ))}
          <Link href="/trading/bot" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-deep)' }}>
            Open bot / dispatch →
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <TradingSectionLink href="/trading/market-intel" title="Market Intel" body="Full market context, research radar, tracked signals, and shared manual watch flow." />
        <TradingSectionLink href="/trading/signals" title="Signals" body="Execution candidates and tracked signals split out into a denser operator view." />
        <TradingSectionLink href="/trading/watchlist" title="Watchlist" body="Manual watch candidates with theme linkage preserved from the shared file-backed source." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        <div style={{ ...tradingCardStyle(), display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Recent tracked signals</div>
          {leadSignals.map((signal) => (
            <div key={signal.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 650 }}>{signal.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>{signal.source} · {formatTradingTime(signal.addedAt)}</div>
            </div>
          ))}
        </div>
        <div style={{ ...tradingCardStyle(), display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Manual watch linkage</div>
          {manualWatch.map((item) => (
            <div key={item.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 650 }}>{item.symbol}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-body)' }}>{item.thesis}</div>
            </div>
          ))}
        </div>
      </div>
    </TradingPageFrame>
  );
}
