# Mission Control Trading Lab — Savepoint Addendum

Date: 2026-04-28 Asia/Ho_Chi_Minh  
Scope: `projects/mission-control-lab` only  
Status: BOILER ROOM Overview approved directionally; ticker detail page is now provider-ready, mobile-friendly, and backed by first Yahoo chart/search adapter  
Parent plan: `projects/mission-control-lab/docs/trading-section-lab-implementation-plan-2026-04-27.md`

## Read this first next time

Philippe had to leave for dinner after reviewing the ticker mobile pass. The next agent should be able to resume from this document without Philippe re-explaining the day.

The high-level state:

- **Do not promote Lab to live `projects/mission-control` without Philippe's explicit approval.** All Trading work today stayed in `projects/mission-control-lab`.
- The Trading rebuild is called **BOILER ROOM**.
- The BOILER ROOM Overview page is considered **good enough / approved directionally for now** and should remain the visual anchor.
- The ticker page `/trading/ticker/[symbol]` has been built, polished, made source-ready, given a first real provider adapter, debugged, and made mobile-friendly.
- The next best product slice is probably a **Cash & Debt / Balance Sheet snapshot** module, implemented through the existing `TickerProfile` contract/source shape rather than hardcoding page-local data.
- Continue to use Atreus as the primary content/layout reference. Zero Sum informs data/cache architecture and module depth, not the default visual language.

## Current visual/product direction

### Durable visual thesis

BOILER ROOM should feel like a quiet institutional finance terminal with editorial density:

- light cream / parchment surface;
- dark ink text;
- muted green/red market states;
- precise tables and thin dividers;
- restrained cards/panels only where they help interaction;
- serious research workspace, not a decorative dashboard mosaic.

### References and how to use them

- **Atreus** is the main reference for page IA, calm layout discipline, sidebar/nav style, account snapshot, watchlist tables, ticker detail structure, profile/resources, and restrained module hierarchy.
- **Zero Sum Times** is useful for backend/cache architecture, stock-detail module depth, and analytical ideas such as cash/debt, balance sheet bars, moving-average controls, ratings radar, technical scorecards, and compact metric rails.
- **Portfolio Dividend Tracker** remains mostly relevant for future Portfolio/X-ray: allocation, closed positions, exposure tabs, ETF decomposition, strategy/broker/country/currency exposure. It is not the visual default for ticker detail.

## Overview page state

Route: `/trading`

The Overview was already approved directionally before the ticker work continued.

Important current state:

- no redundant top title block;
- Atreus-style account card with total account value, day P/L, all-time P/L, centered range tabs, and green line/area chart;
- Portfolio Health uses Atreus categories: Concentration, ESG Alignment, Risk Level, Diversification;
- Pinned Watchlists are clean, column-aligned, and free of micro horizontal scroll on desktop;
- Top Movers, Earnings, and News Pulse remain compact secondary modules without extra subtitles;
- Overview is the design anchor for future Trading pages.

Relevant commits from the Overview phase:

- `16939b5 Polish Lab trading overview`
- `1b566bf Fix Lab watchlist overflow`
- `74fd60b Align Lab watchlist day column`
- `44037ed Document Lab trading overview polish`

## Ticker page implementation state

Route: `/trading/ticker/[symbol]`

Current page shape:

- market tape at top;
- back link to `/trading`;
- quote/identity panel with ticker mark, company name, ticker, exchange;
- price/change/as-of block;
- compact stats strip: Market Cap, P/E, Sector, Industry;
- tab row: Overview, Financials, News, Metrics, Estimates, Dividends, Ownership, SEC Filings;
- right-aligned watchlist button in the tab/action row, not inside the quote identity block;
- main chart panel with price range buttons and chart stats;
- company profile/facts panel;
- financial highlights grid with small sparklines;
- recent news/resources modules;
- financial overview bars: revenue vs net income;
- key ratios grid.

### Watchlist UI decision

Philippe requested that the original `+ Follow` button be moved out of the quote header and into the tab row. Current behavior:

- `+ Watchlist` when not watched;
- `− Watchlist` when watched/removing;
- current sample state renders as watched (`− Watchlist`);
- watched/not-watched states have subtle visual differences;
- the stock price is smaller than the company name so it does not dominate the header.

Relevant commit:

- `71eb627 Polish Lab ticker watchlist controls`

## Data architecture state

The ticker page no longer reads fixture data directly. It now goes through a provider-ready contract/cache/source pipeline.

Important files:

