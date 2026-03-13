# Market Intel ↔ Equity Bot Improvement Plan

## Purpose

Structured plan to improve:
1. how Market Intel produces execution-relevant intelligence and hands it off to trading systems
2. how the equity-bot consumes that intelligence and hardens its own execution stack

This plan is intentionally split into two tracks.

---

## Executive Summary

### Current state
The Market Intel → equity-bot connection is real, but too much useful intelligence is flattened before execution.

Current flow:

`Market Intel rich signals -> compressed context summary -> generic fusion modifiers -> equity-bot risk/execution`

This is stable, but too low-resolution.

### Target state

`Market Intel rich signals -> execution-oriented context/interface -> symbol/instrument relevance layer -> equity-bot risk/execution`

The goal is not tighter chaos. The goal is better separation:
- Market Intel becomes better at producing execution-usable intelligence
- equity-bot becomes better at consuming that intelligence safely and transparently

---

# Track A — Market Intel strengthening

## Goal
Improve Market Intel so it produces cleaner, richer, and more execution-relevant intelligence before it reaches the equity-bot.

## Main problems identified

### A1. Intelligence is compressed too early
Rich signal fields exist upstream:
- `pattern_id`
- `pattern`
- `reasoning_score`
- `confidence_level`
- `predicted_outcomes`
- `predicted_causal_chain`
- `signal_briefing`
- `evidence_pack`

But the bot currently receives only broad summary fields such as:
- `risk_bias`
- `severity`
- `high_confidence_signal_count`
- `geopolitical_count`
- `tracked_take_ratio`
- `ab_enriched_lift`

### A2. No strong symbol/instrument relevance bridge
The current interface does not clearly express:
- why a signal is relevant to a given ticker/instrument
- whether the relevance is company, sector, macro, commodity, or sentiment driven
- what confidence the mapping has
- what expected horizon applies

### A3. Historical-pattern intelligence is not transferred operationally
Pattern matching exists upstream, but downstream execution is not using it in an actionable form.

### A4. Learning loop is barely reaching execution
A/B comparison and tracked-signal feedback exist, but execution receives only low-resolution derivatives.

### A5. Evidence-pack structure exists but is not operationally consumed
The evidence-pack schema could become the execution bridge, but is not yet actually used that way.

### A6. Signal score calibration may be too compressed
Too many signals look similarly strong, which weakens downstream differentiation.

### A7. Some pattern mappings appear too generic or suspicious
Examples suggest possible overfitting or weak analog assignment in some cases.

---

## Track A workstreams

### A.1 Build an execution-facing Market Intel artifact
Create a dedicated handoff artifact, for example:
- `execution_context.json`
- or `execution_candidates.json`

Reference draft spec created:
- `projects/market-intel/docs/execution-candidates-spec.md`
Reference implementation plan created:
- `projects/market-intel/docs/execution-candidates-implementation-plan.md`

Suggested fields:
- `signal_id`
- `pattern_id`
- `pattern_name`
- `category`
- `historical_confidence`
- `reasoning_score`
- `confidence_level`
- `expected_horizon`
- `predicted_outcomes`
- `predicted_causal_chain`
- `instrument_candidates`
- `instrument_relevance`
- `execution_bias`
- `evidence_strength`
- `risk_overlay_hint`
- `source_credibility`
- `feedback_bias_points`

#### Success criteria
- the artifact preserves more intelligence than the current summary snapshot
- the artifact remains deterministic and easy to debug
- the artifact is execution-oriented, not just research-oriented

### A.2 Strengthen symbol / instrument mapping
Improve the logic that answers:
- what instrument should this affect?
- with what confidence?
- over what horizon?
- at what level: company / sector / macro / commodity / rates?

#### Success criteria
- mapping output is explicit and explainable
- mapping confidence is visible
- execution layer can understand why a symbol was chosen

### A.3 Improve signal-quality calibration
Reduce the current tendency toward over-uniform strong signals.

#### Focus
- wider score distribution
- better discrimination between excellent vs merely plausible signals
- stronger confidence normalization across categories

### A.4 Audit and tighten pattern-matching quality
Review suspicious analog assignments and identify where pattern matching is too generic.

#### Success criteria
- fewer unintuitive pattern matches
- better category-pattern alignment
- clearer rejection of weak analogs

### A.5 Connect evidence-pack structure to execution output
Turn evidence-pack richness into a live execution-facing layer, not just a post-hoc evaluation concept.

#### Success criteria
- evidence-pack fields influence execution-facing signal packets
- downstream consumers can see evidence strength and sector impact directly

---

# Track B — Equity-bot strengthening

## Goal
Improve the equity-bot so it consumes Market Intel better and hardens its own execution reliability.

## Main problems identified

### B1. Idempotency appears too coarse
Current duplicate suppression likely collapses distinct signals too aggressively when symbol/side/timestamp/source match.

