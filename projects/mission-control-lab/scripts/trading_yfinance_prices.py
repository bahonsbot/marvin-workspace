#!/usr/bin/env python3
"""Small JSON bridge for Mission Control Lab Trading yfinance price history."""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from typing import Any


def safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except Exception:
        return None


def main() -> int:
    symbol = sys.argv[1].strip().upper() if len(sys.argv) > 1 else ""
    period = sys.argv[2].strip().lower() if len(sys.argv) > 2 else "1y"
    interval = sys.argv[3].strip().lower() if len(sys.argv) > 3 else "1d"
    if not symbol:
        print(json.dumps({"error": "missing symbol"}))
        return 2

    try:
        import yfinance as yf
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"symbol": symbol, "error": f"yfinance unavailable: {exc}"}))
        return 1

    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period=period, interval=interval, auto_adjust=True)
    except Exception as exc:
        print(json.dumps({"symbol": symbol, "error": f"history unavailable: {exc}"}))
        return 1

    points: list[dict[str, Any]] = []
    if history is not None and not getattr(history, "empty", True):
        for index, row in history.iterrows():
            close = safe_float(row.get("Close"))
            if close is None:
                continue
            try:
                date_value = index.date().isoformat()
            except Exception:
                date_value = str(index)[:10]
            points.append({"date": date_value, "close": close})

    print(json.dumps({
        "symbol": symbol,
        "period": period,
        "interval": interval,
        "asOf": datetime.now(timezone.utc).isoformat(),
        "points": points,
        "sourceNote": "yfinance adjusted close history over Yahoo Finance data.",
    }, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
