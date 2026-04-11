#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
MISSION_CONTROL_DIR = WORKSPACE_ROOT / "projects" / "mission-control"


def main() -> int:
    proc = subprocess.run(
        ["python3", "scripts/custom_news_digest.py"],
        cwd=str(MISSION_CONTROL_DIR),
    )
    return int(proc.returncode)


if __name__ == "__main__":
    sys.exit(main())
