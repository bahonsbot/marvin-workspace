#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
WORKSPACE_ROOT = Path("/data/.openclaw/workspace")
PYTHON = "/usr/bin/python3"
LOG_PATH = WORKSPACE_ROOT / "memory" / "deterministic-scheduler.log"
STATE_PATH = WORKSPACE_ROOT / "memory" / "deterministic-scheduler-state.json"
PID_PATH = WORKSPACE_ROOT / "memory" / "deterministic-scheduler.pid"
POLL_SECONDS = 20


@dataclass(frozen=True)
class Task:
    name: str
    kind: str
    hour: int | None = None
    minute: int | None = None
    hours: tuple[int, ...] = ()
    weekdays: tuple[int, ...] = ()  # Monday=0
    day_of_week: int | None = None
    interval_minutes: int | None = None
    minute_offset: int | None = None
    randomized_delay_sec: int = 0


def _wd(*days: int) -> tuple[int, ...]:
    return tuple(days)


TASKS: tuple[Task, ...] = (
    Task("trading-daily-report", "daily", hour=8, minute=0, weekdays=_wd(0, 1, 2, 3, 4)),
    Task("pre-market-brief", "daily", hour=20, minute=0, weekdays=_wd(0, 1, 2, 3, 4)),
    Task("auto-signal-dispatcher", "interval", interval_minutes=15, minute_offset=0, weekdays=_wd(0, 1, 2, 3, 4)),
    Task("rss-feed-monitor", "hourly", minute=10, weekdays=_wd(0, 1, 2, 3, 4), randomized_delay_sec=300),
    Task("rss-feed-monitor-weekend-light", "fixed_hours", minute=10, hours=(0, 4, 8, 12, 16, 20), weekdays=_wd(5, 6)),
    Task("custom-news-feed-monitor", "interval", interval_minutes=30, minute_offset=20),
    Task("reddit-monitor", "hourly", minute=40, weekdays=_wd(0, 1, 2, 3, 4)),
    Task("reddit-monitor-weekend-light", "fixed_hours", minute=40, hours=(0, 4, 8, 12, 16, 20), weekdays=_wd(5, 6)),
    Task("weekly-test-suite", "weekly", day_of_week=6, hour=2, minute=15),
    Task("dependency-update-audit", "weekly", day_of_week=0, hour=10, minute=30),
    Task("entity-lifecycle-manager", "weekly", day_of_week=6, hour=5, minute=0),
    Task("audit-sensitive-snapshot", "weekly", day_of_week=6, hour=3, minute=15),
    Task("data-manager", "weekly", day_of_week=0, hour=5, minute=0),
    Task("session-log-cleanup", "daily", hour=5, minute=20),
    Task("cron-run-details-cleanup", "daily", hour=5, minute=25),
)


stop_requested = False


def log(msg: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    line = f"[{datetime.now(TZ).isoformat()}] {msg}"
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    print(line, flush=True)


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def due(task: Task, now: datetime) -> bool:
    wd = now.weekday()
    if task.weekdays and wd not in task.weekdays:
        return False
    if task.kind == "daily":
        return now.hour == task.hour and now.minute == task.minute
    if task.kind == "hourly":
        return now.minute == task.minute
    if task.kind == "fixed_hours":
        return now.hour in task.hours and now.minute == task.minute
    if task.kind == "weekly":
        return wd == task.day_of_week and now.hour == task.hour and now.minute == task.minute
    if task.kind == "interval":
        return now.minute % int(task.interval_minutes) == int(task.minute_offset or 0)
    return False


def already_fired(state: dict, task: Task, now: datetime) -> bool:
    minute_key = now.strftime("%Y-%m-%dT%H:%M")
    return state.get(task.name) == minute_key


def mark_fired(state: dict, task: Task, now: datetime) -> None:
    state[task.name] = now.strftime("%Y-%m-%dT%H:%M")
    save_state(state)


def run_task(task: Task) -> None:
    cmd = [PYTHON, str(WORKSPACE_ROOT / "scripts" / "cron_runner.py"), "--task", task.name]
    if task.randomized_delay_sec:
        delay = int.from_bytes(os.urandom(2), "big") % (task.randomized_delay_sec + 1)
        log(f"{task.name}: randomized delay {delay}s before execution")
        time.sleep(delay)
    log(f"{task.name}: starting")
    proc = subprocess.run(cmd, cwd=str(WORKSPACE_ROOT), capture_output=True, text=True)
    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    log(f"{task.name}: exit={proc.returncode}")
    if stdout:
        log(f"{task.name}: stdout={stdout[:1200]}")
    if stderr:
        log(f"{task.name}: stderr={stderr[:1200]}")


def handle_signal(signum, frame) -> None:  # noqa: ANN001
    global stop_requested
    stop_requested = True
    log(f"received signal {signum}; stopping")


def _process_matches_scheduler(pid: int) -> bool:
    try:
        cmdline = Path(f"/proc/{pid}/cmdline").read_text(encoding="utf-8", errors="ignore")
        return str(Path(__file__).resolve()) in cmdline
    except Exception:
        return False


def ensure_single_instance() -> None:
    if PID_PATH.exists():
        try:
            pid = int(PID_PATH.read_text(encoding="utf-8").strip())
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                pass  # Stale PID file — not running, proceed
            except PermissionError:
                # Signal sent but denied — still check if it's our process
                if _process_matches_scheduler(pid):
                    print(f"scheduler already running with pid {pid}", file=sys.stderr)
                    raise SystemExit(1)
            else:
                # Signal sent successfully — still must verify it's our process
                if _process_matches_scheduler(pid):
                    print(f"scheduler already running with pid {pid}", file=sys.stderr)
                    raise SystemExit(1)
        except ProcessLookupError:
            pass
        except Exception:
            pass
    PID_PATH.write_text(str(os.getpid()), encoding="utf-8")


def cleanup() -> None:
    PID_PATH.unlink(missing_ok=True)


def main() -> int:
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    ensure_single_instance()
    log("deterministic scheduler started")
    state = load_state()
    try:
        while not stop_requested:
            now = datetime.now(TZ).replace(second=0, microsecond=0)
            for task in TASKS:
                if due(task, now) and not already_fired(state, task, now):
                    mark_fired(state, task, now)
                    run_task(task)
            time.sleep(POLL_SECONDS)
    finally:
        cleanup()
        log("deterministic scheduler stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
