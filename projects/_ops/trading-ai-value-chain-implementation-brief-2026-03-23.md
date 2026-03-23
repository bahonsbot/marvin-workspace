# Trading AI Value-Chain Implementation Brief

Date: 2026-03-23
Status: implementation brief
Purpose: convert the value-chain framework into concrete system changes for Market Intel, the equity bot, the futures bot, and later Mission Control trading modules.

---

## 1. Executive summary

This brief translates the framework into buildable components.

The most important implementation rule is:
- start with **research and ranking surfaces**
- do not jump straight to automated execution logic

The framework began from an AI-focused transcript, but the implementation should be designed so it can later generalize to other sectors such as mining, rare earths, industrials, and energy infrastructure.

---

## 2. Core data model additions

These are the new fields that should exist conceptually across the trading research stack.

### 2.1 Theme / chain classification
For any significant signal, especially in tech and infrastructure themes, add:
- `theme`
- `chain_layer`
- `chain_sublayer`
- `theme_maturity`

Example values:
- `theme=ai_infrastructure`
- `chain_layer=semiconductors`
- `chain_sublayer=memory_hbm`
- `theme_maturity=early_infra_buildout`

### 2.2 Structural interpretation fields
Add explainable structural fields:
- `bottleneck_type`
- `moat_type`
- `fragility_type`
- `supplier_status`
- `position_in_chain`

Example values:
- `bottleneck_type=capacity_constraint`
- `moat_type=ecosystem_lock_in`
- `fragility_type=financing_dependent`
- `supplier_status=exclusive_supplier_candidate`
- `position_in_chain=category2_enabler`

### 2.3 Market-structure / trade interpretation fields
Add fields for relative research, not direct execution:
- `beneficiary_class`
- `loser_class`
- `pair_trade_candidate`
- `pair_trade_rationale`
- `valuation_context`

Example values:
- `beneficiary_class=high_margin_infra_leader`
- `loser_class=low_margin_downstream_integrator`
- `pair_trade_candidate=true`
- `pair_trade_rationale=memory_inflation_benefits_supplier_hurts_low_end_assembler`
- `valuation_context=peg_supportive`

---

## 3. Market Intel implementation

## 3.1 New signal enrichment fields
Extend Market Intel output records to support the framework.

### Minimum useful additions
- `theme`
- `chain_layer`
- `chain_sublayer`
- `bottleneck_type`
- `moat_type`
- `fragility_type`
- `supplier_status`
- `position_in_chain`
- `beneficiary_class`
- `loser_class`
- `evidence_notes`

### First-pass field vocabulary
Use a small controlled vocabulary first.

#### `chain_layer`
- semis_design
- semis_memory
- semis_packaging
- semis_equipment
- foundry
- datacenter_compute
- datacenter_networking
- datacenter_power_cooling
- enterprise_data
- cybersecurity
- ai_model_layer
- app_layer
- non_ai_analog

#### `bottleneck_type`
- capacity
- energy
- supply_chain
- software_ecosystem
- switching_cost
- regulation
- financing
- distribution
- none_clear

#### `moat_type`
- high_gross_margin
- ecosystem_lock_in
- exclusive_supplier
- preferred_vendor
- proprietary_data
- design_leadership
- scale_advantage
- none_clear

#### `fragility_type`
- low_margin
- high_sbc
- financing_dependent
- weak_cash_flow
- hype_led
- easy_entry
- commodity_exposure
- none_clear

### 3.2 Supplier-intelligence workflow
Add a recurring extraction workflow for:
- earnings-call transcripts
- press releases
- datacenter build announcements
- partnership announcements
- customer case studies

Output should extract:
- named suppliers
- named partners
- exclusive / sole / preferred vendor wording
- deployment references
- new cooperation references
- confidence + source link

### 3.3 Signal interpretation logic
When a signal is AI-related or infrastructure-related, Market Intel should try to answer:
1. what part of the chain is this?
2. is this a bottleneck story, a demand story, or a fragility story?
3. who benefits first-order?
4. who benefits second-order?
5. who is vulnerable even if the headline sounds bullish?

### 3.4 Recommended immediate outputs
Add these output sections to relevant Market Intel briefs:
- `Chain layer`
- `Why this matters structurally`
- `Likely beneficiaries`
- `Likely fragile exposures`
- `Supplier / partner clues`

---

## 4. Equity bot implementation

## 4.1 Ranking model additions
Add a new research-layer score composed of:
- margin quality
- free cash flow quality
- innovation durability
- balance-sheet flexibility
- supplier status
- ecosystem lock-in
- valuation context
- fragility penalties

