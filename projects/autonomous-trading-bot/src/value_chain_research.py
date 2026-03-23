"""Research-layer ranking and pair-trade candidate helpers.

Purpose:
- consume Market Intel execution candidates with value-chain fields
- rank strongest vs weakest structural exposures inside a theme/subtheme
- stay research-only (no execution logic)
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Tuple


_MOAT_SCORE = {
    "high_gross_margin": 2.0,
    "ecosystem_lock_in": 2.0,
    "exclusive_supplier": 2.5,
    "preferred_vendor": 1.75,
    "proprietary_data": 1.5,
    "design_leadership": 1.75,
    "scale_advantage": 1.5,
    "none_clear": 0.0,
    "": 0.0,
}

_BOTTLENECK_SCORE = {
    "capacity": 1.5,
    "energy": 1.25,
    "supply_chain": 1.25,
    "software_ecosystem": 1.0,
    "switching_cost": 1.0,
    "regulation": 0.5,
    "financing": 0.25,
    "distribution": 0.5,
    "none_clear": 0.0,
    "": 0.0,
}

_FRAGILITY_PENALTY = {
    "low_margin": 2.0,
    "high_sbc": 1.5,
    "financing_dependent": 2.0,
    "weak_cash_flow": 1.5,
    "hype_led": 1.25,
    "easy_entry": 1.25,
    "commodity_exposure": 0.75,
    "execution_risk": 1.0,
    "none_clear": 0.0,
    "": 0.0,
}

_POSITION_SCORE = {
    "category1_obvious_leader": 1.0,
    "category2_hidden_enabler": 1.5,
    "category3_fragile_downstream": -1.0,
    "infrastructure_backbone": 1.25,
    "application_exposure": -0.5,
    "none_clear": 0.0,
    "": 0.0,
}

_BENEFICIARY_SCORE = {
    "high_margin_infra_leader": 1.5,
    "bottleneck_supplier": 1.75,
    "category2_enabler": 1.5,
    "ecosystem_owner": 1.75,
    "quality_turnaround": 0.75,
    "none_clear": 0.0,
    "": 0.0,
}

_LOSER_PENALTY = {
    "low_margin_integrator": 1.5,
    "financing_dependent_scaler": 1.75,
    "fragile_app_layer": 1.25,
    "weak_supplier_without_moat": 1.0,
    "theme_hype_without_economics": 1.25,
    "none_clear": 0.0,
    "": 0.0,
}


VALUE_CHAIN_FIELDS = [
    "theme",
    "chain_layer",
    "chain_sublayer",
    "bottleneck_type",
    "moat_type",
    "fragility_type",
    "supplier_status",
    "position_in_chain",
    "beneficiary_class",
    "loser_class",
    "pair_trade_candidate",
    "pair_trade_rationale",
    "valuation_context",
    "value_chain_notes",
    "structural_interpretation_confidence",
]


def _score_row(row: Dict[str, Any]) -> float:
    reasoning = float(row.get("reasoning_score", 0) or 0) / 25.0
    signal_score = float(row.get("signal_score", 0) or 0) / 25.0
    structural_conf = float(row.get("structural_interpretation_confidence", 0.0) or 0.0) * 2.0
    moat = _MOAT_SCORE.get(str(row.get("moat_type", "")), 0.0)
    bottleneck = _BOTTLENECK_SCORE.get(str(row.get("bottleneck_type", "")), 0.0)
    position = _POSITION_SCORE.get(str(row.get("position_in_chain", "")), 0.0)
    beneficiary = _BENEFICIARY_SCORE.get(str(row.get("beneficiary_class", "")), 0.0)
    fragility = _FRAGILITY_PENALTY.get(str(row.get("fragility_type", "")), 0.0)
    loser = _LOSER_PENALTY.get(str(row.get("loser_class", "")), 0.0)
    score = reasoning + signal_score + structural_conf + moat + bottleneck + position + beneficiary - fragility - loser
    return round(score, 4)


def _bucket_key(row: Dict[str, Any]) -> Tuple[str, str, str]:
    return (
        str(row.get("theme") or "none_clear"),
        str(row.get("chain_layer") or "none_clear"),
        str(row.get("chain_sublayer") or "none_clear"),
    )


def _primary_symbol(row: Dict[str, Any]) -> str:
    primary = row.get("primary_instrument")
    if isinstance(primary, dict):
        symbol = str(primary.get("symbol") or "").strip().upper()
        if symbol:
            return symbol
    return ""


def build_theme_research(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    buckets: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = _bucket_key(row)
        if key[0] == "none_clear":
            continue
        enriched = dict(row)
        enriched["research_score"] = _score_row(row)
        buckets[key].append(enriched)

    reports: List[Dict[str, Any]] = []
    for key, items in sorted(buckets.items()):
        ranked = sorted(items, key=lambda r: (r["research_score"], float(r.get("reasoning_score", 0) or 0)), reverse=True)
        strongest = ranked[0]
        weakest = sorted(items, key=lambda r: (r["research_score"], float(r.get("reasoning_score", 0) or 0)))[0]
        unique_patterns = {str(r.get("pattern_id") or "") for r in items if r.get("pattern_id")}
        unique_titles = {str(r.get("source_title") or "") for r in items if r.get("source_title")}
        unique_symbols = {_primary_symbol(r) for r in items if _primary_symbol(r)}
        strongest_symbol = _primary_symbol(strongest)
        weakest_symbol = _primary_symbol(weakest)
        pair_trade_ready = (
            bool(strongest.get("pair_trade_candidate") or weakest.get("pair_trade_candidate"))
            and len(ranked) >= 2
            and len(unique_symbols) >= 2
            and strongest_symbol
            and weakest_symbol
            and strongest_symbol != weakest_symbol
            and (len(unique_patterns) >= 2 or len(unique_titles) >= 2)
            and strongest.get("source_title") != weakest.get("source_title")
        )
        reports.append(
            {
                "theme": key[0],
                "chain_layer": key[1],
                "chain_sublayer": key[2],
                "candidate_count": len(items),
                "unique_symbol_count": len(unique_symbols),
                "symbols": sorted(unique_symbols),
                "pair_trade_ready": pair_trade_ready,
                "strongest": strongest,
                "weakest": weakest,
                "strongest_symbol": strongest_symbol,
                "weakest_symbol": weakest_symbol,
                "top_candidates": ranked[:3],
                "pair_trade_rationale": strongest.get("pair_trade_rationale") or weakest.get("pair_trade_rationale") or "",
            }
        )
    return reports
