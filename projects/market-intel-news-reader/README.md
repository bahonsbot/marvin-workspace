# Market Intel News Reader

Simple PWA news reader that displays RSS and Reddit alerts from the market-intel pipeline.

## Architecture

The app reads **directly from the market-intel data sources**:

- `projects/market-intel/data/rss_alerts.json` — Updated hourly by `rss-feed-monitor` cron
- `projects/market-intel/data/reddit_alerts.json` — Updated hourly by `reddit-monitor` cron

**No separate feed generation needed** — the app combines both sources in real-time.

## Data Flow

```
RSS feeds → rss-feed-monitor (cron) → rss_alerts.json → News Reader App
Reddit → reddit-monitor (cron) → reddit_alerts.json → News Reader App
```

## Opening the App

### Quick Start (Test Locally)

```bash
cd projects/market-intel-news-reader
./scripts/build_for_github_pages.sh
cd app
python3 -m http.server 8080
```

Open: http://localhost:8080

### Production (GitHub Pages)

1. **Build the app** (copies RSS/Reddit JSON into app/ folder):
   ```bash
   cd projects/market-intel-news-reader
   ./scripts/build_for_github_pages.sh
   ```

2. **Push to GitHub Pages**:
   - Push the `app/` folder contents to your GitHub Pages branch
   - Or deploy to Netlify/Vercel (drag & drop the `app/` folder)

3. **Update data regularly**:
   - Re-run `build_for_github_pages.sh` after each RSS/Reddit cron run
   - Or set up auto-deploy via GitHub Actions

**Note:** The app includes snapshot data from build time. For live data, re-run the build script.

## Data Schema

The app normalizes both RSS and Reddit items to a common format:

**RSS items:**
- `id`: `rss_<timestamp>`
- `title`, `summary`, `url`, `source`, `category`, `timestamp`
- `type`: `"rss"`
- `enriched_text_source`: `headline_only`, `summary`, or `article_excerpt`

**Reddit items:**
- `id`: `reddit_<timestamp>`
- `title`, `summary` (from selftext or top comment), `url`, `source`, `category`, `timestamp`
- `type`: `"reddit"`
- `score`, `comments`: engagement metrics

## Features

- **Combined feed**: RSS + Reddit in a single chronological view
- **Category filters**: Filter by topic (geopolitical, financial, sentiment, etc.)
- **Source filters**: Toggle RSS vs Reddit sources
- **Dark/Light theme**: Auto-detects system preference, manual toggle available
- **PWA-ready**: Install on iPhone/Android as a standalone app
- **Responsive**: Optimized for mobile and desktop

## Troubleshooting

### Feed not loading

1. Check that market-intel monitors are running:
   ```bash
   openclaw cron list | grep -E "rss-feed|reddit"
   ```

2. Verify data files exist and are recent:
   ```bash
   ls -lh projects/market-intel/data/rss_alerts.json
   ls -lh projects/market-intel/data/reddit_alerts.json
   ```

3. Check browser console for fetch errors (F12 → Console)

### RSS count is low

- Re-run monitor: `cd projects/market-intel && python3 src/rss_monitor.py`
- Check network from VPS: `curl -I https://feeds.marketwatch.com/marketwatch/topstories/`

### Reddit count is zero

- Test endpoint: `curl -A "MarketIntelNewsReader/1.1" "https://www.reddit.com/r/investing/hot/.json?limit=5&raw_json=1"`
- Ensure outbound HTTPS is allowed on the VPS
