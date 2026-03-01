#!/usr/bin/env python3
"""Run deterministic paper-only signal simulation.

This script never executes real trades. It only replays signals through
validation, context fusion, and risk checks to generate local artifacts.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load .env from project root (fallback if python-dotenv unavailable)
_env_path = ROOT / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.simulation_runner import (  # noqa: E402
    DEFAULT_INPUT_PATH,
    DEFAULT_OUTPUT_DIR,
    load_signals,
    run_simulation,
    write_artifacts,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run paper-only simulation over JSON/JSONL signals and write report artifacts.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Path to JSON/JSONL signals (default: {DEFAULT_INPUT_PATH})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for artifacts (default: {DEFAULT_OUTPUT_DIR})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    signals = load_signals(args.input)
    run_output = run_simulation(signals)
    paths = write_artifacts(run_output, args.output_dir)

    summary = run_output["summary"]
    print("Paper-only simulation completed (non-executing).")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print("Artifacts:")
    for name, path in paths.items():
        print(f"- {name}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
