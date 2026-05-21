# Autonomous Daily Tasks

<!--
Role: Mission Control autonomous task-board mirror and markdown sync surface.
Authoritative task store: projects/mission-control/data/autonomous-tasks.json.
Manual edits made on the Mission Control task board are authoritative and must not be silently overwritten from this file.
This file is not autonomy policy; operational autonomy rules live in AUTONOMY.md and HEARTBEAT.md.
-->

## Goals

### Career
- Develop and maintain a library of Python-based automation scripts for Unreal Engine, Blender, and After Effects. Focus on automating routine tasks and procedural scene setup.

### Trading
- Build and improve UI/UX tools for the internal trading dashboard that aggregate sentiment, technical indicators, and fundamental metrics into a single "Actionable Alpha" view.
- Research and draft integrations for new APIs that bridge the gap between trading data and trading outputs, focusing on real-time data ingestion.
- Develop a system that autonomously pulls SEC filings and quarterly reports for popular tickers, then populate the trading dashboard with sensitivity-analysis ranges.
- Find ways to improve the current signal tracking and evidence verification.

### Other
- Analyze OpenClaw’s logs to identify repetitive prompts or "looping" behaviors. Propose and implement logic-gate optimizations or custom tool definitions to reduce token waste and improve task success rates.
- Transition OpenClaw into a Proactive Operations Manager. Find safe ways to move from "Reactive" (waiting for prompts) to "Recursive" (checking own work and optimizing own logic).

---



## Done Today

- Draft: Proactive operations guardrails | ✅ Completed: Drafted the guardrail note for a bounded recursive ops loop and committed it. Artifact: `projects/_ops/openclaw-safe-recursive-ops-loop-guardrails-2026-04-21.md` What it covers: trigger conditions allowed actions and…
- Draft: Actionable Alpha dashboard slice | ✅ Completed: Sudo completed the lane plan frontend -> qa.
## Needs Input
## In Progress
**Brief:** review recent OpenClaw logs to identify one concrete repetitive prompt or looping behavior, then propose a bounded gate, prompt fix, or tool-definition improvement; deliverable: markdown audit in projects/_ops/ with evidence, root-cause hypothesis, and recommended guard
| Why: Turns the log-analysis goal into a concrete anti-looping audit with an operator-usable output | Proof: Audit cites one real loop pattern, why it happens, and one bounded mitigation that avoids risky control-plane drift | Unlocks: Unlocks a safer token-efficiency or reliability fix with clear evidence behind it
## Open Backlog

- [Trading] Improve: ATB observability and rejection health signals
**Brief:** Preserve structured public-safe rejection reasons, emit explicit webhook/broker health state transitions, and replace or remove the ATB reporter stub so operator-facing diagnostics do not imply more coverage than exists.
| Why: The audit found operator signals are too lossy when validation, broker health, or execution paths degrade. | Proof: Daily/reporting output distinguishes validation failure, broker-state outage, risk denial, health transition, and execution failure without exposing secrets. | Unlocks: Faster diagnosis when ATB blocks, degrades, or silently skips dispatch.

- [Trading] Improve: Market Intel pattern ambiguity preservation
**Brief:** Preserve the top 2-3 pattern matches and winner-vs-runner-up margin from signal generation into reasoning/execution candidates, instead of collapsing every headline into a single best pattern too early.
| Why: Messy headlines can be multi-hypothesis; throwing away competing matches makes false confidence harder to detect downstream. | Proof: Generated signals include competing pattern candidates and tests show weak winner margins reduce readiness or execution priority. | Unlocks: Cleaner semantic-fit scoring and better handling of ambiguous macro/geopolitical headlines.

- [Trading] Build: ATB challenger alternative scoring report
**Brief:** Create a reporting artifact that compares each ready primary ticker with shadow/challenger alternatives, including confidence deltas, role, liquidity, and later paper-performance comparison.
| Why: The system already generates alternatives, but they are hard to evaluate because they do not compete visibly with the primary path. | Proof: Report shows primary vs challenger candidates for each ready signal and records whether liquid ETF fallbacks or hidden suppliers would have been better paper expressions. | Unlocks: Evidence-based promotion of conservative challenger lanes instead of guessing which alternatives deserve trust.

