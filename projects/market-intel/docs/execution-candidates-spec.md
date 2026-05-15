# Execution Candidates Specification

## Status
Draft v1

## Purpose

Define a new execution-oriented artifact for Market Intel:

- `projects/market-intel/data/execution_candidates.json`

This artifact is the bridge between:
- Market Intel's research-grade signal layer
- downstream execution systems such as the equity-bot and later the futures-bot

It exists because the current handoff compresses too much intelligence too early.

Current state:

`rich signals -> compact context summary -> generic fusion -> execution`

Target state:

`rich signals -> execution candidates -> execution consumer + risk overlay`

This specification aims to preserve useful signal structure without forcing the execution bot to parse the entire research layer.

---

## Design goals

The artifact must be:
- execution-oriented
- deterministic
- debuggable
- broker-agnostic
- transparent
- suitable for both automated and human review

It must avoid becoming:
- a dump of raw research fields
- an opaque score-only layer
- a hidden runtime-coupling mechanism

---

## Problems this artifact solves

### 1. Intelligence compression
Current downstream consumers lose too much information when rich Market Intel signals are reduced to broad summary fields.

### 2. Missing event identity
Execution systems need a stable identity for upstream signals so idempotency can suppress duplicate events without collapsing distinct ones.

### 3. Opaque symbol mapping
Current symbol mapping is too hidden and too simplistic for a robust intelligence-to-execution system.

### 4. Weak execution readiness logic
Not every signal should become an execution candidate. The handoff layer should express that explicitly.

---

## Core design principles

### Principle 1 — Stable identity is mandatory
Each candidate must carry:
- a stable upstream `signal_id`
- a stable downstream `candidate_id`

These are not interchangeable.

- `signal_id` identifies the original Market Intel event/signal
- `candidate_id` identifies the execution interpretation of that signal

This allows one signal to later generate:
- one primary execution candidate
- optional secondary candidates

### Principle 2 — Mapping must be explicit
The artifact must show:
- candidate instrument(s)
- mapping confidence
- direction bias
- rationale
- mapping type

### Principle 3 — Readiness must be explicit
Execution systems should not have to infer whether a signal is tradable.

The artifact must include:
- `dispatch_readiness.ready`
- explicit reasons when not ready

### Principle 4 — Regime summary remains separate
This artifact does not replace the broad macro/regime summary layer.

The existing context summary can remain as a risk overlay/fallback layer.
The execution-candidate artifact is the candidate-specific intelligence layer.

---

## File location

Canonical output:

- `projects/market-intel/data/execution_candidates.json`

Optional later additions:
- `projects/market-intel/data/execution_candidates_latest.json`
- `projects/market-intel/data/execution_candidates_history.jsonl`

For v1, a single JSON array file is sufficient.

---

## Top-level structure

```json
[
  {
    "candidate_id": "exec_20260312_001",
    "signal_id": "sig_20260312_001",
    "...": "..."
  }
]
```

Each entry is one execution candidate packet.

---

## Candidate object schema

### Identity

```json
{
  "candidate_id": "exec_20260312_001",
  "signal_id": "sig_20260312_001",
  "signal_fingerprint": "sha256:...",
  "generated_at": "2026-03-12T23:30:00Z"
}
```

#### Field meanings
- `candidate_id`: stable ID for this execution interpretation
- `signal_id`: stable upstream signal ID
- `signal_fingerprint`: deterministic fingerprint of the source event identity
- `generated_at`: when the candidate packet was created

#### Requirements
- `signal_id` must remain stable across reprocessing of the same event
- `candidate_id` must remain stable unless the candidate mapping semantics materially change
- fingerprints should be deterministic and reproducible

---

### Source metadata

```json
{
  "source_type": "rss",
  "source_feed": "Financial_Times",
  "source_title": "Supertankers rush to Red Sea port as Iran war chokes Gulf oil exports",
  "source_url": "https://...",
  "source_timestamp": "2026-03-12T22:47:37.505540Z"
}
```

