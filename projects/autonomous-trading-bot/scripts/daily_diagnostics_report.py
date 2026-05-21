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
import os
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load minimal broker env from project .env when not already exported by the parent runtime.
# Keep this allowlisted so diagnostics can inspect positions without leaking or loading
# unrelated runtime settings.
_ENV_PATH = ROOT / ".env"
_ALLOWED_ENV_KEYS = {
    "PAPER_MODE",
    "ALPACA_API_KEY",
    "ALPACA_API_SECRET",
    "ALPACA_BASE_URL",
}


def _load_env_file(env_path: Path = _ENV_PATH) -> int:
    loaded = 0
    if not env_path.exists():
        return loaded
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            key = key.strip()
            if key in _ALLOWED_ENV_KEYS and key not in os.environ:
                os.environ[key] = val.strip()
                loaded += 1
    return loaded


_load_env_file()

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


def classify_outcome(result: dict[str, Any]) -> str:
    """Return an operational outcome bucket for one webhook decision result."""
    exec_info = result.get("execution", {}) or {}
    status = str(exec_info.get("status") or "").strip().lower()
    reason = str(exec_info.get("reason") or "").strip().lower()
    accepted = bool(result.get("accepted", False))

    if status == "submitted":
        return "submitted"
    if status == "dry_run":
        return "dry_run"
    if status == "duplicate_suppressed":
        return "duplicate_suppressed"
    if status == "validation_failed":
        return "validation_failed"
    if status == "denied" or reason == "risk_denied":
        return "risk_denied"
    if status == "paper_guard_blocked":
        return "paper_guard_blocked"
    if status in {"execution_failed", "type_error"}:
        return status
    if accepted:
        return "accepted_no_execution"
    return "blocked_unknown"


def normalize_denial_reason(reason: str) -> str:
    """Group noisy reason strings into stable report buckets."""
    lowered = reason.lower()
    if "timestamp" in lowered and "stale" in lowered:
        return "stale_timestamp"
    if "daily loss cap" in lowered:
        return "daily_loss_cap"
    if "kill switch" in lowered:
        return "kill_switch"
    if "max open positions" in lowered:
        return "max_open_positions"
    if "max position size" in lowered:
        return "max_position_size"
    if "sell" in lowered and "inventory" in lowered:
        return "sell_inventory"
    if "symbol" in lowered and ("invalid" in lowered or "not" in lowered):
        return "symbol_validation"
    return reason[:100]


def _score_bucket(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if score >= 0.85:
        return ">=0.85"
    if score >= 0.70:
        return "0.70-0.84"
    if score >= 0.55:
        return "0.55-0.69"
    return "<0.55"


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
        "outcomes": Counter(),
        "symbols": Counter(),
        "sides": Counter(),
        "strategies": Counter(),
        "patterns": Counter(),
        "market_intel_modes": Counter(),
        "semantic_fit_buckets": Counter(),
        "ticker_fit_buckets": Counter(),
        "ticker_directness": Counter(),
        "denial_reasons": Counter(),
        "denial_reason_buckets": Counter(),
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

        outcome = classify_outcome(result)
        stats["outcomes"][outcome] += 1

        req = rec.get("request", {})
        stats["symbols"][req.get("symbol", "UNKNOWN")] += 1
        stats["sides"][req.get("side", "UNKNOWN")] += 1
        stats["strategies"][req.get("strategy", "unknown")] += 1
        stats["patterns"][req.get("pattern_name") or req.get("pattern_id") or "unknown"] += 1
        stats["market_intel_modes"][req.get("market_intel_mode", "unknown")] += 1

        semantic_bucket = _score_bucket(req.get("semantic_fit_score"))
        if semantic_bucket:
            stats["semantic_fit_buckets"][semantic_bucket] += 1
        ticker_bucket = _score_bucket(req.get("ticker_fit_score"))
        if ticker_bucket:
            stats["ticker_fit_buckets"][ticker_bucket] += 1
        ticker_directness = req.get("ticker_fit_directness")
        if ticker_directness:
            stats["ticker_directness"][str(ticker_directness)] += 1

        for reason in result.get("reasons", []):
            stats["denial_reasons"][reason] += 1
            stats["denial_reason_buckets"][normalize_denial_reason(str(reason))] += 1

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

    if perf["outcomes"]:
        lines += [
            "### Outcome Buckets",
            "",
            "| Outcome | Count |",
            "|---------|-------|",
        ]
        for outcome, cnt in perf["outcomes"].most_common():
            lines.append(f"| {outcome} | {cnt} |")
        lines.append("")

    if perf["strategies"]:
        lines += [
            "### Strategies / Modes",
            "",
            "| Strategy | Count |",
            "|----------|-------|",
        ]
        for strategy, cnt in perf["strategies"].most_common(8):
            lines.append(f"| {strategy} | {cnt} |")
        lines += ["", "| Market Intel mode | Count |", "|-------------------|-------|"]
        for mode, cnt in perf["market_intel_modes"].most_common(8):
            lines.append(f"| {mode} | {cnt} |")
        lines.append("")

    if perf["patterns"]:
        lines += [
            "### Top Patterns",
            "",
            "| Pattern | Count |",
            "|---------|-------|",
        ]
        for pattern, cnt in perf["patterns"].most_common(8):
            escaped = str(pattern).replace("|", "\\|")
            lines.append(f"| {escaped} | {cnt} |")
        lines.append("")

    if perf["semantic_fit_buckets"] or perf["ticker_fit_buckets"] or perf["ticker_directness"]:
        lines += [
            "### Fit Score Summary",
            "",
        ]
        if perf["semantic_fit_buckets"]:
            lines += ["**Semantic fit buckets**", "", "| Score bucket | Count |", "|--------------|-------|"]
            for bucket, cnt in perf["semantic_fit_buckets"].most_common():
                lines.append(f"| {bucket} | {cnt} |")
            lines.append("")
        if perf["ticker_fit_buckets"]:
            lines += ["**Ticker fit buckets**", "", "| Score bucket | Count |", "|--------------|-------|"]
            for bucket, cnt in perf["ticker_fit_buckets"].most_common():
                lines.append(f"| {bucket} | {cnt} |")
            lines.append("")
        if perf["ticker_directness"]:
            lines += ["**Ticker directness**", "", "| Directness | Count |", "|------------|-------|"]
            for directness, cnt in perf["ticker_directness"].most_common():
                lines.append(f"| {directness} | {cnt} |")
            lines.append("")

    if perf["denial_reasons"]:
        lines += [
            "### Denial Reason Buckets",
            "",
        ]
        for reason, cnt in perf["denial_reason_buckets"].most_common(8):
            lines.append(f"- **{cnt}×** {reason}")
        lines += [
            "",
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