### B2. Runtime vs repo alignment needs verification
Observed runtime behavior suggests possible drift or ambiguity between code on disk and active process behavior.

### B3. System-level verification is thinner than unit-test coverage
Unit tests pass, but long-running and replay-style operational verification remains limited.

### B4. Risk engine is still shallow for anything beyond foundation phase
Missing or underdeveloped:
- cooldown logic
- stale-signal TTL
- symbol re-entry rules
- concentration / clustering controls
- session/liquidity nuance
- direction conflict logic

### B5. Context-fusion layer is too generic
Current fusion adjusts size/confidence broadly but does not yet consume richer signal intelligence.

### B6. Notification/logging layer could be cleaner
The Telegram notifier works, but feels somewhat legacy and less aligned with the broader OpenClaw ecosystem.

### B7. Historical log hygiene deserves review
Older logs appear to contain previously exposed secret-bearing request payloads.

### B8. Overall architecture still shows patch-history seams
System is functional, but cohesion can be improved.

---

## Track B workstreams

### B.1 Verify runtime/code alignment
Audit what process is actually running and whether it matches the repo state.

#### Success criteria
- current launch path is explicit
- health/auth behavior matches actual code expectations
- no ambiguity about active runtime version

### B.2 Redesign idempotency behavior
Make duplicate suppression precise enough to block real duplicates without suppressing distinct signals.

#### Possible directions
- use upstream signal/event identity
- use normalized source fingerprint
- include URL/title hash or explicit signal ID

#### Success criteria
- distinct signals are not wrongly suppressed
- true duplicates are still safely blocked

### B.3 Add replay / burst verification
Go beyond unit tests with controlled simulation and webhook burst testing.

#### Success criteria
- repeated-signal behavior is measured, not assumed
- state behavior under burst conditions is verified
- execution/audit outputs remain coherent under stress

### B.4 Upgrade risk controls
Add and/or improve:
- cooldown logic
- stale-signal TTL
- symbol re-entry guard
- concentration / exposure guard
- session / liquidity checks
- conflict with existing position rules

### B.5 Replace broad context-only fusion with richer execution context consumption
Once Track A produces a better handoff artifact, update the bot to consume:
- instrument relevance
- historical confidence
- expected horizon
- evidence strength
- risk overlay hint

### B.6 Clean notification / log hygiene
- review notifier coupling
- decide whether to keep or refactor Telegram path
- set log cleanup / retention plan for historically sensitive records

### B.7 Improve system cohesion
Refactor only after the two higher-priority fixes above are understood.

---

# Recommended sequencing

## Phase 1 — Interface and truth-finding
1. Verify equity-bot runtime/code alignment
2. Audit idempotency in real signal flows
3. Define the execution-facing Market Intel artifact
4. Define stronger symbol/instrument relevance output

## Phase 2 — Intelligence quality
5. Improve Market Intel score calibration
6. Audit/fix weak pattern mappings
7. Connect evidence-pack richness to execution-facing output

### Current baseline note (Mar 13)
- M1 producer baseline now exists:
  - `projects/market-intel/src/execution_candidates.py`
  - `projects/market-intel/data/execution_candidates.json`
  - `projects/market-intel/tests/test_execution_candidates.py`
- Baseline posture: conservative by design, with deterministic IDs, explicit readiness, mismatch blocking, mixed-theme/FX-stress gating, and material-event dedupe.
- Next work should assume this producer exists and should avoid skipping straight to full bot integration until consumer planning is reviewed against this artifact.

## Phase 3 — Consumer upgrade
8. Update equity-bot to consume richer execution context
9. Upgrade risk controls around symbol/horizon/exposure logic
10. Add replay/burst verification for the improved pipeline

## Phase 4 — Cleanup and hardening
11. Logging / notifier cleanup
12. Architecture cohesion cleanup

---

# Immediate next recommendations

## Best next audit targets
1. **equity-bot runtime/code alignment**
2. **idempotency behavior in real signal flow**
3. **Market Intel symbol/instrument mapping quality**
4. **definition of execution-facing handoff artifact**

These four will give the best signal with the least premature redesign.

---

# Decision rules

- Do not migrate the equity-bot to a richer context layer until Market Intel produces a cleaner execution-facing artifact.
- Do not deepen Market Intel complexity without improving score discrimination and mapping quality.
- Do not treat broad macro counters as a substitute for symbol-level execution intelligence.
- Prefer transparent intermediate artifacts over hidden real-time coupling.

---

# Desired end state

A cleaner two-step architecture:

## Market Intel
- produces research-grade signals
- ranks and calibrates them well
- maps them to instruments/horizons clearly
- publishes execution-oriented context artifacts

## Equity-bot
- consumes those artifacts safely
- applies sharper risk controls
- suppresses duplicates precisely
- executes with traceable logic that explains:
  - what evidence mattered
  - why a symbol was chosen
  - what was adjusted and why

That is the path from "loosely coupled prototype" to "coherent intelligence-to-execution system."