#### Purpose
Preserve the exact upstream event identity and allow audit/debugging.

#### Requirements
- `source_title` should match the original event title
- `source_url` should be included when available
- `source_timestamp` should represent the original source event timestamp, not only dispatch time

---

### Signal interpretation

```json
{
  "pattern_id": "p001",
  "pattern_name": "Saudi Oil Attacks",
  "category": "geopolitical",
  "historical_confidence": "HIGH",
  "confidence_level": "STRONG BUY",
  "reasoning_score": 99.5,
  "signal_score": 300,
  "recommendation": "TAKE",
  "expected_horizon": "intraday"
}
```

#### Purpose
Carry the core interpreted signal fields that matter to downstream execution.

#### Requirements
- `pattern_id` and `pattern_name` should always be paired
- `expected_horizon` should reflect the intended execution horizon, not just the research label
- `recommendation` should remain visible rather than being hidden in later aggregation

---

### Reasoning and evidence

```json
{
  "reasoning": "high-credibility source, strong historical pattern match.",
  "reasoning_components": {
    "source_credibility": 90.0,
    "pattern_strength": 90.0,
    "time_horizon_fit": 100.0,
    "base_score": 92.0,
    "feedback_bias_points": 7.5,
    "feedback_sample_size": 20
  },
  "evidence_strength": 0.89,
  "signal_briefing": "...",
  "predicted_outcomes": ["volatility_spike", "risk_repricing"],
  "predicted_causal_chain": ["Headline catalyst", "Positioning adjustment", "Cross-asset reaction"]
}
```

#### Purpose
Preserve execution-relevant reasoning without forcing consumers to parse full raw signal archives.

#### Requirements
- `evidence_strength` should be normalized (0.0 to 1.0)
- `reasoning_components` should remain transparent and machine-readable
- `predicted_outcomes` should remain structured, not flattened into prose only

---

### Mapping layer

```json
{
  "instrument_candidates": [
    {
      "symbol": "USO",
      "instrument_type": "etf",
      "relevance_score": 0.93,
      "mapping_confidence": 0.88,
      "mapping_type": "commodity_proxy",
      "direction_bias": "long",
      "reason": "Oil supply disruption / shipping shock"
    },
    {
      "symbol": "XLE",
      "instrument_type": "etf",
      "relevance_score": 0.82,
      "mapping_confidence": 0.81,
      "mapping_type": "sector_proxy",
      "direction_bias": "long",
      "reason": "Energy sector benefits from oil price spike"
    }
  ],
  "primary_instrument": {
    "symbol": "USO",
    "instrument_type": "etf",
    "direction_bias": "long",
    "relevance_score": 0.93,
    "mapping_confidence": 0.88
  }
}
```

#### Purpose
Make symbol/instrument mapping explicit, ranked, and explainable.

#### Requirements
- `instrument_candidates` must be sorted highest relevance first
- `primary_instrument` must reference the top chosen execution candidate
- `direction_bias` must be explicit
- `mapping_type` should indicate the relationship, for example:
  - `company_direct`
  - `sector_proxy`
  - `commodity_proxy`
  - `macro_proxy`
  - `second_order_positive`
  - `second_order_negative`

#### Important note
This layer should support multiple candidate instruments, not just one blind symbol guess.

---

### Execution guidance

```json
{
  "execution_bias": "allow",
  "risk_overlay_hint": "elevated_macro_volatility",
  "execution_priority": 0.87,
  "dispatch_readiness": {
    "ready": true,
    "reasons": []
  }
}
```

#### Purpose
Give downstream execution systems a clean summary of whether the candidate is usable and how aggressively it should be treated.

#### Suggested values
- `execution_bias`: `allow | caution | block | observe`
- `risk_overlay_hint`: free but controlled hint string from a known set
- `execution_priority`: normalized 0.0 to 1.0 score for ranking candidates

