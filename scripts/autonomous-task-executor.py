#!/usr/bin/env python3
"""
Autonomous Task Executor - Proactively executes tasks from the Open Backlog.

Behavior per run:
- Read AUTONOMOUS.md Open Backlog and In Progress
- Select one highest-value autonomous task using simple scoring heuristic
- Move selected task to In Progress (if from Open Backlog)
- Execute one bounded work chunk
- Record result line in memory/tasks-log.md with timestamp and outcome
- If completed, move to Done; if blocked, keep in In Progress with blocker note

Safety Constraints:
- NEVER sends emails, posts comments, or performs other communication in Philippe's name
  UNLESS explicitly asked to do so by Philippe
- Operations should be idempotent-ish to avoid duplicate spam
- For external/public actions beyond communication (e.g., code commits, file uploads), 
  executor can proceed autonomously if it helps advance the goal
"""

import os
import re
import subprocess
import json
from datetime import datetime
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
TASKS_LOG_FILE = WORKSPACE / "memory" / "tasks-log.md"
MEMORY_DIR = WORKSPACE / "memory"

# Ensure memory directory exists
TASKS_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Executor constants
EXECUTION_LOG_FILE = WORKSPACE / "memory" / "executor-log.md"


def read_autonomous_file():
    """Read AUTONOMOUS.md and extract Open Backlog and In Progress tasks."""
    if not AUTONOMOUS_FILE.exists():
        return [], []
    
    content = AUTONOMOUS_FILE.read_text()
    
    open_backlog = []
    in_progress = []
    
    # Find Open Backlog section
    in_open = False
    in_progress_section = False
    
    for line in content.split('\n'):
        # Detect section headers
        if line.strip() == "## Open Backlog":
            in_open = True
            in_progress_section = False
            continue
        elif line.strip() == "## In Progress":
            in_open = False
            in_progress_section = True
            continue
        elif line.startswith("## "):
            in_open = False
            in_progress_section = False
        
        # Extract task items
        if line.strip().startswith("- "):
            task = line.strip()[2:]
            if in_open:
                open_backlog.append(task)
            elif in_progress_section:
                in_progress.append(task)
    
    return open_backlog, in_progress


def score_task(task, in_progress_tasks):
    """
    Simple scoring heuristic to pick highest-value task.
    
    Scoring factors:
    - Has clear deliverable (+2)
    - Has success criterion (+2)
    - Not recently in progress (+1)
    - Has action verb (+1)
    """
    score = 0
    task_lower = task.lower()
    
    # Has deliverable (deliverable, output, create, build, etc.)
    if 'deliverable' in task_lower or 'output' in task_lower or 'create' in task_lower:
        score += 2
    
    # Has success criterion
    if 'success:' in task_lower or 'success criterion' in task_lower:
        score += 2
    
    # Has action verb at start
    action_verbs = ['build', 'create', 'analyze', 'draft', 'design', 'fix', 'complete', 'execute']
    if any(task_lower.startswith(v) for v in action_verbs):
        score += 1
    
    # Not already in progress (check by partial match)
    for ip in in_progress_tasks:
        if task[:50] in ip[:50]:  # Similar task already in progress
            score -= 3
    
    return score


def select_task(open_backlog, in_progress_tasks):
    """Select the highest-value task from Open Backlog."""
    if not open_backlog:
        return None, None
    
    # Score all tasks
    scored = []
    for task in open_backlog:
        score = score_task(task, in_progress_tasks)
        scored.append((score, task))
    
    # Sort by score (descending), then by age (prefer older tasks)
    scored.sort(key=lambda x: (-x[0], x[1]))
    
    return scored[0][1], scored[0][0]


def move_to_in_progress(task, content):
    """Move task from Open Backlog to In Progress."""
    # Remove from Open Backlog
    content = re.sub(rf'^- {re.escape(task)}\n', '', content, flags=re.MULTILINE)
    
    # Add to In Progress section
    in_progress_marker = "## In Progress"
    if in_progress_marker in content:
        # Find the section and add after header
        pattern = rf'({re.escape(in_progress_marker)}\s*\n)'
        replacement = rf'\1- {task}\n'
        content = re.sub(pattern, replacement, content)
    else:
        # Create In Progress section before Open Backlog
        content = content.replace("## Open Backlog", f"## In Progress\n\n- {task}\n\n## Open Backlog")
    
    return content


def move_to_done(task, content):
    """Move task from In Progress to Done (or remove if no Done section)."""
    # Remove from In Progress
    content = re.sub(rf'^- {re.escape(task)}\n', '', content, flags=re.MULTILINE)
    
    return content


def log_execution(task, outcome, details=""):
    """Log executor action to execution log."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    log_entry = f"## {timestamp}\n"
    log_entry += f"- Task: {task[:100]}...\n"
    log_entry += f"- Outcome: {outcome}\n"
    if details:
        log_entry += f"- Details: {details}\n"
    log_entry += "\n"
    
    if EXECUTION_LOG_FILE.exists():
        existing = EXECUTION_LOG_FILE.read_text()
    else:
        existing = "# Autonomous Task Executor Log\n\n**Internal execution log.** Records task selection and outcomes.\n\n---\n\n"
    
    EXECUTION_LOG_FILE.write_text(existing + log_entry)


def log_completed_task(task, category="general"):
    """Append completed task to tasks-log.md with ✅."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # Extract category from task if present
    cat_match = re.match(r'\[(\w+)\]', task)
    if cat_match:
        category = cat_match.group(1)
    
    log_entry = f"- ✅ [{timestamp}] [{category}] {task}\n"
    
    if TASKS_LOG_FILE.exists():
        existing = TASKS_LOG_FILE.read_text()
    else:
        existing = "# Completed Tasks Log\n\n**Append-only.** Sub-agents: Only add new lines at the bottom. Never edit existing lines.\n\n---\n\n"
    
    TASKS_LOG_FILE.write_text(existing + log_entry)


