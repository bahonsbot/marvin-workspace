"""Context adapter for local Market Intel and News Reader artifacts.

Paper-only helper that reads local JSON files, tolerates missing inputs,
and derives a compact context snapshot for deterministic fusion rules.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
MARKET_INTEL_DATA_DIR = ROOT.parent / "market-intel" / "data"
NEWS_READER_DATA_DIR = ROOT.parent / "market-intel-news-reader" / "data"


RISK_OFF_CATEGORIES = {"geopolitical", "macroeconomic", "financial_credit"}


def _safe_read_json(path: Path) -> tuple[Any | None, str | None]:
    if not path.exists():
        return None, f"missing:{path.name}"
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"invalid:{path.name}:{exc.__class__.__name__}"


def _count_categories(records: Any) -> Counter:
    counter: Counter = Counter()
    if isinstance(records, list):
        for row in records:
            if not isinstance(row, dict):
                continue
            category = row.get("category") or row.get("signal", {}).get("category")
            if isinstance(category, str) and category.strip():
                counter[category.strip().lower()] += 1
    return counter


def _tracked_take_ratio(records: Any) -> float:
    if not isinstance(records, list) or len(records) == 0:
        return 0.0

    total = 0
    takes = 0
    for row in records:
        if not isinstance(row, dict):
            continue
        signal = row.get("signal", {}) if isinstance(row.get("signal"), dict) else {}
        recommendation = signal.get("recommendation")
        if isinstance(recommendation, str):
            total += 1
            if recommendation.strip().upper() == "TAKE":
                takes += 1

    return (takes / total) if total > 0 else 0.0


def _derive_risk_bias(category_counter: Counter, take_ratio: float) -> str:
    total = sum(category_counter.values())
    if total == 0:
        return "neutral"

    risk_off_count = sum(category_counter.get(cat, 0) for cat in RISK_OFF_CATEGORIES)
    risk_off_ratio = risk_off_count / total

    if risk_off_ratio >= 0.6:
        return "risk_off"
    if risk_off_ratio <= 0.3 and take_ratio >= 0.6:
        return "risk_on"
    return "neutral"


def _derive_severity(high_conf_count: int, geo_count: int) -> str:
    score = high_conf_count + geo_count
    if score >= 40:
        return "high"
    if score >= 15:
        return "medium"
    return "low"


def load_context_snapshot(
    *,
    market_intel_dir: Path = MARKET_INTEL_DATA_DIR,
    news_reader_dir: Path = NEWS_READER_DATA_DIR,
) -> Dict[str, Any]:
    """Load local context artifacts with graceful fallback on missing files."""
    warnings: List[str] = []

    enriched_signals, err = _safe_read_json(market_intel_dir / "signals_enriched_shadow.json")
    if err:
        warnings.append(err)

    tracked_signals, err = _safe_read_json(market_intel_dir / "tracked_signals.json")
    if err:
        warnings.append(err)

    signal_comparison, err = _safe_read_json(market_intel_dir / "signal_ab_comparison.json")
    if err:
        warnings.append(err)

    # News reader is optional. Try common files and use first available payload.
    news_payload = None
    for filename in ("news_snapshot.json", "headlines.json", "feed.json", "latest.json"):
        candidate, err = _safe_read_json(news_reader_dir / filename)
        if candidate is not None:
            news_payload = candidate
            break
        if err and err.startswith("invalid:"):
            warnings.append(err)

    category_counter = _count_categories(enriched_signals)
    high_conf_count = 0
    if isinstance(enriched_signals, list):
        for row in enriched_signals:
            confidence = row.get("confidence") if isinstance(row, dict) else None
            if isinstance(confidence, str) and confidence.strip().upper() == "HIGH":
                high_conf_count += 1

    geo_count = category_counter.get("geopolitical", 0)
    take_ratio = _tracked_take_ratio(tracked_signals)
    risk_bias = _derive_risk_bias(category_counter, take_ratio)
    severity = _derive_severity(high_conf_count, geo_count)

    latest_comparison = (
        signal_comparison[-1]
        if isinstance(signal_comparison, list) and len(signal_comparison) > 0 and isinstance(signal_comparison[-1], dict)
        else {}
    )

    headline_count = 0
    if isinstance(news_payload, list):
        headline_count = len(news_payload)
    elif isinstance(news_payload, dict):
        for key in ("items", "headlines", "articles"):
            value = news_payload.get(key)
            if isinstance(value, list):
                headline_count = len(value)
                break

    return {
        "summary": {
            "risk_bias": risk_bias,
            "severity": severity,
            "high_confidence_signal_count": high_conf_count,
            "geopolitical_count": geo_count,
            "tracked_take_ratio": round(take_ratio, 4),
            "ab_enriched_lift": int(latest_comparison.get("enriched_lift", 0) or 0),
            "news_headline_count": headline_count,
            "available_context": bool(category_counter or latest_comparison or headline_count > 0),
        },
        "sources": {
            "market_intel": {
                "signals_enriched_shadow": isinstance(enriched_signals, list),
                "tracked_signals": isinstance(tracked_signals, list),
                "signal_ab_comparison": isinstance(signal_comparison, list),
            },
            "news_reader": {
                "data_present": news_payload is not None,
            },
        },
        "warnings": warnings,
        "paper_only": True,
    }
