#!/usr/bin/env python3
"""
Queue state helper for autonomous sub-agent tasks.

Purpose:
- inspect queue state
- detect whether an active spawned task exists
- self-heal stale spawned entries

Usage:
  python3 scripts/queue_state.py status
  python3 scripts/queue_state.py can-start
  python3 scripts/queue_state.py heal-stale

Exit codes:
  0 = success / can start
  1 = active spawned task exists
  2 = queue missing or invalid
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
QUEUE_FILE = WORKSPACE / "memory" / "executor-subagent-queue.json"
STALE_HOURS = 2


def load_queue():
    if not QUEUE_FILE.exists():
        return []
    try:
        return json.loads(QUEUE_FILE.read_text())
    except json.JSONDecodeError:
        print("ERROR: invalid queue JSON", file=sys.stderr)
        sys.exit(2)


def save_queue(queue):
    QUEUE_FILE.write_text(json.dumps(queue, indent=2, ensure_ascii=False))


def parse_ts(value):
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def active_spawned_entries(queue):
    return [entry for entry in queue if entry.get("status") == "spawned"]


def is_stale(entry, hours=STALE_HOURS):
    started = parse_ts(entry.get("startedAt")) or parse_ts(entry.get("queuedAt")) or parse_ts(entry.get("timestamp"))
    if not started:
        return True
    return datetime.now() - started > timedelta(hours=hours)


def cmd_status():
    queue = load_queue()
    spawned = active_spawned_entries(queue)
    pending = [e for e in queue if e.get("status") == "pending"]
    completed = [e for e in queue if e.get("status") == "completed"]
    blocked = [e for e in queue if e.get("status") == "blocked"]

    print(json.dumps({
        "queueFile": str(QUEUE_FILE),
        "total": len(queue),
        "spawned": len(spawned),
        "pending": len(pending),
        "completed": len(completed),
        "blocked": len(blocked),
        "staleSpawned": [
            {
                "task": e.get("task", "")[:140],
                "startedAt": e.get("startedAt"),
                "label": e.get("label")
            }
            for e in spawned if is_stale(e)
        ]
    }, indent=2, ensure_ascii=False))


def cmd_can_start():
    queue = load_queue()
    spawned = active_spawned_entries(queue)
    if spawned:
        print("ACTIVE_SPAWNED")
        sys.exit(1)
    print("CAN_START")
    sys.exit(0)


def cmd_heal_stale():
    queue = load_queue()
    healed = 0
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    for entry in queue:
        if entry.get("status") == "spawned" and is_stale(entry):
            entry["status"] = "blocked"
            entry["updatedAt"] = now
            entry["note"] = f"Auto-healed stale spawned task after >{STALE_HOURS}h without completion; active slot released"
            healed += 1

    if healed:
        save_queue(queue)

    print(json.dumps({"healed": healed, "queueFile": str(QUEUE_FILE)}, indent=2))


def main():
    if len(sys.argv) < 2:
        print("Usage: queue_state.py [status|can-start|heal-stale]", file=sys.stderr)
        sys.exit(2)

    cmd = sys.argv[1]
    if cmd == "status":
        cmd_status()
    elif cmd == "can-start":
        cmd_can_start()
    elif cmd == "heal-stale":
        cmd_heal_stale()
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
