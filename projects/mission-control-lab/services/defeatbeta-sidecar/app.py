#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import math
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
PROBE_PACKAGES = ROOT.parent / "defeatbeta-probe" / ".python-packages"
LOCAL_PACKAGES = ROOT / ".python-packages"
for package_dir in (LOCAL_PACKAGES, PROBE_PACKAGES):
    if package_dir.exists() and str(package_dir) not in sys.path:
        sys.path.insert(0, str(package_dir))

CACHE_DIR = ROOT / ".cache"
os.environ.setdefault("HOME", str(ROOT))
os.environ.setdefault("XDG_CACHE_HOME", str(CACHE_DIR / "xdg"))
os.environ.setdefault("HF_HOME", str(CACHE_DIR / "huggingface"))
os.environ.setdefault("DUCKDB_EXTENSION_DIRECTORY", str(CACHE_DIR / "duckdb-extensions"))
os.environ.setdefault("MPLCONFIGDIR", str(CACHE_DIR / "matplotlib"))
os.environ.setdefault("NLTK_DATA", str(CACHE_DIR / "nltk"))
os.environ.setdefault("DEFEATBETA_CACHE_DIR", str(CACHE_DIR / "defeatbeta"))

from fastapi import FastAPI, Query  # type: ignore  # noqa: E402
from fastapi.responses import JSONResponse  # type: ignore  # noqa: E402

app = FastAPI(title="DefeatBeta Analytics Sidecar", version="0.1.0")
STARTED_AT = time.time()
DATA_SOURCE = {
    "id": "defeatbeta",
    "label": "DefeatBeta API",
    "note": "Yahoo Finance dataset hosted via DefeatBeta/HuggingFace; Analytics enrichment only, not quote truth.",
}

SYMBOL_ALIASES = {
    "AAPL.US": "AAPL",
    "MSFT.US": "MSFT",
    "NVDA.US": "NVDA",
    "TSM.US": "TSM",
    "ASML.US": "ASML",
    "ASML.AS": "ASML",
}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def normalize_symbol(symbol: str) -> str:
    cleaned = symbol.strip().upper().replace("/", ".")
    return SYMBOL_ALIASES.get(cleaned, cleaned)


def symbol_candidates(symbol: str) -> list[str]:
    cleaned = symbol.strip().upper().replace("/", ".")
    candidates: list[str] = []

    def add(candidate: str) -> None:
        normalized = SYMBOL_ALIASES.get(candidate, candidate)
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    add(cleaned)
    if "." in cleaned:
        base = cleaned.split(".", 1)[0]
        add(base)
    return candidates


def summary_has_core(summary: dict[str, Any]) -> bool:
    coverage = summary.get("coverage") or {}
    return bool(coverage.get("ratios") and coverage.get("statements"))


def finite_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if isinstance(value, str) and value.strip() in {"", "*", "nan", "NaN", "None"}:
            return None
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (str, int, bool)):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def df_from(value: Any):
    import pandas as pd  # type: ignore

    if isinstance(value, pd.DataFrame):
        return value
    if hasattr(value, "df"):
        df_attr = getattr(value, "df")
        maybe = df_attr() if callable(df_attr) else df_attr
        if isinstance(maybe, pd.DataFrame):
            return maybe
    if hasattr(value, "data"):
        data = getattr(value, "data")
        maybe = data() if callable(data) else data
        if isinstance(maybe, pd.DataFrame):
            return maybe
    return pd.DataFrame()


def safe_call(name: str, fn) -> tuple[Any | None, dict[str, Any]]:
    started = time.perf_counter()
    try:
        with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            value = fn()
        return value, {"name": name, "ok": True, "elapsedMs": round((time.perf_counter() - started) * 1000)}
    except Exception as exc:
        return None, {
            "name": name,
            "ok": False,
            "elapsedMs": round((time.perf_counter() - started) * 1000),
            "error": {"type": type(exc).__name__, "message": str(exc)},
        }


