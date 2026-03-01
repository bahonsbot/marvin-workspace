"""Deterministic paper-only simulation runner.

Replays historical/sample signals through the existing decision pipeline:
validate -> context fusion -> risk checks.

No broker integrations. No external API calls. No order execution.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

from src.risk_manager import AccountState, RiskConfig
from src.simulation_report import build_simulation_summary
from src.webhook_receiver import process_webhook_payload

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_PATH = ROOT / "data" / "simulations" / "sample_signals.jsonl"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "simulations"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_signals(input_path: Path) -> List[Dict[str, Any]]:
    """Load signals from JSONL or JSON array/object format."""
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    suffix = input_path.suffix.lower()
    if suffix == ".jsonl":
        rows: List[Dict[str, Any]] = []
        with input_path.open("r", encoding="utf-8") as f:
            for idx, line in enumerate(f, start=1):
                raw = line.strip()
                if not raw:
                    continue
                item = json.loads(raw)
                if not isinstance(item, dict):
                    raise ValueError(f"JSONL line {idx} must be a JSON object.")
                rows.append(item)
        return rows

    if suffix == ".json":
        with input_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        if isinstance(payload, list):
            for idx, item in enumerate(payload, start=1):
                if not isinstance(item, dict):
                    raise ValueError(f"JSON item at index {idx} must be a JSON object.")
            return payload

        if isinstance(payload, dict):
            if "signals" in payload and isinstance(payload["signals"], list):
                for idx, item in enumerate(payload["signals"], start=1):
                    if not isinstance(item, dict):
                        raise ValueError(f"JSON signals[{idx}] must be a JSON object.")
                return payload["signals"]
            return [payload]

        raise ValueError("JSON input must be an object, array, or {'signals': [...]}.")

    raise ValueError("Unsupported input format. Use .json or .jsonl")


def _state_from_dict(raw: Dict[str, Any] | None) -> AccountState:
    raw = raw or {}
    return AccountState(
        daily_pnl=float(raw.get("daily_pnl", 0.0) or 0.0),
        open_positions=int(raw.get("open_positions", 0) or 0),
    )


def _config_from_dict(raw: Dict[str, Any] | None) -> RiskConfig:
    raw = raw or {}
    return RiskConfig(
        kill_switch_enabled=bool(raw.get("kill_switch_enabled", False)),
        daily_loss_cap=float(raw.get("daily_loss_cap", 100.0) or 100.0),
        max_position_size=float(raw.get("max_position_size", 1.0) or 1.0),
        max_open_positions=int(raw.get("max_open_positions", 3) or 3),
    )


def _iter_signal_entries(signals: Iterable[Dict[str, Any]]) -> Iterable[tuple[Dict[str, Any], AccountState, RiskConfig]]:
    for item in signals:
        signal = dict(item.get("signal")) if isinstance(item.get("signal"), dict) else dict(item)
        state = _state_from_dict(item.get("state") if isinstance(item, dict) else None)
        config = _config_from_dict(item.get("config") if isinstance(item, dict) else None)
        yield signal, state, config


def run_simulation(signals: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Replay all input signals through the paper-only decision pipeline."""
    rows: List[Dict[str, Any]] = []

    for index, (signal, state, config) in enumerate(_iter_signal_entries(signals), start=1):
        result = process_webhook_payload(signal, state=state, config=config)

        rows.append(
            {
                "index": index,
                "signal": signal,
                "state": {
                    "daily_pnl": state.daily_pnl,
                    "open_positions": state.open_positions,
                },
                "config": {
                    "kill_switch_enabled": config.kill_switch_enabled,
                    "daily_loss_cap": config.daily_loss_cap,
                    "max_position_size": config.max_position_size,
                    "max_open_positions": config.max_open_positions,
                },
                **result,
            }
        )

    summary = build_simulation_summary(rows)
    return {
        "paper_only": True,
        "generated_at": _utc_now_iso(),
        "pipeline": ["validate", "context_fusion", "risk_checks"],
        "results": rows,
        "summary": summary,
    }


def _write_csv(rows: List[Dict[str, Any]], csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "index",
        "symbol",
        "side",
        "raw_qty",
        "adjusted_qty",
        "size_multiplier",
        "confidence_adjustment",
        "accepted",
        "reasons",
        "risk_bias",
        "severity",
        "paper_only",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            signal = row.get("signal", {}) if isinstance(row.get("signal"), dict) else {}
            proposal = row.get("proposal", {}) if isinstance(row.get("proposal"), dict) else {}
            context = row.get("context", {}) if isinstance(row.get("context"), dict) else {}
            summary = context.get("summary", {}) if isinstance(context.get("summary"), dict) else {}

            writer.writerow(
                {
                    "index": row.get("index"),
                    "symbol": signal.get("symbol"),
                    "side": signal.get("side"),
                    "raw_qty": proposal.get("raw_qty"),
                    "adjusted_qty": proposal.get("adjusted_qty"),
                    "size_multiplier": proposal.get("size_multiplier"),
                    "confidence_adjustment": proposal.get("confidence_adjustment"),
                    "accepted": row.get("accepted"),
                    "reasons": " | ".join(row.get("reasons", [])),
                    "risk_bias": summary.get("risk_bias"),
                    "severity": summary.get("severity"),
                    "paper_only": row.get("paper_only", True),
                }
            )


def write_artifacts(run_output: Dict[str, Any], output_dir: Path = DEFAULT_OUTPUT_DIR) -> Dict[str, str]:
    """Write required latest_run and summary artifacts."""
    output_dir.mkdir(parents=True, exist_ok=True)

    latest_run_json = output_dir / "latest_run.json"
    latest_run_csv = output_dir / "latest_run.csv"
    summary_json = output_dir / "summary.json"

    with latest_run_json.open("w", encoding="utf-8") as f:
        json.dump(run_output, f, indent=2, ensure_ascii=False)

    _write_csv(run_output.get("results", []), latest_run_csv)

    with summary_json.open("w", encoding="utf-8") as f:
        json.dump(run_output.get("summary", {}), f, indent=2, ensure_ascii=False)

    return {
        "latest_run_json": str(latest_run_json),
        "latest_run_csv": str(latest_run_csv),
        "summary_json": str(summary_json),
    }
