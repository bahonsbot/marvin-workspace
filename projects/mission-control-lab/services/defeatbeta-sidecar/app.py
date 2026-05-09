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


def transcript_records_from_frame(df, limit: int = 8) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []
    usable = df.copy()
    for column in ("fiscal_year", "fiscal_quarter", "report_date"):
        if column not in usable.columns:
            return []
    usable = usable.sort_values(["fiscal_year", "fiscal_quarter"], ascending=False)
    records: list[dict[str, Any]] = []
    for _, row in usable.head(limit).iterrows():
        transcripts = row.get("transcripts")
        paragraphs = list(transcripts) if hasattr(transcripts, "__iter__") and not isinstance(transcripts, (str, bytes, dict)) else []
        speakers: list[str] = []
        for paragraph in paragraphs:
            speaker = None
            if isinstance(paragraph, dict):
                speaker = paragraph.get("speaker")
            elif hasattr(paragraph, "get"):
                speaker = paragraph.get("speaker")
            if speaker and speaker not in speakers:
                speakers.append(str(speaker))
            if len(speakers) >= 8:
                break
        records.append({
            "symbol": jsonable(row.get("symbol")),
            "fiscalYear": int(row.get("fiscal_year")) if finite_number(row.get("fiscal_year")) is not None else None,
            "fiscalQuarter": int(row.get("fiscal_quarter")) if finite_number(row.get("fiscal_quarter")) is not None else None,
            "reportDate": jsonable(row.get("report_date")),
            "transcriptId": jsonable(row.get("transcripts_id")),
            "paragraphCount": len(paragraphs),
            "sampleSpeakers": speakers,
        })
    return records


def transcript_paragraph_records(df, limit: int = 90) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []
    records: list[dict[str, Any]] = []
    for _, row in df.head(limit).iterrows():
        content = str(row.get("content") or "").strip()
        if not content:
            continue
        records.append({
            "paragraphNumber": int(row.get("paragraph_number")) if finite_number(row.get("paragraph_number")) is not None else len(records) + 1,
            "speaker": jsonable(row.get("speaker")),
            "content": content[:2_000],
        })
    return records


def build_transcript_catalog(symbol: str) -> dict[str, Any]:
    from defeatbeta_api.data.ticker import Ticker  # type: ignore

    requested = symbol.strip().upper().replace("/", ".")
    candidates = symbol_candidates(requested)
    attempts: list[dict[str, Any]] = []
    for candidate in candidates:
        started = time.perf_counter()

        def load_catalog(candidate_symbol: str = candidate):
            transcripts = Ticker(candidate_symbol).earning_call_transcripts()
            list_fn = getattr(transcripts, "get_transcripts_list", None)
            return list_fn() if callable(list_fn) else transcripts

        value, diag = safe_call(f"transcripts:{candidate}", load_catalog)
        df = df_from(value)
        records = transcript_records_from_frame(df, limit=8)
        attempts.append({
            "candidate": candidate,
            "ok": diag.get("ok"),
            "elapsedMs": round((time.perf_counter() - started) * 1000),
            "recordCount": len(df.index) if df is not None else 0,
            "error": diag.get("error"),
        })
        if records:
            return {
                "requestedSymbol": requested,
                "resolvedSymbol": candidate,
                "status": "available",
                "source": DATA_SOURCE,
                "asOf": now_iso(),
                "latest": records[0],
                "recent": records,
                "coverage": {"transcripts": True, "llmConfigured": bool(os.environ.get("OPEN_AI_API_KEY"))},
                "llmAnalysis": {
                    "status": "requires_config" if not os.environ.get("OPEN_AI_API_KEY") else "available_in_library",
                    "availableMethods": ["keyFinancialData", "metricChanges", "forecastDrivers"],
                    "underlyingMethods": ["summarize_key_financial_data_with_ai", "analyze_financial_metrics_change_for_this_quarter_with_ai", "analyze_financial_metrics_forecast_for_future_with_ai"],
                    "note": "DefeatBeta LLM transcript methods require an OpenAI-compatible API key/model configuration before Lab can run extraction.",
                },
                "attempts": attempts,
                "notes": ["Transcript catalogue is metadata only; raw transcript text is not exposed by this endpoint."],
            }
    return {
        "requestedSymbol": requested,
        "resolvedSymbol": candidates[0] if candidates else requested,
        "status": "unavailable",
        "source": DATA_SOURCE,
        "asOf": now_iso(),
        "latest": None,
        "recent": [],
        "coverage": {"transcripts": False, "llmConfigured": bool(os.environ.get("OPEN_AI_API_KEY"))},
        "llmAnalysis": {
            "status": "unavailable",
            "availableMethods": ["keyFinancialData", "metricChanges", "forecastDrivers"],
            "underlyingMethods": ["summarize_key_financial_data_with_ai", "analyze_financial_metrics_change_for_this_quarter_with_ai", "analyze_financial_metrics_forecast_for_future_with_ai"],
            "note": "No transcript catalogue was available for this symbol through DefeatBeta.",
        },
        "attempts": attempts,
        "notes": ["No DefeatBeta candidate returned earnings-call transcript metadata."],
    }