#### Readiness examples
```json
{
  "ready": false,
  "reasons": [
    "mapping_too_ambiguous",
    "no_tradable_proxy",
    "pattern_confidence_too_weak"
  ]
}
```

---

### Feedback context

```json
{
  "feedback_context": {
    "feedback_bias_points": 7.5,
    "feedback_sample_size": 20,
    "tracked_take_ratio": 0.71,
    "ab_enriched_lift": 36
  }
}
```

#### Purpose
Carry enough learning-loop context so the execution consumer can understand signal maturity and feedback influence.

#### Requirement
This should remain compact and execution-oriented. It is not a full feedback archive.

---

## Full example candidate

```json
{
  "candidate_id": "exec_20260312_001",
  "signal_id": "sig_20260312_001",
  "signal_fingerprint": "sha256:2c3f...",
  "generated_at": "2026-03-12T23:30:00Z",

  "source_type": "rss",
  "source_feed": "Financial_Times",
  "source_title": "Supertankers rush to Red Sea port as Iran war chokes Gulf oil exports",
  "source_url": "https://www.ft.com/content/87c3dc86-052c-4fb1-b03e-2987ae79bcd7",
  "source_timestamp": "2026-03-12T22:47:37.505540Z",

  "pattern_id": "p001",
  "pattern_name": "Saudi Oil Attacks",
  "category": "geopolitical",
  "historical_confidence": "HIGH",
  "confidence_level": "STRONG BUY",
  "reasoning_score": 99.5,
  "signal_score": 300,
  "recommendation": "TAKE",
  "expected_horizon": "intraday",

  "reasoning": "high-credibility source, strong historical pattern match.",
  "reasoning_components": {
    "source_credibility": 90.0,
    "pattern_strength": 90.0,
    "time_horizon_fit": 100.0,
    "base_score": 92.0,
    "feedback_bias_points": 7.5,
    "feedback_sample_size": 20
  },
  "evidence_strength": 0.89,
  "signal_briefing": "Similar to Oct 2023 when Iran attacked Israel — oil spiked 5% intraday before settling.",
  "predicted_outcomes": ["volatility_spike", "risk_repricing"],
  "predicted_causal_chain": ["Headline catalyst", "Positioning adjustment", "Cross-asset reaction"],

  "instrument_candidates": [
    {
      "symbol": "USO",
      "instrument_type": "etf",
      "relevance_score": 0.93,
      "mapping_confidence": 0.88,
      "mapping_type": "commodity_proxy",
      "direction_bias": "long",
      "reason": "Oil supply disruption / shipping shock"
    },
    {
      "symbol": "XLE",
      "instrument_type": "etf",
      "relevance_score": 0.82,
      "mapping_confidence": 0.81,
      "mapping_type": "sector_proxy",
      "direction_bias": "long",
      "reason": "Energy sector positive spillover"
    },
    {
      "symbol": "JETS",
      "instrument_type": "etf",
      "relevance_score": 0.74,
      "mapping_confidence": 0.72,
      "mapping_type": "second_order_negative",
      "direction_bias": "short",
      "reason": "Fuel-cost pressure on airlines"
    }
  ],
  "primary_instrument": {
    "symbol": "USO",
    "instrument_type": "etf",
    "direction_bias": "long",
    "relevance_score": 0.93,
    "mapping_confidence": 0.88
  },

  "execution_bias": "allow",
  "risk_overlay_hint": "elevated_macro_volatility",
  "execution_priority": 0.87,
  "dispatch_readiness": {
    "ready": true,
    "reasons": []
  },

  "feedback_context": {
    "feedback_bias_points": 7.5,
    "feedback_sample_size": 20,
    "tracked_take_ratio": 0.71,
    "ab_enriched_lift": 36
  }
}
```

---

## Identity rules

### signal_id
Must represent the original Market Intel event identity.

