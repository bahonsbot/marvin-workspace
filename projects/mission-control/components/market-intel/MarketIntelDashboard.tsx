'use client';

import { useMemo, useState } from 'react';
import type {
  MarketIntelDashboardSummary,
  MarketIntelOutcome,
  MarketIntelResearchRadarItem,
  MarketIntelManualWatchCandidate,
} from '@/lib/types/contracts';
import { ManualWatchForm } from '@/components/market-intel/ManualWatchForm';

type Selection =
  | { kind: 'candidate'; id: string }
  | { kind: 'signal'; id: string }
  | null;

function formatPct(value: number | null | undefined, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

function formatScore(value: number | null | undefined, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function toneForOutcome(outcome: MarketIntelOutcome) {
  if (outcome === 'correct') {
    return { label: 'Correct', color: '#5eead4', bg: 'rgba(94, 234, 212, 0.14)', border: 'rgba(94, 234, 212, 0.3)' };
  }
  if (outcome === 'incorrect') {
    return { label: 'Incorrect', color: '#f87171', bg: 'rgba(248, 113, 113, 0.16)', border: 'rgba(248, 113, 113, 0.32)' };
  }
  if (outcome === 'duplicate') {
    return { label: 'Duplicate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.16)', border: 'rgba(251, 191, 36, 0.32)' };
  }
  return { label: 'Pending', color: '#93a4bd', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.3)' };
}

function toneForBias(bias: string | null) {
  if (bias === 'allow') return { color: '#5eead4', bg: 'rgba(94, 234, 212, 0.14)', border: 'rgba(94, 234, 212, 0.3)' };
  if (bias === 'caution') return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.3)' };
  if (bias === 'observe' || bias === 'block') return { color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)', border: 'rgba(248, 113, 113, 0.3)' };
  return { color: 'var(--muted-strong)', bg: 'rgba(148, 163, 184, 0.12)', border: 'var(--border)' };
}

function toneForConfidence(confidence: MarketIntelResearchRadarItem['confidence']) {
  if (confidence === 'high') return { color: '#5eead4', bg: 'rgba(94, 234, 212, 0.14)', border: 'rgba(94, 234, 212, 0.3)' };
  if (confidence === 'medium') return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.3)' };
  return { color: '#93a4bd', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.3)' };
}

function toneForConviction(conviction: MarketIntelManualWatchCandidate['conviction']) {
  if (conviction === 'high') return { color: '#5eead4', bg: 'rgba(94, 234, 212, 0.14)', border: 'rgba(94, 234, 212, 0.3)' };
  if (conviction === 'medium') return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.3)' };
  return { color: '#93a4bd', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.3)' };
}

function toneForReviewStatus(status: MarketIntelManualWatchCandidate['reviewStatus']) {
  if (status === 'active') return { color: '#5eead4', bg: 'rgba(94, 234, 212, 0.14)', border: 'rgba(94, 234, 212, 0.3)' };
  if (status === 'paused') return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.3)' };
  return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.14)', border: 'rgba(107, 114, 128, 0.3)' };
}

function MarketContextCard({ symbol, label, price, changePct, freshness }: {
  symbol: string; label?: string; price: number | null; changePct: number | null; freshness: string;
}) {
  const isUp = (changePct ?? 0) >= 0;
  const tone = isUp
    ? { color: '#5eead4', bg: 'rgba(94, 234, 212, 0.1)' }
    : { color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' };
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'rgba(7, 12, 22, 0.72)', display: 'grid', gap: 5 }}>
      <div style={{ fontSize: 11, fontWeight: 760, letterSpacing: 0.3 }}>{symbol}</div>
      {label ? <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div> : null}
      <div style={{ fontSize: 16, fontWeight: 760 }}>{price !== null ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</div>
      {changePct !== null ? (
        <div style={{ fontSize: 12, fontWeight: 700, color: tone.color, background: tone.bg, display: 'inline-flex', padding: '2px 7px', borderRadius: 999, alignSelf: 'start' }}>
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      ) : null}
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{freshness}</div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 12,
        padding: '10px 11px',
        background: 'rgba(7, 12, 22, 0.72)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: 0.35, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 760, lineHeight: 1 }}>{value}</div>
      {hint ? <div style={{ color: 'var(--muted)', fontSize: 11 }}>{hint}</div> : null}
    </div>
  );
}

