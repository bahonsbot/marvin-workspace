#!/usr/bin/env python3
"""News search shortcut for this skill.

Uses DuckDuckGo via ddgs. This is intentionally simple: it prints a small list
of links + snippets in Markdown.

Dependency:
- pip install -U ddgs

Example:
- python3 scripts/news.py NVDA --max 8
- python3 scripts/news.py "Tesla earnings" --max 8
"""

from __future__ import annotations

import argparse
import subprocess
import sys


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="News search (DDG via ddgs)")
    p.add_argument("query", help="Ticker or free-form query")
    p.add_argument("--max", type=int, default=8)
    p.add_argument("--region", default="us-en")
    p.add_argument("--timelimit", default="w", choices=["d", "w", "m", "y"], help="d|w|m|y")
    args = p.parse_args(argv)

    # Bound max results to avoid abuse / accidental oversized requests.
    args.max = max(1, min(args.max, 20))

    # Delegate to the vendored ddg_search helper.
    cmd = [
        sys.executable,
        "scripts/ddg_search.py",
        f"{args.query} latest news earnings guidance",
        "--kind",
        "news",
        "--max",
        str(args.max),
        "--region",
        args.region,
        "--timelimit",
        args.timelimit,
        "--out",
        "md",
    ]
    return subprocess.run(cmd, check=False, cwd="/data/.openclaw/workspace/skills/stock-market-pro").returncode


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
