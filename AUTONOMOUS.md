# Autonomous Daily Tasks

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

## Needs Input
## In Progress
## Open Backlog

- [Career] Draft: Creative-tool automation script plan
**Brief:** define one scoped automation script for Blender, Unreal Engine, or After Effects that removes a real repetitive setup step; deliverable: markdown spec in projects/creative-practice/ or the relevant tool workspace with target app, inputs/outputs, edge cases, and first prototype step
| Why: Reduces repetitive manual setup work while moving directly toward the current creative-tool automation goal | Proof: Spec names one target app, one concrete repetitive task, the intended input/output flow, and a believable first prototype scope | Unlocks: Unlocks a first real automation prototype instead of another generic practice exercise
- [Other] Analyze: OpenClaw loop-pattern audit
**Brief:** review recent OpenClaw logs to identify one concrete repetitive prompt or looping behavior, then propose a bounded gate, prompt fix, or tool-definition improvement; deliverable: markdown audit in projects/_ops/ with evidence, root-cause hypothesis, and recommended guard
| Why: Turns the log-analysis goal into a concrete anti-looping audit with an operator-usable output | Proof: Audit cites one real loop pattern, why it happens, and one bounded mitigation that avoids risky control-plane drift | Unlocks: Unlocks a safer token-efficiency or reliability fix with clear evidence behind it
- [Other] Draft: Proactive operations guardrails
**Brief:** define one safe recursive operations loop for OpenClaw that improves self-checking without overreach; deliverable: markdown guardrail note in projects/_ops/ covering trigger, allowed actions, stop conditions, rollback, and operator visibility
| Why: Moves the proactive-operations goal toward an explicit safe operating loop instead of a vague ambition | Proof: Guardrail note defines one bounded loop with clear trigger, limits, escalation path, and rollback | Unlocks: Unlocks a safer proactive-ops prototype without blurring governance boundaries
- [Trading] Research: Real-time trading API shortlist
**Brief:** compare 3 candidate APIs for real-time market-data ingestion and score them on latency, coverage, pricing, integration friction, and output usefulness; deliverable: markdown shortlist in projects/market-intel/notes/ with a recommendation and integration notes
| Why: Bridges the gap between raw market data sources and a real integration decision instead of leaving the API goal vague | Proof: Shortlist names 3 concrete APIs with decision criteria, recommendation, and next integration step | Unlocks: Unlocks a more credible real-time data integration task for the trading stack

## Review
- [Trading] Draft: Actionable Alpha dashboard slice
**Brief:** spec one concrete UI module for the Actionable Alpha dashboard that combines sentiment, technical indicators, and fundamentals into one operator decision view; deliverable: markdown spec in projects/market-intel/notes/ with module layout, required inputs, and the exact decision the module should support
| Why: Turns the dashboard goal into one specific operator-facing slice that can actually be designed or built next | Proof: Spec defines one named module, its inputs, presentation logic, and why it improves trading decisions | Unlocks: Unlocks a buildable next UI/UX implementation step for the trading dashboard
