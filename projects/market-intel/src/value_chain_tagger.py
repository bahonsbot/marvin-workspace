#!/usr/bin/env python3
"""Value-chain structural tagging for Market Intel signals.

First-pass implementation:
- AI/infra focused
- explainable, controlled-vocabulary output
- safe defaults when confidence is weak
"""

from __future__ import annotations

from typing import Any


NONE_CLEAR = "none_clear"

_PATTERN_DEFAULTS: dict[str, dict[str, Any]] = {
        "p001": {
        "theme": "energy_infrastructure",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "oil_supply",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "supply_chain",
        "moat_type": NONE_CLEAR,
        "fragility_type": "commodity_exposure",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "infrastructure_backbone",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Oil supply disruption can benefit upstream energy exposure while pressuring margin-thin downstream users.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is an energy-supply chokepoint signal rather than an AI-chain signal.",
        "structural_interpretation_confidence": 0.86,
    },
    "p002": {
        "theme": "energy_infrastructure",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "war_supply_routes",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "supply_chain",
        "moat_type": NONE_CLEAR,
        "fragility_type": "commodity_exposure",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "infrastructure_backbone",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "War-related route and commodity disruption can favor upstream constrained exposures and hurt downstream users.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a war-escalation and supply-route signal, not a generic semiconductor signal.",
        "structural_interpretation_confidence": 0.8,
    },
    "p003": {
        "theme": "ai_infrastructure",
        "chain_layer": "semis_design",
        "chain_sublayer": "gpu_compute",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "capacity",
        "moat_type": "design_leadership",
        "fragility_type": NONE_CLEAR,
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "category2_enabler",
        "loser_class": "fragile_app_layer",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "GPU and compute bottlenecks usually benefit scarce upstream enablers more than downstream software hopefuls.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Signal points to compute bottlenecks or semiconductor demand inside the AI stack rather than broad end-user app demand.",
        "structural_interpretation_confidence": 0.72,
    },
        "p014": {
        "theme": "macro_rates_regime",
        "chain_layer": "none_clear",
        "chain_sublayer": "none_clear",
        "theme_maturity": "none_clear",
        "bottleneck_type": "financing",
        "moat_type": NONE_CLEAR,
        "fragility_type": "financing_dependent",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": NONE_CLEAR,
        "beneficiary_class": "high_margin_infra_leader",
        "loser_class": "financing_dependent_scaler",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Rates and fiscal repricing usually favor self-funded quality over financing-dependent growth exposures.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a macro/rates regime signal and should only map into sector chains when a more specific bottleneck is visible.",
        "structural_interpretation_confidence": 0.68,
    },
    "p035": {
        "theme": "datacenter_buildout",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "global_shipping_routes",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "supply_chain",
        "moat_type": NONE_CLEAR,
        "fragility_type": "commodity_exposure",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "infrastructure_backbone",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Shipping disruption can support constrained upstream transport and energy exposures while hurting margin-thin downstream users.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a chokepoint logistics signal, so route disruption matters more than generic geopolitical fear.",
        "structural_interpretation_confidence": 0.84,
    },
    "p036": {
        "theme": "ai_infrastructure",
        "chain_layer": "datacenter_compute",
        "chain_sublayer": "capital_funding",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "financing",
        "moat_type": NONE_CLEAR,
        "fragility_type": "financing_dependent",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "category3_fragile_downstream",
        "beneficiary_class": "high_margin_infra_leader",
        "loser_class": "financing_dependent_scaler",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Fiscal and front-end funding stress tends to hurt financing-dependent builders more than cash-rich quality leaders.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Funding stress changes what parts of a buildout chain can self-finance and which ones become vulnerable to capital conditions.",
        "structural_interpretation_confidence": 0.78,
    },
    "p037": {
        "theme": "ai_infrastructure",
        "chain_layer": "datacenter_compute",
        "chain_sublayer": "capital_funding",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "financing",
        "moat_type": NONE_CLEAR,
        "fragility_type": "financing_dependent",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "category3_fragile_downstream",
        "beneficiary_class": "high_margin_infra_leader",
        "loser_class": "financing_dependent_scaler",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Liquidity shocks tend to punish levered builders and weak balance-sheet names more than quality incumbents.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a liquidity-plumbing stress signal that matters through capital access and funding fragility, not only through price volatility.",
        "structural_interpretation_confidence": 0.79,
    },
    "p038": {
        "theme": "ai_infrastructure",
        "chain_layer": "semis_packaging",
        "chain_sublayer": "cowos",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "capacity",
        "moat_type": "preferred_vendor",
        "fragility_type": NONE_CLEAR,
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "financing_dependent_scaler",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Packaging scarcity benefits scarce upstream enablers more than downstream builders that rely on volume availability.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Packaging capacity is the constraint, so the supply-side bottleneck matters more than broad AI demand rhetoric.",
        "structural_interpretation_confidence": 0.88,
    },
    "p039": {
        "theme": "ai_infrastructure",
        "chain_layer": "semis_memory",
        "chain_sublayer": "hbm",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "capacity",
        "moat_type": "high_gross_margin",
        "fragility_type": "commodity_exposure",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "HBM scarcity supports upstream suppliers and can compress downstream assemblers that must absorb memory costs.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Memory is a scarce input to the AI buildout, so the supplier economics matter more than the broad headline theme.",
        "structural_interpretation_confidence": 0.89,
    },
    "p040": {
        "theme": "chip_supply_chain",
        "chain_layer": "raw_materials",
        "chain_sublayer": "gallium_germanium",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "supply_chain",
        "moat_type": NONE_CLEAR,
        "fragility_type": "commodity_exposure",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Materials constraints support scarce upstream supply and pressure downstream users with weak pricing power.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a materials chokepoint signal, which makes hidden upstream inputs more important than front-end product demand.",
        "structural_interpretation_confidence": 0.86,
    },
    "p041": {
        "theme": "ai_infrastructure",
        "chain_layer": "app_layer",
        "chain_sublayer": "enterprise_spending",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "distribution",
        "moat_type": NONE_CLEAR,
        "fragility_type": "low_margin",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "category3_fragile_downstream",
        "beneficiary_class": "high_margin_infra_leader",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "When customers trade down, weaker downstream operators lose margin first while quality leaders absorb the shock better.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Customer trade-down reveals which parts of the chain have pricing power and which parts are fragile when demand quality weakens.",
        "structural_interpretation_confidence": 0.74,
    },
    "p042": {
        "theme": "datacenter_buildout",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "global_shipping_routes",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "supply_chain",
        "moat_type": NONE_CLEAR,
        "fragility_type": "commodity_exposure",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "infrastructure_backbone",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "A chokepoint blockage can favor scarce upstream logistics exposure and hurt downstream operators with thin margin buffers.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "A physical transport chokepoint is a chain-level constraint, not just a headline event.",
        "structural_interpretation_confidence": 0.83,
    },
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _with_defaults(tags: dict[str, Any]) -> dict[str, Any]:
    base = {
        "theme": NONE_CLEAR,
        "chain_layer": NONE_CLEAR,
        "chain_sublayer": NONE_CLEAR,
        "theme_maturity": NONE_CLEAR,
        "bottleneck_type": NONE_CLEAR,
        "moat_type": NONE_CLEAR,
        "fragility_type": NONE_CLEAR,
        "supplier_status": NONE_CLEAR,
        "position_in_chain": NONE_CLEAR,
        "beneficiary_class": NONE_CLEAR,
        "loser_class": NONE_CLEAR,
        "pair_trade_candidate": False,
        "pair_trade_rationale": "",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "",
        "structural_interpretation_confidence": 0.0,
    }
    base.update(tags)
    return base


def _infer_from_text(signal: dict[str, Any]) -> dict[str, Any]:
    title_text = f"{signal.get('title', '')} {signal.get('summary', '')}".lower()
    context_text = f"{signal.get('title', '')} {signal.get('summary', '')} {signal.get('signal_briefing', '')}".lower()
    tags = _with_defaults({})

    if any(term in context_text for term in ("cowos", "advanced packaging", "blackwell", "packaging bottleneck")):
        return _with_defaults(_PATTERN_DEFAULTS["p038"])
    if any(term in context_text for term in ("hbm", "high bandwidth memory", "dram", "sk hynix")):
        return _with_defaults(_PATTERN_DEFAULTS["p039"])
    if any(term in context_text for term in ("gallium", "germanium", "chip materials", "export controls")):
        return _with_defaults(_PATTERN_DEFAULTS["p040"])
    if any(term in context_text for term in ("red sea", "houthi", "bab el-mandeb")):
        return _with_defaults(_PATTERN_DEFAULTS["p035"])
    if any(term in context_text for term in ("suez", "ever given", "canal blockage")):
        return _with_defaults(_PATTERN_DEFAULTS["p042"])
    if any(term in context_text for term in ("debt ceiling", "x-date", "treasury cash balance", "extraordinary measures")):
        return _with_defaults(_PATTERN_DEFAULTS["p036"])
    if any(term in context_text for term in ("repo stress", "dash for cash", "basis trade", "treasury market dislocation")):
        return _with_defaults(_PATTERN_DEFAULTS["p037"])
    if any(term in context_text for term in ("trade down", "essentials over discretionary", "retail margin")):
        return _with_defaults(_PATTERN_DEFAULTS["p041"])

    if any(term in title_text for term in ("ai ", " ai", "gpu", "semiconductor", "chip", "chips", "nvidia", "datacenter", "hbm", "cowos")):
        tags.update({
            "theme": "ai_infrastructure",
            "chain_layer": "semis_design",
            "theme_maturity": "early_infra_buildout",
            "position_in_chain": "category2_hidden_enabler",
            "beneficiary_class": "category2_enabler",
            "loser_class": "fragile_app_layer",
            "value_chain_notes": "Signal appears AI/semiconductor related but lacks enough specificity for a narrower structural tag.",
            "structural_interpretation_confidence": 0.45,
        })
    return tags


def enrich_signal(signal: dict[str, Any]) -> dict[str, Any]:
    pattern_id = str(signal.get("pattern_id") or "")
    tags = _with_defaults(_PATTERN_DEFAULTS.get(pattern_id, {}))

    if tags["theme"] == NONE_CLEAR:
        inferred = _infer_from_text(signal)
        tags.update(inferred)

    return {**signal, **tags}


def enrich_signals(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [enrich_signal(signal) if isinstance(signal, dict) else signal for signal in signals]