def latest_records(df, value_column: str, date_column: str = "report_date", limit: int = 8) -> list[dict[str, Any]]:
    if df is None or df.empty or value_column not in df.columns:
        return []
    records = []
    usable = df.copy()
    if date_column in usable.columns:
        usable = usable.sort_values(date_column, ascending=False)
    for _, row in usable.head(limit).iterrows():
        value = finite_number(row.get(value_column))
        if value is None:
            continue
        records.append({
            "date": jsonable(row.get(date_column)) if date_column in usable.columns else None,
            "value": value,
        })
    return records


def statement_trends(df, metric_names: list[str], periods: int = 6) -> list[dict[str, Any]]:
    if df is None or df.empty or "Breakdown" not in df.columns:
        return []
    period_columns = [col for col in df.columns if col != "Breakdown" and str(col).upper() != "TTM"][:periods]
    trends = []
    lower_map = {str(row.get("Breakdown", "")).strip().lower(): row for _, row in df.iterrows()}
    for metric in metric_names:
        row = lower_map.get(metric.lower())
        if row is None:
            continue
        points = []
        for period in period_columns:
            value = finite_number(row.get(period))
            if value is not None:
                points.append({"period": str(period), "value": value})
        trends.append({"metric": metric, "points": points})
    return trends


def non_empty_frame(df) -> bool:
    return df is not None and not df.empty and len(df.index) > 0


def build_candidate_summary(symbol: str, requested_symbol: str | None = None) -> dict[str, Any]:
    from defeatbeta_api.data.ticker import Ticker  # type: ignore
    import defeatbeta_api  # type: ignore

    requested = (requested_symbol or symbol).strip().upper()
    resolved = normalize_symbol(symbol)
    started = time.perf_counter()
    ticker = Ticker(resolved)
    diagnostics: list[dict[str, Any]] = []

    calls: dict[str, Any] = {}
    for name, fn in {
        "prices": ticker.price,
        "quarterlyIncomeStatement": ticker.quarterly_income_statement,
        "annualIncomeStatement": ticker.annual_income_statement,
        "quarterlyCashFlow": ticker.quarterly_cash_flow,
        "ttmPe": ticker.ttm_pe,
        "psRatio": ticker.ps_ratio,
        "pbRatio": ticker.pb_ratio,
        "roe": ticker.roe,
        "roic": ticker.roic,
        "wacc": ticker.wacc,
        "dividends": ticker.dividends,
        "splits": ticker.splits,
    }.items():
        value, diag = safe_call(name, fn)
        diagnostics.append(diag)
        calls[name] = value

    frames = {name: df_from(value) for name, value in calls.items() if value is not None}
    has_core = any(non_empty_frame(frames.get(name)) for name in ["quarterlyIncomeStatement", "annualIncomeStatement", "ttmPe", "psRatio", "pbRatio"])

    ratios = {
        "pe": latest_records(frames.get("ttmPe"), "ttm_pe", limit=12),
        "ps": latest_records(frames.get("psRatio"), "ps_ratio", limit=12),
        "pb": latest_records(frames.get("pbRatio"), "pb_ratio", limit=12),
        "wacc": latest_records(frames.get("wacc"), "wacc", limit=12),
    }
    quality = {
        "roe": latest_records(frames.get("roe"), "roe", limit=8),
        "roic": latest_records(frames.get("roic"), "roic", limit=8),
    }
    statements = {
        "annualIncome": statement_trends(frames.get("annualIncomeStatement"), ["Total Revenue", "Gross Profit", "Operating Income", "Net Income Common Stockholders"]),
        "quarterlyIncome": statement_trends(frames.get("quarterlyIncomeStatement"), ["Total Revenue", "Gross Profit", "Operating Income", "Net Income Common Stockholders"]),
        "quarterlyCashFlow": statement_trends(frames.get("quarterlyCashFlow"), ["Operating Cash Flow", "Free Cash Flow", "Capital Expenditure"]),
    }
    events = {
        "dividends": latest_records(frames.get("dividends"), "amount", limit=8),
        "splits": [
            {"date": jsonable(row.get("report_date")), "splitFactor": jsonable(row.get("split_factor"))}
            for _, row in (frames.get("splits").sort_values("report_date", ascending=False).head(8).iterrows() if non_empty_frame(frames.get("splits")) else [])
        ],
    }

    coverage = {
        "prices": non_empty_frame(frames.get("prices")),
        "statements": any(bool(v) for v in statements.values()),
        "ratios": any(bool(v) for v in ratios.values()),
        "quality": any(bool(v) for v in quality.values()),
        "events": bool(events["dividends"] or events["splits"]),
    }
    status = "available" if has_core and coverage["ratios"] else "unavailable"
    if status == "available" and not all(coverage.values()):
        status = "partial"

    return {
        "requestedSymbol": requested,
        "resolvedSymbol": resolved,
        "status": status,
        "source": DATA_SOURCE,
        "asOf": now_iso(),
        "defeatbetaVersion": getattr(defeatbeta_api, "__version__", None),
        "elapsedMs": round((time.perf_counter() - started) * 1000),
        "coverage": coverage,
        "ratios": ratios,
        "quality": quality,
        "statements": statements,
        "events": events,
        "diagnostics": diagnostics,
        "notes": [
            "Analytics enrichment only; keep existing Lab quote providers as quote truth.",
            "Empty core datasets are treated as unavailable, not as zero-valued analytics.",
        ],
    }


