# Mission Control Comprehensive Save Point

Date: 2026-03-24
Status: end-of-night comprehensive continuity package
Owner: Marvin + Philippe
Purpose: give tomorrow-Marvin a full, practical handoff for Mission Control after the Mar 23 late-night Market Intel/trading expansion session, including what changed in product thinking, what was implemented, what was tried and rejected, what still needs refinement, and exactly how to resume without Philippe having to restate the context.

---

## Read this first

This file is the current Mission Control continuity anchor and supersedes the prior Mar 20 savepoint for practical next-step work.
If tomorrow-you only reads one Mission Control handoff file, read this one.

Read alongside:
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-20.md`
- `projects/_ops/mission-control-market-intel-gap-audit-2026-03-23.md`
- `projects/_ops/mission-control-trading-data-feasibility-2026-03-23.md`
- `projects/_ops/mission-control-trading-data-shapes-2026-03-23.md`
- `memory/2026-03-23.md`
- `MEMORY.md` (Mission Control Direction section)

Do not rely on older Mission Control assumptions without reconciling them against this file.

---

# 1. Durable Mission Control product truth

Mission Control remains:
- a hybrid companion shell around real OpenClaw/runtime/workspace truth
- modular, read-first where appropriate, denser where the module warrants it
- intentionally honest about runtime/auth/embed limits
- not a fake dashboard and not a shadow chat product

Mission Control is not:
- a premium terminal cosplay layer with fake real-time market data
- a replacement for the working chat path until Chat is truly production-usable
- a system that should smooth over missing data with placeholder fiction

Durable non-negotiables still in force:
1. truth over polish
2. useful before beautiful, then beautiful once useful
3. no fake state, no fake realtime, no fake embedded chat success
4. module personality may vary by job
5. domain modules are allowed to be denser than Memory/Files if the work benefits

---

# 2. The main Mission Control shift that happened tonight

The most important conceptual shift from tonight is this:

## Market Intel inside Mission Control is no longer only a signal-operations dashboard

Before tonight, Mission Control Market Intel was mainly about:
- execution candidates
- tracked signals
- signal detail
- accuracy snapshot

That was good, but no longer sufficient relative to the richer trading-research stack built outside Mission Control.

By the end of tonight, the durable product direction became:

### Mission Control Market Intel should have three layers
1. **Signal Operations**
   - execution candidates
   - tracked signals
   - signal detail
   - accuracy/review

2. **Research Radar**
   - interesting companies surfaced from recent signals
   - strongest/weakest operator context
   - pair-style ideas worth looking into
   - recurrence / why-now / thesis context

3. **Market Context**
   - compact index snapshot
   - compact commodities snapshot
   - delayed/snapshot posture only
   - no fake realtime

And there is now a fourth important supporting concept:

4. **Manual Watch Candidates**
   - Philippe can say “keep an eye on this one”
   - that idea becomes shared trading-research truth
   - not UI-only state
   - should influence Mission Control and later Market Intel / equity-bot research paths

This is the durable product direction now.

---

# 3. Key user requests captured tonight

Philippe explicitly asked for the following Mission Control trading/dashboard capabilities:

## 3.1 Interesting companies from recent signals
This means:
- a research-first surface for names that pop up from recent signals and appear worth investigating
- not an execution blotter and not fake trade theater

## 3.2 Manual watch candidates
This means:
- a way to manually add names based on outside media, social, instinct, or research
- phrased conceptually as: “keep an eye on this one, it has potential”
- critically, this must affect Market Intel and/or the equity bot later, not just be a local UI note

## 3.3 Market context blocks from free/open-access data
Philippe shared visual examples for:
- indices block
- commodities block

Constraint:
- only worth doing if the data can be sourced honestly without relying on a paid subscription-heavy vendor stack

## 3.4 Winners / losers
Discussed, but explicitly deprioritized by end of night.
Durable current status:
- **deferred**
- not top priority
- do not chase it next

---

# 4. Docs and audits created tonight

These files were created to anchor the new direction:

## 4.1 Gap audit
- `projects/_ops/mission-control-market-intel-gap-audit-2026-03-23.md`

Main conclusion:
- current Mission Control Market Intel was a good signal-operations dashboard
- biggest missing piece was the research-first candidate-discovery layer

## 4.2 Trading-data feasibility pass
- `projects/_ops/mission-control-trading-data-feasibility-2026-03-23.md`

Main conclusions:
- clearly feasible without paid subscriptions:
  - Research Radar / interesting companies from signals
  - manual watch candidates
  - commodities snapshot
  - index snapshot
- conditionally feasible and lower priority:
  - winners/losers

Important source posture captured there:
- **Stooq** looked strongest on paper for free/open-access snapshot-style data, especially commodities and some indices
- **Euronext** official pages are strategically attractive but more brittle/higher-friction for implementation
- **Yahoo Finance** was assessed as acceptable as fallback/reference but not the ideal long-term backbone

## 4.3 Trading data shapes
- `projects/_ops/mission-control-trading-data-shapes-2026-03-23.md`

Purpose:
- define shared truth-layer contracts before UI wandering

---

# 5. What was actually implemented tonight

This section is the practical state-of-project truth.

## 5.1 Mission Control Market Intel contracts expanded
File:
- `projects/mission-control/lib/types/contracts.ts`

Added support for:
- richer execution-candidate value-chain fields
- `researchRadar`
- `manualWatch`
- `marketContext`

This means the page now has formal data contracts for:
- research-first idea surfacing
- manual watch items
- market context quotes

---

## 5.2 Market Intel adapter expanded
File:
- `projects/mission-control/lib/adapters/marketIntel.ts`

Current adapter responsibilities now include:
- existing execution candidates
- tracked signals
- signal accuracy history
- value-chain research input from:
  - `projects/autonomous-trading-bot/data/value_chain_research.json`
- manual watch input from:
  - `projects/market-intel/data/manual_watch_candidates.json`

It now synthesizes a first real **Research Radar** layer from:
- system-surfaced ideas
- value-chain research board outputs
- manual watch items

Later in the night, it was also extended to fetch Market Context data.
See section 5.6 for the current market-context state.

---

## 5.3 Shared manual-watch truth file created
File:
- `projects/market-intel/data/manual_watch_candidates.json`

Durable significance:
- manual watch is no longer a conceptual request only
- there is now a real shared file-backed source for it
- this is intended to be shared truth, not Mission Control-local state

Initial state:
- append-friendly
- safe when empty
- no edit/delete workflow yet

---

## 5.4 Research Radar UI added
File:
- `projects/mission-control/components/market-intel/MarketIntelDashboard.tsx`

What the page gained:
- a visible **Research Radar** section
- system-surfaced ideas sourced from value-chain research + candidates
- support for showing manual-watch-origin items in the same research-first surface

Research Radar is now part of the live page, not only a doc idea.

Important product rule preserved:
- it remains research-first, not trade-theater

---

## 5.5 Manual watch write flow added
Files:
- `projects/mission-control/app/api/market-intel/manual-watch/route.ts`
- `projects/mission-control/components/market-intel/ManualWatchForm.tsx`
- `projects/mission-control/components/market-intel/MarketIntelDashboard.tsx`

What now works:
- Mission Control Market Intel can add manual watch candidates from the UI
- data is written into the shared file-backed source
- duplicate symbols are blocked
- required fields are validated
- items are normalized and stored with:
  - id
  - timestamp
  - `source_origin: "manual"`
  - `review_status: "active"`

This is a real end-to-end feature now.

Current limitation:
- add-only
- no edit/delete yet
- that is intentional for v1

---

## 5.6 Market Context first data pass added
Files:
- `projects/mission-control/lib/adapters/marketIntel.ts`
- `projects/mission-control/app/api/market-intel/indices/route.ts`
- `projects/mission-control/components/market-intel/MarketIntelDashboard.tsx`

Current state:
- indices row now uses real index symbols, not ETF placeholders:
  - `SPX` — S&P 500
  - `NDX` — Nasdaq 100
  - `DJI` — Dow Jones
  - `RUT` — Russell 2000
- data path uses Yahoo Finance chart endpoint
- delayed/snapshot posture is preserved
- empty states are honest when data is unavailable

Important nuance:
- **indices are real now**
- **commodities are not ideal yet**

Current commodities are still represented through market instruments/products rather than clean benchmark-style commodity truth.
That is acceptable as an intermediate pass, but not final-form.

Durable honest wording:
- the Market Context block is improved and useful
- but still not fully satisfactory in either commodity purity or visible contextual richness

---

# 6. Preview / validation truth

Preview/build validation was used throughout the later Mission Control passes.
This was explicitly requested by Philippe and should remain part of the normal loop.

Durable rule from tonight:
- for Mission Control build passes, validate with:
  1. typecheck
  2. preview restart
  3. local preview verification

Relevant script:
- `projects/mission-control/scripts/preview-restart.sh`

Important clarification from tonight:
- there was a temporary misunderstanding about whether `preview.motiondisplay.cloud` had stopped working
- local preview was healthy
- remote verification from this environment hit a certificate mismatch path
- Philippe manually checked and confirmed the public preview still worked for him

Durable lesson:
- do not overstate public preview breakage from one environment-side verification failure
- distinguish clearly between:
  - local preview working
  - remote cert/path verification from Marvin’s environment failing
  - actual user-facing preview breakage

---

# 7. Agent-team / delegation lesson

Philippe explicitly reminded Marvin not to do everything solo and to use the agent team where useful.
This was logged as a durable correction.

What happened in practice tonight:
- first Mission Control UI delegation attempt was too broad and timed out
- the builder drifted when given a combined layout + real data wiring task
- a narrower follow-up pass succeeded cleanly

Durable execution lesson:
- use the agent team more
- but split tasks more tightly
- especially for Mission Control UI work, separate:
  - layout/content cleanup
  - data wiring
  - polish/refinement

Do not send a builder on a mixed, under-bounded task if you want predictable turnaround.

---

# 8. What changed in conceptualisation tonight

These are the subtle but important product-thought changes tomorrow-you must preserve.

## 8.1 Research-first trading UI became more concrete
Earlier Mission Control trading direction was mostly aspirational.
Tonight it became structurally concrete:
- Research Radar exists as a defined layer
- manual watch exists as shared truth
- Market Context exists as a compact supporting block
- winners/losers is explicitly deferred

## 8.2 Manual watch is not “notes”, it is intake
This is important.
Manual watch should be understood as:
- a human research-intake layer
- a watch-source that can later feed Market Intel and the equity bot
- not a sticky-note feature

## 8.3 Market context should orient, not dominate
Philippe liked the top-level market-context idea, but the current result still lacks enough context.
Specifically:
- just showing numbers is not enough
- you need enough visible context to tell whether the market is up/down and what that means at a glance
- layout also matters; stretched rows are less usable than a tighter, more UI-considered arrangement

## 8.4 Market Intel still needs one more polish pass
The page is much better than before tonight, but it is **not done**.
Philippe explicitly said after the second data pass:
- it is “not really there yet”
- the indices showing real data is an improvement
- but the context is still lacking
- and the UI arrangement still isn’t ideal enough

This matters: tomorrow-you should not mistake the current page for a finished success.

---

# 9. Current user feedback at end of night

These are the exact points Philippe still wants addressed later.

## 9.1 Market Context still needs more context
Problem:
- the indices currently show numbers, but not enough visible context to quickly understand whether they went up or down or what changed
- some values are returning `changePct: null`, which makes the cards feel flat

Implication:
- tomorrow-you should improve the visible context layer, not just show a bare number
- if the source does not provide reliable intraday delta, make that honest but still useful

## 9.2 Market Context layout still not quite right
Problem:
- the cards are still visually stretching across the page in a way Philippe finds less UI-friendly

Implication:
- tomorrow-you should do a small polish pass on card sizing/arrangement/density

## 9.3 Commodities source should be refined
Problem:
- the current commodities row is not yet the clean benchmark-style truth we originally wanted
- current implementation is acceptable as an intermediate pass but not final

Implication:
- commodity-source refinement is a real next-step item

## 9.4 Signals command deck vs Accuracy Snapshot distinction still not obvious enough
Even after the second pass, Philippe said he did not really see the change enough.

Implication:
- tomorrow-you should do a more visible distinction, not just a metric reshuffle
- probably through stronger heading/content separation and/or more obvious role definitions

## 9.5 Winners / losers is explicitly not the focus right now
Durable instruction:
- leave it alone for now
- do not spend tomorrow on that

---

# 10. Exact next-step queue for tomorrow

This is the practical continuation plan.

## Next step 1 — small polish pass on Mission Control Market Intel
Priority: high
Scope: bounded UI refinement only

Target fixes:
1. make Market Context cards feel more informative at a glance
   - visible up/down context if available
   - more useful card composition
   - less “just a number on a slab” feel
2. improve Market Context layout
   - tighter, more UI-friendly grouping
   - avoid awkward stretched rows
3. make Signals command deck and Accuracy Snapshot visibly more distinct in purpose
   - command deck = operational state / queue posture / current market backdrop
   - accuracy snapshot = review/evidence/outcome analysis
4. keep Manual Watch directly below Market Context
5. preserve Research Radar and signal operations

Important rule:
- do not turn this into a broad redesign
- this is a polish/clarity pass

## Next step 2 — commodity-source refinement
Priority: medium-high
Scope: data-source quality refinement

Goal:
- improve commodities so they reflect cleaner commodity benchmarks or a more honest commodity-context representation

Possible directions:
- revisit Stooq-based commodity sourcing, since the feasibility pass rated it highly
- if keeping current source, improve labels/honesty so the commodity row does not imply something cleaner than it is

Important rule:
- honesty first
- if cleaner benchmark sourcing is not stable enough, use honest labeling rather than overclaiming purity

## Next step 3 — later downstream integration of manual watch
Priority: medium
Scope: not immediate tomorrow-first item

Future direction:
- manual watch candidates should later feed not just Mission Control display but Market Intel/equity-bot research logic too
- that work is not complete yet

---

# 11. Long-term Mission Control trading objective

Tomorrow-you should keep the long arc in mind.

The goal is not:
- to build a fake Bloomberg clone
- to make a flashy trading terminal
- to maximize market widgets

The real long-term objective is:
- a **research-first trading workspace** inside Mission Control
- grounded in real Market Intel and bot truth layers
- where system-surfaced opportunities and human-curated watch ideas meet
- with enough market context to orient the user, not overwhelm the product

Desired eventual shape:
1. **Market Context**
   - indices
   - commodities
   - maybe later other high-signal orientation elements
2. **Research Radar**
   - names worth investigating
   - strongest/weakest operator framing
   - recurrence and chain context
3. **Manual Watch**
   - human intake layer
4. **Signal Operations**
   - execution candidates
   - tracked signals
   - signal review / evidence / accuracy
5. **Later Trading module ideas**
   - only after truth layers are stable enough to deserve more surface area

This is the durable product direction.

---

# 12. Files and implementation state worth checking tomorrow

If resuming tomorrow, inspect these first:

## Core Mission Control files
- `projects/mission-control/app/market-intel/page.tsx`
- `projects/mission-control/components/market-intel/MarketIntelDashboard.tsx`
- `projects/mission-control/components/market-intel/ManualWatchForm.tsx`
- `projects/mission-control/lib/adapters/marketIntel.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/app/api/market-intel/manual-watch/route.ts`
- `projects/mission-control/app/api/market-intel/indices/route.ts`
- `projects/mission-control/scripts/preview-restart.sh`

## Source-of-truth trading files
- `projects/market-intel/data/execution_candidates.json`
- `projects/market-intel/data/tracked_signals.json`
- `projects/market-intel/data/signal_accuracy_history.json`
- `projects/market-intel/data/manual_watch_candidates.json`
- `projects/autonomous-trading-bot/data/value_chain_research.json`

## Continuity docs
- this file
- `projects/_ops/mission-control-market-intel-gap-audit-2026-03-23.md`
- `projects/_ops/mission-control-trading-data-feasibility-2026-03-23.md`
- `projects/_ops/mission-control-trading-data-shapes-2026-03-23.md`

---

# 13. Commits from tonight worth knowing

Mission Control-related commits from this session included:
- `1550ec4` — Audit Mission Control Market Intel gaps
- `2626ec3` — Assess Mission Control trading data sources
- `1d6c215` — Add Mission Control trading data contracts
- `ef2b038` — Add Mission Control Market Intel radar UI
- `10830b8` — Add Mission Control manual watch flow
- `f1026a1` — Refine Mission Control Market Intel layout
- `16bc0f7` — Wire Mission Control market context data

Do not trust remembered hashes without checking git, but these are the expected anchors from tonight.

---

# 14. Final practical instruction to tomorrow-you

Tomorrow-you should not start by exploring the whole workspace again.

Start here:
1. read this file
2. inspect `MarketIntelDashboard.tsx`
3. inspect the live preview
4. compare it directly against Philippe’s final feedback from tonight
5. run a **small polish pass**, not a broad redesign
6. only after that, consider commodity-source refinement

Philippe’s final feeling tonight was:
- progress is real
- the page is looking better
- but the Market Context block still lacks enough context and polish
- and the deck/snapshot distinction still is not obvious enough

That is the exact emotional/product state to resume from.
