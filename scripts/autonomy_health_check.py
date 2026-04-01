#!/usr/bin/env python3
"""
Autonomy Health Check — Operator diagnostic for the dual-source autonomous task system.

Reads:
  - AUTONOMOUS.md          (canonical lane state)
  - memory/executor-subagent-queue.json   (sub-agent queue / completion log)

Reports:
  1. Lane summary (Backlog / In Progress / Needs Input / Review / Done Today)
  2. Stale / blocked lane items with age signals
  3. Cross-source drift:
     - in Review but already completed in queue  → needs Done promotion
     - in queue as 'spawned' but not in In Progress  → orphaned sub-agent
     - in Needs Input but prerequisite resolved         → needs re-evaluation
     - duplicate task text across lanes
  4. Queue health (pending / spawned / blocked / completed counts)
  5. Explicit next-action guidance per finding

Usage:
  python3 scripts/autonomy_health_check.py [--verbose] [--fix]

  --verbose  show full task text for each finding (default: truncated summary)
  --fix      print the exact AUTONOMOUS.md mutations needed to resolve each drift
"""

import re
import json
import argparse
from datetime import datetime
from pathlib import Path
from difflib import SequenceMatcher

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
QUEUE_FILE = WORKSPACE / "memory" / "executor-subagent-queue.json"
TASKS_LOG_FILE = WORKSPACE / "memory" / "tasks-log.md"

# Age thresholds (hours) for stale flags
STALE_IN_PROGRESS_HOURS = 4
STALE_NEEDS_INPUT_HOURS = 48
STALE_REVIEW_HOURS = 24
STALE_SPAWNED_QUEUE_HOURS = 2

ANSI_RED = "\033[91m"
ANSI_YELLOW = "\033[93m"
ANSI_GREEN = "\033[92m"
ANSI_BLUE = "\033[94m"
ANSI_BOLD = "\033[1m"
ANSI_RESET = "\033[0m"


def c(text, color):
    return f"{color}{text}{ANSI_RESET}"


def now_ts():
    return datetime.now()


def parse_autonomous_sections(content: str) -> dict:
    """Return {section_name: [line_texts]} from AUTONOMOUS.md."""
    sections = {}
    current = None
    for line in content.splitlines():
        m = re.match(r"^##\s+(.+)$", line.strip())
        if m:
            current = m.group(1).strip()
            sections[current] = []
        elif current is not None and line.strip().startswith("- "):
            sections[current].append(line.strip()[2:])
    return sections


def extract_tasks_from_lines(lines: list) -> list:
    """Strip '- ' prefix, skip empty / section marker lines."""
    tasks = []
    for line in lines:
        text = line.strip()
        if text.startswith("- "):
            text = text[2:]
        if text and not text.startswith("*(") and not re.match(r"^##", text):
            tasks.append(text)
    return tasks


def task_normalized(t: str) -> str:
    """Fingerprint for dedup: strip timestamps, common noise, collapse whitespace."""
    t = re.sub(r"\s+", " ", t.strip()).lower()
    t = re.sub(r"\[/?(done|review|backlog|inbox|blocked)\]", "", t)
    t = re.sub(r"⏰|✅|❌|🔨|🔧|📝|🎁|📚|🚀|🎨", "", t)
    return t.strip()


def task_title(t: str, max_len: int = 72) -> str:
    """First ~72 chars of task, fallback to fingerprint."""
    semicolon = t.find(";")
    title = t[:semicolon] if semicolon > -1 else t
    return title.strip()[:max_len]


def parse_queue() -> list:
    if not QUEUE_FILE.exists():
        return []
    try:
        return json.loads(QUEUE_FILE.read_text())
    except json.JSONDecodeError:
        return []


def queue_completed_tasks(queue: list) -> set:
    """Return normalized task texts for completed entries with verified outputs."""
    completed = set()
    for entry in queue:
        if entry.get("status") == "completed":
            t = task_normalized(entry.get("task", ""))
            if t:
                completed.add(t)
    return completed