### Candidate score components
- `gross_margin_score`
- `fcf_quality_score`
- `innovation_durability_score`
- `supplier_advantage_score`
- `ecosystem_score`
- `valuation_score`
- `fragility_penalty`

### First practical use
Use these for:
- ranking watchlists
- prioritizing review candidates
- finding strongest / weakest operators within one subtheme

Not yet for:
- direct order execution

## 4.2 Pair-trade research engine
Add a research-only layer that tries to identify:
- strongest operator in subtheme
- weakest operator in same subtheme
- why the spread exists
- what would invalidate it

### Example output shape
- `subtheme`: AI memory inflation
- `best_operator`: supplier with pricing power
- `weakest_operator`: downstream assembler with margin pressure
- `rationale`: input-cost inflation passes through asymmetrically
- `risk`: theme-wide selloff, demand destruction, wrong cycle timing

### 4.3 Category-2 discovery lane
Create a dedicated watchlist bucket for hidden enablers.

Initial buckets:
- semicap and tools
- memory and packaging
- networking and switching
- power and cooling
- security and data infra
- non-AI analog chains in other sectors

## 4.4 PEG integration
Use PEG as a context field, not a master score.

Recommended usage:
- supportive if < 1 and quality strong
- caution if > 2.5 unless quality/margins exceptionally strong
- ignore as primary decision input when growth estimates are too fragile

---

## 5. Futures bot implementation

## 5.1 Proper role
The framework should not become direct futures execution logic yet.

Best current role:
- context enrichment
- macro regime interpretation
- narrative overlays for manual/future systematic use

## 5.2 Useful enrichment dimensions
Add optional context tags such as:
- power_demand_buildout
- shipping_chokepoint
- semiconductor_supply_stress
- rare_earth_bottleneck
- export_control_risk
- growth_leadership_fragility

## 5.3 Example use
A futures brief could say:
- AI infra buildout is increasing power demand and capex optimism
- bullish for power / industrial buildout narratives
- but fragile if rates spike or supply constraints become inflationary

That is useful context without pretending we have a direct futures signal edge from the transcript alone.

---

## 6. Mission Control later-module implementation

Current product direction still puts Trading / Market Intel later than the core shell.
So this section should be treated as later module guidance, not immediate V1 scope.

## 6.1 Recommended future module surfaces

### A. Value-chain map
A visual map showing:
- theme layers
- active signal density
- bottlenecks
- leader / fragile clusters
- top linked names

### B. Pair-trade research board
A board showing:
- subtheme
- strongest operator
- weakest operator
- rationale
- evidence links
- confidence
- invalidation notes

### C. Supplier-intelligence panel
A compact panel showing:
- newly detected suppliers
- repeated supplier mentions
- exclusive / preferred vendor clues
- linked sources

### D. Quality / fragility scorecards
A card view for names showing:
- gross margin quality
- FCF quality
- innovation durability
- SBC pressure
- financing dependence
- ecosystem lock-in
- valuation context

### E. Signal-to-chain routing view
For each new signal:
- where it lands in the chain
- what type of bottleneck it represents
- first-order beneficiaries
- second-order beneficiaries
- possible weak exposures

### F. Transcript intelligence inbox
A review surface for:
- earnings-call AI summaries
- highlight / lowlight extraction
- tone change
- supplier / partner extraction
- verification status

## 6.2 Dashboard design rule
Prefer:
- explainable research panels
- source-linked evidence
- compact structural labels
- human-reviewable intelligence

Avoid:
- fake autonomous certainty
- decorative confidence meters with no evidence
- premature PnL theater
- execution controls before research truth is stable

---

## 7. Suggested build order

### Step 1 — docs/spec
- finalize field vocabulary
- define where each field lives in Market Intel outputs
- define scorecard logic for equity research

### Step 2 — Market Intel prototype
- add value-chain tags to AI-related signals first
- add bottleneck / moat / fragility labels
- add supplier-intelligence extraction draft

### Step 3 — Equity research prototype
- create strongest/weakest-by-subtheme outputs
- create pair-trade research candidate output
- add PEG as a context field

### Step 4 — Mission Control later design
- mock the module surfaces only after data outputs are real enough

---

## 8. Best next action

The most useful next build artifact would be:
- a **field-level Market Intel spec** for the new tags and output sections
- or a **pair-trade research prototype spec** for the equity bot

Recommended order:
1. Market Intel field spec
2. equity bot ranking + pair-trade prototype spec
3. later Mission Control UI wireframe/spec
