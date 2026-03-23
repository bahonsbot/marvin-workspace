# Mission Control Market Intel Gap Audit — 2026-03-23

## Why this audit exists
Mission Control’s Market Intel module was built as the first domain module during the Mar 20 Mission Control pass.
Since then, the underlying Market Intel and equity-bot stack has become much richer:
- value-chain tagging
- execution-candidate mapping
- strongest/weakest operator research
- cross-sector expansion
- pair-trade-ready research framing

This audit checks the current Mission Control Market Intel page against that newer truth.

Primary question:
- what does the current Mission Control Market Intel module already do well?
- what important research/trading truth does it still not surface?

---

## Current source-of-truth inputs already used by Mission Control
Current Mission Control Market Intel adapter reads:
- `projects/market-intel/data/execution_candidates.json`
- `projects/market-intel/data/tracked_signals.json`
- `projects/market-intel/data/signal_accuracy_history.json`

Current UI file:
- `projects/mission-control/components/market-intel/MarketIntelDashboard.tsx`

Current page posture is therefore:
- **real-data-backed**
- **not fake**
- **operationally honest**

That is good and should be preserved.

---

## What the current module already does well

### 1) It is truth-backed, not decorative
This remains the strongest product virtue.
The page uses real candidate / tracked-signal / accuracy files and does not invent market state.

### 2) It already supports the original v1 Mission Control posture well
It currently shows:
- execution candidates
- tracked signals
- signal detail
- accuracy snapshot

That makes it a solid **signal operations dashboard**.

### 3) It is compatible with Mission Control’s broader product rules
It respects the Mar 20 correction that domain modules can be denser and more dashboard-like than Memory/Files.
So the module is directionally correct as a workstation-style surface.

---

## The main gap
The current page is still centered on:
- signal generation
- execution candidate lists
- verification/accuracy review

But the underlying trading stack now also supports a newer layer:
- **research-first candidate discovery and prioritization**

That newer layer is only partially visible in Mission Control today.

### In plain terms
Mission Control currently helps answer:
- what signals fired?
- what candidates were mapped?
- how accurate has the system been?

But it does **not yet help enough with**:
- which companies are genuinely interesting to research right now
- which operators keep surfacing across signals/themes
- which strongest/weakest pair-style ideas are worth a closer manual look
- which names the user wants to keep on the radar even before a formal signal fully matures

That is the real gap.

---

## Specific missing surfaces

### Gap 1 — no research-board layer
The newer stack produces a value-chain research view from:
- `projects/autonomous-trading-bot/data/value_chain_research.md`
- `projects/autonomous-trading-bot/data/value_chain_research.json`

This includes useful truths like:
- theme / chain / sublayer
- operator symbols
- pair-trade readiness
- strongest / weakest operator selection
- operator-pool structure

Mission Control’s current Market Intel module does **not** surface this board.

### Why this matters
Without that layer, Mission Control shows raw candidates but not the more useful synthesized question:
- “what are the interesting names/themes worth looking into now?”

---

### Gap 2 — no "interesting companies from recent signals" surface
This is a real user request and now the stack is mature enough to justify it.

Desired product behavior:
- show a visible panel/list of companies that repeatedly or credibly surfaced from recent signals
- bias toward names worth further research, not just highest raw score in one isolated event
- make this feel like a **research-first watchlist**, not an auto-trade blotter

Current module does not have a dedicated surface for that.

### Why this matters
It bridges:
- noisy signal flow
and
- human curiosity / follow-up research

This is likely the most useful next-wave Market Intel improvement inside Mission Control.

---

### Gap 3 — no manual candidate/watchflow
Second user request from today:
- add a way to manually mark a company/candidate as “keep an eye on this one, it has potential”
- this should not be a UI-only note
- it should affect Market Intel and/or the equity-bot research path

Current Mission Control has no such concept.

### Why this matters
This is a major product upgrade because it lets human insight enter the same truth system as machine-discovered candidates.

If done properly, this becomes:
- a curated candidate intake layer
- a light operator watchlist
- a bridge from discretionary research to systematic monitoring

---

### Gap 4 — current candidate panel is signal-first, not idea-first
The left execution-candidates rail is useful, but it is organized around candidate entries, not around:
- recurring symbols
- clusters/themes
- strongest names
- weak-side contrasts
- “worth watching” names

That makes it less helpful for discretionary research scanning.

---

### Gap 5 — no explicit value-chain context in the Mission Control UI
Even though `execution_candidates.json` now carries fields like:
- `theme`
- `chain_layer`
- `chain_sublayer`
- `beneficiary_class`
- `loser_class`
- `pair_trade_candidate`
- `pair_trade_rationale`
- `value_chain_notes`

