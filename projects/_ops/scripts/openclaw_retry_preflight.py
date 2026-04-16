#!/usr/bin/env python3
"""Preflight for safer OpenClaw live-upgrade retries.

Why this exists:
- OpenClaw 2026.4.12 accepts legacy Telegram streaming config such as
  channels.telegram.streaming = "off" and exposes it as the newer nested shape.
- OpenClaw 2026.3.8 rejects the newer nested shape
  channels.telegram.streaming = {"mode": "off"}.
- That means a failed live upgrade can become a rollback failure if the target
  runtime rewrites config and the rollback runtime is restarted against the
  rewritten file.

This script proves that compatibility gap against temp config copies and blocks
"safe retry" status until a byte-for-byte rollback backup of the raw config
exists.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

DEFAULT_CONFIG = Path("/data/.openclaw/openclaw.json")
DEFAULT_TARGET_CLI = Path("/data/.openclaw/rehearsals/v2026.4.12/cli/node_modules/.bin/openclaw")
LEGACY_KEYS = ["streamMode", "chunkMode", "blockStreaming", "draftChunk", "blockStreamingCoalesce"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Safer retry preflight for OpenClaw live upgrades")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to the raw openclaw.json to inspect")
    parser.add_argument("--current-cli", default="openclaw", help="CLI command for the current live runtime")
    parser.add_argument("--target-cli", default=str(DEFAULT_TARGET_CLI), help="CLI command for the target runtime")
    parser.add_argument(
        "--rollback-backup",
        help="Path to a byte-for-byte backup of the raw config. Required when rollback compatibility risk is detected.",
    )
    return parser.parse_args()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text())


def normalize_mode(value: Any) -> str | None:
    if isinstance(value, bool):
        return "partial" if value else "off"
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if normalized in {"off", "partial", "block", "progress"}:
        return "partial" if normalized == "progress" else normalized
    return None


def resolve_telegram_mode(entry: Dict[str, Any]) -> str:
    mode = normalize_mode(entry.get("streaming"))
    if mode:
        return mode
    mode = normalize_mode(entry.get("streamMode"))
    if mode:
        return mode
    return "partial"


def collect_legacy_telegram_risks(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    telegram = ((cfg.get("channels") or {}).get("telegram"))
    if not isinstance(telegram, dict):
        return results

    def inspect_entry(path_prefix: str, entry: Dict[str, Any]) -> None:
        issues: List[str] = []
        streaming = entry.get("streaming")
        if isinstance(streaming, (str, bool)):
            issues.append(f"legacy scalar streaming={streaming!r}")
        for key in LEGACY_KEYS:
            if key in entry:
                issues.append(f"legacy key {key}")
        if issues:
            results.append({"path": path_prefix, "issues": issues, "resolvedMode": resolve_telegram_mode(entry)})

    inspect_entry("channels.telegram", telegram)
    accounts = telegram.get("accounts")
    if isinstance(accounts, dict):
        for account_id, account in accounts.items():
            if isinstance(account, dict):
                inspect_entry(f"channels.telegram.accounts.{account_id}", account)
    return results


def build_migrated_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    migrated = json.loads(json.dumps(cfg))
    telegram = ((migrated.get("channels") or {}).get("telegram"))
    if not isinstance(telegram, dict):
        return migrated

    def migrate_entry(entry: Dict[str, Any]) -> None:
        has_legacy = isinstance(entry.get("streaming"), (str, bool)) or any(key in entry for key in LEGACY_KEYS)
        if not has_legacy:
            return
        streaming = entry.get("streaming")
        if not isinstance(streaming, dict):
            entry["streaming"] = {}
        entry["streaming"].setdefault("mode", resolve_telegram_mode(entry))
        for key in LEGACY_KEYS:
            if key in entry:
                del entry[key]

    migrate_entry(telegram)
    accounts = telegram.get("accounts")
    if isinstance(accounts, dict):
        for account in accounts.values():
            if isinstance(account, dict):
                migrate_entry(account)
    return migrated


def write_temp_home(cfg: Dict[str, Any]) -> str:
    home = tempfile.mkdtemp(prefix="openclaw-preflight-")
    ocdir = Path(home) / ".openclaw"
    ocdir.mkdir(parents=True, exist_ok=True)
    (ocdir / "openclaw.json").write_text(json.dumps(cfg, indent=2) + "\n")
    return home


def run_validate(cli: str, home: str) -> Tuple[int, str]:
    env = os.environ.copy()
    env["HOME"] = home
    proc = subprocess.run(
        f"{cli} config validate",
        shell=True,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return proc.returncode, proc.stdout.strip()


def first_lines(text: str, limit: int = 8) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    return "\n".join(lines[:limit])


def compare_backup(config_path: Path, backup_path: Path) -> Tuple[bool, str]:
    if not backup_path.exists():
        return False, f"missing backup file: {backup_path}"
    config_bytes = config_path.read_bytes()
    backup_bytes = backup_path.read_bytes()
    if config_bytes != backup_bytes:
        return (
            False,
            "backup content does not match the current raw config "
            f"(config sha256={sha256_bytes(config_bytes)}, backup sha256={sha256_bytes(backup_bytes)})",
        )
    return True, f"backup matches current raw config (sha256={sha256_bytes(config_bytes)})"


def main() -> int:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"FAIL: config file not found: {config_path}")
        return 1
    if not shutil.which(args.current_cli.split()[0]):
        print(f"FAIL: current CLI not found on PATH: {args.current_cli}")
        return 1
    if not Path(args.target_cli).exists() and not shutil.which(args.target_cli.split()[0]):
        print(f"FAIL: target CLI not found: {args.target_cli}")
        return 1

    cfg = load_json(config_path)
    risks = collect_legacy_telegram_risks(cfg)
    migrated_cfg = build_migrated_config(cfg)

    raw_home = write_temp_home(cfg)
    migrated_home = write_temp_home(migrated_cfg)
    try:
        current_raw_rc, current_raw_out = run_validate(args.current_cli, raw_home)
        target_raw_rc, target_raw_out = run_validate(args.target_cli, raw_home)
        current_migrated_rc, current_migrated_out = run_validate(args.current_cli, migrated_home)
    finally:
        shutil.rmtree(raw_home, ignore_errors=True)
        shutil.rmtree(migrated_home, ignore_errors=True)

    print("OpenClaw safer retry preflight")
    print(f"- Raw config: {config_path}")
    print(f"- Current CLI: {args.current_cli}")
    print(f"- Target CLI: {args.target_cli}")
    print()

    if risks:
        print("Telegram streaming compatibility risk detected:")
        for risk in risks:
            issues = "; ".join(risk["issues"])
            print(f"- {risk['path']}: {issues} -> target runtime will normalize to streaming.mode={risk['resolvedMode']!r}")
    else:
        print("Telegram streaming compatibility risk detected: none")
    print()

    print(f"Current runtime validates raw config: {'PASS' if current_raw_rc == 0 else 'FAIL'}")
    print(first_lines(current_raw_out) or "(no output)")
    print()

    print(f"Target runtime validates raw config: {'PASS' if target_raw_rc == 0 else 'FAIL'}")
    print(first_lines(target_raw_out) or "(no output)")
    print()

    print(f"Rollback compatibility simulation against migrated Telegram shape: {'PASS' if current_migrated_rc == 0 else 'FAIL'}")
    print(first_lines(current_migrated_out) or "(no output)")
    print()

    needs_backup_guard = bool(risks) and current_raw_rc == 0 and target_raw_rc == 0 and current_migrated_rc != 0
    backup_ok = True
    backup_message = "not required"
    if needs_backup_guard:
        if args.rollback_backup:
            backup_ok, backup_message = compare_backup(config_path, Path(args.rollback_backup))
        else:
            backup_ok = False
            backup_message = "rollback backup path not provided"
        print(f"Rollback backup guard: {'PASS' if backup_ok else 'FAIL'}")
        print(backup_message)
        print()

    failures: List[str] = []
    if current_raw_rc != 0:
        failures.append("current runtime does not validate the raw config")
    if target_raw_rc != 0:
        failures.append("target runtime does not validate the raw config")
    if needs_backup_guard and not backup_ok:
        failures.append("rollback-safe config backup is missing or stale")

    if failures:
        print("PRECHECK RESULT: FAIL")
        print("Why:")
        for failure in failures:
            print(f"- {failure}")
        if needs_backup_guard:
            print("Required before live retry:")
            print("- create a byte-for-byte backup of the raw /data/.openclaw/openclaw.json before upgrading")
            print("- if rollback is needed after any 2026.4.12 config rewrite, restore that raw backup before restarting 2026.3.8")
        return 1

    print("PRECHECK RESULT: PASS")
    if needs_backup_guard:
        print("Conditions:")
        print("- rollback must restore the saved raw config backup before any 2026.3.8 restart")
    else:
        print("No rollback-specific Telegram config guard is currently required.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