- [Trading] Fix: ATB sell/open-position guard
**Brief:** Fix ATB risk logic so de-risking sells with valid inventory are not blocked merely because max_open_positions is reached; add regression coverage for sell-with-inventory when the book is full.
| Why: Prevents the bot from blocking exposure-reducing sells during a full-book or stress state. | Proof: Risk manager test shows sell with matching inventory is allowed even when open_positions >= max_open_positions; buy/opening exposure remains capped. | Unlocks: Safer paper execution and a correct foundation for later exit management.

- [Trading] Fix: ATB fail-closed broker state in execution mode
**Brief:** Change ATB webhook/execution behavior so PAPER_EXECUTE=true blocks new orders when broker account/position state cannot be fetched, while dry-run mode may warn and continue.
| Why: Avoids treating unknown Alpaca state as empty exposure, which can bypass inventory, loss, symbol, and sector safeguards. | Proof: Tests cover broker-state outage in dry-run vs paper-execution mode, and reports surface a structured state-health warning. | Unlocks: Trustworthy risk controls that depend on real account state.

- [Trading] Implement: ATB event-cluster dedupe
**Brief:** Add event_cluster_id generation from normalized entity/topic/time-window and use it to suppress or down-rank repeated headline waves while retaining candidate_id for traceability.
| Why: Candidate IDs are too literal, so near-identical Saudi/Iran/Pakistan or Nvidia headline waves can dispatch repeatedly. | Proof: Repeated similar headlines within a window share an event_cluster_id and only the best/new materially stronger candidate is dispatch-eligible. | Unlocks: Less overtrading of the same story and cleaner signal-quality measurement.

- [Trading] Improve: Market Intel semantic-fit scoring
**Brief:** Move title-pattern/event-type fit penalties upstream into Market Intel reasoning so false positives are penalized before HIGH_PRIORITY promotion, not only blocked later by execution readiness.
| Why: Broad keyword matches can still score as HIGH_PRIORITY even when the pattern is semantically wrong. | Proof: Tests cover Aramco labor/Saudi oil and social macro chatter examples; bad semantic fits receive lower actionable scores before execution-candidate gating. | Unlocks: Cleaner tracked signals, less review noise, and safer downstream dispatch assumptions.

- [Trading] Implement: ATB diversified ranked selection
**Brief:** Replace brittle exact-label dispatch gating with ranked top-N selection using minimum score/evidence plus per-symbol, per-theme, and per-window caps; allow reviewed challenger alternatives to compete conservatively.
| Why: Current ready sets can collapse into one obvious name such as NVDA, while shadow alternatives remain mostly quarantined. | Proof: Dispatcher selects distinct top candidates per run/window and tests show repeated same-symbol clusters are capped or reranked. | Unlocks: More meaningful paper exploration without weakening main safety controls.

- [Trading] Build: ATB trade ledger and true performance reports
**Brief:** Create a durable trade ledger keyed by client_order_id/idempotency/candidate metadata with submit/fill/close/P&L fields, then base daily and accuracy reports on the ledger instead of current position snapshots.
| Why: Current reports are operationally useful but do not yet measure realized strategy performance causally. | Proof: Daily report can show submitted, filled, open, closed, realized/unrealized P&L, and source candidate metadata from the ledger. | Unlocks: Real evaluation of whether signals, explorer ideas, and challenger alternatives are working.

- [Trading] Design: ATB exit-management path
**Brief:** Design and implement a first paper-only exit model: bracket orders, protective stop placement, or a position monitor with hard exit rules; reject strategies without an explicit exit model once enabled.
| Why: The bot can open exposure but does not yet have stop-loss, bracket, or autonomous exit discipline. | Proof: Paper execution path records an exit model and tests verify protective-order or monitor behavior without touching live trading. | Unlocks: Safer expansion beyond toy-size paper entries.

- [Trading] Improve: ATB risk simulation fixtures
**Brief:** Extend ATB simulations to exercise positions, position values, sector exposure, symbol caps, inventory-constrained sells, and broker-state-unavailable scenarios.
| Why: Simulation currently does not fully cover the richer risk model, so it can overstate readiness. | Proof: Simulation fixtures and tests cover concentration breaches, sell inventory, and state-outage behavior. | Unlocks: Safer validation before changing dispatch or risk policy.