def build_transcript_detail(symbol: str, fiscal_year: int | None = None, fiscal_quarter: int | None = None) -> dict[str, Any]:
    from defeatbeta_api.data.ticker import Ticker  # type: ignore

    catalog = build_transcript_catalog(symbol)
    latest = catalog.get("latest") or {}
    year = fiscal_year or latest.get("fiscalYear")
    quarter = fiscal_quarter or latest.get("fiscalQuarter")
    resolved = str(catalog.get("resolvedSymbol") or symbol).strip().upper()
    if catalog.get("status") != "available" or not year or not quarter:
        return {
            "requestedSymbol": symbol.strip().upper().replace("/", "."),
            "resolvedSymbol": resolved,
            "status": "unavailable",
            "source": DATA_SOURCE,
            "asOf": now_iso(),
            "fiscalYear": year,
            "fiscalQuarter": quarter,
            "paragraphs": [],
            "notes": ["No transcript detail was available for this symbol/quarter."],
        }

    def load_transcript():
        return Ticker(resolved).earning_call_transcripts().get_transcript(int(year), int(quarter))

    value, diag = safe_call(f"transcriptDetail:{resolved}:{year}Q{quarter}", load_transcript)
    df = df_from(value)
    paragraphs = transcript_paragraph_records(df, limit=90)
    return {
        "requestedSymbol": catalog.get("requestedSymbol"),
        "resolvedSymbol": resolved,
        "status": "available" if paragraphs else "unavailable",
        "source": DATA_SOURCE,
        "asOf": now_iso(),
        "fiscalYear": int(year),
        "fiscalQuarter": int(quarter),
        "reportDate": latest.get("reportDate"),
        "paragraphCount": len(df.index) if df is not None else 0,
        "includedParagraphCount": len(paragraphs),
        "paragraphs": paragraphs,
        "diagnostics": [diag],
        "notes": ["Transcript detail is capped to the first 90 paragraphs and 2,000 characters per paragraph for Lab extraction prompts."],
    }


def build_economy_context() -> dict[str, Any]:
    from defeatbeta_api.data.treasure import Treasure  # type: ignore
    from defeatbeta_api.utils import util  # type: ignore

    diagnostics: list[dict[str, Any]] = []
    annual, diag = safe_call("sp500AnnualReturns", util.load_sp500_historical_annual_returns)
    diagnostics.append(diag)
    cagr_10, diag = safe_call("sp500Cagr10", lambda: util.sp500_cagr_returns(10))
    diagnostics.append(diag)
    yields, diag = safe_call("dailyTreasureYield", lambda: Treasure().daily_treasure_yield())
    diagnostics.append(diag)

    annual_df = df_from(annual)
    cagr_df = df_from(cagr_10)
    yields_df = df_from(yields)
    latest_annual = None
    if non_empty_frame(annual_df):
        row = annual_df.sort_values("report_date", ascending=False).iloc[0]
        latest_annual = {"date": jsonable(row.get("report_date")), "annualReturn": finite_number(row.get("annual_returns"))}
    latest_yield = None
    if non_empty_frame(yields_df):
        row = yields_df.sort_values("report_date", ascending=False).iloc[0]
        latest_yield = {
            "date": jsonable(row.get("report_date")),
            "bc3Month": finite_number(row.get("bc3_month")),
            "bc2Year": finite_number(row.get("bc2_year")),
            "bc10Year": finite_number(row.get("bc10_year")),
            "bc30Year": finite_number(row.get("bc30_year")),
        }
        if latest_yield["bc10Year"] is not None and latest_yield["bc2Year"] is not None:
            latest_yield["twoTenSpread"] = latest_yield["bc10Year"] - latest_yield["bc2Year"]
    cagr_value = None
    if non_empty_frame(cagr_df):
        row = cagr_df.iloc[0]
        cagr_value = finite_number(row.get("cagr_returns"))
    status = "available" if latest_annual or latest_yield or cagr_value is not None else "unavailable"
    return {
        "status": status,
        "source": DATA_SOURCE,
        "asOf": now_iso(),
        "sp500": {"latestAnnualReturn": latest_annual, "cagr10Year": cagr_value},
        "yieldCurve": latest_yield,
        "notes": ["Economy context is broad market backdrop only; it is not ticker-specific quote truth."],
        "diagnostics": diagnostics,
    }



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


@app.get("/v1/ticker/{symbol}/transcript-catalog")
def transcript_catalog(symbol: str, includeAttempts: bool = Query(default=False)):
    try:
        result = build_transcript_catalog(symbol)
        if not includeAttempts:
            result.pop("attempts", None)
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


@app.get("/v1/ticker/{symbol}/transcript")
def transcript_detail(symbol: str, fiscalYear: int | None = Query(default=None), fiscalQuarter: int | None = Query(default=None), includeDiagnostics: bool = Query(default=False)):
    try:
        result = build_transcript_detail(symbol, fiscalYear, fiscalQuarter)
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


@app.get("/v1/economy/context")
def economy_context(includeDiagnostics: bool = Query(default=False)):
    try:
        result = build_economy_context()
        if not includeDiagnostics:
            result.pop("diagnostics", None)
        return JSONResponse(result)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
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
