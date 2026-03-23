# Mission Control Trading Data Feasibility — 2026-03-23

## Goal
Assess which trading/dashboard surfaces can be added to Mission Control using **free or open-access market data**, without depending on a paid market-data subscription.

The specific desired surfaces are:
1. index snapshot block
2. commodities snapshot block
3. winners / losers block
4. interesting companies from signals
5. manual watch candidates

Important interpretation:
- “open source” is not the precise standard here
- the real question is whether we can use **free/open-access and operationally honest data**
- we should avoid quietly building on fragile or clearly subscription-grade vendor assumptions

---

## High-level answer

### Definitely feasible without paid subscription
- **interesting companies from signals**
- **manual watch candidates**
- **index snapshot block** (if snapshot/delayed is acceptable)
- **commodities snapshot block** (if snapshot/delayed is acceptable)

### Conditionally feasible
- **winners / losers**

This is possible only if we scope it carefully and accept one of these realities:
- delayed/public-page data
- narrow exchange/universe scope
- brittle or semi-official data collection risk if we choose the wrong source

---

## Source review

### 1) Stooq
Observed evidence:
- `https://stooq.com/db/` explicitly exposes **Free Market Data**
- individual commodity pages such as:
  - `https://stooq.com/q/d/?s=gc.f` (gold)
  - `https://stooq.com/q/d/?s=cl.f` (WTI crude)
  - `https://stooq.com/q/d/?s=ng.f` (natural gas)
  return accessible quote/history pages with current values and changes

Practical interpretation:
- strong candidate for **snapshot-style dashboard blocks**
- especially good for:
  - commodities
  - some index data
  - historical/snapshot extraction

Cautions:
- still a third-party website, not an exchange API contract
- should be treated as **best-effort public data**, not institutional-grade feed
- production design should respect rate limits and avoid heavy scraping behavior

Feasibility rating:
- **commodities snapshot: high**
- **index snapshot: medium-high**
- **winners/losers: low-medium unless a very narrow universe is used**

---

### 2) Euronext official data pages
Observed evidence:
- `https://www.euronext.com/en/data` states that Euronext offers real-time and delayed market data
- `https://www.euronext.com/en/data/real-time-data/how-access-market-data` explicitly says delayed data is available via **Euronext Web Services** and other solutions
- `https://live.euronext.com/en/popout-page/getTopPerformers` publicly exists as a top-performers page, though the public fetch view loads only a shell/loader state

Practical interpretation:
- best **official** source family for Euronext-linked surfaces
- good strategic option for:
  - European indices
  - Euronext-related movers/performers
- but the easy public-page route may be less straightforward than it first appears

Cautions:
- the official pages clearly point toward market-data products and web services, not necessarily a frictionless free public API for our use case
- if we rely on browser-loaded public pages only, implementation may become brittle

Feasibility rating:
- **index snapshot (Europe-focused): medium**
- **Euronext winners/losers: medium, but implementation-risky unless an officially accessible endpoint is confirmed**

---

### 3) Yahoo Finance
Observed evidence:
- Yahoo has API/legal terms pages and quota language for official API use
- unofficial Yahoo-finance usage is widely discussed online, but those routes are clearly not the strongest foundation for a durable product

Practical interpretation:
- useful for ad-hoc inspection or personal experimentation
- **not the best recommended backend** for a durable Mission Control feature

Cautions:
- unofficial access patterns are common but weak as a product dependency
- legal/operational posture is murkier than cleaner alternatives
- fragile if the site changes

Feasibility rating:
- **possible fallback/reference only**
- **not recommended as primary Mission Control source**

---

## Feature-by-feature feasibility

## 1) Interesting companies from recent signals
### Feasibility: **very high**
This does **not require any external market-data provider** to be useful.

It can be derived from internal truth we already have:
- `projects/market-intel/data/execution_candidates.json`
- `projects/autonomous-trading-bot/data/value_chain_research.json`
- value-chain recurrence / strongest-weakest operator logic

Why it is attractive:
- no paid API problem
- already aligned with current stack
- research-first by design
- directly answers Philippe’s request

Recommended Mission Control treatment:
- add a **Research Radar** or **Interesting Companies** panel
- label entries by origin:
  - `system surfaced`
  - later `manual watch`

---

