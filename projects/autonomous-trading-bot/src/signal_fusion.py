"""Deterministic rule-based fusion between signal payload and macro overlay."""

from __future__ import annotations

from typing import Any, Dict, List


DEFENSE_SYMBOLS = {"LMT", "RTX", "NOC", "LHX", "GD", "ITA"}
ENERGY_SYMBOLS = {"XOM", "CVX", "USO", "XLE"}
SEMIS_AI_SYMBOLS = {"NVDA", "AVGO", "AMD", "TSM", "ASML", "SOXX", "SMH", "XLK"}
HEDGE_SYMBOLS = {"SH", "VIXY", "TLT", "UUP"}
BROAD_MARKET_SYMBOLS = {"SPY", "QQQ", "DIA", "IWM"}


def _float_or_none(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _signal_text(signal: Dict[str, Any]) -> str:
    parts = [
        signal.get("pattern_name"),
        signal.get("pattern_id"),
        signal.get("symbol_category"),
        signal.get("source_title"),
        signal.get("theme"),
        signal.get("symbol_reasoning"),
    ]
    return " ".join(str(part).lower() for part in parts if part not in (None, ""))


def _symbol_family(symbol: str) -> str:
    symbol = symbol.upper().strip()
    if symbol in DEFENSE_SYMBOLS:
        return "defense"
    if symbol in ENERGY_SYMBOLS:
        return "energy"
    if symbol in SEMIS_AI_SYMBOLS:
        return "semis_ai"
    if symbol in HEDGE_SYMBOLS:
        return "hedge"
    if symbol in BROAD_MARKET_SYMBOLS:
        return "broad_market"
    return "single_name"


def _signal_family(signal: Dict[str, Any]) -> str:
    text = _signal_text(signal)
    if any(term in text for term in ("gpu", "semis", "semiconductor", "chip", "nvidia", "artificial intelligence")):
        return "semis_ai"
    if any(term in text for term in ("ukraine", "russia", "war", "defense", "defence", "missile", "military", "geopolitical")):
        return "geopolitical_defense"
    if any(term in text for term in ("oil", "saudi", "aramco", "opec", "hormuz", "tanker", "energy", "crude")):
        return "geopolitical_energy"
    if any(term in text for term in ("fed", "rates", "inflation", "cpi", "nfp", "dollar", "treasury", "macro")):
        return "macro_rates"
    if any(term in text for term in ("0dte", "reddit", "meme", "short squeeze", "retail")):
        return "sentiment_social"
    return "unknown"


def _fit_quality(signal: Dict[str, Any]) -> tuple[str, List[str]]:
    semantic_score = _float_or_none(signal.get("semantic_fit_score"))
    ticker_score = _float_or_none(signal.get("ticker_fit_score"))
    directness = str(signal.get("ticker_fit_directness") or "").strip().lower()
    reasons: List[str] = []

    low_scores = [score for score in (semantic_score, ticker_score) if score is not None and score < 0.60]
    strong_scores = [score for score in (semantic_score, ticker_score) if score is not None and score >= 0.85]

    if low_scores:
        reasons.append("Weak semantic/ticker fit reduces confidence for this exact signal.")
        return "weak", reasons
    if directness in {"theme_proxy", "etf_fallback", "fallback", "ambiguous"}:
        reasons.append("Proxy/fallback ticker mapping is sized more cautiously than direct-company mapping.")
        return "proxy", reasons
    if len(strong_scores) >= 2 or directness == "direct_company":
        reasons.append("Direct/high-fit signal-to-ticker mapping supports normal sizing.")
        return "strong", reasons
    return "neutral", reasons


def _risk_alignment(signal: Dict[str, Any], risk_bias: str) -> tuple[str, List[str]]:
    symbol = str(signal.get("symbol") or "").upper().strip()
    symbol_family = _symbol_family(symbol)
    signal_family = _signal_family(signal)
    side = str(signal.get("side", "")).lower().strip()
    reasons: List[str] = []

    if side != "buy":
        return "global", reasons

    if risk_bias == "risk_off":
        if symbol_family in {"defense", "hedge"} and signal_family == "geopolitical_defense":
            reasons.append("Risk-off/geopolitical backdrop is relevant to this defense or hedge expression.")
            return "supports_signal", reasons
        if symbol_family == "energy" and signal_family == "geopolitical_energy":
            reasons.append("Risk-off backdrop is relevant to this energy/geopolitical expression.")
            return "supports_signal", reasons
        return "conflicts_signal", reasons

    if risk_bias == "risk_on":
        if signal_family in {"semis_ai", "sentiment_social", "macro_rates"} and symbol_family in {"semis_ai", "broad_market", "single_name"}:
            reasons.append("Risk-on backdrop supports this specific growth/macro signal.")
            return "supports_signal", reasons
        if signal_family.startswith("geopolitical") and symbol_family in {"defense", "energy", "hedge"}:
            reasons.append("Risk-on backdrop is not direct support for this geopolitical expression.")
            return "neutral_signal", reasons
        return "global", reasons

    return "global", reasons


def derive_decision_context(signal: Dict[str, Any], context_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Return transparent paper-only modifiers for downstream risk checks.

    Output fields:
      - confidence_adjustment: additive adjustment in [-1.0, 1.0]
      - size_multiplier: multiplicative qty factor in [0.0, 1.5]
      - block_reason: set when severe conflict exists
    """
    summary = context_snapshot.get("summary", {}) if isinstance(context_snapshot, dict) else {}

    risk_bias = str(summary.get("risk_bias", "neutral"))
    severity = str(summary.get("severity", "low"))
    geo_count = int(summary.get("geopolitical_count", 0) or 0)
    take_ratio = float(summary.get("tracked_take_ratio", 0.0) or 0.0)
    available_context = bool(summary.get("available_context", False))

    side = str(signal.get("side", "")).lower()
    symbol = str(signal.get("symbol") or "").upper().strip()
    signal_family = _signal_family(signal)
    symbol_family = _symbol_family(symbol)
    fit_quality, fit_reasons = _fit_quality(signal)
    confidence_adjustment = 0.0
    size_multiplier = 1.0
    reasons: List[str] = []
    block_reason: str | None = None
    alignment = "none"

    if not available_context:
        reasons.append("No external context available. Using neutral modifiers.")
    else:
        alignment, alignment_reasons = _risk_alignment(signal, risk_bias)
        reasons.extend(alignment_reasons)

        if risk_bias == "risk_off":
            if side == "buy":
                if alignment == "supports_signal":
                    confidence_adjustment += 0.05
                    size_multiplier *= 1.0
                else:
                    confidence_adjustment -= 0.2
                    size_multiplier *= 0.7
                    reasons.append("Risk-off backdrop conflicts with this buy signal.")
            elif side == "sell":
                confidence_adjustment += 0.1
                size_multiplier *= 1.05
                reasons.append("Risk-off backdrop supports sell signal.")

        elif risk_bias == "risk_on":
            if side == "buy":
                if alignment == "supports_signal":
                    confidence_adjustment += 0.1
                    size_multiplier *= 1.1
                elif alignment == "neutral_signal":
                    size_multiplier *= 0.9
                else:
                    confidence_adjustment += 0.03
                    size_multiplier *= 1.0
                    reasons.append("Risk-on backdrop is only weak generic support for this signal.")
            elif side == "sell":
                confidence_adjustment -= 0.1
                size_multiplier *= 0.9
                reasons.append("Risk-on backdrop conflicts with sell signal.")

        if severity == "high":
            if side == "buy" and alignment != "supports_signal":
                confidence_adjustment -= 0.25
                size_multiplier *= 0.6
                reasons.append("High-severity macro/news regime reduces long risk appetite for this signal.")
            else:
                size_multiplier *= 0.85
                reasons.append("High-severity regime triggers overall de-leveraging.")

        if geo_count >= 20 and side == "buy" and alignment != "supports_signal":
            confidence_adjustment -= 0.2
            size_multiplier *= 0.5
            reasons.append("Elevated geopolitical signal count throttles unrelated long exposure.")

        if geo_count >= 25 and risk_bias == "risk_off" and side == "buy" and alignment != "supports_signal":
            block_reason = (
                "Severe conflict: risk_off + extreme geopolitical pressure conflicts with this buy signal."
            )
            size_multiplier = 0.0
            confidence_adjustment = min(confidence_adjustment, -0.8)

        # Optional slight support for sell signals when tracked market-intel ideas are weak.
        if side == "sell" and take_ratio < 0.45:
            confidence_adjustment += 0.05
            reasons.append("Low TAKE ratio in tracked signals modestly supports defensive sells.")

    reasons.extend(fit_reasons)
    if fit_quality == "weak":
        confidence_adjustment -= 0.25
        size_multiplier *= 0.5
    elif fit_quality == "proxy":
        confidence_adjustment -= 0.05
        size_multiplier *= 0.8

    confidence_adjustment = max(-1.0, min(1.0, round(confidence_adjustment, 4)))
    size_multiplier = max(0.0, min(1.5, round(size_multiplier, 4)))

    return {
        "confidence_adjustment": confidence_adjustment,
        "size_multiplier": size_multiplier,
        "block_reason": block_reason,
        "reasons": reasons,
        "signal_context": {
            "symbol_family": symbol_family,
            "signal_family": signal_family,
            "risk_alignment": alignment,
            "fit_quality": fit_quality,
        },
        "paper_only": True,
        "ruleset": "signal-specific-context-v1",
    }
