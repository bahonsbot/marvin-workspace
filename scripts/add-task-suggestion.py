#!/usr/bin/env python3
"""Add a Philippe suggestion and place it at the top of the Open Backlog.

Usage:
  python3 scripts/add-task-suggestion.py "<task text>"

Behavior:
- stores the suggestion in memory/task-suggestions.json
- inserts the suggestion at the top of AUTONOMOUS.md Open Backlog
- syncs autonomous-kanban board.json
"""

import json
import re
import shlex
import subprocess
import sys
from datetime import datetime
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
SUGGESTIONS_FILE = WORKSPACE / "memory" / "task-suggestions.json"
SYNC_SCRIPT = WORKSPACE / "projects" / "autonomous-kanban" / "scripts" / "sync-board.js"


def load_suggestions():
    if not SUGGESTIONS_FILE.exists():
        return []
    try:
        data = json.loads(SUGGESTIONS_FILE.read_text())
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_suggestions(items):
    SUGGESTIONS_FILE.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n")


def parse_flag_payload(text):
    try:
        tokens = shlex.split(text)
    except ValueError:
        return None

    if not tokens or not tokens[0].startswith("--"):
        return None

    fields = {}
    current = None

    for token in tokens:
        if token.startswith("--"):
            current = token[2:]
            if current:
                fields.setdefault(current, [])
            continue
        if current:
            fields[current].append(token)

    title = " ".join(fields.get("title", [])).strip()
    description = " ".join(fields.get("description", [])).strip()

    if title and description:
        return title, description
    return None


def normalize_task(raw):
    text = raw.strip()
    if not text:
        raise ValueError("Empty suggestion")

    parsed = parse_flag_payload(text) if text.startswith("--") else None
    if parsed:
        title, description = parsed
        return f"[Philippe] 📝 Suggested: {title}\n**Brief:** {description}"

    if text.startswith("["):
        return text

    return (
        f"[Philippe] 📝 Suggested: {text} | "
        f"Why: Philippe-prioritized task suggestion | "
        f"Proof: Task outcome or deliverable is clear from the task text | "
        f"Unlocks: Direct progress on Philippe's chosen priority"
    )


def insert_at_top_of_backlog(task):
    content = AUTONOMOUS_FILE.read_text()
    pattern = r"(## Open Backlog\s*\n\n)(.*?)(?=\n##|\Z)"
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        raise RuntimeError("Open Backlog section not found")

    existing_block = match.group(2)
    existing_lines = [line for line in existing_block.splitlines() if line.strip()]
    existing_tasks = [line for line in existing_lines if line.startswith("- ")]
    existing_texts = [line[2:] for line in existing_tasks]

    if task in existing_texts:
        return False

    new_block_lines = [f"- {task}"] + existing_tasks
    new_block = "\n".join(new_block_lines) + "\n"
    new_content = content[:match.start(2)] + new_block + content[match.end(2):]
    AUTONOMOUS_FILE.write_text(new_content)
    return True


def sync_board():
    if not SYNC_SCRIPT.exists():
        print(f"[WARN] Kanban sync script not found: {SYNC_SCRIPT}", file=sys.stderr)
        return
    result = subprocess.run(["node", str(SYNC_SCRIPT)], cwd=WORKSPACE)
    if result.returncode != 0:
        print(f"[WARN] Kanban sync failed with exit code {result.returncode}", file=sys.stderr)


def main():
    if len(sys.argv) < 2:
        print("Usage: add-task-suggestion.py \"<task text>\"", file=sys.stderr)
        sys.exit(2)

    raw = " ".join(sys.argv[1:])
    task = normalize_task(raw)
    suggestions = load_suggestions()

    for item in suggestions:
        if item.get("task") == task and item.get("status") in {"suggested", "promoted"}:
            inserted = insert_at_top_of_backlog(task)
            if inserted:
                sync_board()
            print(json.dumps({"status": "already_exists", "task": task, "inserted": inserted}, ensure_ascii=False))
            return

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    suggestions.insert(0, {
        "task": task,
        "source": "Philippe",
        "status": "promoted",
        "createdAt": now,
        "promoteNext": True,
    })
    save_suggestions(suggestions)

    inserted = insert_at_top_of_backlog(task)
    sync_board()
    print(json.dumps({"status": "added", "task": task, "inserted": inserted}, ensure_ascii=False))


if __name__ == "__main__":
    main()
