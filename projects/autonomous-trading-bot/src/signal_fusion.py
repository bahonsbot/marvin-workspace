"""Deterministic rule-based fusion between technical payload and market context."""

from __future__ import annotations

from typing import Any, Dict, List


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
    confidence_adjustment = 0.0
    size_multiplier = 1.0
    reasons: List[str] = []
    block_reason: str | None = None

    if not available_context:
        reasons.append("No external context available. Using neutral modifiers.")
    else:
        if risk_bias == "risk_off":
            if side == "buy":
                confidence_adjustment -= 0.2
                size_multiplier *= 0.7
                reasons.append("Risk-off backdrop conflicts with buy signal.")
            elif side == "sell":
                confidence_adjustment += 0.1
                size_multiplier *= 1.05
                reasons.append("Risk-off backdrop supports sell signal.")

        elif risk_bias == "risk_on":
            if side == "buy":
                confidence_adjustment += 0.1
                size_multiplier *= 1.1
                reasons.append("Risk-on backdrop supports buy signal.")
            elif side == "sell":
                confidence_adjustment -= 0.1
                size_multiplier *= 0.9
                reasons.append("Risk-on backdrop conflicts with sell signal.")

        if severity == "high":
            if side == "buy":
                confidence_adjustment -= 0.25
                size_multiplier *= 0.6
                reasons.append("High-severity macro/news regime reduces long risk appetite.")
            else:
                size_multiplier *= 0.85
                reasons.append("High-severity regime triggers overall de-leveraging.")

        if geo_count >= 20 and side == "buy":
            confidence_adjustment -= 0.2
            size_multiplier *= 0.5
            reasons.append("Elevated geopolitical signal count throttles long exposure.")

        if geo_count >= 25 and risk_bias == "risk_off" and side == "buy":
            block_reason = (
                "Severe conflict: risk_off + extreme geopolitical pressure conflicts with buy signal."
            )
            size_multiplier = 0.0
            confidence_adjustment = min(confidence_adjustment, -0.8)

        # Optional slight support for sell signals when tracked market-intel ideas are weak.
        if side == "sell" and take_ratio < 0.45:
            confidence_adjustment += 0.05
            reasons.append("Low TAKE ratio in tracked signals modestly supports defensive sells.")

    confidence_adjustment = max(-1.0, min(1.0, round(confidence_adjustment, 4)))
    size_multiplier = max(0.0, min(1.5, round(size_multiplier, 4)))

    return {
        "confidence_adjustment": confidence_adjustment,
        "size_multiplier": size_multiplier,
        "block_reason": block_reason,
        "reasons": reasons,
        "paper_only": True,
        "ruleset": "context-fusion-v1",
    }
