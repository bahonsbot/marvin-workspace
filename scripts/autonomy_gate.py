#!/usr/bin/env python3
"""
Autonomy gate for cron-triggered proactive execution.

Purpose:
- keep heartbeat lightweight
- give cron-triggered autonomy a deterministic preflight check
- align live execution with AUTONOMY.md policy boundaries

Usage:
  python3 scripts/autonomy_gate.py workspace
  python3 scripts/autonomy_gate.py queue
  python3 scripts/autonomy_gate.py improve

Exit codes:
  0 = run allowed
  1 = skip
  2 = invalid usage / file error
"""

from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import NamedTemporaryFile
from zoneinfo import ZoneInfo

import fcntl

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMY_FILE = WORKSPACE / "AUTONOMY.md"
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
QUEUE_FILE = WORKSPACE / "memory" / "executor-subagent-queue.json"
QUEUE_LOCK_FILE = WORKSPACE / "memory" / "executor-subagent-queue.lock"
TZ = ZoneInfo("Asia/Ho_Chi_Minh")
ACTIVE_START_HOUR = 9
ACTIVE_END_HOUR = 22
STALE_HOURS = 2


@dataclass
class GateResult:
    mode: str
    decision: str
    reason: str
    details: dict

    def emit(self) -> int:
        print(json.dumps(asdict(self), indent=2, ensure_ascii=False))
        return 0 if self.decision == "run" else 1


def now_local() -> datetime:
    return datetime.now(TZ)


def in_active_window(ts: datetime) -> bool:
    return ACTIVE_START_HOUR <= ts.hour < ACTIVE_END_HOUR


def parse_ts(value: str | None):
    if not value:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.replace(tzinfo=TZ)
        except ValueError:
            continue
    return None


@contextmanager
def queue_lock():
    QUEUE_LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with QUEUE_LOCK_FILE.open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _load_queue_unlocked():
    if not QUEUE_FILE.exists():
        return []
    try:
        data = json.loads(QUEUE_FILE.read_text())
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"invalid queue JSON: {exc}") from exc
    if not isinstance(data, list):
        raise RuntimeError("queue JSON must be a list")
    return data


def load_queue():
    with queue_lock():
        return _load_queue_unlocked()


def _save_queue_unlocked(queue):
    QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", delete=False, dir=QUEUE_FILE.parent, encoding="utf-8") as tmp:
        json.dump(queue, tmp, indent=2, ensure_ascii=False)
        tmp.write("\n")
        tmp.flush()
        os.chmod(tmp.name, 0o600)
        temp_path = Path(tmp.name)
    os.replace(temp_path, QUEUE_FILE)
    os.chmod(QUEUE_FILE, 0o600)


def save_queue(queue):
    with queue_lock():
        _save_queue_unlocked(queue)


def active_spawned_entries(queue):
    return [entry for entry in queue if entry.get("status") == "spawned"]


def pending_entries(queue):
    return [entry for entry in queue if entry.get("status") == "pending"]


def is_stale(entry, hours=STALE_HOURS):
    started = parse_ts(entry.get("startedAt")) or parse_ts(entry.get("queuedAt")) or parse_ts(entry.get("timestamp"))
    if not started:
        return True
    return now_local() - started > timedelta(hours=hours)


def heal_stale_spawned(queue):
    healed = 0
    stamp = now_local().strftime("%Y-%m-%d %H:%M")
    for entry in queue:
        if entry.get("status") == "spawned" and is_stale(entry):
            entry["status"] = "blocked"
            entry["updatedAt"] = stamp
            entry["note"] = f"Auto-healed stale spawned task after >{STALE_HOURS}h without completion; active slot released"
            healed += 1
    return healed


def read_autonomous_sections():
    if not AUTONOMOUS_FILE.exists():
        return {"open_backlog": 0, "in_progress": 0}

    open_backlog = 0
    in_progress = 0
    section = None
    for line in AUTONOMOUS_FILE.read_text().splitlines():
        stripped = line.strip()
        if stripped == "## Open Backlog":
            section = "open_backlog"
            continue
        if stripped == "## In Progress":
            section = "in_progress"
            continue
        if stripped.startswith("## "):
            section = None
            continue
        if stripped.startswith("- ") and section in {"open_backlog", "in_progress"}:
            if section == "open_backlog":
                open_backlog += 1
            else:
                in_progress += 1
    return {"open_backlog": open_backlog, "in_progress": in_progress}


