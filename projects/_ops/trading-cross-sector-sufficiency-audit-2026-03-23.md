# Trading Cross-Sector Sufficiency Audit — 2026-03-23

## Goal
Audit the newly added cross-sector value-chain expansions with a specific focus on **candidate sufficiency**.

Key question:
- does each added sector/theme have enough distinct operator candidates to justify its breadth?

Secondary questions:
- where is overlap healthy and explainable versus taxonomy bleed?
- how much raw operator depth exists versus what actually survives into surfaced execution candidates?
- how much of the new coverage is live-flow proven versus only bench-ready?

## Method
Two-layer audit:
1. **Raw bench depth** — inspect the value-chain operator pool produced by deterministic mapping for a canonical synthetic headline in each bucket
2. **Surfaced depth** — inspect what survives into the current surfaced candidate list after ranking/truncation

Also checked current live-flow presence using:
- `projects/market-intel/data/execution_candidates.json`
- `projects/autonomous-trading-bot/data/value_chain_research.md`

## Important overlap finding
One overlap was too broad rather than merely explainable:
- some datacenter power/cooling headlines could be captured by the broader `energy_infrastructure / grid_power_equipment` route before the more specific AI datacenter power/cooling route fired

Fix applied:
- added routing precedence so datacenter-specific power/cooling signals resolve to `ai_infrastructure / datacenter_power_cooling / power_cooling_stack` before broader grid-power routing

Interpretation:
- overlap between energy infrastructure and AI datacenter infrastructure is real and explainable
- but the tagger still needs precedence rules so the more specific chain wins when both are plausible

## Candidate Sufficiency Findings

### 1) Rare earth supply
Bucket:
- `rare_earth_supply / raw_materials / rare_earth_processing`

Raw bench:
- longs: `MP`, `UUUU`, `LYSCF`
- shorts: `TSLA`, `GM`, `CAT`
- raw distinct equities: 6

Surfaced:
- surfaced distinct equities: 5
- dropped on surface: `CAT`

Verdict:
- **sufficient for a narrow chokepoint chain**
- **not broad enough to represent all mining/materials** and should not be framed that way

Interpretation:
- this is acceptable because the bucket is not really “mining” in general
- it is a specific rare-earth processing chain, and for that narrower scope the bench is good enough

### 2) Industrial automation
Buckets:
- `controls_robotics`
- `machine_vision_sensing`
- `robotics_motion`

Theme-level raw operator footprint:
- unique longs across theme: `ROK`, `EMR`, `SBGSY`, `ABBNY`, `FANUY`, `CGNX`, `KYCCF`
- unique shorts across theme: `CAT`, `DE`
- total unique raw equities across theme: 9

Per-bucket notes:
- `controls_robotics`: 7 raw, 6 surfaced, `DE` gets dropped by surfaced ranking
- `machine_vision_sensing`: 5 raw, 5 surfaced
- `robotics_motion`: 5 raw, 5 surfaced

Verdict:
- **strong enough**
- the split into sublayers fixed the main risk of this theme being too broad and too shallow at the same time

Interpretation:
- industrial automation works because it is no longer one blob
- if it were still just one bucket, the operator bench would have looked much weaker relative to the sector breadth

### 3) Energy infrastructure
Buckets in scope:
- existing `oil_supply`
- existing `war_supply_routes`
- new `grid_power_equipment`
- AI-adjacent but related overlap lane: `datacenter_power_cooling`

Raw bench for `grid_power_equipment`:
- longs: `ETN`, `PWR`, `GEV`, `HUBB`, `SBGSY`
- shorts: `NRG`, `VST`
- raw distinct equities: 7

Surfaced:
- surfaced distinct equities: 6
- dropped on surface: `VST`

AI datacenter power/cooling bench after overlap fix:
- longs: `VRT`, `ETN`, `TT`, `JCI`
- shorts: `CARR`
- raw distinct equities: 5

Verdict:
- **theme-level breadth is good enough**
- **surface-layer short-side diversity is slightly compressed** by the top candidate cap

Interpretation:
- energy infrastructure is not too thin overall
- but the surfaced candidate budget hides some secondary weak-side names in broader buckets

### 4) Defense supply chain
Buckets:
- `munitions_propulsion`
- `electronics_sensors`
- `naval_shipbuilding`

Theme-level raw operator footprint:
- unique longs across theme: `RTX`, `LHX`, `NOC`, `LMT`, `CW`, `HII`, `GD`
- unique shorts across theme: `BA`
- total unique raw equities across theme: 8

Per-bucket notes:
- `munitions_propulsion`: 5 raw / 5 surfaced
- `electronics_sensors`: 5 raw / 5 surfaced
- `naval_shipbuilding`: 4 raw / 4 surfaced

