# Market Intel Value-Chain Signal Fields Spec

Date: 2026-03-23
Status: proposed extension spec
Purpose: define the field-level additions needed to bring the AI value-chain framework into live Market Intel artifacts without breaking the current pipeline.

---

## 1. Why this spec exists

Market Intel already produces useful signal artifacts:
- `signals.json`
- `enhanced_signals.json`
- `execution_candidates.json`

The current gap is not lack of signal generation.
The gap is lack of **structural interpretation fields** that explain where a signal sits in a value chain, what kind of bottleneck or moat it implies, and whether it points toward strong vs fragile exposures.

This spec adds those fields in a way that:
- fits the current artifact pipeline
- stays explainable
- can start AI-focused
- can later generalize to other sectors such as mining, rare earths, industrials, and energy infrastructure

---

## 2. Design principles

### Principle 1 — Extend, do not fork
Do not create an entirely separate signal system for value-chain analysis.
Add fields to the existing signal artifacts.

### Principle 2 — Use controlled vocabularies first
Do not start with open-ended prose-only tags.
Use a small enum-style vocabulary and expand later if needed.

### Principle 3 — Explainability beats false precision
Every structural tag should be auditable from the source signal.
If the system cannot justify the tag, leave it `none_clear` or omit it.

### Principle 4 — AI-first examples, cross-sector method
The first implementation can target AI/infra signals first, but the spec should remain reusable for other chains.

---

## 3. Artifact extension plan

## 3.1 `signals.json`
Keep this lightweight.

### Add only if minimal enough
Optional additions:
- `theme`
- `chain_layer`
- `chain_sublayer`

Reason:
- this file is the compact surface
- do not overload it too early

## 3.2 `enhanced_signals.json`
This should become the main structural interpretation layer.

### Add these fields here first
- `theme`
- `chain_layer`
- `chain_sublayer`
- `theme_maturity`
- `bottleneck_type`
- `moat_type`
- `fragility_type`
- `supplier_status`
- `position_in_chain`
- `beneficiary_class`
- `loser_class`
- `value_chain_notes`
- `structural_interpretation_confidence`

## 3.3 `execution_candidates.json`
Only promote fields here that are execution-relevant.

### Add these selectively
- `theme`
- `chain_layer`
- `bottleneck_type`
- `moat_type`
- `fragility_type`
- `supplier_status`
- `beneficiary_class`
- `loser_class`
- `pair_trade_candidate`
- `pair_trade_rationale`
- `valuation_context`

Do **not** dump every research nuance into execution candidates.
This file should remain execution-oriented.

---

## 4. Field definitions

## 4.1 Core theme fields

### `theme`
Top-level thematic umbrella.

Examples:
- `ai_infrastructure`
- `ai_software`
- `chip_supply_chain`
- `datacenter_buildout`
- `rare_earth_supply`
- `energy_infrastructure`
- `industrial_automation`

### `chain_layer`
Main location in the value chain.

Initial vocabulary:
- `semis_design`
- `semis_memory`
- `semis_packaging`
- `semis_equipment`
- `foundry`
- `datacenter_compute`
- `datacenter_networking`
- `datacenter_power_cooling`
- `enterprise_data`
- `cybersecurity`
- `ai_model_layer`
- `app_layer`
- `raw_materials`
- `industrial_inputs`
- `none_clear`

### `chain_sublayer`
Optional finer grain.

Examples:
- `hbm`
- `cowos`
- `lithography`
- `hybrid_bonding`
- `cooling_hvac`
- `small_modular_reactors`
- `gallium_germanium`
- `rare_earth_processing`

### `theme_maturity`
Where the signal sits in the development arc.

Initial vocabulary:
- `early_infra_buildout`
- `mid_cycle_scaling`
- `late_cycle_capacity`
- `mature_platform_layer`
- `emerging_speculation`
- `turnaround_phase`
- `none_clear`

---

## 4.2 Structural interpretation fields

### `bottleneck_type`
What kind of structural bottleneck the signal points to.

Initial vocabulary:
- `capacity`
- `energy`
- `supply_chain`
- `software_ecosystem`
- `switching_cost`
- `regulation`
- `financing`
- `distribution`
- `none_clear`

### `moat_type`
What moat or durable advantage is implied.

Initial vocabulary:
- `high_gross_margin`
- `ecosystem_lock_in`
- `exclusive_supplier`
- `preferred_vendor`
- `proprietary_data`
- `design_leadership`
- `scale_advantage`
- `none_clear`

### `fragility_type`
What fragility the signal implies.

Initial vocabulary:
- `low_margin`
- `high_sbc`
- `financing_dependent`
- `weak_cash_flow`
- `hype_led`
- `easy_entry`
- `commodity_exposure`
- `execution_risk`
- `none_clear`

### `supplier_status`
Whether the signal suggests favored supplier positioning.

