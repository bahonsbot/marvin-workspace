import { PlaceholderPage, tradingCardStyle } from '@/components/pages/trading/shared';
import { newsItems, newsTabs } from '@/components/pages/trading/trading-sample-data';

export default function TradingNewsPage() {
  return (
    <PlaceholderPage title="News" description="Market news, watchlist news, earnings/calendar, reports, and filings in one tabbed room." tabs={newsTabs}>
      <section style={tradingCardStyle()}>
        <div className="trading-section-label">Sample feed</div>
        <div className="trading-news-list">
          {newsItems.map((item) => <article key={item.title}><span>{item.tag}</span><strong>{item.title}</strong><p>{item.source} · {item.time}</p></article>)}
        </div>
      </section>
    </PlaceholderPage>
  );
}
