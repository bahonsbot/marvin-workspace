#!/usr/bin/env python3
"""Small JSON bridge for Mission Control Lab Trading yfinance enrichment."""
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


def fmt_large(value: Any) -> str | None:
    number = safe_float(value)
    if number is None:
        return None
    sign = '-' if number < 0 else ''
    number = abs(number)
    if number >= 1_000_000_000_000:
        return f"{sign}{number / 1_000_000_000_000:.2f}T"
    if number >= 1_000_000_000:
        return f"{sign}{number / 1_000_000_000:.2f}B"
    if number >= 1_000_000:
        return f"{sign}{number / 1_000_000:.1f}M"
    return f"{sign}{number:,.0f}"


def fmt_number(value: Any, digits: int = 2) -> str | None:
    number = safe_float(value)
    if number is None:
        return None
    return f"{number:.{digits}f}"


def fmt_pct(value: Any) -> str | None:
    number = safe_float(value)
    if number is None:
        return None
    return f"{number * 100:.2f}%"


def metric(label: str, value: str | None, note: str | None = None) -> dict[str, Any] | None:
    if not value or value in {"nan", "None"}:
        return None
    output: dict[str, Any] = {"label": label, "value": value, "status": "available"}
    if note:
        output["note"] = note
    return output


def df_metric(df: Any, period: str, column: str) -> Any:
    try:
        if df is None or getattr(df, "empty", True):
            return None
        if period not in df.index or column not in df.columns:
            return None
        value = df.loc[period, column]
        if hasattr(value, "item"):
            value = value.item()
        return value
    except Exception:
        return None


