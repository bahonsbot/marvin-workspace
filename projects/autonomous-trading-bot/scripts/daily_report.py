#!/usr/bin/env python3
"""Daily summary report from webhook decision logs.

Reads webhook_decisions.jsonl and produces a concise daily summary:
- signals received, accepted, denied
- execution stats (submitted, dry-run, blocked)
- denial reasons breakdown
- top risk warnings
- ASCII equity curve (P&L over time)
- current open positions from Alpaca
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add parent to path for imports
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.broker_adapter_alpaca import AlpacaPaperAdapter


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


def extract_pnl_data(log_path: Path) -> list[tuple[datetime, float]]:
    """Extract P&L data from executed trades in the log.
    
    Returns list of (timestamp, cumulative_pnl) tuples.
    Currently uses submitted trades - would need filled trades for real P&L.
    """
    trades = []
    cumulative_pnl = 0.0
    
    for line in log_path.read_text().splitlines():
        if not line.strip():
            continue
        record = parse_log_line(line)
        if not record:
            continue
        
        # Get timestamp
        ts_str = record.get("timestamp", "")
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        
        # Check for executed trade
        result = record.get("result", {})
        execution = result.get("execution", {})
        exec_status = execution.get("status", "")
        
        # For now, track accepted submissions as "trades" 
        # (real P&L would come from filled trades with avg_fill_price)
        if exec_status == "submitted":
            # Check for filled trade data
            broker_result = execution.get("broker_result", {})
            filled_qty = broker_result.get("filled_qty", "0")
            filled_price = broker_result.get("filled_avg_price")
            
            if filled_qty and filled_qty != "0" and filled_price:
                # Real filled trade - calculate P&L
                # For now using a placeholder - in real implementation,
                # we'd need exit price to calculate actual P&L
                pass
            
            # Record this as a data point even without P&L
            trades.append((ts, cumulative_pnl))
    
    return trades


def generate_ascii_equity_curve(pnl_data: list[tuple[datetime, float]], width: int = 40, height: int = 10) -> str:
    """Generate a simple ASCII equity curve chart.
    
    Args:
        pnl_data: List of (timestamp, cumulative_pnl) tuples
        width: Character width of the chart
        height: Character height of the chart
    
    Returns:
        ASCII chart string
    """
    if not pnl_data:
        return "  [No trade data available yet]"
    
    # Get min/max P&L values
    values = [pnl for _, pnl in pnl_data]
    min_pnl = min(values)
    max_pnl = max(values)
    
    # Handle flat line case
    if min_pnl == max_pnl:
        mid = height // 2
        line = "+" + "-" * width + "+"
        chart = [line]
        for i in range(height):
            row = "|" + (" " * width) + "|"
            if i == mid:
                row = "|" + ("=" * width) + "|"
            chart.append(row)
        chart.append(line)
        chart.append(f"  P&L: ${min_pnl:+.2f} (flat)")
        return "\n".join(chart)
    
    # Build the chart
    range_pnl = max_pnl - min_pnl
    if range_pnl == 0:
        range_pnl = 1
    
    # Create buckets for each column
    buckets = [[] for _ in range(width)]
    for i, (_, pnl) in enumerate(pnl_data):
        bucket_idx = int((i / max(len(pnl_data) - 1, 1)) * (width - 1))
        buckets[bucket_idx].append(pnl)
    
    # Find max/min in each bucket for range
    bucket_max = [max(b) if b else min_pnl for b in buckets]
    bucket_min = [min(b) if b else max_pnl for b in buckets]
    
    # Build the ASCII chart from top to bottom
    chart_lines = []
    chart_lines.append("+" + "-" * width + "+")
    
    for row in range(height):
        # Calculate Pnl range for this row
        row_max = max_pnl - (row / (height - 1)) * range_pnl
        row_min = max_pnl - ((row + 1) / (height - 1)) * range_pnl
        
        line = "|"
        for col in range(width):
            # Check if this column's range overlaps with this row
            if bucket_max[col] >= row_min and bucket_min[col] <= row_max:
                # Draw a point or line
                if bucket_max[col] >= row_max and bucket_min[col] <= row_min:
                    line += "#"  # Full column
                elif bucket_max[col] >= row_max or bucket_min[col] <= row_min:
                    line += "o"  # Partial
                else:
                    line += "-"
            else:
                line += " "
        line += "|"
        chart_lines.append(line)
    
    chart_lines.append("+" + "-" * width + "+")
    
    # Add axis labels
    chart_lines.append(f"  Start: ${min_pnl:+.2f}" + " " * (width - 20) + f"End: ${max_pnl:+.2f}")
    
    return "\n".join(chart_lines)


def fetch_open_positions() -> list[dict]:
    """Fetch current open positions from Alpaca paper API.
    
    Returns:
        List of position dicts with symbol, qty, market_value
    """
    try:
        adapter = AlpacaPaperAdapter()
        positions = adapter.list_positions()
        
        # Simplify position data
        open_positions = []
        for pos in positions:
            open_positions.append({
                "symbol": pos.get("symbol", ""),
                "qty": pos.get("qty", "0"),
                "market_value": pos.get("market_value", "0.00"),
                "side": pos.get("side", ""),
                "avg_entry_price": pos.get("avg_entry_price", "0.00"),
            })
        return open_positions
    except Exception as e:
        print(f"  [Warning: Could not fetch positions: {e}]")
        return []


def format_report(stats: dict, pnl_data: list[tuple[datetime, float]] = None, positions: list[dict] = None) -> str:
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

    # Add equity curve if we have P&L data
    if pnl_data is not None:
        lines.append("Equity Curve:")
        equity_chart = generate_ascii_equity_curve(pnl_data)
        for chart_line in equity_chart.split("\n"):
            lines.append("  " + chart_line)
        lines.append("")

    # Add open positions if available
    if positions:
        lines.append("Open Positions:")
        total_value = 0.0
        for pos in positions:
            symbol = pos.get("symbol", "")
            qty = pos.get("qty", "0")
            market_val = pos.get("market_value", "0.00")
            side = pos.get("side", "")
            avg_price = pos.get("avg_entry_price", "0.00")
            try:
                total_value += float(market_val)
            except (ValueError, TypeError):
                pass
            lines.append(f"  {symbol}: {qty} shares ({side}) @ ${avg_price} = ${market_val}")
        lines.append(f"  Total: ${total_value:,.2f}")
        lines.append("")
    elif positions is not None:
        lines.append("Open Positions: None")
        lines.append("")

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
    pnl_data = extract_pnl_data(LOG_PATH)
    positions = fetch_open_positions()
    report = format_report(stats, pnl_data, positions)
    print(report)


if __name__ == "__main__":
    main()
