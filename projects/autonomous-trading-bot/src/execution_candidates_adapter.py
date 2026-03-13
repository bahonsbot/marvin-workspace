"""Adapter for Market Intel execution candidates.

Loads the execution-facing handoff artifact conservatively and leaves
candidate selection separate from macro context overlays.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
MARKET_INTEL_DATA_DIR = ROOT.parent / "market-intel" / "data"
EXECUTION_CANDIDATES_PATH = MARKET_INTEL_DATA_DIR / "execution_candidates.json"


def _safe_read_json(path: Path) -> tuple[Any | None, str | None]:
    if not path.exists():
        return None, f"missing:{path.name}"
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle), None
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"invalid:{path.name}:{exc.__class__.__name__}"


def load_ready_execution_candidates(
    *,
    candidate_path: Path = EXECUTION_CANDIDATES_PATH,
) -> Dict[str, Any]:
    """Return ready execution candidates and structured load diagnostics."""
    payload, err = _safe_read_json(candidate_path)
    if err:
        return {
            "ok": False,
            "mode": "execution_candidates",
            "path": str(candidate_path),
            "candidates": [],
            "warnings": [err],
        }

    if not isinstance(payload, list):
        return {
            "ok": False,
            "mode": "execution_candidates",
            "path": str(candidate_path),
            "candidates": [],
            "warnings": [f"invalid:{candidate_path.name}:expected_list"],
        }

    ready_candidates: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for index, row in enumerate(payload):
        if not isinstance(row, dict):
            warnings.append(f"invalid:{candidate_path.name}:row_{index}:not_dict")
            continue

        readiness = row.get("dispatch_readiness", {})
        if not isinstance(readiness, dict):
            warnings.append(f"invalid:{candidate_path.name}:row_{index}:dispatch_readiness_not_dict")
            continue

        if not bool(readiness.get("ready", False)):
            continue

        primary_instrument = row.get("primary_instrument")
        if not isinstance(primary_instrument, dict):
            warnings.append(
                f"invalid:{candidate_path.name}:row_{index}:missing_primary_instrument"
            )
            continue

        symbol = str(primary_instrument.get("symbol", "")).upper().strip()
        direction_bias = str(primary_instrument.get("direction_bias", "")).lower().strip()
        if not symbol or direction_bias not in {"long", "short"}:
            warnings.append(
                f"invalid:{candidate_path.name}:row_{index}:primary_instrument_incomplete"
            )
            continue

        ready_candidates.append(row)

    return {
        "ok": True,
        "mode": "execution_candidates",
        "path": str(candidate_path),
        "candidates": ready_candidates,
        "warnings": warnings,
    }