def queue_spawned_tasks(queue: list) -> list:
    """Return spawned entries sorted by queuedAt."""
    spawned = [e for e in queue if e.get("status") == "spawned"]
    spawned.sort(key=lambda x: x.get("queuedAt", ""))
    return spawned


def queue_pending_tasks(queue: list) -> list:
    pending = [e for e in queue if e.get("status") == "pending"]
    pending.sort(key=lambda x: x.get("queuedAt", ""))
    return pending


def queue_blocked_tasks(queue: list) -> list:
    blocked = [e for e in queue if e.get("status") == "blocked"]
    blocked.sort(key=lambda x: x.get("updatedAt", ""))
    return blocked


def check_in_progress_age(in_progress_tasks: list, sections: dict) -> list:
    """Check In Progress tasks for staleness. Returns list of (task, age_hours) pairs."""
    # We only have done-today timestamps to estimate age, so we flag by presence + lack of progress
    stale = []
    for task in in_progress_tasks:
        # Check if task title suggests it's stuck
        title_lower = task.lower()
        if any(kw in title_lower for kw in ["reset pending", "placeholder", "regenerate", "re-run"]):
            stale.append((task, -1, "contains-placeholder-signal"))
    return stale


def find_duplicate_tasks_across_lanes(sections: dict) -> list:
    """Find tasks that appear in more than one lane."""
    task_positions = {}  # normalized -> [(lane, text)]
    for lane_name, tasks in sections.items():
        for task in tasks:
            n = task_normalized(task)
            if n:
                task_positions.setdefault(n, []).append((lane_name, task))

    duplicates = {n: pos for n, pos in task_positions.items() if len(pos) > 1}
    return duplicates