export function MarketIntelDashboard({ data }: { data: MarketIntelDashboardSummary }) {
  const [selection, setSelection] = useState<Selection>(
    data.executionCandidates[0]
      ? { kind: 'candidate', id: data.executionCandidates[0].candidateId }
      : data.trackedSignals[0]
      ? { kind: 'signal', id: data.trackedSignals[0].id }
      : null,
  );

  // Derive market regime from index changes
  const marketRegime = (() => {
    const changes = data.marketContext.indices
      .map((q) => q.changePct)
      .filter((c): c is number => c !== null);
    if (changes.length === 0) return null;
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    if (avg >= 0.5) return { label: 'Risk-On', color: '#5eead4', bg: 'rgba(94, 234, 212, 0.14)' };
    if (avg <= -0.5) return { label: 'Risk-Off', color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)' };
    return { label: 'Mixed', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)' };
  })();

  if (data.status === 'stub') {
    return (
      <section
        style={{
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: 16,
          padding: 18,
          background: 'linear-gradient(120deg, rgba(15, 23, 38, 0.95) 0%, rgba(6, 10, 20, 0.98) 100%)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.34 }}>Market Intel</div>
          <div style={{ fontSize: 20, fontWeight: 780, marginTop: 2 }}>Data unavailable</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted-strong)', lineHeight: 1.6 }}>
          Mission Control could not read the current Market Intel data files. This page stays honest: no simulated signals, no fake market context, no placeholder research radar.
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Check that the Market Intel data files exist and are readable, then refresh this page.
        </div>
      </section>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'candidate') {
      const candidate = data.executionCandidates.find((item) => item.candidateId === selection.id);
      return candidate ? { kind: 'candidate' as const, candidate } : null;
    }
    const signal = data.trackedSignals.find((item) => item.id === selection.id);
    return signal ? { kind: 'signal' as const, signal } : null;
  }, [selection, data.executionCandidates, data.trackedSignals]);

  const accuracyTotal = data.accuracySnapshot.correctCount + data.accuracySnapshot.incorrectCount + data.accuracySnapshot.duplicateCount;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* ── Market Context ─────────────────────────────────────── */}
      <section
        style={{
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 15,
          padding: 12,
          background: 'rgba(7, 12, 22, 0.75)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.34, marginBottom: 2 }}>Market context</div>

        {/* Indices row — primary */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 7 }}>Indices</div>
          {data.marketContext.indices.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              Index data unavailable — source fetch failed or market closed.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140, 1fr))', gap: 8 }}>
              {data.marketContext.indices.map((q) => (
                <MarketContextCard key={q.id} symbol={q.symbol} label={q.label ?? undefined} price={q.price} changePct={q.changePct} freshness={q.freshness} />
              ))}
            </div>
          )}
        </div>

        {/* Commodities row — secondary, visually less prominent */}
        <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 7 }}>Commodities</div>
          {data.marketContext.commodities.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              Commodity data unavailable.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.marketContext.commodities.map((q) => (
                <MarketContextCard key={q.id} symbol={q.symbol} label={q.label ?? undefined} price={q.price} changePct={q.changePct} freshness={q.freshness} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Manual Watch ─────────────────────────────────────── */}
      <section
        style={{
          border: '1px solid rgba(251, 191, 36, 0.22)',
          borderRadius: 15,
          padding: 12,
          background: 'linear-gradient(120deg, rgba(251, 191, 36, 0.1) 0%, rgba(9, 13, 23, 0.96) 60%, rgba(7, 11, 20, 0.98) 100%)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.34 }}>Research &amp; watchlist</div>
            <div style={{ fontSize: 17, fontWeight: 780, marginTop: 2 }}>Manual watch</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{data.manualWatch.items.length} items</span>
            <ManualWatchForm onAdded={() => window.location.reload()} />
          </div>

        </div>

        {data.manualWatch.items.length === 0 ? (
          <div
            style={{
              border: '1px dashed rgba(251, 191, 36, 0.28)',
              borderRadius: 12,
              padding: '20px 20px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 13,
              background: 'rgba(251, 191, 36, 0.03)',
            }}
          >
            No manual watch items yet. Tickers added to manual_watch_candidates.json appear here.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240, 1fr))', gap: 9 }}>
            {data.manualWatch.items.map((item) => {
              const conv = toneForConviction(item.conviction);
              const status = toneForReviewStatus(item.reviewStatus);
              return (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                    borderRadius: 12,
                    padding: '9px 11px',
                    background: 'rgba(8, 14, 24, 0.75)',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 780, fontSize: 15 }}>{item.symbol}</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 999,
                          border: `1px solid ${conv.border}`,
                          background: conv.bg,
                          color: conv.color,
                          fontWeight: 700,
                        }}
                      >
                        {item.conviction}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 999,
                          border: `1px solid ${status.border}`,
                          background: status.bg,
                          color: status.color,
                          fontWeight: 700,
                        }}
                      >
                        {item.reviewStatus}
                      </span>
                    </div>
                  </div>
                  {item.company && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{item.company}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted-strong)', lineHeight: 1.5 }}>{item.thesis}</div>
                  {item.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {item.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 10,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: 'var(--muted)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.linkedTheme && (
                    <div style={{ fontSize: 10, color: '#9d8df5', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {item.linkedTheme}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          border: '1px solid rgba(110, 168, 255, 0.24)',
          borderRadius: 16,
          padding: 12,
          background:
            'linear-gradient(120deg, rgba(110, 168, 255, 0.15) 0%, rgba(15, 23, 38, 0.95) 34%, rgba(6, 10, 20, 0.98) 100%)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.34 }}>
              Signals command deck
            </div>
            {marketRegime && (
              <div
                style={{
                  padding: '3px 9px',
                  borderRadius: 999,
                  border: `1px solid ${marketRegime.color}44`,
                  background: marketRegime.bg,
                  fontSize: 10,
                  color: marketRegime.color,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                {marketRegime.label}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {data.kpis.lastUpdated && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Signals {formatDate(data.kpis.lastUpdated)}
              </span>
            )}
            <div
              style={{
                padding: '4px 9px',
                borderRadius: 999,
                border: '1px solid rgba(110, 168, 255, 0.28)',
                background: 'rgba(110, 168, 255, 0.1)',
                fontSize: 10,
                color: '#9cc4ff',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {data.kpis.pendingCount} pending
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 9 }}>
          <KpiCard label="Candidates" value={String(data.kpis.candidateCount)} hint="ready to act on" />
          <KpiCard label="Pending review" value={String(data.kpis.pendingCount)} hint="need verification" />
          <KpiCard label="Verified" value={String(data.kpis.totalVerified)} hint="reviewed signals" />
          <KpiCard label="Evidence coverage" value={formatPct(data.kpis.evidenceCoverage)} hint="with evidence" />
          <KpiCard label="Research radar" value={String(data.researchRadar.items.length)} hint="ideas surfacing" />
          <KpiCard label="Duplicates" value={String(data.kpis.duplicateCount)} hint="flagged duplicates" />
        </div>
      </section>

      {/* ── Research Radar ─────────────────────────────────────── */}
      <section
        style={{
          border: '1px solid rgba(168, 130, 255, 0.28)',
          borderRadius: 15,
          padding: 12,
          background: 'linear-gradient(120deg, rgba(168, 130, 255, 0.12) 0%, rgba(10, 13, 24, 0.96) 55%, rgba(7, 11, 20, 0.98) 100%)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.34 }}>Ideas surfacing</div>
            <div style={{ fontSize: 18, fontWeight: 780, marginTop: 2 }}>Research radar</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {data.researchRadar.generatedAt ? (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>from {formatDate(data.researchRadar.generatedAt)}</span>
            ) : null}
            <span
              style={{
                padding: '4px 9px',
                borderRadius: 999,
                border: '1px solid rgba(168, 130, 255, 0.3)',
                background: 'rgba(168, 130, 255, 0.1)',
                fontSize: 10,
                color: '#c4b5fd',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {data.researchRadar.items.length} ideas
            </span>
          </div>
        </div>

        {data.researchRadar.items.length === 0 ? (
          <div
            style={{
              border: '1px dashed rgba(168, 130, 255, 0.3)',
              borderRadius: 12,
              padding: '24px 20px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 13,
              background: 'rgba(168, 130, 255, 0.04)',
            }}
          >
            No research radar items yet. System-surfaced pair-trade ideas and manual watch tickers appear here.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230, 1fr))', gap: 9 }}>
            {data.researchRadar.items.slice(0, 12).map((item) => {
              const conf = toneForConfidence(item.confidence);
              return (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid rgba(168, 130, 255, 0.22)',
                    borderRadius: 12,
                    padding: '9px 10px',
                    background: 'rgba(8, 14, 24, 0.75)',
                    display: 'grid',
                    gap: 7,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 780, fontSize: 15 }}>{item.symbol}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 999,
                          border: `1px solid ${conf.border}`,
                          background: conf.bg,
                          color: conf.color,
                          fontWeight: 700,
                        }}
                      >
                        {item.confidence}
                      </span>
                      {item.pairTradeReady && (
                        <span
                          style={{
                            fontSize: 9,
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: 999,
                            border: '1px solid rgba(94, 234, 212, 0.35)',
                            background: 'rgba(94, 234, 212, 0.1)',
                            color: '#5eead4',
                            fontWeight: 700,
                          }}
                        >
                          pair ✓
                        </span>
                      )}
                    </div>
                  </div>
                  {item.theme && (
                    <div style={{ fontSize: 10, color: '#9d8df5', textTransform: 'uppercase', letterSpacing: 0.3 }}>{item.theme}</div>
                  )}
                  {item.thesis && (
                    <div style={{ fontSize: 11, color: 'var(--muted-strong)', lineHeight: 1.5 }}>{item.thesis}</div>
                  )}
                  {item.whyNow && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>→ {item.whyNow}</div>
                  )}
                  {item.operatorSymbols.length > 1 && (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      ops: {item.operatorSymbols.slice(0, 4).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data.researchRadar.note && (
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
            {data.researchRadar.note}
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.35fr 0.8fr', gap: 12, alignItems: 'start' }}>
        <div
          style={{
            border: '1px solid rgba(110, 168, 255, 0.26)',
            borderRadius: 15,
            padding: 10,
            background: 'linear-gradient(180deg, rgba(110, 168, 255, 0.08) 0%, rgba(8, 14, 24, 0.85) 16%)',
            display: 'grid',
            gap: 10,
            minHeight: 560,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Execution candidates</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{data.executionCandidates.length} live</span>
          </div>
          <div style={{ display: 'grid', gap: 8, overflowY: 'auto', maxHeight: 500, paddingRight: 2 }}>
            {data.executionCandidates.map((candidate) => {
              const isSelected = selection?.kind === 'candidate' && selection.id === candidate.candidateId;
              const biasTone = toneForBias(candidate.executionBias);
              return (
                <button
                  key={candidate.candidateId}
                  onClick={() => setSelection({ kind: 'candidate', id: candidate.candidateId })}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: `1px solid ${isSelected ? 'rgba(110, 168, 255, 0.5)' : 'var(--border)'}`,
                    borderRadius: 12,
                    background: isSelected ? 'rgba(110, 168, 255, 0.14)' : 'rgba(8, 14, 24, 0.72)',
                    padding: '9px 10px',
                    display: 'grid',
                    gap: 7,
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 680, fontSize: 13 }}>{candidate.primaryInstrument?.symbol ?? 'No primary'}</div>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: `1px solid ${biasTone.border}`,
                        background: biasTone.bg,
                        color: biasTone.color,
                        fontWeight: 700,
                      }}
                    >
                      {candidate.executionBias ?? 'n/a'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-strong)', lineHeight: 1.45 }}>{candidate.sourceTitle}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                    <span>{candidate.sourceFeed}</span>
                    <span>•</span>
                    <span>{formatDate(candidate.generatedAt)}</span>
                    <span>•</span>
                    <span>prio {formatScore(candidate.executionPriority, 3)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 15,
            padding: 10,
            background: 'rgba(8, 14, 24, 0.78)',
            display: 'grid',
            gap: 10,
            minHeight: 560,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Tracked signals</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{data.trackedSignals.length} items</span>
          </div>
          <div style={{ display: 'grid', gap: 8, overflowY: 'auto', maxHeight: 500, paddingRight: 2 }}>
            {data.trackedSignals.map((signal) => {
              const isSelected = selection?.kind === 'signal' && selection.id === signal.id;
              const outcome = toneForOutcome(signal.outcome);
              return (
                <button
                  key={signal.id}
                  onClick={() => setSelection({ kind: 'signal', id: signal.id })}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: `1px solid ${isSelected ? 'rgba(94, 234, 212, 0.44)' : 'var(--border)'}`,
                    borderRadius: 12,
                    background: isSelected ? 'rgba(94, 234, 212, 0.12)' : 'rgba(7, 12, 22, 0.72)',
                    padding: '9px 10px',
                    display: 'grid',
                    gap: 7,
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 660, fontSize: 13, lineHeight: 1.35 }}>{signal.title}</div>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: `1px solid ${outcome.border}`,
                        background: outcome.bg,
                        color: outcome.color,
                        fontWeight: 700,
                      }}
                    >
                      {outcome.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                    <span>{signal.feed}</span>
                    <span>•</span>
                    <span>{signal.category}</span>
                    <span>•</span>
                    <span>{formatDate(signal.addedAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: 15,
            padding: 12,
            background: 'linear-gradient(180deg, rgba(18, 28, 45, 0.94) 0%, rgba(8, 14, 24, 0.92) 100%)',
            display: 'grid',
            gap: 10,
            minHeight: 560,
            alignContent: 'start',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Signal detail</h3>

          {!selected ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No candidate or tracked signal selected.</div>
          ) : selected.kind === 'candidate' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 760, lineHeight: 1.3 }}>{selected.candidate.sourceTitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <KpiCard label="Priority" value={formatScore(selected.candidate.executionPriority, 3)} />
                <KpiCard label="Reasoning" value={formatScore(selected.candidate.reasoningScore)} />
                <KpiCard label="Evidence" value={formatPct((selected.candidate.evidenceStrength ?? 0) * 100)} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65 }}>{selected.candidate.reasoning ?? 'No reasoning text.'}</div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.32 }}>Instrument map</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {selected.candidate.instrumentCandidates.slice(0, 4).map((instrument) => (
                    <div
                      key={`${selected.candidate.candidateId}-${instrument.symbol}`}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '8px 9px',
                        background: 'rgba(7, 12, 22, 0.72)',
                        display: 'grid',
                        gap: 5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: 13 }}>{instrument.symbol}</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatPct((instrument.mappingConfidence ?? 0) * 100)}</span>
                      </div>
                      {instrument.reason ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>{instrument.reason}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              {!!selected.candidate.dispatchReasons.length && (
                <div
                  style={{
                    border: '1px solid rgba(251, 191, 36, 0.28)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: 'rgba(251, 191, 36, 0.1)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 0.3 }}>Dispatch blockers</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#fcd34d', fontSize: 12 }}>
                    {selected.candidate.dispatchReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 760, lineHeight: 1.3 }}>{selected.signal.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <KpiCard label="Reasoning" value={formatScore(selected.signal.reasoningScore)} />
                <KpiCard label="Signal score" value={formatScore(selected.signal.signalScore)} />
                <KpiCard label="Outcome" value={toneForOutcome(selected.signal.outcome).label} />
              </div>

              {(selected.signal.evidencePack?.summary || selected.signal.verificationNote || selected.signal.notes) && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'rgba(7, 12, 22, 0.68)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                    Evidence / review
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-strong)', lineHeight: 1.6 }}>
                    {selected.signal.evidencePack?.summary ?? selected.signal.verificationNote ?? selected.signal.notes}
                  </div>
                </div>
              )}

              {!!selected.signal.evidencePack?.drivers.length && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Evidence drivers</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.6 }}>
                    {selected.signal.evidencePack.drivers.slice(0, 5).map((driver) => (
                      <li key={driver}>{driver}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!selected.signal.predictedCausalChain.length && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Predicted causal chain</div>
                  <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.6 }}>
                    {selected.signal.predictedCausalChain.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Accuracy Snapshot ─────────────────────────────────── */}
        <div
          style={{
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 15,
            padding: 10,
            background: 'rgba(8, 14, 24, 0.82)',
            display: 'grid',
            gap: 10,
            minHeight: 560,
            alignContent: 'start',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Accuracy snapshot</h3>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}>
                <span>Correct</span>
                <span>{data.accuracySnapshot.correctCount}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(94, 234, 212, 0.18)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${accuracyTotal > 0 ? (data.accuracySnapshot.correctCount / accuracyTotal) * 100 : 0}%`,
                    height: '100%',
                    background: '#5eead4',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}>
                <span>Incorrect</span>
                <span>{data.accuracySnapshot.incorrectCount}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(248, 113, 113, 0.16)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${accuracyTotal > 0 ? (data.accuracySnapshot.incorrectCount / accuracyTotal) * 100 : 0}%`,
                    height: '100%',
                    background: '#f87171',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}>
                <span>Duplicate</span>
                <span>{data.accuracySnapshot.duplicateCount}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(251, 191, 36, 0.18)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${accuracyTotal > 0 ? (data.accuracySnapshot.duplicateCount / accuracyTotal) * 100 : 0}%`,
                    height: '100%',
                    background: '#fbbf24',
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 6,
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '9px 10px',
              background: 'rgba(7, 12, 22, 0.74)',
              display: 'grid',
              gap: 7,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Reviewed raw</span>
              <span>{data.accuracySnapshot.totalReviewedRaw ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Weighted accuracy</span>
              <span style={{ fontWeight: 700 }}>{formatPct(data.accuracySnapshot.weightedAccuracy)}</span>
            </div>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.6 }}>
            Snapshot is computed from tracked signals plus the latest signal_accuracy_history.json. No simulated or placeholder values.
          </div>
        </div>
      </section>
    </div>
  );
}
