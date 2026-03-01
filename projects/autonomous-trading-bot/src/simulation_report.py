"""Paper-only simulation reporting helpers.

This module summarizes simulation outputs without any execution side effects.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List


def build_simulation_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build concise daily summary metrics for paper-only simulation runs."""
    total = len(results)
    accepted = sum(1 for row in results if bool(row.get("accepted")))
    denied = total - accepted

    denial_counter: Counter[str] = Counter()
    warning_counter: Counter[str] = Counter()

    size_multipliers: List[float] = []
    confidence_adjustments: List[float] = []

    for row in results:
        proposal = row.get("proposal") if isinstance(row.get("proposal"), dict) else {}
        decision_context = (
            row.get("decision_context") if isinstance(row.get("decision_context"), dict) else {}
        )
        context = row.get("context") if isinstance(row.get("context"), dict) else {}

        size_multiplier = proposal.get("size_multiplier")
        if isinstance(size_multiplier, (int, float)):
            size_multipliers.append(float(size_multiplier))

        confidence_adjustment = proposal.get("confidence_adjustment")
        if isinstance(confidence_adjustment, (int, float)):
            confidence_adjustments.append(float(confidence_adjustment))

        if not row.get("accepted"):
            for reason in row.get("reasons", []):
                if isinstance(reason, str) and reason.strip():
                    denial_counter[reason] += 1

        for warning in context.get("warnings", []):
            if isinstance(warning, str) and warning.strip():
                warning_counter[warning] += 1

        # Also surface fusion rationale lines as lightweight context warnings.
        for line in decision_context.get("reasons", []):
            if isinstance(line, str) and line.strip():
                warning_counter[line] += 1

    avg_size_multiplier = (
        round(sum(size_multipliers) / len(size_multipliers), 6) if size_multipliers else 0.0
    )
    avg_confidence_adjustment = (
        round(sum(confidence_adjustments) / len(confidence_adjustments), 6)
        if confidence_adjustments
        else 0.0
    )

    top_context_warnings = [
        {"warning": warning, "count": count}
        for warning, count in warning_counter.most_common(5)
    ]

    return {
        "paper_only": True,
        "counts": {
            "total": total,
            "accepted": accepted,
            "denied": denied,
        },
        "denial_reason_breakdown": dict(denial_counter),
        "avg_size_multiplier": avg_size_multiplier,
        "avg_confidence_adjustment": avg_confidence_adjustment,
        "top_context_warnings": top_context_warnings,
    }
