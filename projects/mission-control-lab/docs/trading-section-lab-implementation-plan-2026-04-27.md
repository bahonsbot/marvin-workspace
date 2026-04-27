# Mission Control Trading Section — Lab Implementation Plan

Date: 2026-04-27 Asia/Ho_Chi_Minh
Status: Planning only, no implementation yet
Scope: `projects/mission-control-lab` only until Philippe explicitly approves Dashboard promotion

## Executive recommendation

Rebuild Trading as a serious operator workspace in Lab, not as a reskin of the current placeholder pages.

The right first version is a hybrid of three references:

1. **Atreus dashboard screenshots** for calm portfolio/account UX: clear account value, P/L, health snapshot, watchlists, ticker detail pages, and resource panels.
2. **Zero Sum Times** for dense market/research tooling: ticker tape, sector heatmap, movers, earnings, stock analysis, fundamentals, technical charting, watchlist, compare, correlation, congress/insider/dividend research.
3. **Portfolio Dividend Tracker** for personal portfolio intelligence: allocation, P/L, weights, diversification, strategy tags, closed positions, and X-ray exposure including ETF/holding decomposition.

Build this in Lab as a coherent product surface called **BOILER ROOM**. Do not promote anything to live Dashboard until Philippe approves the Lab result.

## Product thesis

### Visual thesis

A quiet institutional terminal with editorial finance density: cream paper, dark ink, muted green/red market state, precise tables, thin dividers, and one dark portfolio/X-ray mode where exposure needs depth.

### Content plan

- **Overview:** market tape, account/portfolio snapshot, day/all-time P/L, watchlists, sector/health snapshot, market movers/news/earnings.
- **Ticker detail:** quote header, chart, tabs, company profile, financial highlights, news/resources, fundamentals, technical summary, dividends/ownership/SEC.
- **Portfolio/X-ray:** IBKR/manual holdings, P/L, allocation, weights, sector/industry/country/currency/strategy/broker, ETF exposure drilldown, closed positions.
- **Health:** Atreus-style portfolio health: concentration, diversification, risk, thesis alignment, rule compliance, drawdown posture, and warnings.
- **Analytics:** portfolio/account analytics: performance attribution, allocation drift, sector/industry/country/currency exposure, realized vs unrealized P/L, dividends, and benchmark comparisons.
- **News:** market and ticker-specific news stream with earnings/calendar context and source/freshness labels.
- **Chart/Technical:** TradingView Lightweight Charts style chart terminal, indicators, timeframes, watchlist sidebar, technical scorecard.
- **Bots/Dispatch:** future equity and futures bot surfaces, clearly separated from research/read-only portfolio views.

### Interaction thesis

- Fast symbol search and ticker drilldown from any market/watchlist table.
- Responsive dense tables that become horizontal scroll or row-detail cards on mobile, not broken desktop grids.
- Cross-page continuity: selecting a symbol should feel like moving deeper into the same research object, not jumping to another app.

## Visual blueprint from screenshots

### Screenshot 1: Atreus overview

Use:

- Thin global market ticker strip across the very top: S&P 500, Nasdaq, Dow, VIX, 10Y, oil, gold, USD index.
- Left sidebar with section nav and bottom market-status chip. Health, Analytics, and News should be explicit first-class entries, not hidden under Research.
- Large greeting/account block with total account value, day P/L, all-time P/L, and large line chart.
- Time range tabs on charts: 1D, 1W, 1M, YTD, 1Y, ALL.
- Portfolio health snapshot as stacked rows: concentration, ESG/alignment substitute, risk level, diversification.
- Pinned watchlists with mini tables and tiny sparkline day charts.

Adapt:

- Replace sample brand/name with Mission Control context.
- ESG can be optional or replaced by “thesis alignment”, “risk discipline”, or “portfolio rules” because Philippe’s use case is practical trading/investing, not a robo-advisor costume.
- Keep the calm white/cream look but avoid generic card overload. Use sections, rows, dividers, and tables where possible.

### Screenshot 2: Atreus ticker detail

Use:

- Back-to-overview affordance.
- Quote header: logo/mark, company name, ticker, exchange, follow button, price/change, market cap, P/E, sector, industry.
- Horizontal ticker tabs: Overview, Financials, News, Metrics, Estimates, Dividends, Ownership, SEC Filings.
- Main price-history chart with summary stats below.
- Company profile, financial-highlight mini metrics, recent news, resources, financial overview, key ratios.

Adapt:

- Build `/trading/ticker/[symbol]` early, even if backed by cached/mock data at first.
- Treat tabs as real IA, not decorative placeholders. If data is unavailable, show honest “not connected yet” states.