Recommended construction:
- deterministic hash of normalized source type + source feed + source URL or title + source timestamp

### candidate_id
Must represent the execution interpretation of that signal.

Recommended construction:
- deterministic hash of `signal_id` + primary mapping identity + direction bias + horizon

### Why this matters
This lets the execution system later distinguish:
- same event processed twice
- same event mapped to a different instrument candidate
- distinct events that happen to point toward the same ticker

This is essential for future idempotency redesign.

---

## Mapping rules

### Minimum requirements
The mapping layer must:
- allow multiple candidate instruments
- state confidence per mapping
- state mapping type
- support long and short directional bias
- expose the top candidate explicitly

### Mapping quality notes
The mapping layer must not blindly trust weak upstream pattern matches.

If the mapping is weak or ambiguous:
- lower `mapping_confidence`
- reduce `execution_priority`
- or mark `dispatch_readiness.ready = false`

---

## Readiness rules

A candidate may be marked not ready when:
- no tradable proxy exists
- mapping is too ambiguous
- evidence strength is too weak
- pattern quality is too low
- direction is unclear
- signal is more suitable for observation than execution

Readiness should be conservative.

This layer should help execution consumers avoid making trade/no-trade decisions from unclear candidate packets.

---

## Relationship to existing artifacts

### `enhanced_signals.json`
- remains the richer research/intermediate signal layer
- may contain more fields than needed for direct execution

### `execution_candidates.json`
- is the filtered execution-facing artifact
- should be smaller, cleaner, and more opinionated

### `signals_enriched_shadow.json`, `tracked_signals.json`, `signal_ab_comparison.json`
- remain useful supporting inputs
- should influence candidate construction and feedback context
- should not themselves become the direct execution interface

### equity-bot `context_adapter.py`
- should remain useful for regime/risk overlay and fallback summary
- should not remain the main intelligence bridge once execution candidates exist

---

## Consumer expectations

The future equity-bot consumer should be able to answer:
- what signal is this?
- why does it matter?
- why this symbol/instrument?
- what is the direction bias?
- how strong is the evidence?
- what is the expected horizon?
- is it actually ready for execution?

If the artifact cannot answer those questions, it is too weak.

---

## Implementation roadmap

### Phase 1
Create this spec and align it with the broader trading-systems improvement plan.

### Phase 2
Create a generator that transforms rich Market Intel signals into execution candidates.

### Phase 3
Validate candidate quality on real current signals.

### Phase 4
Update downstream execution consumers to use this artifact.

---

## Non-goals for v1

This artifact does not yet attempt to:
- guarantee broker-specific order logic
- replace the full risk engine
- encode portfolio optimization
- encode position sizing rules directly
- replace global macro/risk overlay summaries

Those belong in downstream execution logic.

---

## Desired end state

A cleaner, stronger bridge:

`Market Intel rich signals -> execution_candidates.json -> equity-bot / futures-bot / manual brief consumers`

This preserves signal intelligence, exposes mapping decisions, and gives downstream systems a stable identity layer for precise execution logic.

---

## Shadow ticker research expansion

A separate research-only artifact may be generated from execution candidates:

- `projects/market-intel/data/ticker_research_shadow.json`

Purpose:
- expand the current primary instrument into a richer analyst-style candidate set
- preserve alternatives such as direct beneficiary, hidden supplier, second-order beneficiary, hedge/short leg, and ETF fallback
- make ticker-selection creativity visible for review without changing the order path

Safety contract:
- this artifact is **not executable**
- every idea carries `promotion_status: shadow_only`, `dispatcher_eligible: false`, and `executable: false`
- dispatcher code must continue to read only `execution_candidates.json`
- any future promotion requires explicit code changes, deterministic validation, and human approval

LLM posture:
- current runtime generation is deterministic and does not call an LLM
- the artifact is shaped so an optional future LLM analyst pass can review or expand ideas, but LLM output must never be trusted for execution without deterministic validation
