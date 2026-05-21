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