### Screenshot 3: Zero Sum market home

Use:

- Editorial masthead inspiration for the Trading identity, but do not copy the exact Zero Sum branding.
- Dense nav taxonomy: Home, Screener, Heatmap, Sectors, Dividends, Compare, Watchlist, Portfolio, Chart, Technical, Scanner, Earnings, Correlation, Sector Analysis, Insiders, Congress, News, Learn, About, Status.
- Market tape plus compact status line.
- Major index cards, sector performance heatmap, market movers table, market news column, upcoming earnings column.

Adapt:

- Mission Control should not show every nav item immediately. Use staged nav groups to avoid building a museum of empty doors.
- Keep the dense market intelligence layout for desktop, collapse to focused vertical sections on mobile.

### Screenshot 4: Zero Sum ticker/analysis page

Use:

- Big ticker identity and large price readout.
- Metric strip: market cap, P/E, EPS, beta, ROE, 52-week high/low, average volume.
- Large chart area with moving-average toggles.
- Below-chart link-outs to chart terminal and technical analysis.
- Company profile text, cash/debt table, ratings radar, balance sheet visualizations.

Adapt:

- Use chart/fundamental modules that can degrade gracefully if only Yahoo/FMP/Alpha Vantage data is present.
- AI stock analysis should come after the data foundation, not before. No synthetic authority. The machine should cite which data it used.

### Screenshot 5: Portfolio Dividend Tracker

Use:

- Dark portfolio exposure header with allocation donut and ranked allocation bars.
- Exposure tabs: Sector, Industry, Market cap, World region, Country, Currency, Exchange, Asset type, Strategy, Broker.
- Main holdings table: instrument, strategy, portfolio value, total P/L, percentage P/L, portfolio weight.
- Portfolio weight bars in table rows.
- Closed positions accordion.
- Time-travel / historical snapshot concept.

Adapt:

- Add X-ray mode: decompose ETFs/funds into underlying sector/country/issuer exposure where data allows.
- IBKR should supply account/positions/trades when available. Market/fundamental data should not depend solely on IBKR.


## Correction: Atreus side menu is primary

Philippe explicitly called out that the Atreus screenshots include left-menu pages such as **Health**, **Analytics**, and **News**. The plan should follow that Atreus structure more closely. Those pages are first-class surfaces in the Trading rebuild, not accidental subfeatures.

Also: remove the idea of redesigning “existing Mission Control Market Intel” as a destination. Old Market Intel data can be mined as an input if useful, but the product direction is Atreus-style Trading, not legacy artifact preservation.

## Information architecture

Recommended Lab route structure:

```text
/trading                         Overview / Boiler Room home
/trading/ticker/[symbol]          Ticker detail and research object
/trading/portfolio                Portfolio, dividends, exposure, X-ray
/trading/watchlist                Watchlists and tracked names
/trading/health                   Portfolio/account health dashboard
/trading/analytics                Performance, exposure, attribution, dividends
/trading/news                     Market and ticker news stream
/trading/screener                 Filters, movers, candidates
/trading/chart                    Chart terminal
/trading/technical                Technical scoring and setups
/trading/signals                  Signal review and tracked signals
/trading/bots                     Equity/futures bot dispatch hub
/trading/reports                  Generated reports, journals, post-trade review
```

Initial nav should be smaller than the full future map:

1. Overview
2. Portfolio
3. Watchlist
4. Health
5. Analytics
6. News
7. Screener
8. Chart
9. Bots
10. Reports

Keep deeper tools reachable from pages before promoting them to top-level nav.

## Shell changes required in Lab

Current Lab shell findings:

- `components/shell/TopTabBar.tsx` hardcodes `Marvin’s Room`.
- `components/shell/navigation.ts` already has `ShellDomain = 'general' | 'trading'` and separate `TRADING_NAV_ITEMS`.
- `components/shell/Sidebar.tsx` chooses nav items by domain.
- `components/shell/AppShellClient.tsx` has many General-specific mobile/layout classes; Trading has not been given its own intentional compact/mobile treatment.

Plan:

- Add domain metadata in `navigation.ts`, for example:
  - General: label `MARVIN’S ROOM`
  - Trading: label `BOILER ROOM`
- Update `TopTabBar` to render active domain room label from metadata.
- Add Trading-specific shell classes in `AppShellClient`, e.g. `trading-shell-grid`, `trading-shell-main`, and route-specific compact handling.
- Do not piggyback on General page CSS hacks. Trading needs its own layout system from the start.

## Data-source recommendation

### Distinguish three data categories

