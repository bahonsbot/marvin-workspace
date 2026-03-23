# Mission Control Trading Data Shapes — 2026-03-23

## Goal
Define the shared data contracts for the next-wave Mission Control trading surfaces before the UI implementation pass.

This step is intentionally about **truth-layer shape first**, not visual polish.

The four target surfaces are:
1. Research Radar
2. Manual Watch Candidates
3. Commodities Snapshot
4. Index Snapshot

Winners / losers is intentionally deferred.

---

## 1) Research Radar
Purpose:
- surface the most interesting companies and operator ideas worth manual research right now
- combine system-surfaced names and manual-watch names in one honest research-first list

### Contract intent
Each item should answer:
- what symbol is interesting
- why it surfaced
- whether it is system-surfaced or manually tracked
- what theme/chain it belongs to
- whether pair-style context exists
- how strong/recurrent it seems

### Current Mission Control contract
`MarketIntelResearchRadarItem`

Core fields:
- `symbol`
- `origin` = `system | manual`
- `thesis`
- `whyNow`
- `theme`
- `chainLayer`
- `chainSublayer`
- `recurrence`
- `confidence`
- `sourceCount`
- `pairTradeStyle`
- `pairTradeReady`
- `bestLongOperator`
- `bestShortOperator`
- `operatorSymbols`
- `notes`

### Current derivation path
- `projects/market-intel/data/execution_candidates.json`
- `projects/autonomous-trading-bot/data/value_chain_research.json`
- `projects/market-intel/data/manual_watch_candidates.json`

---

## 2) Manual Watch Candidates
Purpose:
- let Philippe say “keep an eye on this one”
- ensure that idea enters shared trading-research truth, not just a UI note

### Shared source file
- `projects/market-intel/data/manual_watch_candidates.json`

### Contract
`MarketIntelManualWatchCandidate`

Fields:
- `id`
- `symbol`
- `company`
- `thesis`
- `sourceOrigin`
- `conviction` = `low | medium | high`
- `reviewStatus` = `active | paused | archived`
- `tags`
- `notes`
- `linkedTheme`
- `linkedChainLayer`
- `linkedChainSublayer`
- `addedAt`

### Initial operating rule
- append-friendly
- safe to read even when empty
- no destructive workflow required for v1

### Example shape
```json
[
  {
    "id": "watch-nvda-20260323-1",
    "symbol": "NVDA",
    "company": "NVIDIA",
    "thesis": "Keeps surfacing as the strongest operator in AI infrastructure and still worth manual follow-up.",
    "source_origin": "manual",
    "conviction": "high",
    "review_status": "active",
    "tags": ["ai", "semis", "research-radar"],
    "notes": "Mentioned in podcast + recent signal flow.",
    "linked_theme": "ai_infrastructure",
    "linked_chain_layer": "semis_design",
    "linked_chain_sublayer": "gpu_compute",
    "added_at": "2026-03-23T14:30:00.000Z"
  }
]
```

---

## 3) Market Context Quotes
Purpose:
- support compact market-orientation blocks in Mission Control without pretending to be a premium realtime terminal

### Contract
`MarketContextQuote`

Fields:
- `label`
- `symbol`
- `category` = `index | commodity`
- `price`
- `change`
- `changePct`
- `currency`
- `source`
- `freshness` = `live | delayed | snapshot | unavailable`
- `updatedAt`
- `note`

### Product rule
These blocks must stay honest about:
- source
- freshness
- delay/snapshot posture

### First intended use
- `marketContext.indices`
- `marketContext.commodities`

### Current state
Contracts are reserved now.
Source-backed fetch wiring is intentionally the next implementation step.

---

## 4) Market Intel summary expansion
`MarketIntelDashboardSummary` now needs to carry four logical sections:

1. `executionCandidates`
2. `trackedSignals`
3. `researchRadar`
4. `manualWatch`
5. `marketContext`
6. `accuracySnapshot`

Interpretation:
- old Market Intel page = signal operations core
- new layers = research radar + market context

---

## Product consequence
This contract split gives Mission Control a cleaner future shape:

### Signal Operations
- execution candidates
- tracked signals
- accuracy/review

### Research Radar
- interesting companies
- strongest/weakest operator context
- manual-watch names

### Market Context
- commodities snapshot
- index snapshot

That is the intended direction.