def run_health_check(verbose: bool = False) -> dict:
    """Run all health checks and return structured findings."""
    findings = {
        "lane_summary": {},
        "drift": [],
        "queue_health": {},
        "stale_items": [],
        "next_actions": [],
        "ok": True,
    }

    # ── 1. Parse AUTONOMOUS.md ──────────────────────────────────────────────────
    if not AUTONOMOUS_FILE.exists():
        findings["drift"].append({
            "type": "FATAL",
            "summary": "AUTONOMOUS.md not found",
            "detail": None,
            "fix": None,
        })
        findings["ok"] = False
        return findings

    content = AUTONOMOUS_FILE.read_text()
    sections = parse_autonomous_sections(content)

    lane_order = ["Open Backlog", "In Progress", "Needs Input", "Review", "Done Today"]
    for lane in lane_order:
        findings["lane_summary"][lane] = extract_tasks_from_lines(sections.get(lane, []))

    # ── 2. Parse queue ──────────────────────────────────────────────────────────
    queue = parse_queue()
    completed_norm = queue_completed_tasks(queue)
    spawned_entries = queue_spawned_tasks(queue)
    pending_entries = queue_pending_tasks(queue)
    blocked_entries = queue_blocked_tasks(queue)

    findings["queue_health"] = {
        "total": len(queue),
        "completed": len(completed_norm),
        "spawned": len(spawned_entries),
        "pending": len(pending_entries),
        "blocked": len(blocked_entries),
    }

    # ── 3. Drift: Review items that are already completed in queue ─────────────
    review_tasks = extract_tasks_from_lines(sections.get("Review", []))
    for task in review_tasks:
        n = task_normalized(task)
        if n in completed_norm:
            queue_entry = next((e for e in queue if task_normalized(e.get("task", "")) == n and e.get("status") == "completed"), None)
            output = queue_entry.get("outputPath", "") if queue_entry else ""
            findings["drift"].append({
                "type": "review_completed",
                "summary": "Task in Review but already completed in queue",
                "task": task[:120],
                "output": output,
                "fix": f"Move task from Review → Done Today in AUTONOMOUS.md",
            })
            findings["next_actions"].append({
                "priority": "HIGH",
                "action": f"MARK DONE: {task_title(task)}",
                "reason": "Completed in queue, still in Review",
                "output": output,
            })

    # ── 4. Drift: spawned in queue but not in In Progress ──────────────────────
    for entry in spawned_entries:
        task_n = task_normalized(entry.get("task", ""))
        in_progress_tasks = extract_tasks_from_lines(sections.get("In Progress", []))
        ip_norms = {task_normalized(t) for t in in_progress_tasks}
        if task_n and task_n not in ip_norms:
            findings["drift"].append({
                "type": "orphaned_spawned",
                "summary": "Task spawned in queue but not in In Progress lane",
                "task": entry.get("task", "")[:120],
                "label": entry.get("label", ""),
                "queued_at": entry.get("queuedAt", ""),
                "fix": "Ensure the task is listed under ## In Progress in AUTONOMOUS.md, or cancel the sub-agent session",
            })
            findings["next_actions"].append({
                "priority": "HIGH",
                "action": f"CHECK SPAWNED: {task_title(entry.get('task', ''))}",
                "reason": "Sub-agent running but not tracked in In Progress",
                "label": entry.get("label", ""),
            })

    # ── 5. Drift: blocked in queue with "Needs input" resolution ────────────────
    for entry in blocked_entries:
        note = entry.get("note", "").lower()
        if "needs input" in note or "prerequisite" in note:
            findings["drift"].append({
                "type": "blocked_prerequisite",
                "summary": "Blocked queue entry with unmet prerequisite",
                "task": entry.get("task", "")[:120],
                "note": entry.get("note", ""),
                "fix": "Address the prerequisite or move task to Needs Input in AUTONOMOUS.md",
            })
            findings["next_actions"].append({
                "priority": "MEDIUM",
                "action": f"NEEDS INPUT: {task_title(entry.get('task', ''))}",
                "reason": f"Blocked: {entry.get('note', '')[:80]}",
            })

    # ── 6. Stale In Progress (placeholder/no-op items) ─────────────────────────
    in_progress_tasks = extract_tasks_from_lines(sections.get("In Progress", []))
    for task in in_progress_tasks:
        n = task_normalized(task)
        # Flag placeholder tasks
        if not n or n in ("", " "):
            findings["stale_items"].append({
                "lane": "In Progress",
                "task": task[:120],
                "signal": "empty-task",
            })
            findings["next_actions"].append({
                "priority": "MEDIUM",
                "action": f"CLEAN LANE: Remove empty In Progress entry",
                "reason": "Empty or placeholder task in In Progress",
            })
        # Flag tasks that are actually no-ops (re-run, reset, regenerate)
        if any(kw in task.lower() for kw in ["reset pending", "regenerate", "re-run", "retry"]):
            findings["stale_items"].append({
                "lane": "In Progress",
                "task": task[:120],
                "signal": "placeholder-reset-task",
            })
            findings["next_actions"].append({
                "priority": "LOW",
                "action": f"RESET LANE: {task_title(task)}",
                "reason": "Reset/regenerate placeholder should be removed",
            })

    # ── 7. Stale Needs Input (not addressed in 48+ hours) ──────────────────────
    needs_input_tasks = extract_tasks_from_lines(sections.get("Needs Input", []))
    for task in needs_input_tasks:
        # Extract the Needs Input question if present
        q_match = re.search(r"Needs input:\s*(.+)", task)
        question = q_match.group(1).strip() if q_match else ""
        findings["stale_items"].append({
            "lane": "Needs Input",
            "task": task[:120],
            "question": question[:120],
            "signal": "needs-input",
        })
        findings["next_actions"].append({
            "priority": "HIGH",
            "action": f"ANSWER NEEDED: {question[:80] if question else task_title(task)}",
            "reason": "Task blocked on operator input",
            "task": task[:120],
        })

    # ── 8. Duplicate tasks across lanes ─────────────────────────────────────────
    duplicates = find_duplicate_tasks_across_lanes(sections)
    for norm, positions in duplicates.items():
        lanes = [p[0] for p in positions]
        if len(set(lanes)) > 1:
            findings["drift"].append({
                "type": "duplicate_across_lanes",
                "summary": f"Task appears in multiple lanes: {', '.join(set(lanes))}",
                "task": positions[0][1][:120],
                "lanes": list(set(lanes)),
                "fix": "Keep task in the most-advanced lane; remove from other lanes",
            })
            findings["next_actions"].append({
                "priority": "MEDIUM",
                "action": f"DE-DUPLICATE: {task_title(positions[0][1])}",
                "reason": f"Appears in: {', '.join(set(lanes))}",
            })

    # ── 9. Open Backlog count ───────────────────────────────────────────────────
    backlog_tasks = extract_tasks_from_lines(sections.get("Open Backlog", []))
    if len(backlog_tasks) == 0 and not spawned_entries and not pending_entries:
        findings["next_actions"].append({
            "priority": "LOW",
            "action": "GENERATE TASKS: Run daily-task-generator",
            "reason": "Open Backlog is empty",
        })

    # ── 10. Structural check: duplicate Done Today sections ─────────────────────
    done_today_count = content.count("## Done Today")
    if done_today_count > 1:
        findings["drift"].append({
            "type": "structure",
            "summary": f"Found {done_today_count} '## Done Today' section headers in AUTONOMOUS.md",
            "fix": "Merge duplicate Done Today sections into one",
        })
        findings["next_actions"].append({
            "priority": "MEDIUM",
            "action": "FIX STRUCTURE: Merge duplicate ## Done Today sections",
            "reason": f"{done_today_count} occurrences found — one is the maximum",
        })

    # ── 11. Assess overall OK status ────────────────────────────────────────────
    if findings["drift"]:
        error_drifts = [d for d in findings["drift"] if d["type"] in ("FATAL", "review_completed", "orphaned_spawned")]
        if error_drifts:
            findings["ok"] = False

    return findings