1. **Market/research data:** quotes, OHLCV, fundamentals, news, dividends, earnings, sectors.
2. **Broker/account data:** positions, cash, trades, orders, realized/unrealized P/L.
3. **Execution data:** placing/canceling orders, bot dispatch, futures/equity execution state.

These must stay separate in the architecture. Mixing them is how dashboards become charming little liability machines.

### Stage 1 recommendation: free/low-cost research baseline

Use cached market-data adapters, not direct client-side calls.

Recommended baseline:

- **Yahoo/yfinance or defeat-beta-style Yahoo wrapper** for fast free baseline: quotes, OHLCV, profile-ish data, fundamentals where available.
- **SEC/EDGAR** for filings/resources and source-backed company documents.
- Optional **Alpha Vantage free key** as fallback for time series, indicators, fundamentals, news/sentiment, earnings, dividends, commodities/economic data.

Important caveat: yfinance/Yahoo is unofficial and can be rate-limited or blocked. It is fine for a personal cached research dashboard, not for high-frequency live trading or mission-critical execution.

### Stage 2 recommendation: add a paid fundamentals provider only if needed

Best likely first paid provider:

- **Financial Modeling Prep Starter/Premium**, if the portfolio/ticker detail pages need reliable fundamentals, ratios, dividends, earnings calendars, institutional/ETF holdings, and broader coverage.
- FMP pricing evidence found: free tier around 250 calls/day; paid individual tiers from about $22/mo billed annually with 300 calls/min, US coverage, annual fundamentals/ratios, news, crypto/forex; higher tiers add more history, intraday, global coverage, transcripts, ETF/mutual fund holdings.

Alpha Vantage is broad and cheap/free, but rate limits and endpoint premium gating may make it a fallback/complement rather than the primary provider.

### Stage 3 recommendation: Interactive Brokers integration

Use IBKR for:

- portfolio positions;
- account balances;
- trades/orders;
- execution state;
- future bot dispatch, with explicit approvals and safety gates.

Do not use IBKR as the sole general market-data provider.

IBKR findings:

- Most securities require Level 1 top-of-book market data subscription for API market data.
- Account must generally be funded and use proper market-data API acknowledgements.
- API market data is treated differently from free on-platform TWS data.
- IBKR historical data API requires the same market-data subscription as streaming top-of-book live data.
- Forex and crypto may differ, but equities/futures require careful subscription handling.

So: IBKR is excellent for account and execution truth, but awkward as a broad free research data layer.

### Stage 4 optional: real-time professional market data

Only consider paid real-time sources if Philippe wants low-latency live trading UI:

- Polygon/Massive, Twelve Data, DataBento, Finnhub, IEX/Alpaca where appropriate.
- For now, delayed/cached data is enough for research, portfolio overview, and planning.

## Charting recommendation

For Next.js UI, use the JavaScript TradingView Lightweight Charts library directly rather than `lightweight-charts-python`.

`lightweight-charts-python` is useful for Python-native tools, notebooks, Streamlit/PyQt experiments, live tick examples, and backend research utilities. It is not the natural fit for a React/Next chart terminal.

Need to add deliberate chart dependency later, likely:

- `lightweight-charts` for price/chart terminal.
- Possibly Recharts or D3 only if needed for fundamentals, donuts, heatmaps, and allocation views.

Do not install dependencies until the first implementation slice needs them.

## Data architecture

Add a server-side adapter layer under Lab, roughly:

```text
lib/trading/sources/yahoo.ts
lib/trading/sources/alpha-vantage.ts
lib/trading/sources/fmp.ts
lib/trading/sources/sec.ts
lib/trading/sources/ibkr.ts
lib/trading/cache.ts
lib/trading/contracts.ts
lib/trading/portfolio.ts
lib/trading/indicators.ts
```

Expose normalized contracts:

```text
MarketQuote
MarketIndexQuote
PriceSeries
TickerProfile
FinancialMetricSet
NewsItem
DividendEvent
EarningsEvent
Holding
PortfolioSnapshot
ExposureBreakdown
Watchlist
SignalCandidate
BotDispatchState
```

Rules:

- Every datum should carry `source`, `asOf`, and `freshness` where practical.
- UI must show honest stale/unavailable states.
- Never let a missing provider break the entire page.
- Cache aggressively. A personal dashboard does not need to hammer providers every render.
- Keep account/execution secrets server-side only.

## Implementation phases

### Phase 0 — Plan and scaffolding only

- Save this plan.
- No UI/code changes yet.
- Confirm Philippe agrees with IA, source strategy, and first slice.

