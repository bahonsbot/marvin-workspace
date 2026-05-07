#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parent
PACKAGE_DIR = ROOT / ".python-packages"
CACHE_DIR = ROOT / ".cache"
REPORT_DIR = ROOT / "reports"
for path in (str(PACKAGE_DIR),):
    if path not in sys.path:
        sys.path.insert(0, path)

# Keep all heavyweight caches inside the Lab probe folder.
os.environ.setdefault("HOME", str(ROOT))
os.environ.setdefault("XDG_CACHE_HOME", str(CACHE_DIR / "xdg"))
os.environ.setdefault("HF_HOME", str(CACHE_DIR / "huggingface"))
os.environ.setdefault("DUCKDB_EXTENSION_DIRECTORY", str(CACHE_DIR / "duckdb-extensions"))
os.environ.setdefault("MPLCONFIGDIR", str(CACHE_DIR / "matplotlib"))
os.environ.setdefault("NLTK_DATA", str(CACHE_DIR / "nltk"))
os.environ.setdefault("DEFEATBETA_CACHE_DIR", str(CACHE_DIR / "defeatbeta"))


def cache_size_bytes() -> int:
    total = 0
    if not CACHE_DIR.exists():
        return 0
    for file in CACHE_DIR.rglob("*"):
        try:
            if file.is_file():
                total += file.stat().st_size
        except OSError:
            pass
    return total


def sizeof_result(value: Any) -> dict[str, Any]:
    try:
        import pandas as pd  # type: ignore
    except Exception:
        pd = None
    if pd is not None and isinstance(value, pd.DataFrame):
        return {
            "type": "DataFrame",
            "rows": int(len(value.index)),
            "columns": [str(col) for col in value.columns[:20]],
            "column_count": int(len(value.columns)),
            "sample": json.loads(value.head(3).to_json(orient="records", date_format="iso")),
        }
    if hasattr(value, "to_dataframe"):
        try:
            return sizeof_result(value.to_dataframe())
        except Exception:
            pass
    if hasattr(value, "df"):
        try:
            df_attr = getattr(value, "df")
            return sizeof_result(df_attr() if callable(df_attr) else df_attr)
        except Exception:
            pass
    if hasattr(value, "data"):
        data = getattr(value, "data")
        try:
            return sizeof_result(data() if callable(data) else data)
        except Exception:
            pass
    text = repr(value)
    return {"type": type(value).__name__, "repr": text[:600], "repr_len": len(text)}


def run_call(name: str, fn: Callable[[], Any]) -> dict[str, Any]:
    started = time.perf_counter()
    before_cache = cache_size_bytes()
    stdout = io.StringIO()
    stderr = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            value = fn()
        ok = True
        error = None
        result = sizeof_result(value)
    except Exception as exc:  # probe wants failure shape, not process crash
        ok = False
        error = {"type": type(exc).__name__, "message": str(exc), "traceback_tail": traceback.format_exc().splitlines()[-8:]}
        result = None
    elapsed = time.perf_counter() - started
    after_cache = cache_size_bytes()
    return {
        "name": name,
        "ok": ok,
        "elapsed_seconds": round(elapsed, 3),
        "cache_delta_bytes": after_cache - before_cache,
        "stdout_tail": stdout.getvalue()[-1200:],
        "stderr_tail": stderr.getvalue()[-1200:],
        "result": result,
        "error": error,
    }


def method_if_exists(obj: Any, names: list[str]) -> tuple[str, Callable[[], Any]] | None:
    for name in names:
        candidate = getattr(obj, name, None)
        if callable(candidate):
            return name, candidate
    return None


def probe_symbol(symbol: str) -> dict[str, Any]:
    from defeatbeta_api.data.ticker import Ticker  # type: ignore

    started = time.perf_counter()
    ticker = Ticker(symbol)
    available = [name for name in dir(ticker) if not name.startswith("_")]
    calls: list[dict[str, Any]] = []

    call_groups = [
        ("prices", ["price", "prices", "historical_price"]),
        ("quarterly_income_statement", ["quarterly_income_statement"]),
        ("annual_income_statement", ["annual_income_statement"]),
        ("quarterly_balance_sheet", ["quarterly_balance_sheet"]),
        ("quarterly_cash_flow", ["quarterly_cash_flow"]),
        ("ttm_pe", ["ttm_pe", "pe", "historical_pe"]),
        ("ps_ratio", ["ps_ratio", "historical_ps", "ps"]),
        ("pb_ratio", ["pb_ratio", "historical_pb", "pb"]),
        ("roe", ["roe", "historical_roe"]),
        ("roic", ["roic", "historical_roic"]),
        ("wacc", ["wacc", "historical_wacc"]),
        ("dividends", ["dividend", "dividends"]),
        ("splits", ["split", "splits"]),
        ("earnings_calendar", ["earnings_calendar", "earning_calendar"]),
        ("transcripts_list", ["earning_call_transcripts"]),
        ("dcf", ["dcf", "dcf_valuation"]),
    ]
    for logical_name, names in call_groups:
        resolved = method_if_exists(ticker, names)
        if not resolved:
            calls.append({"name": logical_name, "ok": False, "skipped": True, "error": {"message": "method not found", "candidates": names}})
            continue
        actual_name, fn = resolved
        if logical_name == "transcripts_list":
            def transcript_fn(fn=fn):
                transcripts = fn()
                list_fn = getattr(transcripts, "get_transcripts_list", None)
                return list_fn() if callable(list_fn) else transcripts
            calls.append(run_call(f"{logical_name}:{actual_name}", transcript_fn))
        else:
            calls.append(run_call(f"{logical_name}:{actual_name}", fn))

    return {
        "symbol": symbol,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "available_methods_sample": available[:120],
        "calls": calls,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Lab-only DefeatBeta Analytics probe")
    parser.add_argument("symbols", nargs="*", default=["AAPL", "MSFT", "ASML", "TSM"])
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "package": {},
        "cache_dir": str(CACHE_DIR),
        "symbols": [],
    }
    try:
        import defeatbeta_api  # type: ignore
        report["package"] = {
            "module_file": getattr(defeatbeta_api, "__file__", None),
            "version": getattr(defeatbeta_api, "__version__", None),
        }
    except Exception as exc:
        report["package_error"] = str(exc)
        return 2

    for symbol in args.symbols:
        report["symbols"].append(probe_symbol(symbol))
    report["elapsed_seconds"] = round(time.perf_counter() - started, 3)
    report["cache_size_bytes"] = cache_size_bytes()

    out = Path(args.output) if args.output else REPORT_DIR / f"probe-{time.strftime('%Y%m%d-%H%M%S', time.gmtime())}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(out), "elapsed_seconds": report["elapsed_seconds"], "cache_size_bytes": report["cache_size_bytes"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
