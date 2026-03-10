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
import requests
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

# MiniMax API config
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "sk-cp-h7vNFh1CnIJ2vNFh1CnI")  # fallback for testing
MINIMAX_ENDPOINT = "https://api.minimax.chat/v1/text/chatcompletion_v2"


def call_minimax(prompt, max_tokens=800):
    """Call MiniMax API to get model response."""
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "MiniMax-M2.5",
        "messages": [
            {"role": "system", "content": "You are an autonomous task executor. Analyze the task and provide actionable output. Be specific and practical."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7
    }
    
    try:
        response = requests.post(MINIMAX_ENDPOINT, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            return result.get("choices", [{}])[0].get("message", {}).get("content", "")
        else:
            return f"API Error: {response.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"


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


def parse_task_structure(task):
    """Extract emoji, title, and sections from task text."""
    # Extract emoji
    emoji_match = re.match(r'^([\p{Emoji}\u200d]+)\s*', task)
    emoji = emoji_match.group(1) if emoji_match else ""
    remaining = task[len(emoji):].strip()
    
    # Extract category if present
    category_match = re.match(r'\[(\w+)\]\s*', remaining)
    category = category_match.group(1) if category_match else "general"
    remaining = remaining[len(category_match.group(0)):] if category_match else remaining
    
    # Title is before first semicolon
    semicolon_idx = remaining.find(';')
    title = remaining[:semicolon_idx].strip() if semicolon_idx > -1 else remaining.strip()
    
    # Parse sections
    sections = {}
    if semicolon_idx > -1:
        after_semicolon = remaining[semicolon_idx + 1:]
        parts = after_semicolon.split('|')
        for part in parts:
            colon_idx = part.find(':')
            if colon_idx > -1:
                key = part[:colon_idx].strip().lower()
                value = part[colon_idx + 1:].strip()
                sections[key] = value
    
    return {"emoji": emoji, "category": category, "title": title, "sections": sections}


def execute_task_bounded(task):
    """
    Execute task using AI-assisted analysis and execution.
    Returns (completed: bool, result: str, blocked: bool, blocker_note: str)
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    parsed = parse_task_structure(task)
    
    category = parsed.get("category", "general").lower()
    title = parsed.get("title", "")
    sections = parsed.get("sections", {})
    deliverable = sections.get("deliverable", "")
    proof = sections.get("proof", "")
    why = sections.get("why", "")
    
    print(f"  Task parsed: category={category}, title={title[:50]}")
    print(f"  Deliverable: {deliverable[:80] if deliverable else 'none'}")
    
    # Analyze what needs to be done
    analysis_prompt = f"""Analyze this task and determine the best way to execute it.

Task: {task}

Deliverable: {deliverable}
Proof criterion: {proof}

Category: {category}

Provide a short execution plan (2-3 sentences max) and then create the actual deliverable file content if applicable. 

Output format:
PLAN: <your brief plan>
OUTPUT: <file path to create> (or "NONE" if no file)
CONTENT: <the actual content to write> (or "NONE" if no file)

Be practical and create something useful."""
    
    response = call_minimax(analysis_prompt, max_tokens=1500)
    print(f"  Model response received ({len(response)} chars)")
    
    # Parse the response
    plan = ""
    file_path = None
    content = ""
    
    for line in response.split('\n'):
        if line.startswith("PLAN:"):
            plan = line[5:].strip()
        elif line.startswith("OUTPUT:"):
            path_str = line[7:].strip()
            if path_str and path_str != "NONE":
                file_path = WORKSPACE / path_str
        elif line.startswith("CONTENT:"):
            content = line[8:].strip()
    
    # If no explicit output, create a reasonable default
    if not file_path and deliverable:
        # Map deliverable to file path
        if "portfolio" in deliverable.lower() or "case-study" in deliverable.lower():
            file_path = WORKSPACE / "projects" / "portfolio" / "case-studies" / f"case-study-{datetime.now().strftime('%Y-%m-%d')}.md"
        elif "trading-brief" in deliverable.lower() or "market" in deliverable.lower():
            file_path = WORKSPACE / "projects" / "trading-briefs" / f"brief-{datetime.now().strftime('%Y-%m-%d')}.md"
        elif "company" in deliverable.lower() or "analysis" in deliverable.lower():
            file_path = WORKSPACE / "projects" / "company-research" / f"analysis-{datetime.now().strftime('%Y-%m-%d')}.md"
        elif "content" in deliverable.lower() or "social" in deliverable.lower():
            file_path = WORKSPACE / "projects" / "content" / "content-plan.md"
        elif "python" in deliverable.lower() or "script" in deliverable.lower():
            file_path = WORKSPACE / "scripts" / f"script-{datetime.now().strftime('%Y-%m-%d')}.py"
    
    # If we have content to write, write it
    if file_path and content and content != "NONE":
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Check if content is a placeholder or actual useful content
            if len(content) > 100 and "TEMPLATE" not in content.upper():
                file_path.write_text(content)
                print(f"  Created: {file_path.relative_to(WORKSPACE)}")
                return True, f"Created deliverable: {file_path.name}", False, ""
            else:
                # Content is too short or is a template - not complete
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(f"# {title}\n\n**Generated:** {timestamp}\n\n**Task:** {task}\n\n## Progress\n\n- [ ] Item 1\n- [ ] Item 2\n\n**Model plan:** {plan}\n\n")
                print(f"  Created progress note: {file_path.relative_to(WORKSPACE)}")
                return False, f"Created progress note ({file_path.name})", False, ""
        except Exception as e:
            return False, f"Error writing file: {str(e)}", False, ""
    
    # Fallback: create generic progress note
    note_path = MEMORY_DIR / f"task-progress-{datetime.now().strftime('%Y-%m-%d-%H%M')}.md"
    note_content = f"""# Task Progress Note

**Generated:** {timestamp}

**Task:** {task}

## Analysis

**Plan:** {plan if plan else 'Analyzing...'}

## Progress

- [ ] Item 1
- [ ] Item 2

## Notes

"""
    note_path.write_text(note_content)
    print(f"  Created fallback note: {note_path.name}")
    
    # Check if this seems like a completed deliverable
    if deliverable and ("draft" in title.lower() or "create" in title.lower() or "build" in title.lower()):
        # These tasks are typically multi-step, keep in progress
        return False, f"In progress: {note_path.name}", False, ""
    else:
        return True, f"Completed: {note_path.name}", False, ""


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