The current Mission Control dashboard barely exposes this structure.

### Why this matters
This is exactly the type of information that can make the Trading/Market Intel module feel differentiated and genuinely useful.

---

## Product opportunity created by today’s requests
Today’s two requests fit together cleanly.

### Request A — interesting companies from signals
This should become a dedicated Market Intel surface such as:
- **Research Radar**
- **Interesting Companies**
- **Worth a Look**

Purpose:
- show companies surfacing from recent signals, value-chain strength, recurrence, and operator-quality context

### Request B — manually add candidates to track
This should become a lightweight operator/watch intake flow such as:
- **Add to Watch**
- **Manual Watch Candidate**
- **Research Queue Intake**

Purpose:
- let Philippe add discretionary ideas from social/media/intuition
- store them in a real file-backed watch source
- make them visible both in Mission Control and in downstream Market Intel / equity-bot research logic

### Durable product interpretation
These are not separate random features.
Together they define a better Mission Control trading posture:
- **system finds interesting names**
- **human adds promising names**
- **both feed a shared research/watch layer**

---

## Recommended next-wave design

### New Market Intel section: Research Radar
Add a top-level panel or column for names worth manual research.

Inputs should combine:
1. recent execution candidates
2. value-chain research board outputs
3. symbol recurrence across recent signals
4. strength/weakness operator roles
5. optional manual-watch additions

Suggested card contents:
- symbol
- company name if available
- why it surfaced
- theme / chain / sublayer
- recent recurrence count
- strongest/weakest context
- “system surfaced” vs “manual watch” origin
- freshness timestamp

Important rule:
- this is **research-first**, not an execution command panel

---

### New shared file-backed source: manual watch candidates
Introduce a small file-backed dataset, for example:
- `projects/market-intel/data/manual_watch_candidates.json`

Possible shape:
- id
- symbol
- company
- thesis
- source_origin (`manual`, `media`, `social`, `podcast`, `filing`, etc.)
- conviction (`low` / `medium` / `high`)
- added_at
- review_status
- tags/themes
- optional linked notes

Important product rule:
- manual additions must affect real downstream truth, not only Mission Control display

Good downstream uses:
- Mission Control Research Radar
- Market Intel watch-source enrichment
- equity-bot value-chain research intake / candidate board

---

### Add a clearer split inside Market Intel UI
Recommended internal split:

#### A. Signal Operations
Keep current strengths:
- execution candidates
- tracked signals
- accuracy / review

#### B. Research Radar
Add:
- interesting companies from recent signals
- strongest/weakest operator buckets
- pair-style ideas worth follow-up
- manual-watch candidates

This is likely the cleanest next product evolution.

---

## What should NOT happen next

### Do not turn it into a fake broker terminal
The point is not order-entry theater.
This should stay:
- research-first
- source-linked
- evidence-aware
- honest about confidence

### Do not bury manual watch ideas in a private Mission Control-only state layer
If manual candidates exist, they should live in a real file-backed/shared source that can influence the broader stack.

### Do not overfit the UI before the data source is decided
First define the shared watch-candidate truth layer.
Then build the panel on top of it.

---

## Recommended implementation order

### Phase 1 — data and adapter expansion
1. extend the Mission Control Market Intel adapter to ingest:
   - value-chain research board data
   - a new manual-watch candidate file (once created)
2. extend contracts to represent:
   - research-radar items
   - manual-watch items
   - source provenance (`system` vs `manual`)

### Phase 2 — Research Radar UI
Add a new visible section to the Market Intel page that surfaces:
- interesting names from recent signals
- strongest/weakest operator context
- pair-readiness hints

### Phase 3 — manual candidate flow
Add a safe lightweight way to create a manual watch candidate.
This can start as:
- file-backed only
- append-only
- no destructive editing needed at first

### Phase 4 — downstream integration
Wire manual-watch candidates into:
- Market Intel research surfaces
- equity-bot candidate/research layer
- later maybe Mission Control Trading module

---

## Recommended exact next Mission Control task
The best immediate next implementation target is:

**Add a Research Radar layer to Mission Control Market Intel, backed by value-chain research outputs, and prepare a shared manual-watch candidate file that can later feed both Market Intel and the equity bot.**

This is better than:
- generic visual polish
- more dashboard ornament
- broad new domain-module expansion
- premature trading execution UI

---

## Bottom line
Mission Control’s current Market Intel module is already a good **signal operations** dashboard.

Its biggest missing piece is now clear:
- it needs a **research-first candidate-discovery layer**
- and it should support **manual watch candidates** that become part of the broader trading-research truth system

That is the cleanest, most grounded next step.
