import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MarketIntelDashboardSummary } from '@/lib/types/contracts';

export function tradingCardStyle() {
  return {
    border: '1px solid rgba(121, 166, 148, 0.24)',
    borderRadius: 18,
    padding: 18,
    background: 'rgba(255, 255, 255, 0.78)',
    boxShadow: 'var(--shadow-card)',
  } as const;
}

export function formatTradingTime(value: string | null | undefined) {
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

export function TradingPageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            width: 'fit-content',
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(60, 102, 88, 0.12)',
            color: 'var(--accent-deep)',
            border: '1px solid rgba(60, 102, 88, 0.16)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          Trading
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, letterSpacing: -0.4 }}>{title}</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 860 }}>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function TradingKpiGrid({ data }: { data: MarketIntelDashboardSummary }) {
  const items = [
    { label: 'Candidates', value: String(data.kpis.candidateCount), hint: 'Execution surfaces with real underlying files' },
    { label: 'Pending', value: String(data.kpis.pendingCount), hint: 'Tracked signals still awaiting review' },
    { label: 'Manual watch', value: String(data.manualWatch.items.length), hint: 'Shared manual watch file-backed names' },
    {
      label: 'Research radar',
      value: String(data.researchRadar.items.length),
      hint: 'Interesting companies surfaced from signals and watch inputs',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} style={tradingCardStyle()}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{item.label}</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: 'var(--accent-deep)' }}>{item.value}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.hint}</div>
        </div>
      ))}
    </div>
  );
}

export function TradingSectionLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} style={{ ...tradingCardStyle(), display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
        <span style={{ fontSize: 12, color: 'var(--accent-mid)' }}>Open</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6 }}>{body}</div>
    </Link>
  );
}
