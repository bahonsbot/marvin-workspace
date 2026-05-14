#!/usr/bin/env python3
"""Generate a machine-readable audit of Market Intel pattern matcher quality."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from signal_generator import SignalGenerator  # noqa: E402


def main() -> None:
    generator = SignalGenerator()
    report = generator.save_pattern_coverage_report()
    print(json.dumps({
        "output": "data/pattern_quality_audit.json",
        "total_patterns": report["total_patterns"],
        "supported_count": report["supported_count"],
        "unsupported_count": report["unsupported_count"],
        "coverage_pct": report["coverage_pct"],
        "quality_warning_count": len(report["rule_quality_warnings"]),
    }, indent=2))


if __name__ == "__main__":
    main()
