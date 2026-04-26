#!/usr/bin/env python3
"""
⚠️ DEPRECATED — Mar 19, 2026 — Superseded by host-side marvin-deterministic-scheduler.service
========================================================================================
This script installed user-level systemd timers (--user). That approach was replaced by
a host-side systemd service after the Mar 19 deterministic scheduler migration.
DO NOT USE for new installations. Kept only for rollback reference.
"""
from __future__ import annotations

from pathlib import Path

SYSTEMD_USER_DIR = Path.home() / ".config" / "systemd" / "user"
WORKSPACE_ROOT = Path("/data/.openclaw/workspace")
PYTHON = "/usr/bin/python3"
SERVICE_NAME = "marvin-deterministic-task@.service"

TASKS = {
    "trading-daily-report": {
        "description": "Marvin deterministic task: trading daily report",
        "on_calendar": ["Mon..Fri *-*-* 08:00:00 Asia/Ho_Chi_Minh"],
    },
    "pre-market-brief": {
        "description": "Marvin deterministic task: pre-market brief",
        "on_calendar": ["Mon..Fri *-*-* 20:00:00 Asia/Ho_Chi_Minh"],
    },
    "auto-signal-dispatcher": {
        "description": "Marvin deterministic task: auto signal dispatcher",
        "on_calendar": ["Mon..Fri *-*-* *:00/15:00 Asia/Ho_Chi_Minh"],
    },
    "rss-feed-monitor": {
        "description": "Marvin deterministic task: rss feed monitor",
        "on_calendar": ["Mon..Fri *-*-* *:10:00 Asia/Ho_Chi_Minh"],
        "randomized_delay_sec": 300,
    },
    "rss-feed-monitor-weekend-light": {
        "description": "Marvin deterministic task: rss feed monitor weekend light",
        "on_calendar": ["Sat,Sun *-*-* 00/4:10:00 Asia/Ho_Chi_Minh"],
    },
    "reddit-monitor": {
        "description": "Marvin deterministic task: reddit monitor",
        "on_calendar": ["Mon..Fri *-*-* *:40:00 Asia/Ho_Chi_Minh"],
    },
    "reddit-monitor-weekend-light": {
        "description": "Marvin deterministic task: reddit monitor weekend light",
        "on_calendar": ["Sat,Sun *-*-* 00/4:40:00 Asia/Ho_Chi_Minh"],
    },
    "weekly-test-suite": {
        "description": "Marvin deterministic task: weekly test suite",
        "on_calendar": ["Sun *-*-* 02:15:00 Asia/Ho_Chi_Minh"],
    },
    "dependency-update-audit": {
        "description": "Marvin deterministic task: dependency update audit",
        "on_calendar": ["Mon *-*-* 10:30:00 Asia/Ho_Chi_Minh"],
    },
    "entity-lifecycle-manager": {
        "description": "Marvin deterministic task: entity lifecycle manager",
        "on_calendar": ["Sun *-*-* 05:00:00 Asia/Ho_Chi_Minh"],
    },
    "audit-sensitive-snapshot": {
        "description": "Marvin deterministic task: audit sensitive snapshot",
        "on_calendar": ["Sun *-*-* 03:15:00 Asia/Ho_Chi_Minh"],
    },
}

SERVICE_TEMPLATE = f"""[Unit]
Description=Marvin deterministic cron task %i
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory={WORKSPACE_ROOT}
ExecStart={PYTHON} {WORKSPACE_ROOT}/scripts/cron_runner.py --task %i
Nice=10
"""


def timer_body(task_name: str, cfg: dict) -> str:
    lines = [
        "[Unit]",
        f"Description={cfg['description']}",
        "",
        "[Timer]",
    ]
    for item in cfg["on_calendar"]:
        lines.append(f"OnCalendar={item}")
    lines.append("Persistent=true")
    lines.append("AccuracySec=1s")
    if cfg.get("randomized_delay_sec"):
        lines.append(f"RandomizedDelaySec={cfg['randomized_delay_sec']}")
    lines.extend([
        f"Unit=marvin-deterministic-task@{task_name}.service",
        "",
        "[Install]",
        "WantedBy=timers.target",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    SYSTEMD_USER_DIR.mkdir(parents=True, exist_ok=True)
    (SYSTEMD_USER_DIR / SERVICE_NAME).write_text(SERVICE_TEMPLATE, encoding="utf-8")
    for task_name, cfg in TASKS.items():
        timer_name = f"marvin-deterministic-task@{task_name}.timer"
        (SYSTEMD_USER_DIR / timer_name).write_text(timer_body(task_name, cfg), encoding="utf-8")
    print(f"installed {1 + len(TASKS)} unit files into {SYSTEMD_USER_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
