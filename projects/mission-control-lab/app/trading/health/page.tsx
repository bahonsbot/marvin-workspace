import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';
import { healthItems } from '@/components/pages/trading/trading-sample-data';

export default function TradingHealthPage() {
  return (
    <PlaceholderPage title="Health" description="Atreus-style portfolio health, risk, concentration, diversification, and rule checks.">
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Health checks</div>
        <div className="trading-health-list">
          {healthItems.map((item) => <div key={item.label} className="trading-health-row"><span>{item.label}</span><strong>{item.value}</strong><p>{item.detail}</p></div>)}
        </div>
      </section>
    </PlaceholderPage>
  );
}
