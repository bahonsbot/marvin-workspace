# Market Intel News Reader

Simple PWA news reader that renders `news_feed.json` in `app/index.html`.

## Generate feed

From **any** working directory:

```bash
python3 /data/.openclaw/workspace/projects/market-intel-news-reader/scripts/generate_feed.py
```

Or from workspace root:

```bash
cd /data/.openclaw/workspace
python3 projects/market-intel-news-reader/scripts/generate_feed.py
```

Output file:

- `/data/.openclaw/workspace/projects/market-intel-news-reader/news_feed.json`

## Data sources and fallback behavior

The generator prefers cached monitor outputs from:

- `projects/market-intel/data/rss_alerts.json`
- `projects/market-intel/data/reddit_alerts.json`

If these are missing or too small, it self-heals:

- RSS fallback: fetches multiple feeds with retry/backoff, custom user-agent, and pacing to reduce rate-limit issues
- Reddit fallback: fetches subreddit JSON endpoints first, then subreddit RSS as backup

## Enriched content fields

When upstream monitors provide enrichment, feed items preserve it:

- RSS items may include:
  - `enriched_text_source` (`headline_only`, `summary`, `article_excerpt`)
  - `article_excerpt` (best-effort, capped excerpt)
- Reddit items may include:
  - `selftext_snippet`
  - `top_comment_snippet`

This keeps backward compatibility with older consumers while exposing richer context for ranking and UI.

## Cron-safe notes

This script now resolves paths from its own file location, so it works whether cron runs from `/`, workspace root, or project directory.

## Troubleshooting

### RSS count is low

1. Re-run once after a minute to allow rate-limit backoff.
2. Check network from VPS:
   ```bash
   curl -I https://feeds.marketwatch.com/marketwatch/topstories/
   ```
3. If some providers are blocked temporarily, cached fallback can still populate feed.

### Reddit count is zero

1. Test direct endpoint:
   ```bash
   curl -A "MarketIntelNewsReader/1.1" "https://www.reddit.com/r/investing/hot/.json?limit=5&raw_json=1"
   ```
2. If JSON is blocked, script automatically falls back to `https://www.reddit.com/r/<subreddit>/.rss`.
3. Ensure outbound HTTPS is allowed on the VPS.

### Validate feed quickly

```bash
python3 - <<'PY'
import json
p='/data/.openclaw/workspace/projects/market-intel-news-reader/news_feed.json'
with open(p) as f:d=json.load(f)
print(d['stats'])
print('sample sources:', sorted({i['source'] for i in d['items'][:10]}))
PY
```