Verdict:
- **adequate to strong on the long side**
- **still too dependent on a single repeated short-side contrast (`BA`)**

Interpretation:
- defense is not dangerously thin in total names
- the real weakness is **short-side diversity**, not lack of long candidates
- this matters because a wide supply-chain theme should not rely on one repeated weak-side name across nearly every sub-bucket

### 5) Healthcare equipment
Buckets:
- `imaging_diagnostics`
- `surgical_systems`
- `tools_consumables`

Theme-level raw operator footprint:
- unique longs across theme: `GEHC`, `SMMNY`, `PHG`, `ABT`, `ISRG`, `SYK`, `MDT`, `DHR`, `BDX`, `BSX`
- unique shorts across theme: `MDT`, `BSX`, `PHG`
- total unique raw equities across theme: 10

Per-bucket notes:
- `imaging_diagnostics`: 5 raw / 5 surfaced
- `surgical_systems`: 4 raw / 4 surfaced
- `tools_consumables`: 5 raw / 5 surfaced

Verdict:
- **strong enough overall**
- `surgical_systems` is only **adequate**, not especially deep, but still reasonable for a first structured pass

Interpretation:
- healthcare is one of the better-balanced additions because it has real installed-base/platform/recurring-economics distinctions
- it benefits from having three different sub-buckets rather than pretending to cover all medtech in one lane

## Live Throughput vs Bench Readiness
Current live-flow presence in `execution_candidates.json`:
- `energy_infrastructure`: present
- `ai_infrastructure`: present
- `industrial_automation`: not yet present in current real flow
- `rare_earth_supply`: not yet present in current real flow
- `defense_supply_chain`: not yet present in current real flow
- `healthcare_equipment`: not yet present in current real flow

Interpretation:
- most of the new sectors are currently **bench-ready, not live-proven**
- this is fine for staged expansion, but it means we should not overstate current real-world throughput yet

## Main Answer to the Sufficiency Question
If judged as **broad sectors**, some of these would indeed be too thin.

If judged as **specific value-chain sub-buckets**, most of them are now sufficiently populated.

That distinction matters:
- `rare_earth_supply` is fine as a narrow processing bottleneck chain, not as a claim to broad mining coverage
- `naval_shipbuilding` is fine as a narrow defense-capacity lane, not as a claim to full defense-platform coverage
- `surgical_systems` is fine as a first medtech procedural-platform bucket, but not yet a complete surgical-device universe

So the current posture should be:
- keep using **specific subchain framing**
- avoid presenting these as fully comprehensive sector maps yet

## Most Important Risks Found
1. **Routing precedence overlap**
   - fixed for datacenter power/cooling versus broader energy-infrastructure routing

2. **Surface compression from top candidate cap**
   - some raw benches are healthier than surfaced outputs make them look
   - examples:
     - rare earths loses `CAT`
     - controls/automation loses `DE`
     - grid power equipment loses `VST`

3. **Defense short-side concentration**
   - too much reliance on `BA` as the generic weaker contrast

## Recommended Next Moves
### Priority 1 — keep sector framing honest
Do not describe the new additions as complete sector coverage.
Describe them as:
- rare-earth processing chain
- industrial automation subchains
- grid-power equipment
- defense subsystems + naval shipbuilding
- healthcare imaging / surgical systems / tools-consumables

### Priority 2 — improve surfaced diversity without breaking downstream assumptions
Audit whether the current top candidate cap is too tight for wider buckets.

Important note:
- the raw benches are often sufficient already
- the visible surfaced list is what sometimes looks artificially thin

Best next step:
- evaluate whether surfaced candidate selection should become slightly more diversity-aware rather than purely score-ranked
- for example, preserve at least one weak-side candidate when the raw bench contains multiple plausible shorts

### Priority 3 — strengthen defense short-side logic
Defense is the clearest remaining thematic weakness.
Not because it lacks long candidates, but because it overuses the same weak-side contrast.

### Priority 4 — observe real-flow throughput before adding more sectors
The taxonomy is now broad enough that the next validation step should come from real monitor flow, not just synthetic coverage.

## Bottom Line
The expansion is **not too narrow in a dangerous way**, provided we treat the new areas as **targeted value-chain lanes** rather than broad sector-completion claims.

The weakest current issue is not sector count but **candidate diversity presentation**:
- some buckets are healthy in raw mapping but look thinner once surfaced
- defense especially still needs a better weak-side bench

Overall recommendation:
- pause major new sector expansion
- refine surfaced diversity and short-side contrast quality
- then revisit based on actual live-flow evidence
