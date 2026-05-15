#!/usr/bin/env python3
"""Shadow-only ticker research expansion for execution candidates.

This module deliberately does not feed the dispatcher. It turns the existing
execution-candidate handoff into a richer research artifact that can be reviewed
before any future promotion into live order selection.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_INPUT = DATA_DIR / "execution_candidates.json"
DEFAULT_OUTPUT = DATA_DIR / "ticker_research_shadow.json"

ROLE_ORDER = [
    "direct_beneficiary",
    "hidden_supplier",
    "second_order_beneficiary",
    "hedge_or_short_leg",
    "etf_fallback",
]

THEME_ETF_FALLBACKS = {
    "energy_infrastructure": ("XLE", "buy", "Energy-sector ETF fallback for oil or infrastructure shocks"),
    "defense_supply_chain": ("ITA", "buy", "Defense/aerospace ETF fallback for conflict or defense-demand signals"),
    "ai_infrastructure": ("SOXX", "buy", "Semiconductor ETF fallback for AI infrastructure signals"),
    "ai_software": ("XLK", "buy", "Technology ETF fallback for broad AI software signals"),
    "industrial_automation": ("ROK", "buy", "Automation leader fallback when no cleaner supplier is available"),
    "rare_earth_supply": ("REMX", "buy", "Rare-earths ETF fallback for critical-minerals bottlenecks"),
    "healthcare_equipment": ("IHI", "buy", "Medical devices ETF fallback for medtech equipment signals"),
    "macro_rates_regime": ("TLT", "buy", "Duration ETF fallback for macro/rates regime research"),
}

MACRO_HEDGES = {
    "geopolitical": ("SH", "buy", "Broad equity downside hedge for geopolitical risk-off shocks"),
    "macroeconomic": ("SH", "buy", "Broad equity downside hedge for macro uncertainty"),
    "sentiment_social": ("VIXY", "buy", "Volatility ETF hedge for unstable sentiment/options regimes"),
    "financial_credit": ("TLT", "buy", "Treasury-duration hedge for credit stress research"),
}

LIQUIDITY_TIERS = {
    # Broad ETFs and mega/liquid large caps.
    "SPY": "very_high", "QQQ": "very_high", "SH": "high", "TLT": "very_high", "UUP": "high",
    "XOM": "very_high", "CVX": "very_high", "AAPL": "very_high", "MSFT": "very_high", "NVDA": "very_high",
    "TSLA": "very_high", "META": "very_high", "AMZN": "very_high", "GOOGL": "very_high", "AVGO": "very_high",
    "LMT": "high", "RTX": "high", "NOC": "high", "LHX": "high", "ITA": "high", "XLE": "very_high",
    "USO": "high", "SOXX": "high", "XLK": "very_high", "DAL": "high", "AAL": "high", "JETS": "medium",
    "VRT": "high", "ETN": "high", "PWR": "high", "GEV": "medium", "HUBB": "medium", "MP": "medium",
    "REMX": "medium", "IHI": "medium", "VIXY": "medium",
}


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _side_from_direction(direction: str) -> str:
    return "sell" if str(direction).lower().strip() == "short" else "buy"


def _liquidity(symbol: str) -> str:
    return LIQUIDITY_TIERS.get(str(symbol).upper(), "unknown")


def _idea(
    *,
    role: str,
    symbol: str,
    side: str,
    rationale: str,
    confidence: float,
    source: str,
    source_candidate: dict[str, Any] | None = None,
) -> dict[str, Any]:
    symbol = str(symbol).upper().strip()
    return {
        "role": role,
        "symbol": symbol,
        "side": side,
        "rationale": rationale,
        "research_confidence": round(max(0.0, min(1.0, confidence)), 3),
        "liquidity_tier": _liquidity(symbol),
        "source": source,
        "source_mapping_type": (source_candidate or {}).get("mapping_type"),
        "source_direction_bias": (source_candidate or {}).get("direction_bias"),
        "source_mapping_confidence": (source_candidate or {}).get("mapping_confidence"),
        "provenance": {
            "derived_from": "execution_candidates.json",
            "method": "deterministic_shadow_research_expansion",
            "llm_status": "not_called_in_runtime",
        },
        "promotion_status": "shadow_only",
        "dispatcher_eligible": False,
        "executable": False,
    }


def _dedupe_ideas(ideas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[tuple[str, str, str], dict[str, Any]] = {}
    for idea in ideas:
        key = (idea["role"], idea["symbol"], idea["side"])
        current = best.get(key)
        if current is None or idea["research_confidence"] > current["research_confidence"]:
            best[key] = idea
    return sorted(
        best.values(),
        key=lambda item: (ROLE_ORDER.index(item["role"]), -item["research_confidence"], item["symbol"]),
    )


def _candidates_by_predicate(instruments: list[dict[str, Any]], predicate) -> list[dict[str, Any]]:
    matches = [item for item in instruments if isinstance(item, dict) and predicate(item)]
    return sorted(
        matches,
        key=lambda item: (
            -_safe_float(item.get("mapping_confidence")),
            -_safe_float(item.get("relevance_score")),
            str(item.get("symbol", "")),
        ),
    )


def _fallback_etf(candidate: dict[str, Any]) -> tuple[str, str, str] | None:
    theme = str(candidate.get("theme") or "")
    category = str(candidate.get("category") or "")
    if theme in THEME_ETF_FALLBACKS:
        return THEME_ETF_FALLBACKS[theme]
    if category in MACRO_HEDGES:
        return MACRO_HEDGES[category]
    return None


def _fallback_hedge(candidate: dict[str, Any]) -> tuple[str, str, str] | None:
    category = str(candidate.get("category") or "")
    theme = str(candidate.get("theme") or "")
    if category in MACRO_HEDGES:
        return MACRO_HEDGES[category]
    if theme in {"energy_infrastructure", "defense_supply_chain"}:
        return ("SH", "buy", "Broad equity downside hedge for risk-off geopolitical tape")
    return None


def expand_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    instruments = [item for item in candidate.get("instrument_candidates", []) if isinstance(item, dict)]
    primary = candidate.get("primary_instrument") if isinstance(candidate.get("primary_instrument"), dict) else None
    ideas: list[dict[str, Any]] = []

    if primary and primary.get("symbol"):
        ideas.append(
            _idea(
                role="direct_beneficiary",
                symbol=primary["symbol"],
                side=_side_from_direction(str(primary.get("direction_bias", "long"))),
                rationale=str(primary.get("reason") or "Primary execution-candidate instrument"),
                confidence=_safe_float(primary.get("mapping_confidence")),
                source="primary_instrument",
                source_candidate=primary,
            )
        )

    hidden = _candidates_by_predicate(
        instruments,
        lambda item: item.get("instrument_type") == "equity"
        and str(item.get("direction_bias")) == "long"
        and str(item.get("mapping_type")) in {"value_chain_operator", "value_chain_company"}
        and (not primary or item.get("symbol") != primary.get("symbol")),
    )
    if hidden:
        item = hidden[0]
        ideas.append(
            _idea(
                role="hidden_supplier",
                symbol=item["symbol"],
                side="buy",
                rationale=str(item.get("reason") or "Alternative value-chain beneficiary"),
                confidence=_safe_float(item.get("mapping_confidence")) * 0.95,
                source="instrument_candidates",
                source_candidate=item,
            )
        )

    second_order = _candidates_by_predicate(
        instruments,
        lambda item: "second_order" in str(item.get("mapping_type", "")) and str(item.get("direction_bias")) == "long",
    )
    if second_order:
        item = second_order[0]
        ideas.append(
            _idea(
                role="second_order_beneficiary",
                symbol=item["symbol"],
                side="buy",
                rationale=str(item.get("reason") or "Second-order beneficiary from the same theme"),
                confidence=_safe_float(item.get("mapping_confidence")) * 0.88,
                source="instrument_candidates",
                source_candidate=item,
            )
        )

    short_leg = _candidates_by_predicate(
        instruments,
        lambda item: str(item.get("direction_bias")) == "short" and item.get("instrument_type") in {"equity", "etf"},
    )
    if short_leg:
        item = short_leg[0]
        ideas.append(
            _idea(
                role="hedge_or_short_leg",
                symbol=item["symbol"],
                side="sell",
                rationale=str(item.get("reason") or "Potential short/hedge leg from candidate mapping"),
                confidence=_safe_float(item.get("mapping_confidence")) * 0.85,
                source="instrument_candidates",
                source_candidate=item,
            )
        )
    else:
        hedge = _fallback_hedge(candidate)
        if hedge:
            symbol, side, rationale = hedge
            ideas.append(
                _idea(
                    role="hedge_or_short_leg",
                    symbol=symbol,
                    side=side,
                    rationale=rationale,
                    confidence=0.55,
                    source="theme_fallback",
                )
            )

    etfs = _candidates_by_predicate(
        instruments,
        lambda item: item.get("instrument_type") == "etf" and str(item.get("direction_bias")) == "long",
    )
    if etfs:
        item = etfs[0]
        ideas.append(
            _idea(
                role="etf_fallback",
                symbol=item["symbol"],
                side="buy",
                rationale=str(item.get("reason") or "ETF fallback for the theme"),
                confidence=_safe_float(item.get("mapping_confidence")) * 0.82,
                source="instrument_candidates",
                source_candidate=item,
            )
        )
    else:
        fallback = _fallback_etf(candidate)
        if fallback:
            symbol, side, rationale = fallback
            ideas.append(
                _idea(
                    role="etf_fallback",
                    symbol=symbol,
                    side=side,
                    rationale=rationale,
                    confidence=0.58,
                    source="theme_fallback",
                )
            )

    ideas = _dedupe_ideas(ideas)
    role_counts = Counter(item["role"] for item in ideas)
    return {
        "candidate_id": candidate.get("candidate_id"),
        "signal_id": candidate.get("signal_id"),
        "source_title": candidate.get("source_title"),
        "source_url": candidate.get("source_url"),
        "source_timestamp": candidate.get("source_timestamp"),
        "pattern_id": candidate.get("pattern_id"),
        "pattern_name": candidate.get("pattern_name"),
        "theme": candidate.get("theme"),
        "chain_layer": candidate.get("chain_layer"),
        "chain_sublayer": candidate.get("chain_sublayer"),
        "dispatch_readiness": candidate.get("dispatch_readiness"),
        "execution_priority": candidate.get("execution_priority"),
        "current_primary_instrument": primary,
        "research_ideas": ideas,
        "coverage": {
            "idea_count": len(ideas),
            "roles_present": sorted(role_counts),
            "missing_roles": [role for role in ROLE_ORDER if role_counts[role] == 0],
        },
        "promotion": {
            "status": "shadow_only",
            "dispatcher_eligible": False,
            "requires_human_review": True,
            "requires_code_promotion": True,
            "reason": "Research expansion is intentionally disconnected from order dispatch until explicitly approved.",
        },
    }


def build_ticker_research_shadow(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    source_generated_at = ""
    for candidate in candidates:
        value = str(candidate.get("generated_at") or "")
        if value > source_generated_at:
            source_generated_at = value
    expanded = [expand_candidate(candidate) for candidate in candidates if isinstance(candidate, dict)]
    return {
        "artifact": "ticker_research_shadow",
        "schema_version": 1,
        "mode": "research_only_shadow",
        "generated_from": "execution_candidates.json",
        "source_generated_at": source_generated_at,
        "llm_assist": {
            "status": "not_called_in_runtime",
            "intended_role": "Future optional analyst pass can review and expand these deterministic ideas before promotion.",
            "safety_note": "No LLM output is trusted for execution without deterministic validation and explicit promotion.",
        },
        "promotion": {
            "status": "shadow_only",
            "dispatcher_eligible": False,
            "live_order_path_changed": False,
        },
        "summary": {
            "candidate_count": len(expanded),
            "total_research_ideas": sum(len(row["research_ideas"]) for row in expanded),
            "ready_candidate_count": sum(1 for row in expanded if (row.get("dispatch_readiness") or {}).get("ready")),
        },
        "candidates": expanded,
    }


def write_ticker_research_shadow(input_path: Path = DEFAULT_INPUT, output_path: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    candidates = _load_json(input_path)
    if not isinstance(candidates, list):
        raise ValueError("execution candidates input must be a JSON list")
    artifact = build_ticker_research_shadow(candidates)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build shadow-only ticker research ideas from execution candidates.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Path to execution_candidates.json")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Path for ticker_research_shadow.json")
    parser.add_argument("--stdout", action="store_true", help="Print artifact to stdout instead of writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    candidates = _load_json(Path(args.input))
    if not isinstance(candidates, list):
        raise ValueError("execution candidates input must be a JSON list")
    artifact = build_ticker_research_shadow(candidates)
    if args.stdout:
        print(json.dumps(artifact, indent=2))
    else:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
        print(
            f"Wrote {artifact['summary']['candidate_count']} candidates / "
            f"{artifact['summary']['total_research_ideas']} research ideas to {output}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