- [Trading] Chore: ATB state retention and pruning
**Brief:** Add retention/compaction for idempotency and auto-signal dispatch state, or shard state by date/month, without losing recent duplicate-suppression safety.
| Why: Long-lived JSON state files increase inspection friction, cold-read cost, and corruption blast radius. | Proof: State retention tests or dry-run output show old entries archived/pruned while recent idempotency keys remain protected. | Unlocks: Lower-maintenance ATB operations as paper history grows.

- [Trading] Design: Signal outcome-linkage checklist
**Brief:** design a checklist that links each tracked signal to its verification evidence, outcome status, and follow-up review notes; deliverable: markdown checklist in projects/market-intel/notes/
| Why: Turns signal-tracking improvement into a concrete operator checklist instead of another high-level audit | Proof: Checklist shows how a signal moves from creation to verified outcome without losing evidence context | Unlocks: Unlocks cleaner data integrity and review quality in the signal workflow
- [Trading] Draft: SEC filing ingestion pipeline
**Brief:** define a first-pass pipeline that pulls SEC filings and quarterly reports for a small ticker set, extracts the inputs needed for sensitivity ranges, and maps the outputs into the dashboard; deliverable: markdown pipeline note in projects/market-intel/notes/ with source flow, parser stages, and storage/output contract
| Why: Makes the filings-and-sensitivity goal concrete enough to implement in stages | Proof: Pipeline note defines source, extraction stages, target output fields, and one believable starter ticker set | Unlocks: Unlocks a scoped implementation task for filings ingestion instead of leaving the goal at idea level
- [Trading] Analyze: Signal evidence-verification gaps
**Brief:** audit the current signal tracking flow and identify the top 3 gaps in evidence capture, reviewability, or outcome linkage; deliverable: markdown audit in projects/market-intel/notes/ with the current flow, concrete gaps, and one recommended first fix
| Why: Targets the exact signal-tracking goal directly instead of hiding it behind a generic next-step placeholder | Proof: Audit names the current flow, at least 3 concrete gaps, and one prioritized improvement with rationale | Unlocks: Unlocks a sharper implementation task for signal evidence and review quality
- [Career] Analyze: Creative-tool workflow friction shortlist
**Brief:** identify 3 repetitive setup steps across Blender, Unreal Engine, or After Effects and rank them by automation value and implementation simplicity; deliverable: markdown shortlist in projects/creative-practice/ with recommended first target and rationale
| Why: Makes the automation goal smarter by choosing the highest-leverage repetitive step instead of repeating an already-finished plan | Proof: Shortlist names 3 concrete frictions, scores them, and recommends one first automation target with clear reasoning | Unlocks: Unlocks a fresher automation plan or prototype against the best remaining workflow pain point
- [Trading] Implement: Global official filings adapters
**Brief:** after the yfinance fundamentals backfill is verified, design and implement the next official-filings adapter slice for Lab Trading. Priority source order: Europe filings.xbrl.org/ESEF, Korea OpenDART, Japan EDINET, Taiwan MOPS/TWSE; evaluate Brazil CVM next; keep South Africa CIPC/JSE as a candidate only after public iXBRL retrieval is confirmed. Deliverable: provider-backed filings/fundamentals adapter plan or implementation in projects/mission-control-lab, with no fake numeric data and clear unavailable states where public retrieval is not proven.
| Why: Turns the global filings research into a sequenced implementation task without interrupting the current yfinance slice | Proof: Adapter work starts only after yfinance verification and uses official machine-readable sources where public retrieval is proven | Unlocks: Unlocks non-US filings and global fundamentals coverage beyond Yahoo/yfinance without adding a paid provider


## Review
- [Other] Analyze: OpenClaw loop-pattern audit
**Brief:** review recent OpenClaw logs to identify one concrete repetitive prompt or looping behavior, then propose a bounded gate, prompt fix, or tool-definition improvement; deliverable: markdown audit in projects/_ops/ with evidence, root-cause hypothesis, and recommended guard
| Why: Turns the log-analysis goal into a concrete anti-looping audit with an operator-usable output | Proof: Audit cites one real loop pattern, why it happens, and one bounded mitigation that avoids risky control-plane drift | Unlocks: Unlocks a safer token-efficiency or reliability fix with clear evidence behind it