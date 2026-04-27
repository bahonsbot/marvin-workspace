import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';

export default function TradingBotsPage() {
  return (
    <PlaceholderPage title="Bots" description="Read-only equity and futures automation posture first. Execution controls come later, gated and explicit.">
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Execution boundary</div>
        <h2>No live controls in this slice</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>This room starts as status and design scaffolding only. No broker connection, no order submission, no hidden dispatch.</p>
      </section>
    </PlaceholderPage>
  );
}