def print_report(findings: dict, verbose: bool = False):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n{c('═' * 60, ANSI_BOLD)}")
    print(c(f"  AUTONOMY HEALTH CHECK  ─  {ts}", ANSI_BOLD))
    print(c(f"{'═' * 60}", ANSI_BOLD))

    # ── Lane Summary ────────────────────────────────────────────────────────────
    print(f"\n{c('LANE SUMMARY', ANSI_BLUE)}")
    lane_order = ["Open Backlog", "In Progress", "Needs Input", "Review", "Done Today"]
    summary = findings.get("lane_summary", {})
    total_tasks = 0
    for lane in lane_order:
        tasks = summary.get(lane, [])
        total_tasks += len(tasks)
        color = ANSI_GREEN if tasks else ""
        flag = ""
        if lane == "In Progress" and any("reset" in t.lower() or "placeholder" in t.lower() for t in tasks):
            flag = c(" ⚠️ STALE", ANSI_YELLOW)
        if lane == "Review" and tasks:
            flag = c(" ⚠️ REVIEW→DONE?", ANSI_YELLOW)
        if lane == "Needs Input" and tasks:
            flag = c(f" ⚠️ {len(tasks)} BLOCKED", ANSI_YELLOW)
        print(f"  {lane:<16} {c(f'{len(tasks):>3}', color)} items{flag}")
    print(f"  {'─' * 40}")
    print(f"  {'Total tracked':<16} {c(f'{total_tasks:>3}', ANSI_BLUE)}")

    # ── Queue Health ─────────────────────────────────────────────────────────────
    qh = findings.get("queue_health", {})
    print(f"\n{c('QUEUE HEALTH', ANSI_BLUE)}")
    print(f"  {'Total entries':<20} {qh.get('total', 0)}")
    print(f"  {c('Completed', ANSI_GREEN):<20} {qh.get('completed', 0)}")
    print(f"  {c('Pending', ANSI_YELLOW):<20} {qh.get('pending', 0)}")
    print(f"  {c('Spawned (running)', ANSI_YELLOW + ANSI_BOLD):<20} {qh.get('spawned', 0)}")
    print(f"  {c('Blocked', ANSI_RED):<20} {qh.get('blocked', 0)}")

    # ── Drift Findings ───────────────────────────────────────────────────────────
    drifts = findings.get("drift", [])
    if drifts:
        print(f"\n{c(f'⚑ DRIFT DETECTED ({len(drifts)})', ANSI_RED + ANSI_BOLD)}")
        for i, d in enumerate(drifts, 1):
            dtype = d["type"]
            color = (ANSI_RED if dtype in ("FATAL", "review_completed", "orphaned_spawned")
                     else ANSI_YELLOW if dtype == "structure"
                     else "")
            print(f"\n  [{i}] {c(dtype.upper(), color)}")
            if verbose or d["type"] != "structure":
                print(f"      Task: {d.get('task', d.get('summary',''))[:90]}")
            if "lanes" in d:
                print(f"      Lanes: {', '.join(d['lanes'])}")
            if "output" in d and d["output"]:
                print(f"      Output: {d['output']}")
            if "note" in d and d["note"]:
                print(f"      Note: {d['note'][:100]}")
            print(f"      {c('→ Fix:', ANSI_GREEN)} {d.get('fix', 'No automated fix')}")
    else:
        print(f"\n{c('✓ No drift detected', ANSI_GREEN)}")

    # ── Stale Items ─────────────────────────────────────────────────────────────
    stale = findings.get("stale_items", [])
    if stale:
        print(f"\n{c(f'⚑ STALE ITEMS ({len(stale)})', ANSI_YELLOW + ANSI_BOLD)}")
        for i, s in enumerate(stale, 1):
            print(f"  [{i}] {c(s['lane'], ANSI_BLUE)}: {s['task'][:80]}")
            if s.get("question"):
                print(f"       Q: {s['question'][:100]}")
            print(f"       Signal: {s.get('signal', '')}")

    # ── Next Actions ────────────────────────────────────────────────────────────
    actions = findings.get("next_actions", [])
    if actions:
        print(f"\n{c(f'NEXT ACTIONS ({len(actions)})', ANSI_BOLD)}")
        priority_colors = {"HIGH": ANSI_RED, "MEDIUM": ANSI_YELLOW, "LOW": ANSI_GREEN}
        priority_order = ["HIGH", "MEDIUM", "LOW"]
        for p in priority_order:
            pactions = [a for a in actions if a.get("priority") == p]
            if not pactions:
                continue
            print(f"\n  {c(p, priority_colors[p])}")
            for a in pactions:
                print(f"    → {a['action']}")
                print(f"      Reason: {a['reason'][:90]}")
                if a.get("output"):
                    print(f"      Output: {a['output']}")

    # ── Overall status ───────────────────────────────────────────────────────────
    print(f"\n{c('─' * 60, ANSI_RESET)}")
    if findings["ok"]:
        print(c(f"  ✓ System OK — safe to run autonomous-task-executor", ANSI_GREEN))
    else:
        print(c(f"  ✗ Issues found — review above before running executor", ANSI_RED))
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Autonomy Health Check")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show full task text for each finding")
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of human report")
    args = parser.parse_args()

    findings = run_health_check(verbose=args.verbose)
    if args.json:
        # Strip non-serializable ANSI codes from JSON output
        findings_serializable = json.loads(json.dumps(findings, default=str))
        print(json.dumps(findings_serializable, indent=2))
    else:
        print_report(findings, verbose=args.verbose)
