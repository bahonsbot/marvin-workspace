import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';

export default function TradingSignalsPage() {
  return (
    <PlaceholderPage title="Signals" description="Secondary route for future signal review. Not part of the initial sidebar while BOILER ROOM follows the Atreus structure.">
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Secondary surface</div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Signals can feed Watchlist, Screener, and Bots later. For the first pass, this stays quiet so the main navigation remains clean.
        </p>
      </section>
    </PlaceholderPage>
  );
}