## 2) Manual watch candidates
### Feasibility: **very high**
This is mostly an internal product/data-model feature, not an external data problem.

Recommended implementation:
- add a shared file-backed source such as:
  - `projects/market-intel/data/manual_watch_candidates.json`

Why it is attractive:
- no dependency on outside vendor data
- can feed both Mission Control and downstream Market Intel/equity-bot research
- improves human-in-the-loop research quality

Recommended product posture:
- not UI-only note state
- should become part of the broader trading-research truth system

---

## 3) Index snapshot block
### Feasibility: **high**
This is very doable without a paid subscription **if** we accept snapshot/delayed posture.

Good candidates for a first pass:
- AEX
- EURO STOXX 50
- S&P 500
- Nasdaq 100
- Dow Jones
- DAX 40
- FTSE 100
- CAC 40
- IBEX 35
- FTSE MIB

Best posture:
- show:
  - last value
  - day change
  - day change %
  - last updated timestamp
- label clearly as:
  - `Delayed snapshot`
  - `Refreshed every X min`

Best source posture:
- prefer cleaner public quote/data sources like Stooq where available
- optionally use official exchange/public market pages where practical

Main risk:
- symbol/source normalization, not product fit

Recommendation:
- **safe to plan for implementation**

---

## 4) Commodities snapshot block
### Feasibility: **high to very high**
This is one of the cleanest free-data additions.

Why it is easier than winners/losers:
- fixed small universe
- no full-market breadth problem
- snapshot values are enough
- public data pages appear accessible

Good first-pass list:
- WTI crude
- natural gas
- gold
- silver
- copper
- platinum
- palladium

Observed evidence already supports this direction:
- Stooq commodity pages for `GC.F`, `CL.F`, `NG.F` are fetchable and expose current values/change context

Best posture:
- compact **Commodities Snapshot** panel
- last price + daily % + updated timestamp
- maybe later small sparkline

Recommendation:
- **excellent candidate for early implementation**

---

## 5) Winners / losers
### Feasibility: **medium, but scope-sensitive**
This is the most dangerous one to overpromise.

Why it is harder:
- requires a universe definition
- more dynamic than indices/commodities
- free public sources are often more brittle
- quality depends on whether we want:
  - all Euronext
  - AEX only
  - Europe large caps
  - US majors
  - custom watch universe

Most realistic free-source version:
- a **scoped movers board** rather than a universal market movers engine

Examples of acceptable scope:
- AEX movers
- Euronext top performers/laggards if we can use an official/public path reliably
- curated Mission Control watch-universe movers
- Market Intel watchlist movers

Best posture:
- do not market it as a full exchange-grade movers feed
- explicitly label scope

Recommendation:
- **possible, but not first priority**
- implement only after indices/commodities or as a narrow-universe feature

---

## Recommended build order

### Tier 1 — build first
1. **Research Radar / Interesting Companies**
2. **Manual Watch Candidates**
3. **Commodities Snapshot**
4. **Index Snapshot**

Why:
- strongest usefulness-to-risk ratio
- most honest with current data posture
- minimal dependency on fragile external vendors

### Tier 2 — build after that
5. **Scoped Movers / Winners-Losers**

Why later:
- higher source fragility
- easier to overstate
- needs a tighter universe decision first

---

## Product recommendation for Mission Control
The cleanest future trading/dashboard direction is:

### A. Research-first block
- Research Radar
- Interesting companies from signals
- Strongest/weakest operator context
- Manual watch candidates

### B. Market-context block
- Indices snapshot
- Commodities snapshot
- delayed/public-data label

### C. Later scoped movers block
- only once source scope is explicit

This is a better product shape than jumping straight to an all-in-one pseudo-terminal.

---

## What should be avoided
- pretending free public sources are premium real-time feeds
- building on unofficial Yahoo-style scraping as the core backbone
- broad full-market winners/losers claims without strong source certainty
- UI-first buildout before the source and honesty model are decided

---

## Bottom line
Mission Control can absolutely gain a useful trading/market context layer without paid vendor data.

The best candidates are:
- **Research Radar**
- **Manual Watch Candidates**
- **Commodities Snapshot**
- **Index Snapshot**

The one to treat carefully is:
- **Winners / Losers**, which is viable only with tighter scope and more source discipline

If we stay honest about delay/freshness and avoid fake realtime claims, this is a very workable next-wave direction.
