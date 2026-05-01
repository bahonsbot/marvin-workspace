import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { MarketTapeItem } from '@/lib/trading/market-tape';
import styles from './trading.module.css';

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

export function tradingPanelStyle(extra?: CSSProperties) {
  return {
    borderTop: '1px solid rgba(28, 37, 32, 0.18)',
    background: 'rgba(255, 253, 249, 0.72)',
    paddingTop: 14,
    ...extra,
  } as const;
}

export function tradingCardStyle(extra?: CSSProperties) {
  return {
    border: '1px solid rgba(28, 37, 32, 0.12)',
    borderRadius: 18,
    padding: 18,
    background: 'rgba(255, 253, 249, 0.82)',
    boxShadow: '0 10px 30px rgba(17, 32, 26, 0.05)',
    minHeight: 300,
    maxHeight: 520,
    overflow: 'hidden',
    ...extra,
  } as const;
}

export function TradingPageFrame({
  eyebrow = 'Boiler Room',
  title,
  description,
  hideHeader = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  hideHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.tradingStyleScope} trading-room-shell`}>
      {hideHeader ? null : (
        <header className="trading-room-header">
          <div className="trading-room-eyebrow">{eyebrow}</div>
          <div className="trading-room-title-row">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

export function MarketTape({
  items,
  status = 'Static sample tape · live market tape not wired yet',
}: {
  items: MarketTapeItem[];
  status?: string;
}) {
  return (
    <div className="trading-market-tape-shell" aria-label="Market tape">
      <div className="trading-market-tape">
        {items.map((item) => {
          const mutedMove = item.change.startsWith('-') ? 'negative' : 'positive';
          return (
            <div key={item.label} className="trading-market-tape-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em className={mutedMove}>{item.change}</em>
            </div>
          );
        })}
        <div className="trading-market-tape-status">{status}</div>
      </div>
    </div>
  );
}

export function MiniLineChart({ values }: { values: number[] }) {
  const width = 720;
  const height = 220;
  const plotTop = 18;
  const plotBottom = 34;
  const plotHeight = height - plotTop - plotBottom;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = 12 + (index / Math.max(values.length - 1, 1)) * (width - 44);
      const y = plotTop + (1 - (value - min) / Math.max(max - min, 1)) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastPoint = points.split(' ').at(-1)?.split(',') ?? ['0', '0'];
  const lastX = Number(lastPoint[0]);
  const lastY = Number(lastPoint[1]);

  return (
    <svg className="trading-mini-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sample portfolio performance chart">
      <defs>
        <linearGradient id="tradingChartFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(22, 180, 95, 0.18)" />
          <stop offset="72%" stopColor="rgba(22, 180, 95, 0.04)" />
          <stop offset="100%" stopColor="rgba(22, 180, 95, 0)" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((line) => {
        const y = plotTop + (line / 3) * plotHeight;
        return <line key={line} x1="12" y1={y} x2={width - 22} y2={y} stroke="rgba(28,37,32,0.08)" strokeWidth="1" />;
      })}
      <path d={`M12,${height - plotBottom} L ${points} L ${width - 22},${height - plotBottom} Z`} fill="url(#tradingChartFill)" />
      <polyline points={points} fill="none" stroke="#16B45F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4" fill="#16B45F" stroke="#fffdf9" strokeWidth="2" />
      <line x1="12" y1={height - plotBottom} x2={width - 22} y2={height - plotBottom} stroke="rgba(28,37,32,0.14)" />
    </svg>
  );
}

export function TabScaffold({ tabs }: { tabs: string[] }) {
  return (
    <div className="trading-tab-row" role="tablist" aria-label="Planned tabs">
      {tabs.map((tab, index) => (
        <button key={tab} type="button" className={index === 0 ? 'active' : ''} role="tab" aria-selected={index === 0}>
          {tab}
        </button>
      ))}
    </div>
  );
}

export function PlaceholderPage({
  title,
  description,
  tabs,
  children,
}: {
  title: string;
  description: string;
  tabs?: string[];
  children?: ReactNode;
}) {
  return (
    <TradingPageFrame title={title} description={description}>
      {tabs ? <TabScaffold tabs={tabs} /> : null}
      <div className="trading-placeholder-grid">
        <section style={tradingCardStyle()}>
          <div className="trading-section-label">Planned surface</div>
          <h2>Static shell first</h2>
          <p>
            This page is intentionally a placeholder while BOILER ROOM proves its layout, navigation, desktop rhythm, and mobile behavior.
          </p>
        </section>
        {children}
      </div>
    </TradingPageFrame>
  );
}

export function TradingSectionLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="trading-section-link">
      <span>{title}</span>
      <p>{body}</p>
    </Link>
  );
}
