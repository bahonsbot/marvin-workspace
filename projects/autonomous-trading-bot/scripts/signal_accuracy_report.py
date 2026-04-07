#!/usr/bin/env python3
"""
Signal Accuracy Report Generator

Reads webhook_decisions.jsonl for a given date and produces a structured
JSON report covering:
  - Signal volume and acceptance rate
  - Breakdown by pattern / symbol / side
  - Position-level P&L for acted signals (via Alpaca paper)
  - Execution status summary
  - Data-gap warnings

Feeds the nightly signal_accuracy_review cron job and replaces the stub
in src/reporter.py.

Usage:
    python scripts/signal_accuracy_report.py --date 2026-04-06
    python scripts/signal_accuracy_report.py --date 2026-04-06 --output /path/to/report.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load minimal broker env from project .env when not already exported by the parent runtime.
_ENV_PATH = ROOT / ".env"
_ALLOWED_ENV_KEYS = {
    "PAPER_MODE",
    "ALPACA_API_KEY",
    "ALPACA_API_SECRET",
    "ALPACA_BASE_URL",
}
if _ENV_PATH.exists():
    for line in _ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            key = key.strip()
            if key in _ALLOWED_ENV_KEYS:
                os.environ.setdefault(key, val.strip())

from src.broker_adapter_alpaca import AlpacaPaperAdapter


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_ts(ts_str: str) -> datetime | None:
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except ValueError:
        return None


def _date_from_ts(ts_str: str) -> str:
    dt = _parse_ts(ts_str)
    return dt.strftime("%Y-%m-%d") if dt else ""


def parse_record(line: str) -> dict | None:
    try:
        return json.loads(line.strip())
    except json.JSONDecodeError:
        return None


def filter_log_by_date(log_path: Path, date: str) -> list[dict]:
    """Return only log lines whose top-level timestamp falls on the given date."""
    records = []
    if not log_path.exists():
        return records
    for line in log_path.read_text().splitlines():
        if not line.strip():
            continue
        record = parse_record(line)
        if not record:
            continue
        ts = record.get("timestamp", "")
        if _date_from_ts(ts) == date:
            records.append(record)
    return records


# ---------------------------------------------------------------------------
# Section collectors
# ---------------------------------------------------------------------------

def collect_signal_stats(records: list[dict]) -> dict:
    """Volume, acceptance, and execution breakdown."""
    stats = {
        "total": len(records),
        "accepted": 0,
        "denied": 0,
        "submitted": 0,
        "paper_execute": 0,
        "blocked": 0,
        "symbols": dict(Counter()),
        "sides": dict(Counter()),
        "patterns": dict(Counter()),
        "denial_reasons": dict(Counter()),
        "execution_statuses": Counter(),
    }
    for rec in records:
        result = rec.get("result", {})
        accepted = result.get("accepted", False)
        if accepted:
            stats["accepted"] += 1
        else:
            stats["denied"] += 1

        exec_info = result.get("execution", {})
        status = exec_info.get("status", "unknown")
        stats["execution_statuses"][status] += 1

        if status == "submitted":
            stats["submitted"] += 1
        elif exec_info.get("paper_execute"):
            stats["paper_execute"] += 1
        else:
            stats["blocked"] += 1

        req = rec.get("request", {})
        sym = req.get("symbol", "UNKNOWN")
        side = req.get("side", "UNKNOWN")
        pattern = req.get("pattern_name") or req.get("source_title", "unknown")[:60]

        stats["symbols"][sym] = stats["symbols"].get(sym, 0) + 1
        stats["sides"][side] = stats["sides"].get(side, 0) + 1
        stats["patterns"][pattern] = stats["patterns"].get(pattern, 0) + 1

        for reason in result.get("reasons", []):
            stats["denial_reasons"][reason] = stats["denial_reasons"].get(reason, 0) + 1

    return stats


def collect_positions() -> tuple[list[dict], str]:
    """Fetch open positions from Alpaca paper. Returns (positions, health_note)."""
    try:
        adapter = AlpacaPaperAdapter()
        raw = adapter.list_positions()
        positions = [
            {
                "symbol": p.get("symbol", ""),
                "qty": p.get("qty", "0"),
                "side": p.get("side", ""),
                "avg_entry_price": p.get("avg_entry_price", "0.00"),
                "market_value": p.get("market_value", "0.00"),
                "unrealized_pl": p.get("unrealized_pl", "0.00"),
                "unrealized_plpc": p.get("unrealized_plpc", "0.00"),
                "current_price": p.get("current_price", "0.00"),
            }
            for p in raw
        ]
        return positions, "ok"
    except Exception as e:
        return [], f"error: {e}"


def build_accuracy_report(
    date: str,
    stats: dict,
    positions: list[dict],
    pos_health: str,
    warnings: list[str],
) -> dict:
    """Assemble the structured accuracy report."""
    total = stats["total"]
    accepted = stats["accepted"]
    denied = stats["denied"]

    # Build symbol-level position map for quick lookup
    pos_map: dict[str, dict] = {p["symbol"]: p for p in positions}

    # Cross-reference accepted signals with open positions
    acted_signals: list[dict] = []
    symbol_stats: dict[str, dict] = {}

    for sym, count in stats["symbols"].items():
        pos = pos_map.get(sym, {})
        unrealized = float(pos.get("unrealized_pl", 0) or 0)
        side = pos.get("side", "")
        mv = float(pos.get("market_value", 0) or 0)

        symbol_stats[sym] = {
            "signal_count": count,
            "has_position": bool(pos),
            "side": side,
            "qty": pos.get("qty", "0"),
            "avg_entry": pos.get("avg_entry_price", "0.00"),
            "market_value": mv,
            "unrealized_pl": unrealized,
            "unrealized_plpc": float(pos.get("unrealized_plpc", 0) or 0),
        }

    # Top patterns
    top_patterns = sorted(
        stats["patterns"].items(),
        key=lambda x: x[1],
        reverse=True,
    )[:10]

    # Top denial reasons
    top_denials = sorted(
        stats["denial_reasons"].items(),
        key=lambda x: x[1],
        reverse=True,
    )[:5]

    report = {
        "generated_at": _utc_now_iso(),
        "report_date": date,
        "paper_only": True,

        # Volume summary
        "volume": {
            "total_signals": total,
            "accepted": accepted,
            "denied": denied,
            "acceptance_rate": round(accepted / total, 4) if total > 0 else None,
        },

        # Execution summary
        "execution": {
            "submitted": stats["submitted"],
            "paper_execute": stats["paper_execute"],
            "blocked": stats["blocked"],
            "status_breakdown": dict(stats["execution_statuses"]),
        },

        # Breakdown
        "by_pattern": [
            {"pattern": p, "count": c}
            for p, c in top_patterns
        ],
        "by_symbol": [
            {
                "symbol": sym,
                "signal_count": s["signal_count"],
                "has_position": s["has_position"],
                "side": s["side"],
                "qty": s["qty"],
                "avg_entry": s["avg_entry"],
                "market_value": s["market_value"],
                "unrealized_pl": s["unrealized_pl"],
                "unrealized_plpc": s["unrealized_plpc"],
            }
            for sym, s in sorted(symbol_stats.items(), key=lambda x: x[1]["signal_count"], reverse=True)
        ],
        "by_side": dict(stats["sides"]),

        # Denial reasons
        "denial_reasons": [
            {"reason": r, "count": c}
            for r, c in top_denials
        ],

        # Open positions health
        "positions": {
            "health": pos_health,
            "count": len(positions),
            "items": positions,
        },

        # Warnings
        "warnings": warnings,

        # Tags for downstream triage
        "flags": [],
    }

    # Auto-flag anomalies
    if total > 0 and accepted == 0:
        report["flags"].append("ALL_SIGNALS_DENIED")
    if pos_health != "ok":
        report["flags"].append("POSITION_FETCH_FAILED")
    if stats["denied"] > 0 and stats["denied"] / total > 0.8:
        report["flags"].append("HIGH_DENIAL_RATE")

    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate signal accuracy report.")
    parser.add_argument("--date", required=True, help="Target date YYYY-MM-DD")
    parser.add_argument(
        "--output", "-o",
        help="Output path (default: reports/accuracy/<date>.json)",
    )
    args = parser.parse_args()

    date = args.date
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        sys.stderr.write(f"Invalid date format: {date} (expected YYYY-MM-DD)\n")
        sys.exit(1)

    LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"
    OUTPUT_DIR = ROOT / "reports" / "accuracy"
    OUTPUT_PATH = Path(args.output) if args.output else OUTPUT_DIR / f"{date}.json"

    records = filter_log_by_date(LOG_PATH, date)
    stats = collect_signal_stats(records)
    positions, pos_health = collect_positions()

    warnings: list[str] = []
    if not LOG_PATH.exists():
        warnings.append(f"Decision log not found: {LOG_PATH}")
    elif not records:
        warnings.append(f"No decision records found for {date}")
    if pos_health != "ok":
        warnings.append(f"Position fetch failed: {pos_health}")

    report = build_accuracy_report(date, stats, positions, pos_health, warnings)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"Report written: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
