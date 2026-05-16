#!/usr/bin/env python3
from __future__ import annotations

import argparse
import time
from pathlib import Path

WORKSPACE_ROOT = Path("/data/.openclaw/workspace")
DETAILS_DIR = WORKSPACE_ROOT / "memory" / "cron-run-details"
RETENTION_DAYS = 14
SECONDS_PER_DAY = 86400


def should_delete(path: Path, cutoff_ts: float) -> bool:
    if not path.is_file():
        return False
    if path.suffix != ".log":
        return False
    try:
        return path.stat().st_mtime < cutoff_ts
    except FileNotFoundError:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge old deterministic cron detail logs")
    parser.add_argument("--dry-run", action="store_true", help="Report deletions without removing files")
    parser.add_argument(
        "--retention-days",
        type=int,
        default=RETENTION_DAYS,
        help=f"Days of cron-run detail logs to keep (default: {RETENTION_DAYS})",
    )
    args = parser.parse_args()

    if args.retention_days <= 0:
        parser.error("--retention-days must be positive")

    if not DETAILS_DIR.exists():
        print(f"cron-run-details-cleanup: details dir missing: {DETAILS_DIR}")
        return 0

    cutoff_ts = time.time() - (args.retention_days * SECONDS_PER_DAY)
    deleted: list[tuple[str, int]] = []
    kept = 0
    freed_bytes = 0

    for path in sorted(DETAILS_DIR.iterdir()):
        if should_delete(path, cutoff_ts):
            size = path.stat().st_size
            if not args.dry_run:
                path.unlink(missing_ok=True)
            deleted.append((path.name, size))
            freed_bytes += size
        else:
            kept += 1

    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"cron-run-details-cleanup: {mode}")
    print(f"retention_days={args.retention_days}")
    print(f"deleted_count={len(deleted)}")
    print(f"kept_count={kept}")
    print(f"freed_bytes={freed_bytes}")
    if deleted:
        print("deleted_files:")
        for name, size in deleted[:50]:
            print(f"- {name} ({size} bytes)")
        if len(deleted) > 50:
            print(f"- ... and {len(deleted) - 50} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
