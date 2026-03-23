#!/usr/bin/env python3
from __future__ import annotations

import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    prune_dirs = [
        "memory",
        "projects/market-intel/data",
        "projects/autonomous-trading-bot/data",
    ]
    pruned = []
    now = time.time()

    for d in prune_dirs:
        path = ROOT / d
        if not path.exists():
            continue
        for fp in path.iterdir():
            if fp.is_file() and fp.name.endswith(".jsonl"):
                age_days = (now - fp.stat().st_mtime) / 86400
                if age_days > 30:
                    fp.unlink(missing_ok=True)
                    pruned.append(str(fp.relative_to(ROOT)))

    log_dirs = [
        "logs",
        "projects/autonomous-trading-bot/logs",
        "projects/futures-bot/logs",
        "projects/horizons-pms/app/.next/dev/logs",
    ]
    rotated = []

    for d in log_dirs:
        path = ROOT / d
        if not path.exists():
            continue
        for fp in path.iterdir():
            if not fp.is_file() or not fp.name.endswith(".log"):
                continue
            age_days = (now - fp.stat().st_mtime) / 86400
            if ".log." in fp.name and age_days > 30:
                fp.unlink(missing_ok=True)
                rotated.append(f"deleted:{fp.relative_to(ROOT)}")
            elif fp.name.endswith(".err.log") and fp.stat().st_size > 10 * 1024 * 1024:
                fp.write_text("", encoding="utf-8")
                rotated.append(f"truncated:{fp.relative_to(ROOT)}")

    cron_run_details_dir = ROOT / "memory" / "cron-run-details"
    cron_run_details_pruned = []
    if cron_run_details_dir.exists():
        for fp in cron_run_details_dir.iterdir():
            if not fp.is_file() or not fp.name.endswith(".log"):
                continue
            age_days = (now - fp.stat().st_mtime) / 86400
            if age_days > 30:
                fp.unlink(missing_ok=True)
                cron_run_details_pruned.append(str(fp.relative_to(ROOT)))

    print(f"Pruned {len(pruned)} old JSONL files")
    print(f"Rotated {len(rotated)} log files")
    print(f"Pruned {len(cron_run_details_pruned)} cron run detail logs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