- `projects/mission-control-lab/lib/trading/contracts.ts`
- `projects/mission-control-lab/lib/trading/cache.ts`
- `projects/mission-control-lab/lib/trading/sources.ts`
- `projects/mission-control-lab/lib/trading/sources/sample.ts`
- `projects/mission-control-lab/lib/trading/sources/yahoo.ts`
- `projects/mission-control-lab/lib/trading/ticker-profile.ts`
- `projects/mission-control-lab/data/trading/.gitignore`
- runtime cache directory, ignored: `projects/mission-control-lab/data/trading/ticker-profiles/`

### Contract layer

`contracts.ts` defines the future data shape for ticker research pages:

- `TickerProfile`
- quote and source metadata;
- company profile/facts;
- price series and chart stats;
- financial highlights;
- news/resources;
- financial overview bars;
- key ratios;
- `sourceMap`, `asOf`, and `freshness` state.

`getTickerProfile(symbol)` is the page entrypoint and returns a complete profile.

Relevant commit:

- `ff3d885 Add Lab ticker profile contract`

### Cache/source pipeline

The source pipeline is deliberately Zero Sum-inspired but much lighter:

1. normalize symbol;
2. read disk cache if fresh;
3. if no fresh cache, try provider sources in order;
4. write successful profile to `data/trading/ticker-profiles/{SYMBOL}.json`;
5. return profile;
6. if provider fails, fall back to sample source.

`cache.ts` provides:

- server-only disk cache;
- sanitized ticker paths;
- JSON envelope with schema version, symbol, cachedAt, ttlMs, profile;
- TTL checking;
- atomic-ish write via temp file + rename.

`data/trading/.gitignore` keeps generated ticker-profile JSON files out of git.

Relevant commit:

- `326e59f Add Lab ticker profile cache pipeline`

### Symbol-aware sample source

The sample source was fixed because Philippe noticed every ticker still said NVIDIA Corporation in name/profile even when the route symbol changed.

Current sample source behavior:

- known symbol-aware fixtures for `NVDA`, `MSFT`, `TSM`, and `AAPL`;
- distinct company names, exchanges, quote snippets, market cap/P/E/sector/industry, summaries, facts, news, and selected ratios;
- unknown symbols use an honest fallback such as `XYZ Holdings` and `Provider pending` fields;
- no more random ticker pretending to be NVIDIA in a fake moustache.

Relevant commit:

- `4103745 Make Lab ticker sample profiles symbol aware`

## Yahoo provider adapter state

The first actual provider adapter is implemented.

File:

- `projects/mission-control-lab/lib/trading/sources/yahoo.ts`

Source order:

- `yahooTickerProfileSource`
- `sampleTickerProfileSource`

So Yahoo is tried first, then the symbol-aware sample fallback.

### Yahoo endpoints tested

Working:

- `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1y&interval=1d`
- `https://query1.finance.yahoo.com/v1/finance/search?q={symbol}&quotesCount=1&newsCount=0`

Not used:

- quoteSummary / quote endpoints, because they returned 401/crumb/auth responses.
- Python `urllib` without browser-ish user-agent hit 429.
- Node fetch / curl with browser-ish user-agent worked for chart/search.

Current Yahoo adapter fills:

- symbol;
- company name;
- exchange;
- currency;
- quote price;
- daily change and daily change percentage;
- Yahoo as-of time;
- compact 1Y price series for the page chart;
- chart axis labels;
- chart stats including open/high/low/previous close/volume/52-week range where available;
- sector and industry from Yahoo search when available.

Current Yahoo adapter still falls back to sample modules for:

- profile narrative;
- financial highlights;
- recent news;
- resources;
- filings;
- many fundamentals such as market cap/P/E if chart metadata lacks them.

This is intentional. Do not pretend we have complete fundamentals yet.

Relevant commit:

- `cb7a55c Add Lab Yahoo ticker source adapter`

### Daily-change bug and fix

Philippe noticed AMZN showed something like:

```text
$261.12 +72.13 (+38.17%)
```

That was obviously not a daily move.

Root cause:

- The first Yahoo adapter compared `regularMarketPrice` to `chartPreviousClose` from the `range=1y` chart.
- For the 1Y Yahoo chart, `chartPreviousClose` is effectively the pre-range/start-of-range close, not yesterday's close.
- That made the header display a fake 1Y-ish move as if it were daily.

Fix:

- derive daily change from the last two valid daily closes in the Yahoo chart series;
- only fall back to metadata if needed.

