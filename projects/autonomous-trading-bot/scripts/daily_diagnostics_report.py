#!/usr/bin/env python3
"""
Daily Diagnostics Report Generator

Reads webhook_decisions.jsonl for a specific date and produces a standalone
markdown report covering: performance, open positions, signal outcomes,
system health, and data-gap warnings.

Usage:
    python scripts/daily_diagnostics_report.py --date 2026-03-13
    python scripts/daily_diagnostics_report.py --date 2026-03-13 --output /path/to/report.md
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.broker_adapter_alpaca import AlpacaPaperAdapter


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_ts(ts_str: str) -> datetime | None:
    """Parse ISO timestamp with Z / +00:00 suffix."""
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except ValueError:
        return None


def _date_from_ts(ts_str: str) -> str:
    """Return date portion YYYY-MM-DD or empty string."""
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

def collect_performance(records: list[dict]) -> dict:
    """Summarise signal volume, acceptance, and execution outcomes for the day."""
    stats = {
        "total": len(records),
        "accepted": 0,
        "denied": 0,
        "submitted": 0,
        "paper_execute": 0,
        "blocked": 0,
        "symbols": Counter(),
        "sides": Counter(),
        "denial_reasons": Counter(),
        "risk_warnings": Counter(),
    }
    for rec in records:
        result = rec.get("result", {})
        accepted = result.get("accepted", False)
        if accepted:
            stats["accepted"] += 1
        else:
            stats["denied"] += 1

        exec_info = result.get("execution", {}) or {}
        status = exec_info.get("status", "unknown")
        if status == "submitted":
            stats["submitted"] += 1
            if exec_info.get("paper_execute"):
                stats["paper_execute"] += 1
        elif status in {"dry_run", "duplicate_suppressed"} and accepted:
            # Accepted but intentionally not submitted to the paper broker.
            pass
        else:
            stats["blocked"] += 1

        req = rec.get("request", {})
        stats["symbols"][req.get("symbol", "UNKNOWN")] += 1
        stats["sides"][req.get("side", "UNKNOWN")] += 1

        for reason in result.get("reasons", []):
            stats["denial_reasons"][reason] += 1

        ctx = result.get("decision_context") or {}
        for warning in ctx.get("reasons", []):
            stats["risk_warnings"][warning] += 1

    return stats


def collect_positions() -> tuple[list[dict], str]:
    """
    Fetch open positions from Alpaca.
    Returns (positions, health_note).
    """
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
            }
            for p in raw
        ]
        return positions, "ok"
    except Exception as e:
        return [], f"error: {e}"


def collect_signal_outcomes(records: list[dict]) -> dict:
    """
    Summarise what happened to the signals the bot acted on.
    Groups by pattern / source_title where available.
    """
    outcomes = {
        "acted": 0,
        "by_symbol": Counter(),
        "by_pattern": Counter(),
        "sources": [],
    }
    for rec in records:
        result = rec.get("result", {})
        if not result.get("accepted"):
            continue
        req = rec.get("request", {})
        outcomes["acted"] += 1
        outcomes["by_symbol"][req.get("symbol", "UNKNOWN")] += 1

        pattern = req.get("pattern_name") or req.get("source_title", "unknown")[:60]
        outcomes["by_pattern"][pattern] += 1

        source = req.get("source_title", "")
        if source and source not in [s for s, _ in outcomes["sources"]]:
            outcomes["sources"].append((source, req.get("source_url", "")))

    return outcomes


def check_webhook_health() -> tuple[str, str]:
    """Ping the local webhook /health endpoint. Returns (status, detail)."""
    url = "http://127.0.0.1:8000/health"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode())
            return "up", json.dumps(body, indent=2)
    except Exception as e:
        return "down", str(e)


# ---------------------------------------------------------------------------
# Markdown renderer
# ---------------------------------------------------------------------------

def render_report(
    date: str,
    perf: dict,
    positions: list[dict],
    pos_health: str,
    outcomes: dict,
    wh_status: str,
    wh_detail: str,
    warnings: list[str],
) -> str:
    lines = [
        f"# Trading Bot Daily Diagnostics — {date}",
        "",
        f"_Generated: {_utc_now_iso()}_",
        "",
        "---",
        "",
        "## Performance",
        "",
        f"| Metric | Value |",
        f"|---------|-------|",
        f"| Signals received | {perf['total']} |",
        f"| Accepted | {perf['accepted']} |",
        f"| Denied | {perf['denied']} |",
        f"| Submitted (paper) | {perf['submitted']} |",
        f"| Paper-execute | {perf['paper_execute']} |",
        f"| Blocked | {perf['blocked']} |",
        "",
    ]

    if perf["symbols"]:
        lines += [
            "### Top Symbols",
            "",
            "| Symbol | Count |",
            "|--------|-------|",
        ]
        for sym, cnt in perf["symbols"].most_common(5):
            lines.append(f"| {sym} | {cnt} |")
        lines.append("")

    if perf["denial_reasons"]:
        lines += [
            "### Denial Reasons",
            "",
        ]
        for reason, cnt in perf["denial_reasons"].most_common(5):
            lines.append(f"- **{cnt}×** {reason[:100]}")
        lines.append("")

    if perf["risk_warnings"]:
        lines += [
            "### Risk Warnings",
            "",
        ]
        for w, cnt in perf["risk_warnings"].most_common(5):
            lines.append(f"- **{cnt}×** {w[:100]}")
        lines.append("")

    lines += [
        "## Open Positions",
        "",
    ]
    if positions:
        total_mv = 0.0
        total_pl = 0.0
        lines += [
            "| Symbol | Side | Qty | Entry | Market Value | Unrealized P&L |",
            "|--------|------|-----|-------|--------------|----------------|",
        ]
        for p in positions:
            try:
                total_mv += float(p["market_value"])
                total_pl += float(p["unrealized_pl"])
            except (ValueError, TypeError):
                pass
            mv = f"${float(p['market_value']):,.2f}" if p["market_value"] else "—"
            pl = f"${float(p['unrealized_pl']):+.2f}" if p["unrealized_pl"] else "—"
            plpc = p.get("unrealized_plpc", "")
            pl_str = f"{pl} ({float(plpc):+.2%})" if plpc else pl
            lines.append(
                f"| {p['symbol']} | {p['side']} | {p['qty']} | "
                f"${p['avg_entry_price']} | {mv} | {pl_str} |"
            )
        lines += [
            "",
            f"**Total market value:** ${total_mv:,.2f}  ",
            f"**Total unrealized P&L:** ${total_pl:+.2f}  ",
            "",
        ]
    else:
        lines += [
            "_No open positions_",
            "",
        ]
    if pos_health != "ok":
        lines += [f"⚠️ Position fetch: `{pos_health}`", ""]

    lines += [
        "## Signal Outcomes",
        "",
        f"Signals acted on: **{outcomes['acted']}**",
        "",
    ]
    if outcomes["by_pattern"]:
        lines += [
            "| Pattern / Source | Count |",
            "|------------------|-------|",
        ]
        for pat, cnt in outcomes["by_pattern"].most_common(8):
            escaped = pat.replace("|", "\\|")
            lines.append(f"| {escaped} | {cnt} |")
        lines.append("")

    if outcomes["sources"]:
        lines += ["### Source Headlines", ""]
        for title, url in outcomes["sources"][:5]:
            lines.append(f"- [{title[:80]}]({url})")
        lines.append("")

    lines += [
        "## System Health",
        "",
        f"**Webhook receiver:** `{wh_status}`",
        "",
    ]
    if wh_status == "up":
        lines.append("```json")
        for detail_line in wh_detail.splitlines():
            lines.append(detail_line)
        lines.append("```")
    else:
        lines.append(f"```\n{wh_detail}\n```")
    lines.append("")

    if warnings:
        lines += [
            "## Warnings / Data Gaps",
            "",
        ]
        for w in warnings:
            lines.append(f"- ⚠️ {w}")
        lines.append("")

    lines += [
        "---",
        "_End of diagnostics report_",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate daily diagnostics report.")
    parser.add_argument("--date", required=True, help="Target date YYYY-MM-DD")
    parser.add_argument(
        "--output", "-o",
        help="Output path (default: reports/daily/<date>.md)",
    )
    args = parser.parse_args()

    date = args.date
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        sys.stderr.write(f"Invalid date format: {date} (expected YYYY-MM-DD)\n")
        sys.exit(1)

    LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"
    OUTPUT_DIR = ROOT / "reports" / "daily"
    OUTPUT_PATH = Path(args.output) if args.output else OUTPUT_DIR / f"{date}.md"

    # Filter log
    records = filter_log_by_date(LOG_PATH, date)

    # Collect sections
    perf = collect_performance(records)
    positions, pos_health = collect_positions()
    outcomes = collect_signal_outcomes(records)
    wh_status, wh_detail = check_webhook_health()

    # Warnings
    warnings: list[str] = []
    if not LOG_PATH.exists():
        warnings.append(f"Decision log not found: {LOG_PATH}")
    elif not records:
        warnings.append(f"No decision records found for {date}")
    if wh_status != "up":
        warnings.append(f"Webhook receiver health check: {wh_status} — {wh_detail[:80]}")
    if pos_health != "ok":
        warnings.append(f"Position fetch failed: {pos_health}")

    # Render
    report_md = render_report(
        date, perf, positions, pos_health,
        outcomes, wh_status, wh_detail, warnings,
    )

    # Write
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(report_md)
    print(f"Report written: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