def main() -> int:
    symbol = sys.argv[1].strip().upper() if len(sys.argv) > 1 else ""
    if not symbol:
        print(json.dumps({"error": "missing symbol"}))
        return 2

    try:
        import yfinance as yf
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"symbol": symbol, "error": f"yfinance unavailable: {exc}"}))
        return 1

    ticker = yf.Ticker(symbol)
    try:
        info = dict(ticker.info or {})
    except Exception:
        info = {}

    facts = []
    for label, key in [
        ("Sector", "sector"),
        ("Industry", "industry"),
        ("Country", "country"),
        ("Website", "website"),
        ("Employees", "fullTimeEmployees"),
        ("Quote Type", "quoteType"),
        ("ISIN", "isin"),
    ]:
        value = info.get(key)
        if value not in (None, "", "-"):
            facts.append({"label": label, "value": fmt_large(value) if key == "fullTimeEmployees" else str(value)})

    try:
        isin = ticker.get_isin()
        if isin and isin != "-" and not any(f["label"] == "ISIN" for f in facts):
            facts.append({"label": "ISIN", "value": str(isin)})
    except Exception:
        pass

    header_candidates = [
        metric("Market Cap", f"{info.get('currency', 'USD')} {fmt_large(info.get('marketCap'))}" if fmt_large(info.get("marketCap")) else None, "yfinance/Yahoo Finance profile."),
        metric("P/E (TTM)", fmt_number(info.get("trailingPE")), "Trailing P/E from yfinance."),
        metric("Sector", str(info.get("sector")) if info.get("sector") else None),
        metric("Industry", str(info.get("industry")) if info.get("industry") else None),
        metric("Country", str(info.get("country")) if info.get("country") else None),
    ]

    ratio_candidates = [
        metric("P/E Ratio", fmt_number(info.get("trailingPE")), "Trailing P/E from yfinance."),
        metric("Forward P/E", fmt_number(info.get("forwardPE")), "Forward P/E from yfinance analyst consensus."),
        metric("PEG Ratio", fmt_number(info.get("pegRatio")), "PEG ratio from yfinance when available."),
        metric("Price / Sales", fmt_number(info.get("priceToSalesTrailing12Months")), "Trailing price/sales from yfinance."),
        metric("Price / Book", fmt_number(info.get("priceToBook")), "Price/book from yfinance."),
        metric("Beta", fmt_number(info.get("beta")), "Beta from yfinance profile."),
        metric("Shares Outstanding", fmt_large(info.get("sharesOutstanding")), "Shares outstanding from yfinance."),
    ]

    estimates = []
    try:
        targets = ticker.get_analyst_price_targets()
    except Exception:
        targets = None
    if isinstance(targets, dict):
        currency = info.get("currency", "")
        for label, key in [("Target mean", "mean"), ("Target median", "median"), ("Target high", "high"), ("Target low", "low")]:
            value = fmt_number(targets.get(key))
            if value:
                estimates.append({"label": label, "value": f"{currency} {value}".strip(), "status": "available", "note": "Analyst price target from yfinance."})

    for label, key in [("Recommendation", "recommendationKey"), ("Analyst count", "numberOfAnalystOpinions")]:
        value = info.get(key)
        if value not in (None, ""):
            estimates.append({"label": label, "value": str(value).replace("_", " ").title(), "status": "available", "note": "Yahoo/yfinance analyst summary."})

    try:
        earnings = ticker.get_earnings_estimate()
    except Exception:
        earnings = None
    for label, period, column in [
        ("EPS current year", "0y", "avg"),
        ("EPS next year", "+1y", "avg"),
        ("EPS growth next year", "+1y", "growth"),
    ]:
        raw = df_metric(earnings, period, column)
        value = fmt_pct(raw) if "growth" in label.lower() else fmt_number(raw)
        if value:
            estimates.append({"label": label, "value": value, "status": "available", "note": "Consensus estimate from yfinance."})

    try:
        rec = ticker.get_recommendations_summary()
        if rec is not None and not rec.empty:
            row = rec.iloc[0].to_dict()
            parts = []
            for key in ["strongBuy", "buy", "hold", "sell", "strongSell"]:
                val = row.get(key)
                if val is not None:
                    parts.append(f"{key}: {int(val)}")
            if parts:
                estimates.append({"label": "Recommendation trend", "value": " · ".join(parts), "status": "available", "note": "Current-month recommendation distribution from yfinance."})
    except Exception:
        pass

    ownership = []
    for label, key in [
        ("Insiders held", "heldPercentInsiders"),
        ("Institutions held", "heldPercentInstitutions"),
        ("Float held by institutions", "heldPercentInstitutions"),
    ]:
        value = fmt_pct(info.get(key))
        if value:
            ownership.append({"label": label, "value": value, "status": "available", "note": "Holder percentage from yfinance."})
    try:
        holders = ticker.get_major_holders()
        if holders is not None and not holders.empty:
            text = str(holders).replace("\n", " ")[:180]
            if text:
                ownership.append({"label": "Holder table", "value": "Available", "status": "available", "note": text})
    except Exception:
        pass

    dividends = []
    for label, key in [("Dividend rate", "dividendRate"), ("Dividend yield", "dividendYield"), ("Payout ratio", "payoutRatio")]:
        value = fmt_pct(info.get(key)) if "yield" in label.lower() or "ratio" in label.lower() else fmt_number(info.get(key))
        if value:
            dividends.append({"label": label, "value": value, "status": "available", "note": "Dividend field from yfinance."})

    result = {
        "symbol": symbol,
        "asOf": datetime.now(timezone.utc).isoformat(),
        "sourceNote": "yfinance bridge over Yahoo Finance data. Used for profile, ratios, estimates, ownership, and dividend enrichment.",
        "info": {k: info.get(k) for k in ["longName", "shortName", "currency", "sector", "industry", "country", "marketCap", "trailingPE", "forwardPE", "recommendationKey"] if k in info},
        "facts": facts[:8],
        "headerStats": [item for item in header_candidates if item],
        "keyRatios": [item for item in ratio_candidates if item],
        "estimates": estimates[:10],
        "ownership": ownership[:6],
        "dividends": dividends[:5],
    }
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