Verification values for AMZN during the fix:

- price: `261.12`
- wrong `chartPreviousClose`: `188.99`
- last close: `261.119995...`
- previous daily close: `263.989990...`
- corrected output: `$261.12 -2.87 -1.09%`

Relevant commit:

- `2e3c4f5 Fix Lab Yahoo daily change calculation`

## Mobile ticker pass

Philippe paused further provider/module work to fix mobile first because Overview was already mobile-friendly and the ticker page was not.

This was treated as a foundation change before adding more modules.

File changed:

- `projects/mission-control-lab/components/pages/trading/trading.module.css`

### Mobile visual thesis

BOILER ROOM mobile should feel like a compact research terminal, not a squeezed desktop table.

### Mobile implementation details

Dedicated max-width `560px` ticker layout was added:

- compact quote header;
- smaller ticker mark;
- company name wraps properly;
- wrapped price/change/as-of row;
- 2-column stat grid;
- full-width Watchlist button;
- tabs and range controls have larger touch targets;
- mobile chart height reduced;
- chart axis label density reduced;
- cards/panels get mobile padding and radius tuning;
- profile facts and key ratios stack into mobile-friendly rows;
- financial highlights become single-column mobile cards with sparkline on the right;
- news/resources tighten up;
- revenue/net-income bar chart compresses for mobile.

### Shell/sidebar mobile bug

First mobile screenshot showed a bigger problem: the Lab shell sidebar was still visible at mobile width and squeezed the content.

Fix:

- strengthened the Trading shell mobile CSS rule with a `:has(.trading-shell-main)` fallback;
- this was needed because CSS-module class composition on the main shell meant the original `.app-shell-grid.trading-shell-grid` override was not reliably collapsing the sidebar.

### Mobile verification

Tools used:

- Chromium headless screenshots at `390x1200`;
- image review;
- Chrome DevTools Protocol measurement of `documentElement.scrollWidth` and `body.scrollWidth`.

Findings:

- initial screenshot: sidebar visible, page squeezed, content clipped;
- after shell fix: sidebar gone, content flow correct;
- later screenshot still looked like scroll rows were clipping, but CDP measurement showed no true page-wide horizontal overflow;
- final measured width: `documentElement.scrollWidth = 390`, `body.scrollWidth = 390` at a 390px viewport;
- remaining offscreen items are intentional horizontal scroll rows for the market tape and tabs.

Relevant commit:

- `2d2efe1 Improve Lab ticker mobile layout`

Screenshot artifacts were written under:

- `projects/mission-control-lab/tmp/mobile-check/`

They are untracked/ignored and do not need to be committed.

## Validation evidence across the ticker work

Repeated validation used:

- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run build`
- `scripts/lab-health.sh`
- route checks with `curl`
- HTML grep checks for expected content;
- runtime cache inspection for provider/fallback state;
- Chromium mobile screenshots and CDP width measurements.

Typical route checks that passed:

- `/trading`
- `/trading/ticker/NVDA`
- `/trading/ticker/MSFT`
- `/trading/ticker/TSM`
- `/trading/ticker/AAPL`
- `/trading/ticker/AMZN`
- `/trading/ticker/FAKEZZZ`

Important provider verification examples:

- `MSFT`: `fresh/yahoo`, live price `$424.82`, daily `+0.20 +0.05%` during verification.
- `AMZN`: `fresh/yahoo`, live price `$261.12`, daily `-2.87 -1.09%` after the daily-change fix.
- `FAKEZZZ`: `sample/sample`, `$—`, `Provider pending` fallback.

## Known warnings and what not to touch casually

Lab builds still show warnings that were intentionally not fixed during Trading UI work:

- deprecated middleware convention warning;
- dynamic autonomous runner trace warning around `app/api/tasks/autonomous/[taskId]/execute/route.ts` / `run-autonomous-task.mjs`;
- NFT tracing warning involving `next.config.js`, `lib/adapters/files.ts`, and `app/api/files/roots/route.ts`.

Do not opportunistically fix these while continuing Trading UI/product work. Philippe previously warned that fragile runtime/tracing areas caused serious issues and rollback risk. Only touch them with explicit approval and a dedicated recovery-safe plan.

## Lab runtime caveat

Repeated during today’s work:

- `scripts/lab-restart.sh` / preview scripts sometimes showed EADDRINUSE or PID-capture noise around Lab ports;
- direct checks often still showed the correct Lab stack healthy;
- final validations used `scripts/lab-health.sh`, direct route checks, and process/port inspection as needed;
- live Dashboard processes were not touched.

Treat Lab restart script failure/noise carefully. Do not use broad process kills. Use port/PID-scoped inspection and preserve the Lab/Dashboard separation.

## Current dirty/untracked expectations

The broader repository remains dirty from unrelated work. Do not assume global `git status` is only Trading work.

Expected Lab runtime artifacts that should stay uncommitted:

- `projects/mission-control-lab/data/trading/ticker-profiles/*.json`
- `projects/mission-control-lab/tmp/mobile-check/*`

New/modified Lab Trading files from this phase have been committed in focused commits.

## Current committed sequence for ticker work

Key commits to understand the current route:

```text
bdb1897 Build Lab trading ticker detail prototype
71eb627 Polish Lab ticker watchlist controls
ff3d885 Add Lab ticker profile contract
326e59f Add Lab ticker profile cache pipeline
4103745 Make Lab ticker sample profiles symbol aware
cb7a55c Add Lab Yahoo ticker source adapter
2e3c4f5 Fix Lab Yahoo daily change calculation
2d2efe1 Improve Lab ticker mobile layout
```

There are also log/documentation commits after several implementation commits.

## Recommended next work

Recommended next slice:

### 1. Add Cash & Debt / Balance Sheet snapshot module

Why this next:

- It is the first richer analytical module from the Zero Sum review.
- It adds meaningful research value without jumping into a full fundamentals engine.
- It can be implemented through `TickerProfile` and the source pipeline, preserving architecture discipline.

Suggested shape:

- add contract fields for a balance-sheet/cash-debt snapshot;
- sample source provides symbol-aware or generic fixture values;
- Yahoo source can leave this as sample/fallback for now unless a reliable endpoint is found;
- UI module should sit below or near Company Profile / Financial Highlights;
- keep source/freshness metadata visible or at least inspectable;
- mobile layout must be included in the same slice, not deferred.

Possible fields:

- cash and equivalents;
- total debt;
- net cash / net debt;
- current ratio;
- debt/equity;
- free cash flow;
- cash/debt trend mini bars;
- one short interpretation line such as `Net cash position` / `Levered balance sheet` / `Provider pending`.

### 2. Then consider a fundamentals source

Options:

- keep Yahoo chart/search only and use sample/fallback for fundamentals until a proper provider is chosen;
- evaluate Defeat-Beta behind a Python helper/service, not directly in Next render path;
- consider FMP/Alpha Vantage later if free sources are insufficient;
- use SEC/EDGAR specifically for filings/resources, not quote/fundamentals.

### 3. Then deepen chart controls

Potential later chart work:

- moving-average toggles;
- period switching with provider fetches;
- larger chart terminal link;
- technical summary module.

Do not install chart dependencies until the actual slice needs them.

## Strong rules for continuation

- Stay Lab-only unless Philippe explicitly approves promotion.
- Keep BOILER ROOM Overview as design truth.
- Do not let Zero Sum replace the visual language.
- Use server-side cached adapters, not client-side provider calls.
- Keep market/research data separate from broker/account/execution data.
- Do not integrate IBKR or trading execution unless explicitly requested later.
- For visual changes, verify rendered behavior, preferably screenshot/CDP for mobile or subtle layout issues.
- For provider data, validate actual cache contents and rendered output, not just TypeScript/build success.
- For any odd market value, check source semantics before assuming it is correct. The AMZN daily-change bug is the precedent.
- Preserve mobile behavior with every new module.

## Quick resume checklist

1. Read this addendum and the parent implementation plan.
2. Check current Lab status:
   - `cd /data/.openclaw/workspace/projects/mission-control-lab`
   - `scripts/lab-health.sh`
   - `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3015/trading/ticker/AMZN`
3. Inspect current ticker files before editing:
   - `app/trading/ticker/[symbol]/page.tsx`
   - `components/pages/trading/trading.module.css`
   - `lib/trading/contracts.ts`
   - `lib/trading/ticker-profile.ts`
   - `lib/trading/sources/sample.ts`
   - `lib/trading/sources/yahoo.ts`
4. For provider/cache changes, clear runtime cache before verification:
   - `rm -rf data/trading/ticker-profiles`
5. Validate:
   - `npx tsc --noEmit --pretty false`
   - `npm run lint`
   - `npm run build`
   - `scripts/lab-health.sh`
   - route/cache/render checks
6. Commit only focused Lab/doc/memory changes. Ignore unrelated global repo dirt.