Initial vocabulary:
- `exclusive_supplier_candidate`
- `preferred_vendor_candidate`
- `repeat_supplier_signal`
- `new_supplier_mention`
- `none_clear`

### `position_in_chain`
How the signal’s company / asset sits relative to the obvious theme leaders.

Initial vocabulary:
- `category1_obvious_leader`
- `category2_hidden_enabler`
- `category3_fragile_downstream`
- `infrastructure_backbone`
- `application_exposure`
- `none_clear`

---

## 4.3 Trade interpretation fields

### `beneficiary_class`
Who likely benefits first.

Initial vocabulary:
- `high_margin_infra_leader`
- `bottleneck_supplier`
- `category2_enabler`
- `ecosystem_owner`
- `quality_turnaround`
- `none_clear`

### `loser_class`
Who is structurally vulnerable.

Initial vocabulary:
- `low_margin_integrator`
- `financing_dependent_scaler`
- `fragile_app_layer`
- `weak_supplier_without_moat`
- `theme_hype_without_economics`
- `none_clear`

### `pair_trade_candidate`
Boolean, execution-candidate layer only.

Meaning:
- true if the signal naturally supports strongest-vs-weakest relative-trade analysis

### `pair_trade_rationale`
Short human-readable explanation.

Example:
- `memory inflation benefits supplier and pressures low-end downstream assemblers`

### `valuation_context`
A light contextual field, not a full model.

Initial vocabulary:
- `peg_supportive`
- `peg_neutral`
- `peg_stretched`
- `valuation_unknown`

---

## 4.4 Explainability fields

### `value_chain_notes`
Short prose note explaining why the tags were assigned.

Example:
- `Signal points to HBM capacity bottleneck, which benefits upstream memory suppliers more than downstream assemblers.`

### `structural_interpretation_confidence`
Normalized confidence in the tag assignment.

Range:
- `0.0` to `1.0`

This is confidence in the structural tagging, not in the trade itself.

---

## 5. Example extension: `enhanced_signals.json`

```json
{
  "title": "TSMC CoWoS capacity remains tight as AI server demand rises",
  "pattern_id": "p038",
  "theme": "ai_infrastructure",
  "chain_layer": "semis_packaging",
  "chain_sublayer": "cowos",
  "theme_maturity": "early_infra_buildout",
  "bottleneck_type": "capacity",
  "moat_type": "preferred_vendor",
  "fragility_type": "none_clear",
  "supplier_status": "preferred_vendor_candidate",
  "position_in_chain": "category2_hidden_enabler",
  "beneficiary_class": "bottleneck_supplier",
  "loser_class": "financing_dependent_scaler",
  "value_chain_notes": "Packaging capacity is the constraint, so the supply-chain bottleneck matters more than broad AI demand rhetoric.",
  "structural_interpretation_confidence": 0.84
}
```

---

## 6. Example extension: `execution_candidates.json`

```json
{
  "candidate_id": "exec_20260323_001",
  "signal_id": "sig_20260323_001",
  "pattern_id": "p040",
  "pattern_name": "China Critical Minerals Export Controls",
  "theme": "chip_supply_chain",
  "chain_layer": "raw_materials",
  "bottleneck_type": "supply_chain",
  "moat_type": "none_clear",
  "fragility_type": "commodity_exposure",
  "supplier_status": "none_clear",
  "beneficiary_class": "bottleneck_supplier",
  "loser_class": "low_margin_integrator",
  "pair_trade_candidate": true,
  "pair_trade_rationale": "Materials squeeze can benefit constrained upstream suppliers while pressuring downstream chip users.",
  "valuation_context": "valuation_unknown"
}
```

---

## 7. Recommended implementation order

### Phase 1 — enrich `enhanced_signals.json`
Start here first.
Why:
- richest current research artifact
- easiest place to inspect tags without execution pressure

### Phase 2 — promote a small subset into `execution_candidates.json`
Only after the fields feel useful and stable in enhanced signals.

### Phase 3 — UI and consumer use
After the field quality is good enough:
- Market Intel brief sections
- equity research ranking inputs
- later Mission Control trading module surfaces

---

## 8. Acceptance criteria

This spec is successful when:
1. at least AI/infra signals can be tagged without excessive ambiguity
2. tags remain explainable from the source evidence
3. the field vocabulary is small enough to stay consistent
4. execution candidates gain structural context without becoming bloated research dumps
5. the same field design can later be extended to non-AI chains such as rare earths or energy infrastructure

---

## 9. Best next implementation task

Build a prototype tagger that enriches `enhanced_signals.json` with:
- `theme`
- `chain_layer`
- `bottleneck_type`
- `moat_type`
- `fragility_type`
- `position_in_chain`
- `beneficiary_class`
- `loser_class`
- `value_chain_notes`

Start with AI-related patterns only.
Then inspect the output manually before pushing any of it deeper into execution artifacts.
