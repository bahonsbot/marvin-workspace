import Link from 'next/link';
import type { HomeMarketSignalsSummary } from '@/lib/types/contracts';

type MarketSignalsWidgetProps = {
  summary: HomeMarketSignalsSummary;
  formatRelative: (value: string) => string;
};

function signalTone(score: number) {
  if (score >= 1) return 'strong';
  if (score < 0) return 'cautious';
  return 'neutral';
}

export function MarketSignalsWidget({ summary, formatRelative }: MarketSignalsWidgetProps) {
  const tone = signalTone(summary.strongBuy - summary.sell);

  return (
    <article className="general-home-widget-card" aria-label="Market signals">
      <div className="general-home-widget-header">
        <h3 className="general-home-widget-title">Market signals</h3>
        <span className={`general-home-signal-dot general-home-signal-dot-${tone}`} aria-hidden="true" />
      </div>

      {summary.total > 0 ? (
        <>
          <p className="general-home-widget-primary">
            {summary.strongBuy} STRONG BUY · {summary.sell} SELL
          </p>
          <p className="general-home-widget-meta">
            {summary.latestTitle ? `Latest: ${summary.latestTitle}` : 'Latest signal available'}
          </p>
          {summary.latestAt ? (
            <p className="general-home-widget-subtle">Updated {formatRelative(summary.latestAt)}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className="general-home-widget-primary">No recent market signals</p>
          <p className="general-home-widget-meta">Signal ingestion is quiet right now.</p>
        </>
      )}

      <Link href="/trading/signals" className="general-home-widget-link">
        Open signals
      </Link>
    </article>
  );
}