def execute_task_bounded(task):
    """
    Execute one bounded work chunk on the task.
    
    This is a SAFE bounded execution - only internal workspace actions.
    Returns (completed: bool, result: str, blocked: bool, blocker_note: str)
    
    The executor does NOT make external calls. It performs analysis and
    creates output files that can be reviewed later.
    """
    task_lower = task.lower()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # Analyze task type and create appropriate output
    if 'portfolio' in task_lower:
        # Create portfolio progress note
        note = f"# Portfolio Work Note\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Progress\n\n- [ ] Item 1\n- [ ] Item 2\n\n## Notes\n\n"
        output_file = MEMORY_DIR / "portfolio-progress.md"
        output_file.write_text(note)
        return False, f"Created progress note at {output_file.name}", False, ""
    
    elif 'python' in task_lower or 'programming' in task_lower:
        # Create coding practice note
        note = f"# Coding Practice Note\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Practice\n\n```python\n# Practice code here\n```\n\n"
        output_file = MEMORY_DIR / "coding-practice.md"
        output_file.write_text(note)
        return False, f"Created coding note at {output_file.name}", False, ""
    
    elif 'trading' in task_lower or 'equity' in task_lower or 'futures' in task_lower:
        # Create trading journal note
        note = f"# Trading Journal Note\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Trade Entry\n\n- Setup:\n- Entry:\n- Exit:\n- P&L:\n\n## Lesson\n\n"
        output_file = MEMORY_DIR / "trading-journal.md"
        output_file.write_text(note)
        return False, f"Created journal note at {output_file.name}", False, ""
    
    elif 'blender' in task_lower or 'after effects' in task_lower or 'unreal' in task_lower:
        # Create creative work note
        note = f"# Creative Practice Note\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Session\n\n- Technique:\n- Duration:\n- Output:\n\n"
        output_file = MEMORY_DIR / "creative-practice.md"
        output_file.write_text(note)
        return False, f"Created practice note at {output_file.name}", False, ""
    
    elif 'automate' in task_lower or 'openclaw' in task_lower or 'optimize' in task_lower:
        # Create optimization analysis note
        note = f"# Optimization Analysis\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Finding\n\n- Area:\n- Current state:\n- Proposed fix:\n- Impact:\n\n"
        output_file = MEMORY_DIR / "optimization-analysis.md"
        output_file.write_text(note)
        return False, f"Created analysis at {output_file.name}", False, ""
    
    else:
        # Generic: create a work note
        note = f"# Work Note\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Notes\n\n"
        output_file = MEMORY_DIR / "work-note.md"
        output_file.write_text(note)
        return False, f"Created work note at {output_file.name}", False, ""


def run_executor():
    """Main executor loop - runs once per cron invocation."""
    
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Starting autonomous task executor...")
    
    # Read current state
    if not AUTONOMOUS_FILE.exists():
        print("ERROR: AUTONOMOUS.md not found")
        return
    
    content = AUTONOMOUS_FILE.read_text()
    open_backlog, in_progress = read_autonomous_file()
    
    print(f"Open Backlog: {len(open_backlog)} tasks")
    print(f"In Progress: {len(in_progress)} tasks")
    
    # Select highest-value task from Open Backlog
    selected_task, score = select_task(open_backlog, in_progress)
    
    if not selected_task:
        print("No tasks available in Open Backlog")
        log_execution("none", "skipped", "No tasks in Open Backlog")
        return
    
    print(f"Selected task (score={score}): {selected_task[:80]}...")
    
    # Check if task is already in progress
    was_in_progress = selected_task in in_progress
    
    if not was_in_progress:
        # Move from Open Backlog to In Progress
        content = move_to_in_progress(selected_task, content)
        AUTONOMOUS_FILE.write_text(content)
        print(f"Moved task to In Progress")
    
    # Execute bounded work chunk
    completed, result, blocked, blocker_note = execute_task_bounded(selected_task)
    
    print(f"Execution result: {result}")
    
    if completed:
        # Log as completed
        log_completed_task(selected_task, "autonomous")
        
        # Remove from In Progress
        content = AUTONOMOUS_FILE.read_text()
        content = move_to_done(selected_task, content)
        AUTONOMOUS_FILE.write_text(content)
        
        log_execution(selected_task, "completed", result)
        print(f"Task completed and logged")
    
    elif blocked:
        # Keep in In Progress with blocker note
        log_execution(selected_task, "blocked", blocker_note)
        print(f"Task blocked: {blocker_note}")
    
    else:
        # In progress - task has work to continue
        log_execution(selected_task, "in_progress", result)
        print(f"Task work chunk complete, remains in In Progress")
    
    print("Executor run complete")


if __name__ == "__main__":
    run_executor()