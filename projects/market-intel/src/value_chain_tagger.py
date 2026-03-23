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
    "p050_future_machine_vision": {
        "theme": "industrial_automation",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "machine_vision_sensing",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "switching_cost",
        "moat_type": "preferred_vendor",
        "fragility_type": NONE_CLEAR,
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "ecosystem_owner",
        "loser_class": "weak_supplier_without_moat",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Machine vision and sensing specialists with workflow lock-in should outperform more generic hardware suppliers.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Machine vision is a hidden automation enabler with stronger switching costs than generic industrial hardware.",
        "structural_interpretation_confidence": 0.76,
    },
    "p051_future_robotics_motion": {
        "theme": "industrial_automation",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "robotics_motion",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "capacity",
        "moat_type": "preferred_vendor",
        "fragility_type": "execution_risk",
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "ecosystem_owner",
        "loser_class": "weak_supplier_without_moat",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Robotics and motion-control leaders with installed-base and software tie-ins should outperform lower-margin machinery names.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Robotics and motion control should be treated as a distinct automation chain, not lumped into generic industrials.",
        "structural_interpretation_confidence": 0.77,
    },
    "p049_future_energy_infra": {
        "theme": "energy_infrastructure",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "grid_power_equipment",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "energy",
        "moat_type": "preferred_vendor",
        "fragility_type": NONE_CLEAR,
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Grid and power-equipment bottlenecks favor preferred infrastructure vendors over downstream users exposed to delays and capex pressure.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is an energy-infrastructure bottleneck signal where grid equipment, transformers, switchgear, and power management matter more than broad utility headlines.",
        "structural_interpretation_confidence": 0.79,
    },
    "p047_future_rare_earths": {
        "theme": "rare_earth_supply",
        "chain_layer": "raw_materials",
        "chain_sublayer": "rare_earth_processing",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "supply_chain",
        "moat_type": "preferred_vendor",
        "fragility_type": "commodity_exposure",
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Rare-earth separation and processing bottlenecks favor scarce upstream processors over downstream manufacturers exposed to input squeezes.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a critical-minerals bottleneck signal where refining, separation, and magnet-material conversion often matter more than the loudest miner headline.",
        "structural_interpretation_confidence": 0.78,
    },
    "p048_future_industrial_automation": {
        "theme": "industrial_automation",
        "chain_layer": "industrial_inputs",
        "chain_sublayer": "controls_robotics",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "switching_cost",
        "moat_type": "preferred_vendor",
        "fragility_type": "execution_risk",
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "ecosystem_owner",
        "loser_class": "weak_supplier_without_moat",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Preferred automation vendors with controls/software lock-in should outperform lower-margin integrators and more commoditized hardware suppliers.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Industrial automation should be read as a controls/software/workflow chain rather than a flat machinery sector.",
        "structural_interpretation_confidence": 0.74,
    },
    "p043_future_networking": {
        "theme": "ai_infrastructure",
        "chain_layer": "datacenter_networking",
        "chain_sublayer": "ai_fabric",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "capacity",
        "moat_type": "ecosystem_lock_in",
        "fragility_type": NONE_CLEAR,
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "weak_supplier_without_moat",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "AI networking bottlenecks tend to favor fabric leaders over legacy enterprise networking names.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Networking/fabric throughput is the constraint, so switching and interconnect leaders matter more than generic AI demand.",
        "structural_interpretation_confidence": 0.79,
    },
    "p044_future_power_cooling": {
        "theme": "ai_infrastructure",
        "chain_layer": "datacenter_power_cooling",
        "chain_sublayer": "power_cooling_stack",
        "theme_maturity": "early_infra_buildout",
        "bottleneck_type": "energy",
        "moat_type": "preferred_vendor",
        "fragility_type": NONE_CLEAR,
        "supplier_status": "preferred_vendor_candidate",
        "position_in_chain": "category2_hidden_enabler",
        "beneficiary_class": "bottleneck_supplier",
        "loser_class": "low_margin_integrator",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Power and cooling constraints favor datacenter infrastructure specialists over lower-quality broad HVAC or downstream integrators.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "Power and cooling are becoming hard datacenter constraints, so infra specialists deserve separate routing from generic AI compute headlines.",
        "structural_interpretation_confidence": 0.8,
    },
    "p045_future_enterprise_data": {
        "theme": "ai_software",
        "chain_layer": "enterprise_data",
        "chain_sublayer": "data_platforms",
        "theme_maturity": "mid_cycle_scaling",
        "bottleneck_type": "software_ecosystem",
        "moat_type": "proprietary_data",
        "fragility_type": "high_sbc",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "application_exposure",
        "beneficiary_class": "ecosystem_owner",
        "loser_class": "fragile_app_layer",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Enterprise data platforms with distribution and real data moats should outperform hype-led AI software wrappers.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is an enterprise-data layer signal, which sits above compute infra but below pure end-user app hype.",
        "structural_interpretation_confidence": 0.73,
    },
    "p046_future_ai_app": {
        "theme": "ai_software",
        "chain_layer": "app_layer",
        "chain_sublayer": "ai_applications",
        "theme_maturity": "emerging_speculation",
        "bottleneck_type": "distribution",
        "moat_type": NONE_CLEAR,
        "fragility_type": "hype_led",
        "supplier_status": NONE_CLEAR,
        "position_in_chain": "application_exposure",
        "beneficiary_class": "none_clear",
        "loser_class": "theme_hype_without_economics",
        "pair_trade_candidate": True,
        "pair_trade_rationale": "Speculative AI app layers are often weaker than infrastructure or enterprise-data leaders unless they show real moat and distribution.",
        "valuation_context": "valuation_unknown",
        "value_chain_notes": "This is a higher-fragility app-layer AI signal and should not be conflated with hard infrastructure bottlenecks.",
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

    if any(term in context_text for term in ("transformer", "switchgear", "substation", "grid equipment", "grid modernization", "transmission line", "electrical infrastructure", "power management", "distribution equipment", "eaton", "schneider electric", "hitachi energy", "siemens energy", "grid bottleneck")):
        return _with_defaults(_PATTERN_DEFAULTS["p049_future_energy_infra"])

    if any(term in context_text for term in ("rare earth", "rare-earth", "rare earths", "neodymium", "praseodymium", "dysprosium", "terbium", "magnet materials", "magnet metal", "separation plant", "critical minerals", "processing facility", "mp materials", "lynas", "energy fuels")):
        return _with_defaults(_PATTERN_DEFAULTS["p047_future_rare_earths"])

    if any(term in context_text for term in ("cognex", "keyence", "machine vision", "vision sensor", "vision inspection", "industrial camera", "sensing system")):
        return _with_defaults(_PATTERN_DEFAULTS["p050_future_machine_vision"])

    if any(term in context_text for term in ("robotics", "servo", "motion control", "fanuc", "abb robot", "industrial robot", "automation cell", "servo drive")):
        return _with_defaults(_PATTERN_DEFAULTS["p051_future_robotics_motion"])

    if any(term in context_text for term in ("plc", "programmable logic controller", "industrial automation", "factory automation", "digital twin", "rockwell", "siemens automation", "schneider electric automation", "controls platform")):
        return _with_defaults(_PATTERN_DEFAULTS["p048_future_industrial_automation"])

    if any(term in context_text for term in ("arista", "ethernet switch", "switching", "infini", "interconnect", "network fabric", "networking gear", "ai fabric", "broadcom switch", "cisco networking")):
        return _with_defaults(_PATTERN_DEFAULTS["p043_future_networking"])

    if any(term in context_text for term in ("cooling", "liquid cooling", "power demand", "power capacity", "transformer", "electrical equipment", "vertiv", "eaton", "hvac", "datacenter cooling")):
        return _with_defaults(_PATTERN_DEFAULTS["p044_future_power_cooling"])

    if any(term in context_text for term in ("snowflake", "mongodb", "confluent", "elastic", "data platform", "enterprise data", "data layer", "vector database", "retrieval", "data cloud")):
        return _with_defaults(_PATTERN_DEFAULTS["p045_future_enterprise_data"])

    if any(term in context_text for term in ("ai assistant", "ai app", "copilot app", "chatbot startup", "agent app", "application layer", "ai wrapper", "c3 ai", "bigbear")):
        return _with_defaults(_PATTERN_DEFAULTS["p046_future_ai_app"])

    if any(term in title_text for term in ("ai ", " ai", "gpu", "semiconductor", "chip", "chips", "nvidia", "datacenter", "hbm", "cowos")):
        tags.update({
            "theme": "ai_infrastructure",
            "chain_layer": "semis_design",
            "chain_sublayer": "gpu_compute",
            "theme_maturity": "early_infra_buildout",
            "bottleneck_type": "capacity",
            "moat_type": "design_leadership",
            "position_in_chain": "category2_hidden_enabler",
            "beneficiary_class": "category2_enabler",
            "loser_class": "fragile_app_layer",
            "value_chain_notes": "Signal appears AI/semiconductor related but lacks enough specificity for a narrower structural tag.",
            "structural_interpretation_confidence": 0.72,
        })
    return tags


def enrich_signal(signal: dict[str, Any]) -> dict[str, Any]:
    pattern_id = str(signal.get("pattern_id") or "")
    default_tags = _with_defaults(_PATTERN_DEFAULTS.get(pattern_id, {}))
    inferred = _infer_from_text(signal)

    tags = dict(default_tags)
    inferred_conf = float(inferred.get("structural_interpretation_confidence", 0.0) or 0.0)
    default_conf = float(default_tags.get("structural_interpretation_confidence", 0.0) or 0.0)

    if default_tags["theme"] == NONE_CLEAR:
        tags.update(inferred)
    else:
        should_override = (
            inferred.get("theme") not in (None, NONE_CLEAR, "")
            and (
                inferred_conf > default_conf
                or (
                    default_tags.get("theme") == "macro_rates_regime"
                    and inferred.get("theme") != default_tags.get("theme")
                    and inferred_conf >= 0.6
                )
            )
        )
        if should_override:
            tags.update(inferred)

    return {**signal, **tags}


def enrich_signals(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [enrich_signal(signal) if isinstance(signal, dict) else signal for signal in signals]