def common_preflight(mode: str):
    ts = now_local()
    if not AUTONOMY_FILE.exists():
        return GateResult(mode, "skip", "AUTONOMY.md not found", {"path": str(AUTONOMY_FILE)})
    if not in_active_window(ts):
        return GateResult(mode, "skip", "outside active window", {"now": ts.strftime("%Y-%m-%d %H:%M %Z")})
    return None


def gate_workspace():
    preflight = common_preflight("workspace")
    if preflight:
        return preflight

    if not AUTONOMOUS_FILE.exists():
        return GateResult("workspace", "skip", "AUTONOMOUS.md not found", {"path": str(AUTONOMOUS_FILE)})

    sections = read_autonomous_sections()
    if sections["open_backlog"] == 0:
        return GateResult("workspace", "skip", "no Open Backlog tasks", sections)

    queue = load_queue()
    spawned = active_spawned_entries(queue)
    recent_spawned = [e for e in spawned if not is_stale(e)]
    if recent_spawned:
        return GateResult(
            "workspace",
            "skip",
            "delegated queue already has an active spawned task",
            {
                **sections,
                "spawned": len(spawned),
                "active_task": recent_spawned[0].get("task", "")[:160],
            },
        )

    return GateResult(
        "workspace",
        "run",
        "workspace autonomy run allowed",
        sections,
    )


def gate_queue():
    preflight = common_preflight("queue")
    if preflight:
        return preflight

    with queue_lock():
        queue = _load_queue_unlocked()
        healed = heal_stale_spawned(queue)
        if healed:
            _save_queue_unlocked(queue)

        spawned = active_spawned_entries(queue)
        recent_spawned = [e for e in spawned if not is_stale(e)]
        if recent_spawned:
            return GateResult(
                "queue",
                "skip",
                "active spawned delegated task already exists",
                {
                    "healed": healed,
                    "spawned": len(spawned),
                    "active_task": recent_spawned[0].get("task", "")[:160],
                },
            )

        pending = pending_entries(queue)
        if not pending:
            return GateResult(
                "queue",
                "skip",
                "no pending delegated tasks",
                {"healed": healed, "pending": 0, "spawned": 0},
            )

        return GateResult(
            "queue",
            "run",
            "queue wakeup allowed",
            {
                "healed": healed,
                "pending": len(pending),
                "next_task": pending[0].get("task", "")[:160],
            },
        )


def gate_improve():
    # workspace-home-improvement runs at 07:30 — outside heartbeat active window — so
    # only check AUTONOMY.md existence, not the time window
    if not AUTONOMY_FILE.exists():
        return GateResult("improve", "skip", "AUTONOMY.md not found", {"path": str(AUTONOMY_FILE)})

    queue = load_queue()
    spawned = active_spawned_entries(queue)
    recent_spawned = [e for e in spawned if not is_stale(e)]
    sections = read_autonomous_sections()

    if recent_spawned:
        return GateResult(
            "improve",
            "skip",
            "delegated queue already has an active spawned task",
            {
                **sections,
                "spawned": len(spawned),
                "active_task": recent_spawned[0].get("task", "")[:160],
            },
        )

    return GateResult(
        "improve",
        "run",
        "workspace home-improvement run allowed",
        sections,
    )


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"workspace", "queue", "improve"}:
        print("Usage: autonomy_gate.py [workspace|queue|improve]", file=sys.stderr)
        sys.exit(2)

    mode = sys.argv[1]
    try:
        if mode == "workspace":
            result = gate_workspace()
        elif mode == "queue":
            result = gate_queue()
        else:
            result = gate_improve()
    except RuntimeError as exc:
        print(json.dumps({"mode": mode, "decision": "skip", "reason": str(exc), "details": {}}, indent=2))
        sys.exit(2)

    sys.exit(result.emit())


if __name__ == "__main__":
    main()
