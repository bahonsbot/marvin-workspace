#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Iterable

SEATS = [
    "language-tutor",
    "sportsbet-advisor",
    "trading-advisor",
    "job-advisor",
]

MAIN_WORKSPACE = Path("/data/.openclaw/workspace")


def seat_root(seat: str) -> Path:
    return Path(f"/data/.openclaw/workspace-{seat}")


def seat_shared_root(seat: str) -> Path:
    return MAIN_WORKSPACE / "agent-workspaces" / seat


def mappings_for(seat: str) -> dict[str, Path]:
    shared = seat_shared_root(seat)
    return {
        "agent-workspaces": MAIN_WORKSPACE / "agent-workspaces",
        "skills": MAIN_WORKSPACE / "skills",
        "memory": shared / "memory",
        "artifacts": shared / "artifacts",
        ".learnings": shared / ".learnings",
        "MEMORY.md": shared / "MEMORY.md",
        "SKILLS.md": shared / "SKILLS.md",
        "WORKSPACE.md": shared / "WORKSPACE.md",
    }


def iter_existing(path: Path) -> Iterable[Path]:
    try:
        yield next(path.iterdir())
    except StopIteration:
        return


def ensure_link(link: Path, target: Path, apply: bool) -> tuple[str, str]:
    desired = str(target)

    if link.is_symlink():
        current = os.readlink(link)
        if current == desired:
            return ("ok", f"{link} -> {desired}")
        return ("error", f"{link} points to {current}, expected {desired}")

    if link.exists():
        if link.is_dir():
            if any(True for _ in iter_existing(link)):
                return ("error", f"{link} exists and is not empty")
            if not apply:
                return ("needs-change", f"replace empty dir {link} with symlink -> {desired}")
            link.rmdir()
        else:
            return ("error", f"{link} exists as file; refusing to replace")
    elif not apply:
        return ("needs-change", f"create symlink {link} -> {desired}")

    if apply:
        link.symlink_to(target, target_is_directory=target.is_dir())
        return ("linked", f"{link} -> {desired}")

    return ("needs-change", f"create symlink {link} -> {desired}")


def run(apply: bool) -> int:
    had_error = False
    for seat in SEATS:
        root = seat_root(seat)
        shared = seat_shared_root(seat)
        print(f"=== {seat} ===")

        if not root.exists():
            print(f"ERROR: missing seat root {root}")
            had_error = True
            print()
            continue
        if not shared.exists():
            print(f"ERROR: missing shared root {shared}")
            had_error = True
            print()
            continue

        for name, target in mappings_for(seat).items():
            if not target.exists():
                print(f"ERROR: missing target for {name}: {target}")
                had_error = True
                continue
            status, message = ensure_link(root / name, target, apply=apply)
            print(f"{status.upper()}: {message}")
            if status == "error":
                had_error = True
        print()

    return 1 if had_error else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Check or apply specialist workspace content aliases.")
    parser.add_argument("--apply", action="store_true", help="Create missing aliases when safe to do so.")
    args = parser.parse_args()
    return run(apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