def build_summary(symbol: str) -> dict[str, Any]:
    requested = symbol.strip().upper().replace("/", ".")
    candidates = symbol_candidates(requested)
    attempts: list[dict[str, Any]] = []
    fallback: dict[str, Any] | None = None
    for candidate in candidates:
        summary = build_candidate_summary(candidate, requested_symbol=requested)
        attempts.append({
            "candidate": candidate,
            "resolvedSymbol": summary.get("resolvedSymbol"),
            "status": summary.get("status"),
            "coverage": summary.get("coverage"),
            "elapsedMs": summary.get("elapsedMs"),
        })
        if fallback is None:
            fallback = summary
        if summary.get("status") in {"available", "partial"} and summary_has_core(summary):
            summary["resolution"] = {"strategy": "candidate-chain", "candidates": candidates, "attempts": attempts}
            summary["notes"].append(f"Resolved {requested} via DefeatBeta candidate {summary.get('resolvedSymbol')}.")
            return summary
    result = fallback or build_candidate_summary(requested, requested_symbol=requested)
    result["resolution"] = {"strategy": "candidate-chain", "candidates": candidates, "attempts": attempts}
    result["notes"].append("No DefeatBeta candidate returned core analytics coverage.")
    return result



@app.get("/health")
def health() -> dict[str, Any]:
    package_ok = False
    package_version = None
    try:
        import defeatbeta_api  # type: ignore
        package_ok = True
        package_version = getattr(defeatbeta_api, "__version__", None)
    except Exception:
        package_ok = False
    return {
        "ok": package_ok,
        "service": "defeatbeta-sidecar",
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(STARTED_AT)),
        "uptimeSeconds": round(time.time() - STARTED_AT, 3),
        "packageVersion": package_version,
        "cacheDir": str(CACHE_DIR),
        "internalOnly": True,
    }


@app.get("/v1/ticker/{symbol}/analytics-summary")
def analytics_summary(symbol: str, includeDiagnostics: bool = Query(default=False)):
    try:
        result = build_summary(symbol)
        if not includeDiagnostics:
            result.pop("diagnostics", None)
        return JSONResponse(result)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "requestedSymbol": symbol,
                "status": "error",
                "source": DATA_SOURCE,
                "asOf": now_iso(),
                "error": {"type": type(exc).__name__, "message": str(exc)},
                "tracebackTail": traceback.format_exc().splitlines()[-8:],
            },
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="DefeatBeta Analytics sidecar")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8791)
    args = parser.parse_args()
    import uvicorn  # type: ignore

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
