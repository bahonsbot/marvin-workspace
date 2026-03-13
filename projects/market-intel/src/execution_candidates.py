#!/usr/bin/env python3
"""Deterministic execution-candidate producer for Market Intel M1."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_OUTPUT = DATA_DIR / "execution_candidates.json"

INPUT_FILES = {
    "enhanced_signals": DATA_DIR / "enhanced_signals.json",
    "shadow_signals": DATA_DIR / "signals_enriched_shadow.json",
    "tracked_signals": DATA_DIR / "tracked_signals.json",
    "ab_comparison": DATA_DIR / "signal_ab_comparison.json",
    "patterns": DATA_DIR / "patterns.json",
}

SOURCE_CREDIBILITY = {
    "reuters": 0.95,
    "financial_times": 0.90,
    "ap_top": 0.88,
    "market_watch": 0.75,
    "business": 0.70,
    "financialjuice": 0.65,
    "zerohedge": 0.55,
    "techcrunch": 0.50,
    "the_verge": 0.45,
    "ycombinator": 0.40,
    "unusualwhales": 0.40,
    "r/wallstreetbets": 0.30,
    "r/investing": 0.50,
    "r/options": 0.45,
    "r/stockmarket": 0.45,
    "r/securityanalysis": 0.60,
}

COMPANY_TICKER = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "meta": "META",
    "facebook": "META",
    "tesla": "TSLA",
    "nvidia": "NVDA",
    "bytedance": "TCEHY",
    "tiktok": "META",
    "ulta": "ULTA",
    "kyivstar": "VEON",
    "boeing": "BA",
    "lockheed": "LMT",
    "exxon": "XOM",
    "chevron": "CVX",
}

THEME_CANDIDATES = [
    {
        "keywords": ("oil", "crude", "sanction", "shipping", "tanker", "hormuz", "red sea"),
        "candidates": (
            ("USO", "etf", 0.88, "commodity_proxy", "long", "Oil supply or transport disruption"),
            ("XLE", "etf", 0.80, "sector_proxy", "long", "Energy sector usually benefits from higher oil prices"),
            ("JETS", "etf", 0.67, "second_order_negative", "short", "Airlines face fuel-cost pressure"),
        ),
    },
    {
        "keywords": ("defense", "military", "missile", "war", "escort", "navy", "aerospace"),
        "candidates": (
            ("ITA", "etf", 0.77, "sector_proxy", "long", "Defense and aerospace demand sensitivity"),
            ("SH", "etf", 0.62, "macro_proxy", "long", "Broad risk-off hedge when conflict escalates"),
        ),
    },
    {
        "keywords": ("pandemic", "covid", "outbreak", "virus", "lockdown"),
        "candidates": (
            ("SH", "etf", 0.79, "macro_proxy", "long", "Broad equity downside hedge"),
            ("VIXY", "etf", 0.74, "macro_proxy", "long", "Volatility exposure for market stress"),
            ("TLT", "etf", 0.63, "macro_proxy", "long", "Flight-to-quality treasury proxy"),
        ),
    },
    {
        "keywords": ("rate cut", "rate cuts", "dovish", "yield down", "yields fall", "bond rally"),
        "candidates": (
            ("TLT", "etf", 0.83, "macro_proxy", "long", "Rates down typically support long-duration bonds"),
            ("QQQ", "etf", 0.70, "second_order_positive", "long", "Growth equities often benefit from lower yields"),
            ("UUP", "etf", 0.60, "second_order_negative", "short", "Dollar can soften as rate differentials narrow"),
        ),
    },
    {
        "keywords": ("rate rise", "rate rises", "hike", "hikes", "yield surge", "yields soar", "inflation"),
        "candidates": (
            ("UUP", "etf", 0.74, "macro_proxy", "long", "Higher rates can support the dollar"),
            ("TLT", "etf", 0.72, "macro_proxy", "short", "Long-duration bonds are pressured by rising yields"),
            ("QQQ", "etf", 0.63, "second_order_negative", "short", "Higher discount rates pressure duration-heavy equities"),
        ),
    },
    {
        "keywords": ("chip", "chips", "gpu", "semiconductor", "semis", "ai"),
        "candidates": (
            ("SOXX", "etf", 0.82, "sector_proxy", "long", "Semiconductor sector proxy"),
            ("NVDA", "equity", 0.74, "company_direct", "long", "Nvidia is a leading AI/semi proxy"),
            ("XLK", "etf", 0.66, "sector_proxy", "long", "Broader technology spillover"),
        ),
    },
    {
        "keywords": ("retail", "consumer", "store", "beauty", "e-commerce"),
        "candidates": (
            ("XRT", "etf", 0.68, "sector_proxy", "long", "Retail sector proxy"),
            ("XLY", "etf", 0.63, "sector_proxy", "long", "Consumer discretionary proxy"),
        ),
    },
]

POSITIVE_TITLE_HINTS = (
    "surge", "boom", "rise", "beats", "beat", "growth", "gets access", "escort", "ease", "eases"
)
NEGATIVE_TITLE_HINTS = (
    "crash", "fall", "falls", "cuts", "axes", "sanctions", "war", "chokes", "probe", "investigation", "miss"
)

TOPIC_FAMILY_KEYWORDS = {
    "geopolitical_oil": (
        "oil", "crude", "hormuz", "strait", "tanker", "tankers", "shipping", "red sea", "gulf exports",
    ),
    "geopolitical_conflict": (
        "war", "military", "missile", "escort", "navy", "conflict", "attack", "attacks", "ukraine", "russia", "iran",
    ),
    "rates_macro": (
        "inflation", "cpi", "ppi", "fed", "rate", "rates", "yield", "yields", "treasury", "jobs data",
    ),
    "credit_macro": (
        "credit rating", "downgrade", "downgraded", "deficit", "debt ceiling", "fiscal", "default",
    ),
    "semis_ai": (
        "ai", "chip", "chips", "gpu", "gpus", "semiconductor", "semis", "nvidia", "bytedance", "deepseek",
    ),
    "consumer_retail": (
        "retail", "consumer", "shoppers", "store", "stores", "beauty", "ulta", "e-commerce",
    ),
    "meme_social": (
        "gamestop", "short squeeze", "meme stock", "reddit", "wallstreetbets",
    ),
    "pandemic": (
        "pandemic", "covid", "outbreak", "virus", "lockdown",
    ),
}

TOPIC_FAMILY_SUPERSETS = {
    "geopolitical_oil": "geopolitical",
    "geopolitical_conflict": "geopolitical",
    "rates_macro": "macro",
    "credit_macro": "macro",
    "semis_ai": "sector",
    "consumer_retail": "sector",
    "meme_social": "social",
    "pandemic": "macro",
}

BROAD_ROUNDUP_PHRASES = (
    "stock futures are flat ahead of",
    "stock futures",
    "ahead of key",
    "ahead of inflation data",
    "traders monitor",
    "investors await",
    "markets await",
    "market wrap",
    "morning briefing",
    "week ahead",
    "news roundup",
    "stocks are flat",
)

OIL_DISRUPTION_TERMS = (
    "disruption", "reroute", "reroutes", "rerouting", "attack", "attacks", "sanction", "sanctions", "choke",
    "chokes", "halts", "halt", "surge", "spike", "spikes", "escort",
)

OIL_EXECUTION_TERMS = (
    "disruption",
    "reroute",
    "reroutes",
    "rerouting",
    "attack",
    "attacks",
    "sanction",
    "sanctions",
    "choke",
    "chokes",
    "halts",
    "halt",
    "escort",
    "hormuz",
    "tanker",
    "tankers",
    "shipping",
    "red sea",
)

MACRO_TITLE_BLOCKLIST = (
    "stock futures",
    "stocks are flat",
    "traders monitor",
    "investors await",
    "ahead of key",
)

FX_STRESS_TERMS = (
    "rupee",
    "currency",
    "fx",
    "forex",
    "devaluation",
    "devalue",
    "depreciation",
)

DEFENSE_EXPLICIT_TERMS = (
    "defense",
    "military",
    "missile",
    "navy",
    "aerospace",
    "weapons",
    "contract",
    "contracts",
    "fighter",
)


@dataclass(frozen=True)
class InstrumentCandidate:
    symbol: str
    instrument_type: str
    relevance_score: float
    mapping_confidence: float
    mapping_type: str
    direction_bias: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "instrument_type": self.instrument_type,
            "relevance_score": self.relevance_score,
            "mapping_confidence": self.mapping_confidence,
            "mapping_type": self.mapping_type,
            "direction_bias": self.direction_bias,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class TitleContext:
    families: frozenset[str]
    broad_roundup: bool
    explicit_single_name: bool
    mixed_theme: bool
    fx_stress: bool
    clean_theme: bool


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_url(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text.rstrip("/")


def hash_id(prefix: str, *parts: Any, length: int = 16) -> str:
    normalized = "|".join(normalize_text(part) for part in parts)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:length]
    return f"{prefix}_{digest}"


def fingerprint_for_signal(signal: dict[str, Any]) -> str:
    identity = [
        signal.get("source", ""),
        signal.get("feed", ""),
        normalize_url(signal.get("url", "")) or signal.get("title", ""),
        signal.get("timestamp", ""),
    ]
    digest = hashlib.sha256("|".join(str(part) for part in identity).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def round3(value: float) -> float:
    return round(value, 3)


def source_credibility(feed: str) -> float:
    return SOURCE_CREDIBILITY.get(normalize_text(feed).replace(" ", "_"), 0.5)


def confidence_to_score(value: str) -> float:
    return {
        "HIGH": 0.90,
        "MEDIUM_HIGH": 0.75,
        "MEDIUM": 0.60,
        "LOW": 0.35,
    }.get(str(value or "").upper(), 0.50)


def confidence_level_to_score(value: str) -> float:
    return {
        "STRONG BUY": 0.95,
        "BUY": 0.80,
        "HOLD": 0.60,
        "WEAK": 0.35,
        "SKIP": 0.10,
    }.get(str(value or "").upper(), 0.50)


def horizon_to_score(value: str) -> float:
    return {
        "intraday": 0.92,
        "short-term": 0.78,
        "medium-term": 0.64,
        "long-term": 0.52,
    }.get(normalize_text(value), 0.55)


def risk_overlay_hint(category: str, pattern_name: str) -> str:
    category_norm = normalize_text(category)
    combined = f"{category_norm} {normalize_text(pattern_name)}"
    if "sentiment_social" in combined or "short squeeze" in combined:
        return "crowding_risk"
    if "geopolitical" in combined or "war" in combined:
        return "elevated_macro_volatility"
    if "macro" in combined or "rate" in combined or "inflation" in combined:
        return "macro_event_risk"
    if "company" in combined:
        return "single_name_gap_risk"
    return "event_risk"


def deterministic_generated_at(signals: list[dict[str, Any]], ab_rows: list[dict[str, Any]]) -> str:
    timestamps = [str(item.get("timestamp", "")).strip() for item in signals if item.get("timestamp")]
    timestamps.extend(str(item.get("timestamp", "")).strip() for item in ab_rows if item.get("timestamp"))
    if not timestamps:
        return "1970-01-01T00:00:00Z"
    timestamps = [stamp if stamp.endswith("Z") else f"{stamp}Z" for stamp in timestamps]
    return max(timestamps)


def pattern_lookup(patterns_payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    patterns = patterns_payload.get("patterns", []) if isinstance(patterns_payload, dict) else []
    return {str(item.get("id")): item for item in patterns if isinstance(item, dict) and item.get("id")}


def tracked_indexes(tracked_signals: list[dict[str, Any]]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    by_pattern: dict[str, list[dict[str, Any]]] = {}
    by_category: dict[str, list[dict[str, Any]]] = {}
    for item in tracked_signals:
        if not isinstance(item, dict):
            continue
        signal = item.get("signal", {})
        pattern_id = str(signal.get("pattern_id", "")).strip()
        category = str(signal.get("category", "")).strip().lower()
        if pattern_id:
            by_pattern.setdefault(pattern_id, []).append(item)
        if category:
            by_category.setdefault(category, []).append(item)
    return by_pattern, by_category


def shadow_index(shadow_signals: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for item in shadow_signals:
        if not isinstance(item, dict):
            continue
        key = shadow_key(item)
        if key:
            index[key] = item
    return index


def shadow_key(signal: dict[str, Any]) -> str:
    url = normalize_url(signal.get("url", ""))
    title = normalize_text(signal.get("title", ""))
    source = normalize_text(signal.get("source", ""))
    feed = normalize_text(signal.get("feed", ""))
    return "|".join([source, feed, url or title])


def detect_company_candidates(title: str) -> list[InstrumentCandidate]:
    title_norm = normalize_text(title)
    matches = []
    for name, ticker in COMPANY_TICKER.items():
        if re.search(rf"(^|[^a-z0-9]){re.escape(name)}([^a-z0-9]|$)", title_norm):
            direction = "long"
            if any(term in title_norm for term in NEGATIVE_TITLE_HINTS):
                direction = "short"
            confidence = 0.78 if direction == "long" else 0.72
            matches.append(
                InstrumentCandidate(
                    symbol=ticker,
                    instrument_type="equity",
                    relevance_score=round3(confidence),
                    mapping_confidence=round3(confidence),
                    mapping_type="company_direct",
                    direction_bias=direction,
                    reason=f"Direct company mention: {name}",
                )
            )
    # Preserve deterministic order by ticker, but dedupe repeated aliases.
    deduped: dict[str, InstrumentCandidate] = {}
    for candidate in sorted(matches, key=lambda item: (item.symbol, item.reason)):
        deduped.setdefault(candidate.symbol, candidate)
    return list(deduped.values())


def title_has_keyword(title_norm: str, keyword: str) -> bool:
    if " " in keyword:
        return keyword in title_norm
    return re.search(rf"(^|[^a-z0-9]){re.escape(keyword)}([^a-z0-9]|$)", title_norm) is not None


def infer_topic_families(text: str, category: str = "") -> frozenset[str]:
    text_norm = normalize_text(text)
    families = {family for family, keywords in TOPIC_FAMILY_KEYWORDS.items() if any(title_has_keyword(text_norm, keyword) for keyword in keywords)}
    category_norm = normalize_text(category)
    if category_norm == "geopolitical":
        families.add("geopolitical_conflict")
    elif category_norm == "macroeconomic":
        families.add("rates_macro")
    elif category_norm == "sentiment_social":
        families.add("meme_social")
    return frozenset(sorted(families))


def infer_title_context(title: str) -> TitleContext:
    title_norm = normalize_text(title)
    families = infer_topic_families(title)
    broad_roundup = any(phrase in title_norm for phrase in BROAD_ROUNDUP_PHRASES)
    explicit_single_name = bool(detect_company_candidates(title))
    mixed_theme = len(families) > 1
    fx_stress = any(title_has_keyword(title_norm, term) for term in FX_STRESS_TERMS)
    clean_theme = not broad_roundup and len(families) == 1
    return TitleContext(
        families=families,
        broad_roundup=broad_roundup,
        explicit_single_name=explicit_single_name,
        mixed_theme=mixed_theme,
        fx_stress=fx_stress,
        clean_theme=clean_theme,
    )


def upstream_families(signal: dict[str, Any], pattern_info: dict[str, Any] | None) -> frozenset[str]:
    pattern_name = str((pattern_info or {}).get("name") or signal.get("pattern") or "")
    category = str((pattern_info or {}).get("category") or signal.get("category") or "")
    return infer_topic_families(f"{pattern_name} {category}", category)


def has_strong_family_mismatch(title_context: TitleContext, upstream: frozenset[str]) -> bool:
    title_specific = {family for family in title_context.families if family in TOPIC_FAMILY_SUPERSETS}
    upstream_specific = {family for family in upstream if family in TOPIC_FAMILY_SUPERSETS}
    if not title_specific or not upstream_specific:
        return False
    if title_specific & upstream_specific:
        return False
    title_supers = {TOPIC_FAMILY_SUPERSETS[family] for family in title_specific}
    upstream_supers = {TOPIC_FAMILY_SUPERSETS[family] for family in upstream_specific}
    return title_supers.isdisjoint(upstream_supers)


def has_clean_oil_execution_title(title: str) -> bool:
    title_norm = normalize_text(title)
    return any(term in title_norm for term in OIL_EXECUTION_TERMS)


def detect_theme_candidates(title: str) -> list[InstrumentCandidate]:
    title_norm = normalize_text(title)
    found: list[InstrumentCandidate] = []
    seen_symbols: set[str] = set()
    for mapping in THEME_CANDIDATES:
        if not any(title_has_keyword(title_norm, keyword) for keyword in mapping["keywords"]):
            continue
        for symbol, instrument_type, score, mapping_type, direction_bias, reason in mapping["candidates"]:
            if symbol in seen_symbols:
                continue
            found.append(
                InstrumentCandidate(
                    symbol=symbol,
                    instrument_type=instrument_type,
                    relevance_score=round3(score),
                    mapping_confidence=round3(score),
                    mapping_type=mapping_type,
                    direction_bias=direction_bias,
                    reason=reason,
                )
            )
            seen_symbols.add(symbol)
    return found


def adjust_candidates_for_title_context(
    title: str,
    candidates: list[InstrumentCandidate],
    title_context: TitleContext,
) -> list[InstrumentCandidate]:
    title_norm = normalize_text(title)
    adjusted: list[InstrumentCandidate] = []
    for candidate in candidates:
        score = candidate.relevance_score
        confidence = candidate.mapping_confidence
        reason = candidate.reason

        if title_context.broad_roundup and candidate.mapping_type != "company_direct":
            score = max(0.0, score - 0.18)
            confidence = max(0.0, confidence - 0.22)
            reason = f"{reason}; downgraded for broad roundup headline"

        if (
            candidate.symbol in {"USO", "XLE", "JETS"}
            and any(term in title_norm for term in MACRO_TITLE_BLOCKLIST)
            and not any(term in title_norm for term in OIL_DISRUPTION_TERMS)
        ):
            continue

        if (
            candidate.symbol in {"USO", "XLE", "JETS"}
            and title_context.mixed_theme
            and not has_clean_oil_execution_title(title)
        ):
            continue

        if (
            candidate.symbol == "ITA"
            and title_context.fx_stress
            and not any(term in title_norm for term in DEFENSE_EXPLICIT_TERMS)
        ):
            continue

        adjusted.append(
            InstrumentCandidate(
                symbol=candidate.symbol,
                instrument_type=candidate.instrument_type,
                relevance_score=round3(score),
                mapping_confidence=round3(confidence),
                mapping_type=candidate.mapping_type,
                direction_bias=candidate.direction_bias,
                reason=reason,
            )
        )
    return adjusted


def fallback_macro_candidates(category: str, pattern_name: str, reasoning_score: float, title_context: TitleContext) -> list[InstrumentCandidate]:
    if normalize_text(category) not in {"geopolitical", "macroeconomic", "sentiment_news", "sentiment_social"}:
        return []
    title_score = clamp(reasoning_score / 100.0)
    if title_context.broad_roundup:
        title_score = min(title_score, 0.48)
    return [
        InstrumentCandidate(
            symbol="SPY",
            instrument_type="etf",
            relevance_score=round3(min(0.58, 0.42 + title_score * 0.12)),
            mapping_confidence=round3(min(0.58, 0.42 + title_score * 0.12)),
            mapping_type="macro_proxy",
            direction_bias="long" if "crash" not in normalize_text(pattern_name) else "short",
            reason="Fallback broad-market proxy for a macro signal",
        )
    ]


def build_instrument_candidates(signal: dict[str, Any], title_context: TitleContext) -> list[dict[str, Any]]:
    title = str(signal.get("title", ""))
    company = detect_company_candidates(title)
    theme = adjust_candidates_for_title_context(title, detect_theme_candidates(title), title_context)
    fallback = fallback_macro_candidates(
        signal.get("category", ""),
        signal.get("pattern", ""),
        safe_float(signal.get("reasoning_score")),
        title_context,
    )

    merged: dict[tuple[str, str], InstrumentCandidate] = {}
    for candidate in company + theme + fallback:
        key = (candidate.symbol, candidate.direction_bias)
        current = merged.get(key)
        if current is None or (candidate.relevance_score, candidate.mapping_confidence, candidate.reason) > (
            current.relevance_score,
            current.mapping_confidence,
            current.reason,
        ):
            merged[key] = candidate

    ordered = sorted(
        merged.values(),
        key=lambda item: (-item.relevance_score, -item.mapping_confidence, item.symbol, item.direction_bias, item.reason),
    )
    return [item.to_dict() for item in ordered[:3]]


def choose_primary_instrument(
    signal: dict[str, Any],
    instrument_candidates: list[dict[str, Any]],
    title_context: TitleContext,
) -> dict[str, Any] | None:
    if not instrument_candidates:
        return None
    if title_context.broad_roundup and not title_context.explicit_single_name:
        return None
    if title_context.mixed_theme and not title_context.explicit_single_name and not has_clean_oil_execution_title(str(signal.get("title", ""))):
        return None
    if title_context.fx_stress and not title_context.explicit_single_name:
        return None
    top = instrument_candidates[0]
    if title_context.broad_roundup and top["mapping_type"] != "company_direct":
        return None
    if (
        title_context.mixed_theme
        and not has_clean_oil_execution_title(str(signal.get("title", "")))
        and top["mapping_type"] != "company_direct"
    ):
        return None
    if title_context.fx_stress and top["mapping_type"] != "company_direct":
        return None
    return {
        "symbol": top["symbol"],
        "instrument_type": top["instrument_type"],
        "direction_bias": top["direction_bias"],
        "relevance_score": top["relevance_score"],
        "mapping_confidence": top["mapping_confidence"],
    }


def compute_evidence_strength(signal: dict[str, Any], pattern_info: dict[str, Any] | None, shadow_match: dict[str, Any] | None) -> float:
    reasoning_score = clamp(safe_float(signal.get("reasoning_score")) / 100.0)
    pattern_conf = confidence_to_score((pattern_info or {}).get("confidence") or signal.get("confidence"))
    source_conf = source_credibility(str(signal.get("feed", "")))
    horizon_conf = horizon_to_score((pattern_info or {}).get("time_horizon") or signal.get("time_horizon"))
    shadow_bonus = 0.03 if shadow_match else 0.0
    score = (reasoning_score * 0.45) + (pattern_conf * 0.20) + (source_conf * 0.20) + (horizon_conf * 0.15) + shadow_bonus
    return round3(clamp(score))


def tracked_context(signal: dict[str, Any], tracked_by_pattern: dict[str, list[dict[str, Any]]], tracked_by_category: dict[str, list[dict[str, Any]]]) -> tuple[float | None, int]:
    pattern_matches = tracked_by_pattern.get(str(signal.get("pattern_id", "")), [])
    category_matches = tracked_by_category.get(str(signal.get("category", "")).lower(), [])
    sample = pattern_matches if pattern_matches else category_matches
    verified = [item for item in sample if item.get("verified")]
    if not verified:
        return None, 0
    correct = 0
    for item in verified:
        outcome = normalize_text(item.get("actual_outcome"))
        if outcome in {"correct", "take", "true_positive"}:
            correct += 1
    return round3(correct / len(verified)), len(verified)


def dispatch_readiness(
    signal: dict[str, Any],
    evidence_strength: float,
    instrument_candidates: list[dict[str, Any]],
    primary_instrument: dict[str, Any] | None,
    title_context: TitleContext,
    upstream_topic_families: frozenset[str],
) -> tuple[bool, list[str], str]:
    reasons: list[str] = []
    confidence_level = str(signal.get("confidence_level", "")).upper()
    recommendation = str(signal.get("recommendation", "")).upper()
    reasoning_score = safe_float(signal.get("reasoning_score"))

    if recommendation != "TAKE":
        reasons.append("recommendation_not_take")
    if confidence_level in {"WEAK", "SKIP"}:
        reasons.append("pattern_confidence_too_weak")
    if reasoning_score < 60.0:
        reasons.append("reasoning_score_too_weak")
    if evidence_strength < 0.62:
        reasons.append("evidence_strength_too_weak")
    if title_context.broad_roundup:
        reasons.append("broad_roundup_title")
    if (
        title_context.mixed_theme
        and not title_context.explicit_single_name
        and not has_clean_oil_execution_title(str(signal.get("title", "")))
    ):
        reasons.append("mixed_theme_title")
    if title_context.fx_stress and not title_context.explicit_single_name:
        reasons.append("fx_stress_secondary_mapping")
    if has_strong_family_mismatch(title_context, upstream_topic_families):
        reasons.append("pattern_topic_mismatch")
        reasons.append("title_pattern_family_mismatch")

    if not instrument_candidates:
        reasons.append("no_tradable_proxy")
    elif primary_instrument is None:
        reasons.append("no_clear_primary_instrument")
    else:
        top = instrument_candidates[0]
        if top["mapping_confidence"] < 0.60:
            reasons.append("mapping_confidence_too_low")
        if top["mapping_type"].startswith("second_order") and not title_context.clean_theme:
            reasons.append("mapping_too_second_order")

        top_two = instrument_candidates[:2]
        if len(top_two) > 1:
            first, second = top_two
            if (
                abs(first["relevance_score"] - second["relevance_score"]) <= 0.05
                and first["direction_bias"] != second["direction_bias"]
            ):
                reasons.append("mapping_too_ambiguous")
        direction_counts = Counter(candidate["direction_bias"] for candidate in instrument_candidates if candidate.get("direction_bias"))
        if direction_counts and len(direction_counts) > 1 and direction_counts.most_common(1)[0][1] == direction_counts.most_common()[-1][1]:
            reasons.append("direction_unclear")

    ready = not reasons

    if ready:
        execution_bias = "allow"
    elif "no_tradable_proxy" in reasons or "mapping_too_ambiguous" in reasons:
        execution_bias = "block"
    elif "evidence_strength_too_weak" in reasons or "reasoning_score_too_weak" in reasons:
        execution_bias = "observe"
    else:
        execution_bias = "caution"

    return ready, reasons, execution_bias


def execution_priority(
    signal: dict[str, Any],
    evidence_strength: float,
    primary_instrument: dict[str, Any] | None,
    ready: bool,
    shadow_match: dict[str, Any] | None,
) -> float:
    reasoning_component = clamp(safe_float(signal.get("reasoning_score")) / 100.0)
    mapping_component = safe_float(primary_instrument.get("mapping_confidence")) if primary_instrument else 0.0
    confidence_component = confidence_level_to_score(str(signal.get("confidence_level", "")))
    score = (evidence_strength * 0.40) + (mapping_component * 0.25) + (reasoning_component * 0.20) + (confidence_component * 0.10)
    score += 0.03 if shadow_match else 0.0
    score += 0.02 if ready else -0.20
    return round3(clamp(score))


def build_feedback_context(
    signal: dict[str, Any],
    shadow_match: dict[str, Any] | None,
    tracked_by_pattern: dict[str, list[dict[str, Any]]],
    tracked_by_category: dict[str, list[dict[str, Any]]],
    ab_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    components = signal.get("reasoning_components", {}) if isinstance(signal.get("reasoning_components"), dict) else {}
    tracked_ratio, tracked_sample_size = tracked_context(signal, tracked_by_pattern, tracked_by_category)
    latest_ab = ab_rows[-1] if ab_rows else {}
    result = {
        "feedback_bias_points": round3(safe_float(components.get("feedback_bias_points"))),
        "feedback_sample_size": int(components.get("feedback_sample_size") or 0),
        "tracked_take_ratio": tracked_ratio,
        "tracked_sample_size": tracked_sample_size,
        "ab_enriched_lift": int(latest_ab.get("enriched_lift") or 0),
        "shadow_confirmation": bool(shadow_match),
    }
    if shadow_match is not None:
        result["shadow_signal_score"] = safe_float(shadow_match.get("signal_score"))
    return result


def build_candidate(
    signal: dict[str, Any],
    pattern_by_id: dict[str, dict[str, Any]],
    tracked_by_pattern: dict[str, list[dict[str, Any]]],
    tracked_by_category: dict[str, list[dict[str, Any]]],
    shadow_by_key: dict[str, dict[str, Any]],
    ab_rows: list[dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    pattern_info = pattern_by_id.get(str(signal.get("pattern_id", "")), {})
    shadow_match = shadow_by_key.get(shadow_key(signal))
    title_context = infer_title_context(str(signal.get("title", "")))
    upstream_topic_families = upstream_families(signal, pattern_info)
    instrument_candidates = build_instrument_candidates(signal, title_context)
    primary_instrument = choose_primary_instrument(signal, instrument_candidates, title_context)
    evidence_strength = compute_evidence_strength(signal, pattern_info, shadow_match)
    ready, readiness_reasons, execution_bias = dispatch_readiness(
        signal,
        evidence_strength,
        instrument_candidates,
        primary_instrument,
        title_context,
        upstream_topic_families,
    )
    priority = execution_priority(signal, evidence_strength, primary_instrument, ready, shadow_match)
    fingerprint = fingerprint_for_signal(signal)
    signal_id = hash_id(
        "sig",
        signal.get("source", ""),
        signal.get("feed", ""),
        normalize_url(signal.get("url", "")) or signal.get("title", ""),
        signal.get("timestamp", ""),
    )
    primary_symbol = primary_instrument["symbol"] if primary_instrument else "none"
    primary_direction = primary_instrument["direction_bias"] if primary_instrument else "none"
    candidate_id = hash_id(
        "cand",
        signal_id,
        primary_symbol,
        primary_direction,
        pattern_info.get("time_horizon") or signal.get("time_horizon", ""),
    )

    return {
        "candidate_id": candidate_id,
        "signal_id": signal_id,
        "signal_fingerprint": fingerprint,
        "generated_at": generated_at,
        "source_type": signal.get("source"),
        "source_feed": signal.get("feed"),
        "source_title": signal.get("title"),
        "source_url": signal.get("url"),
        "source_timestamp": signal.get("timestamp"),
        "pattern_id": signal.get("pattern_id"),
        "pattern_name": signal.get("pattern"),
        "category": signal.get("category"),
        "historical_confidence": (pattern_info or {}).get("confidence") or signal.get("confidence"),
        "confidence_level": signal.get("confidence_level"),
        "reasoning_score": safe_float(signal.get("reasoning_score")),
        "signal_score": safe_float(signal.get("signal_score")),
        "recommendation": signal.get("recommendation"),
        "expected_horizon": (pattern_info or {}).get("time_horizon") or signal.get("time_horizon"),
        "reasoning": signal.get("reasoning", ""),
        "reasoning_components": signal.get("reasoning_components") or {},
        "evidence_strength": evidence_strength,
        "signal_briefing": signal.get("signal_briefing", ""),
        "predicted_outcomes": signal.get("predicted_outcomes") or [],
        "predicted_causal_chain": signal.get("predicted_causal_chain") or [],
        "instrument_candidates": instrument_candidates,
        "primary_instrument": primary_instrument,
        "execution_bias": execution_bias,
        "risk_overlay_hint": risk_overlay_hint(str(signal.get("category", "")), str(signal.get("pattern", ""))),
        "execution_priority": priority,
        "dispatch_readiness": {
            "ready": ready,
            "reasons": readiness_reasons,
        },
        "feedback_context": build_feedback_context(
            signal,
            shadow_match,
            tracked_by_pattern,
            tracked_by_category,
            ab_rows,
        ),
    }


def build_execution_candidates(base_dir: Path | None = None) -> list[dict[str, Any]]:
    data_dir = (base_dir or DATA_DIR).resolve()
    enhanced_signals = load_json(data_dir / "enhanced_signals.json", [])
    shadow_signals = load_json(data_dir / "signals_enriched_shadow.json", [])
    tracked_signals = load_json(data_dir / "tracked_signals.json", [])
    ab_rows = load_json(data_dir / "signal_ab_comparison.json", [])
    patterns_payload = load_json(data_dir / "patterns.json", {})

    if not isinstance(enhanced_signals, list):
        raise ValueError("enhanced_signals.json must contain a list")

    generated_at = deterministic_generated_at(enhanced_signals, ab_rows if isinstance(ab_rows, list) else [])
    pattern_by_id = pattern_lookup(patterns_payload if isinstance(patterns_payload, dict) else {})
    tracked_by_pattern, tracked_by_category = tracked_indexes(tracked_signals if isinstance(tracked_signals, list) else [])
    shadow_by_key = shadow_index(shadow_signals if isinstance(shadow_signals, list) else [])

    candidates = [
        build_candidate(
            signal,
            pattern_by_id,
            tracked_by_pattern,
            tracked_by_category,
            shadow_by_key,
            ab_rows if isinstance(ab_rows, list) else [],
            generated_at,
        )
        for signal in enhanced_signals
        if isinstance(signal, dict)
    ]

    deduped: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for candidate in candidates:
        event_key = (
            normalize_text(candidate.get("source_title", "")),
            normalize_url(candidate.get("source_url", "")) or normalize_text(candidate.get("source_title", "")),
            normalize_text(candidate.get("pattern_id", "")),
            normalize_text(candidate.get("category", "")),
        )
        current = deduped.get(event_key)
        if current is None:
            deduped[event_key] = candidate
            continue
        current_rank = (
            bool(current.get("dispatch_readiness", {}).get("ready")),
            safe_float(current.get("execution_priority")),
            safe_float(current.get("evidence_strength")),
            -len(current.get("dispatch_readiness", {}).get("reasons", [])),
            current.get("candidate_id", ""),
        )
        candidate_rank = (
            bool(candidate.get("dispatch_readiness", {}).get("ready")),
            safe_float(candidate.get("execution_priority")),
            safe_float(candidate.get("evidence_strength")),
            -len(candidate.get("dispatch_readiness", {}).get("reasons", [])),
            candidate.get("candidate_id", ""),
        )
        if candidate_rank > current_rank:
            deduped[event_key] = candidate

    candidates = list(deduped.values())

    candidates.sort(
        key=lambda item: (
            -safe_float(item.get("execution_priority")),
            item.get("candidate_id", ""),
            item.get("signal_id", ""),
        )
    )
    return candidates


def write_execution_candidates(output_path: Path, candidates: list[dict[str, Any]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(candidates, handle, indent=2, sort_keys=False)
        handle.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate deterministic Market Intel execution candidates.")
    parser.add_argument("--data-dir", default=str(DATA_DIR), help="Directory containing Market Intel JSON inputs")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Where to write execution_candidates.json")
    parser.add_argument("--stdout", action="store_true", help="Print JSON to stdout instead of writing a file")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    candidates = build_execution_candidates(Path(args.data_dir))
    if args.stdout:
        print(json.dumps(candidates, indent=2))
    else:
        write_execution_candidates(Path(args.output), candidates)
        print(f"Wrote {len(candidates)} execution candidates to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
