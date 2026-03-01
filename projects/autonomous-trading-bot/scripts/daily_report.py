#!/usr/bin/env python3
"""Daily summary report from webhook decision logs.

Reads webhook_decisions.jsonl and produces a concise daily summary:
- signals received, accepted, denied
- execution stats (submitted, dry-run, blocked)
- denial reasons breakdown
- top risk warnings
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_log_line(line: str) -> dict | None:
    try:
        return json.loads(line.strip())
    except json.JSONDecodeError:
        return None


def summarize_log(log_path: Path) -> dict:
    stats = {
        "total": 0,
        "accepted": 0,
        "denied": 0,
        "execution": {
            "submitted": 0,
            "dry_run": 0,
            "blocked": 0,
        },
        "denial_reasons": Counter(),
        "risk_warnings": Counter(),
        "symbols": Counter(),
        "sides": Counter(),
    }

    for line in log_path.read_text().splitlines():
        if not line.strip():
            continue
        record = parse_log_line(line)
        if not record:
            continue

        stats["total"] += 1

        # Extract result
        result = record.get("result", {})
        accepted = result.get("accepted", False)

        if accepted:
            stats["accepted"] += 1
        else:
            stats["denied"] += 1

        # Execution status
        execution = result.get("execution", {})
        exec_status = execution.get("status", "unknown")
        if exec_status == "submitted":
            stats["execution"]["submitted"] += 1
        elif exec_status in ("dry_run", "paper_guard_blocked"):
            stats["execution"]["dry_run"] += 1
        else:
            stats["execution"]["blocked"] += 1

        # Symbol and side
        request = record.get("request", {})
        symbol = request.get("symbol", "UNKNOWN")
        side = request.get("side", "UNKNOWN")
        stats["symbols"][symbol] += 1
        stats["sides"][side] += 1

        # Denial reasons
        reasons = result.get("reasons", [])
        for reason in reasons:
            stats["denial_reasons"][reason] += 1

        # Risk warnings from decision_context
        ctx = result.get("decision_context", {})
        warnings = ctx.get("reasons", [])
        for warning in warnings:
            stats["risk_warnings"][warning] += 1

    return stats


def format_report(stats: dict) -> str:
    lines = [
        "=" * 50,
        "DAILY TRADING BOT SUMMARY",
        "=" * 50,
        "",
        f"Total signals received: {stats['total']}",
        f"  Accepted: {stats['accepted']}",
        f"  Denied:  {stats['denied']}",
        "",
        "Execution:",
        f"  Submitted (paper): {stats['execution']['submitted']}",
        f"  Dry-run:            {stats['execution']['dry_run']}",
        f"  Blocked:            {stats['execution']['blocked']}",
        "",
    ]

    if stats["symbols"]:
        lines.append("Top Symbols:")
        for symbol, count in stats["symbols"].most_common(5):
            lines.append(f"  {symbol}: {count}")
        lines.append("")

    if stats["denial_reasons"]:
        lines.append("Denial Reasons:")
        for reason, count in stats["denial_reasons"].most_common(5):
            lines.append(f"  {count}x {reason[:60]}")
        lines.append("")

    if stats["risk_warnings"]:
        lines.append("Risk Warnings:")
        for warning, count in stats["risk_warnings"].most_common(5):
            lines.append(f"  {count}x {warning[:60]}")
        lines.append("")

    lines.append("=" * 50)
    return "\n".join(lines)


def main() -> None:
    ROOT = Path(__file__).resolve().parents[1]
    LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"

    if not LOG_PATH.exists():
        print(f"Log file not found: {LOG_PATH}")
        sys.exit(1)

    stats = summarize_log(LOG_PATH)
    report = format_report(stats)
    print(report)


if __name__ == "__main__":
    main()