### Phase 1 — Shell identity and Trading layout foundation in Lab

Files likely touched:

- `projects/mission-control-lab/components/shell/navigation.ts`
- `projects/mission-control-lab/components/shell/TopTabBar.tsx`
- `projects/mission-control-lab/components/shell/AppShellClient.tsx`
- `projects/mission-control-lab/app/globals.css`

Build:

- `BOILER ROOM` active brand label for Trading.
- Trading-specific shell classes.
- Desktop and mobile constraints from the beginning.
- Replace placeholder Trading nav with planned first-stage nav.

Validation:

- Lab lint/build.
- Desktop + mobile screenshots for `/trading` and at least one existing general route to ensure General was not damaged.

### Phase 2 — Static visual prototype for Overview and Ticker detail

Files likely added:

- `app/trading/page.tsx`
- `app/trading/ticker/[symbol]/page.tsx`
- `components/pages/trading/TradingOverviewPage.tsx`
- `components/pages/trading/TickerDetailPage.tsx`
- `components/pages/trading/trading-layout.tsx`
- `components/pages/trading/trading-sample-data.ts`

Build:

- Use local sample data, no provider integration yet.
- Overview should match the product shape from Atreus first: market tape, portfolio/account snapshot, health preview, watchlists, analytics preview, news/earnings modules.
- Ticker detail should match the Atreus/Zero Sum ticker shape with chart placeholder and real tabs.
- Design desktop and mobile in the same slice.

Validation:

- Lab lint/build.
- Render screenshots desktop/mobile.
- Check horizontal table behavior on mobile.

### Phase 3 — Cached data adapters v1

Build:

- Server-side normalized contracts.
- Yahoo/yfinance or defeat-beta-style local adapter for quotes/OHLCV/profile.
- SEC resource links.
- Fresh Atreus-shaped data contracts for Overview, Health, Analytics, News, Portfolio, Watchlist, and Ticker detail.
- Cache files under a Lab/runtime-safe data path.

Validation:

- Unit-ish adapter smoke scripts.
- UI stale-state checks.
- No client-side secrets.

### Phase 4 — Portfolio/X-ray v1

Build:

- Manual portfolio import first, probably CSV/JSON-compatible.
- Then IBKR read-only account/positions integration if Philippe approves setup.
- Allocation donut, weight bars, P/L, sector/industry/country/currency/strategy/broker tabs.
- X-ray mode for ETF exposure where provider data exists.

Validation:

- Fake/sample portfolio.
- Real manual file with sensitive values handled carefully.
- No order execution.

### Phase 5 — Chart/Technical v1

Build:

- Add chart library.
- Price chart with timeframes and moving averages.
- Technical scorecard: RSI, MACD, moving averages, support/resistance later.
- Link ticker detail to chart terminal.

Validation:

- Browser render checks; chart libraries often pass build and still look wrong.

### Phase 6 — Intelligence and bots

Build:

- AI ticker notes with source citations and freshness, shaped around the Atreus ticker/detail experience rather than old Market Intel screens.
- Bot dispatch hub separated into equity and futures lanes.
- Any execution path must be approval-gated and safety-reviewed.

Validation:

- Clear read-only vs execution boundaries.
- No hidden auto-trading behavior from UI clicks.

## Mobile and responsive rules

Build mobile with desktop from day one.

- Top ticker can become horizontally scrollable.
- Sidebar should not consume mobile viewport.
- Data tables should either horizontal-scroll with sticky first column or collapse to row cards.
- Ticker detail tabs should become scrollable segmented nav.
- Chart areas need explicit minimum heights for mobile.
- Portfolio allocation header should stack: donut, exposure list, then holdings table.
- Avoid dense three-column desktop layouts becoming unreadable compressed columns.

## Promotion rule

All Trading work stays in:

```text
projects/mission-control-lab
```

Do not copy/promote to:

```text
projects/mission-control
```

until Philippe explicitly approves after Lab screenshots/validation.

## Open decisions for Philippe

1. First implementation slice: I recommend **Phase 1 + static Phase 2 prototype** before real data integration.
2. Portfolio source: start with manual CSV/JSON, then IBKR read-only when approved.
3. Paid provider threshold: start free/cached; consider FMP only after the static prototype proves which fields matter.
4. Visual direction: use cream institutional terminal as default, with dark mode reserved for Portfolio/X-ray depth surfaces.

## Strong recommendation

Start with the shell identity and static Lab prototype. It will force the design, IA, and mobile behavior to prove themselves before we spend time wiring APIs. Data is important, but wiring data into a weak layout just gives us a fast spreadsheet with delusions of grandeur.
