import { getHomeSummary } from '@/lib/adapters/home';
import { MarketWatchRefreshButton } from './MarketWatchRefreshButton';

function formatRelative(at: string | null) {
  if (!at) return 'unavailable';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return 'unavailable';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function formatHeroDate() {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
    .format(new Date())
    .toUpperCase();
}

function formatUptime(seconds: number | null) {
  if (!seconds || seconds < 0) return 'n/a';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function weatherIcon(condition: string | undefined) {
  const value = (condition ?? '').toLowerCase();
  if (value.includes('thunder')) return '⛈️';
  if (value.includes('rain') || value.includes('drizzle')) return '🌧️';
  if (value.includes('snow')) return '❄️';
  if (value.includes('fog')) return '🌫️';
  if (value.includes('cloud') || value.includes('overcast')) return '⛅';
  return '☀️';
}

export default async function HomePage() {
  const summary = await getHomeSummary();
  const weather = summary.ambient.weather;

  return (
    <section className="general-home-v3-shell">
      <header className="general-home-v3-hero-grid">
        <div className="general-home-v3-hero-main">
          <div className="general-home-v3-date">{formatHeroDate()}</div>
          <h1 className="general-home-v3-headline">{summary.ambient.greeting}, Philippe.</h1>
        </div>

        <aside className="general-home-v3-weather-quote" aria-label="Weather and daily quote">
          <div className="general-home-v3-weather-row">
            <div className="general-home-v3-weather-temp">{weather?.temperatureC ?? '—'}°</div>
            <div className="general-home-v3-weather-meta">
              <div>{weather?.location ?? 'Location unavailable'}</div>
              <div>
                {weatherIcon(weather?.condition)} {weather?.condition ?? 'Weather unavailable'}
              </div>
            </div>
          </div>
          <div>
            <blockquote className="general-home-v3-quote">“{summary.ambient.quote.text}”</blockquote>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b756f', letterSpacing: '0.01em' }}>— {summary.ambient.quote.author}</div>
          </div>
        </aside>
      </header>

      <section className="general-home-v3-lower-grid" aria-label="Market and custom news">
        <section className="general-home-v3-market" aria-label="Market watch news reader">
          <div className="general-home-v3-market-head">
            <h2>Market Watch</h2>
            <MarketWatchRefreshButton />
          </div>

          {summary.marketWatch.selectionNote ? <p className="general-home-v3-market-note">{summary.marketWatch.selectionNote}</p> : null}

          {summary.marketWatch.headlines.length > 0 ? (
            <ol className="general-home-v3-news-list">
              {summary.marketWatch.headlines.slice(0, 30).map((item) => (
                <li key={item.id} className="general-home-v3-news-item">
                  <div className="general-home-v3-news-kicker">
                    <span>{item.source}</span>
                    <span>{formatRelative(item.at)}</span>
                  </div>
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" className="general-home-v3-news-link">
                      {item.title}
                    </a>
                  ) : (
                    <div className="general-home-v3-news-link is-static">{item.title}</div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="general-home-v3-news-empty">No local RSS-derived headlines are currently available in the workspace data sources.</p>
          )}
        </section>

        <section className="general-home-v3-custom-news" aria-label="Custom News briefings">
          <div className="general-home-v3-custom-news-head">
            <h2>Custom News</h2>
            <span>24h English briefings</span>
          </div>

          {summary.customNews.items.length > 0 ? (
            <ol className="general-home-v3-custom-news-list">
              {summary.customNews.items.slice(0, 30).map((item) => (
                <li key={item.id} className="general-home-v3-custom-news-item">
                  <h3>{item.headline}</h3>
                  <p><strong>Sources:</strong> {item.sources.length > 0 ? item.sources.join(', ') : 'Unknown source'}</p>
                  <p><strong>What happened:</strong> {item.whatHappened}</p>
                  <p><strong>Why it matters:</strong> {item.whyItMatters}</p>
                  {item.differingViews ? <p><strong>Differing views:</strong> {item.differingViews}</p> : null}
                  {item.links.length > 0 ? (
                    <p className="general-home-v3-custom-news-links">
                      🔗{' '}
                      {item.links.map((link, idx) => (
                        <span key={`${item.id}-link-${idx}`}>
                          <a href={link.url} target="_blank" rel="noreferrer">{link.title}</a>
                          {idx < item.links.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="general-home-v3-news-empty">Custom News has no briefings yet. It updates on the :20 and :50 feed cycle.</p>
          )}
        </section>
      </section>

      <div className="general-home-v3-bottom-strip" role="status" aria-live="polite">
        <span className="label"><span className="status-dot" aria-hidden="true" />VPS</span>
        <span>RAM {summary.system.ramUsedPercent ?? 'n/a'}%</span>
        <span>Disk {summary.system.diskUsedPercent ?? 'n/a'}%</span>
        <span>Load {summary.system.loadAverage1m ?? 'n/a'}</span>
        <span>Uptime {formatUptime(summary.system.uptimeSeconds)}</span>
        <span>RSS {formatRelative(summary.marketWatch.updatedAt)}</span>
      </div>
    </section>
  );
}
