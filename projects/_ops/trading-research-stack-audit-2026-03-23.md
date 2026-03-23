# Trading Research Stack Audit — 2026-03-23

## Scope
Audit the newly built value-chain + operator research stack for:
1. output quality
2. practical usefulness
3. whether the routing was narrowed too aggressively and risks suppressing useful signals

## Current system pieces reviewed
- `projects/market-intel/data/enhanced_signals.json`
- `projects/market-intel/data/execution_candidates.json`
- `projects/autonomous-trading-bot/data/value_chain_research.json`
- `projects/autonomous-trading-bot/data/value_chain_research.md`
- focused synthetic routing checks against `value_chain_tagger.py`

## Short verdict
The stack is in a **good early state**.
It is **not too narrow overall**, but it **is selectively narrow** in ways that are currently acceptable.

Best characterization:
- current routing is strong enough for AI / energy / macro / shipping-adjacent work
- current routing is still underpowered for broader cross-sector chains and some non-AI analog themes
- the system is not at risk of going fully silent; instead, it still lets things through, but some items fall back to broader buckets or `none_clear`

## What looks solid
### 1. Current outputs are still flowing
The current stack is not choking the pipeline.
Signals are still being produced, execution candidates still exist, and the research board is generating theme reports.

### 2. Value-chain fields are visible and useful
The surfaced output is already useful for human review:
- chain layer
- bottleneck
- beneficiary / loser framing
- value-chain notes

This is enough to support manual evaluation and catch bad tags.

### 3. Pair logic is now materially better than before
The research board now distinguishes between:
- `cross_chain_operator_pair`
- `operator_pool_pair`
- `not_ready`

That is a meaningful quality improvement over the earlier proxy theater.

### 4. AI-side routing improved materially
Focused checks show the tagger can now distinguish:
- semis design / compute
- datacenter networking
- datacenter power/cooling
- enterprise data
- app-layer AI
- macro regime

That is the right direction.

## What still looks weak / limited
### 1. Cross-sector portability is only partially implemented
The framework is cross-sector, but the live tagger is still mostly AI / energy / macro focused.
That means sectors like:
- rare earths
- industrial automation
- broader mining
- non-AI supply-chain analogs

are not yet fully represented in live routing.

### 2. Some useful signals still rely on synthetic/operator-pool support rather than live repeated flow
The operator universe is now broad enough to support pair-style research,
but some buckets still depend more on the prepared operator pool than on repeated live signal confirmation.
That is okay for research, but should not be confused with high-confidence market evidence.

### 3. `none_clear` remains a healthy fallback, but it marks the current frontier
This is not a failure. It is the right behavior when evidence is weak.
But it also marks where more field coverage or broader sector routing is still needed.

## Is the system too narrow?
## Answer: no, not in a dangerous way
The current system is **not** so narrow that nothing will come through.

Reasons:
- live signals still classify into meaningful buckets
- execution candidates are still being produced
- the tagger still has fallback behavior rather than requiring perfect specificity
- operator-pool research can still function when live signal depth is thin

## But there is a narrower edge to watch
The system **is** intentionally narrow in one good sense:
- it now refuses to call something a pair-trade or a rich value-chain classification unless there is enough basis

That is mostly good.
The thing to watch is not silence, but **coverage gaps**.

### Current coverage gaps worth tracking
1. non-AI analog sectors
2. rare earth / mining chain routing
3. industrial automation supplier-chain routing
4. broader enterprise software fragility coverage
5. more live examples for networking / power-cooling / enterprise-data buckets

## Focused edge-case results
### Good
- Arista / network fabric -> routed to networking layer
- Vertiv / Eaton / cooling -> routed to power/cooling layer
- Snowflake / MongoDB / enterprise data -> routed to enterprise-data layer
- C3 AI / app hype -> routed to app-layer AI fragility bucket
- Nvidia compute -> routed to semis design / GPU compute
- ECB / rates -> stayed macro

### Still limited
- rare-earth / cross-sector mining-style examples are not yet deeply modeled
- industrial automation analog chains are not yet first-class in the tagger

## Recommended next move
Do **not** broaden the system blindly.
Instead:
1. keep the current AI / energy / macro / shipping routing
2. add the next sector-expansion wave deliberately:
   - rare earths / mining
   - industrial automation
   - broader energy infrastructure
3. keep `none_clear` as the honest fallback rather than forcing false specificity

## Practical conclusion
The current stack is ready to keep using.
It is:
- useful enough for ongoing review
- not too narrow to be functional
- not broad enough yet to claim true cross-sector generality

That means the right next step is **targeted coverage expansion**, not rollback or aggressive loosening.
