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
import uuid
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
LAST_RESULT_FILE = WORKSPACE / "memory" / "executor-last-result.json"

# Sub-agent session storage
SESSIONS_FILE = WORKSPACE / "memory" / "executor-sessions.json"

# Kanban board sync
KANBAN_DIR = WORKSPACE / "projects" / "autonomous-kanban"
KANBAN_BOARD_FILE = KANBAN_DIR / "public" / "board.json"


def sync_kanban_board():
    """Sync AUTONOMOUS.md sections to Kanban board.json with deterministic IDs."""

    autonomous_file = WORKSPACE / "AUTONOMOUS.md"
    if not autonomous_file.exists():
        return False

    content = autonomous_file.read_text()

    sections = {}
    current_section = None
    for line in content.split('\n'):
        if line.strip().startswith("## "):
            current_section = line.strip()[2:].lower().replace(" ", "")
            sections[current_section] = []
        elif line.strip().startswith("- ") and current_section:
            text = line.strip()[2:]
            if text and not text.startswith("*("):
                sections[current_section].append(text)

    def make_task(text, column):
        tid = uuid.uuid5(uuid.NAMESPACE_URL, f"{column}:{text}").hex[:8]
        return {"id": tid, "text": text, "column": column}

    board = {
        "todo": [make_task(t, "todo") for t in sections.get("openbacklog", [])],
        "inprogress": [make_task(t, "inprogress") for t in sections.get("inprogress", [])],
        "done": [make_task(t, "done") for t in sections.get("done", [])]
    }

    board_data = {
        "board": board,
        "updatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    }
    KANBAN_BOARD_FILE.parent.mkdir(parents=True, exist_ok=True)
    KANBAN_BOARD_FILE.write_text(json.dumps(board_data, indent=2))
    print(f"  Synced Kanban board: {len(board['todo'])} todo, {len(board['inprogress'])} in progress, {len(board['done'])} done")
    return True


def publish_kanban_board_if_changed():
    """Commit and push board snapshot so GitHub Pages reflects executor state."""
    if not KANBAN_BOARD_FILE.exists():
        print("  Kanban publish skipped: board.json not found")
        return

    rel_board = str(KANBAN_BOARD_FILE.relative_to(WORKSPACE))
    diff = subprocess.run(
        ["git", "diff", "--quiet", "--", rel_board],
        cwd=WORKSPACE,
        capture_output=True,
        text=True,
    )

    if diff.returncode == 0:
        print("  Kanban publish skipped: board.json unchanged")
        return

    branch = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=WORKSPACE,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    message = f"chore(kanban): sync board snapshot ({datetime.now().strftime('%Y-%m-%d %H:%M')})"

    try:
        subprocess.run(["git", "add", rel_board], cwd=WORKSPACE, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=WORKSPACE, check=True)
        subprocess.run(["git", "push", "origin", branch], cwd=WORKSPACE, check=True)
        print(f"  Published kanban board to origin/{branch}")
    except subprocess.CalledProcessError as exc:
        print(f"  Kanban publish failed: {exc}")


def load_sessions():
    """Load active sub-agent sessions."""
    if SESSIONS_FILE.exists():
        return json.loads(SESSIONS_FILE.read_text())
    return {}


def save_sessions(sessions):
    """Save sub-agent sessions."""
    SESSIONS_FILE.write_text(json.dumps(sessions, indent=2))


def spawn_subagent(task, task_type="general"):
    """
    Build a sub-agent instruction payload for this task.
    Runtime spawning happens outside this script via OpenClaw tools.
    """
    sessions = load_sessions()

    # Generate a unique label for this task
    label = f"executor-{task_type}-{datetime.now().strftime('%Y%m%d%H%M')}"
    
    # Parse task for context
    parsed = parse_task_structure(task)
    category = parsed.get("category", "general").lower()
    title = parsed.get("title", "")
    sections = parsed.get("sections", {})
    deliverable = sections.get("deliverable", "")
    proof = sections.get("proof", "")
    why = sections.get("why", "")
    
    # Build instruction based on task type
    if "portfolio" in deliverable.lower() or "case-study" in deliverable.lower():
        instruction = f"""Execute this task: {title}

Deliverable: {deliverable}
Proof: {proof}

Create a complete case study in projects/portfolio/case-studies/. Include:
- The Problem (what challenge you addressed)
- The Approach (your methodology)
- The Result (outcomes and impact)
- What I Learned (key insights)

Write actual content, not templates. This is for a portfolio."""
        
    elif "trading" in deliverable.lower() or "market" in deliverable.lower() or "brief" in deliverable.lower():
        instruction = f"""Execute this task: {title}

Deliverable: {deliverable}
Proof: {proof}

Create a trading brief in projects/trading-briefs/. Include:
- 2+ specific setups with entry, invalidation, risk, and thesis
- Current market context if relevant
- Specific price levels where possible

Write actual analysis, not templates."""
        
    elif "company" in deliverable.lower() or "analysis" in deliverable.lower():
        instruction = f"""Execute this task: {title}

Deliverable: {deliverable}
Proof: {proof}

Create a company analysis in projects/company-research/. Include:
- Investment thesis (bull case)
- Key risks (3+)
- Important metrics (revenue, growth, margins, debt)
- Conclusion with recommendation

Research a real company if possible, or create a template with realistic structure."""
        
    elif "content" in deliverable.lower() or "social" in deliverable.lower() or "instagram" in deliverable.lower():
        instruction = f"""Execute this task: {title}

Deliverable: {deliverable}
Proof: {proof}

Create a content plan in projects/content/. Include:
- 3 content ideas with hooks
- Format suggestions (reel/post/story)
- Specific posting times
- Platform-specific tips

Write actual content ideas, not placeholders."""
        
    elif "python" in deliverable.lower() or "script" in deliverable.lower() or "build" in deliverable.lower():
        instruction = f"""Execute this task: {title}

Deliverable: {deliverable}
Proof: {proof}

Create working code in scripts/. Include:
- Working Python script with actual logic
- Comments explaining what it does
- Example usage if relevant

Write actual code, not templates."""
        
    else:
        instruction = f"""Execute this task: {title}

Deliverable: {deliverable}
Proof: {proof}

Create the deliverable in the appropriate location within {WORKSPACE}.

Be practical and create something useful."""
    
    return label, instruction

# MiniMax API config (currently unused - pattern-based execution active)
# To enable AI-assisted execution, add MINIMAX_API_KEY to environment


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


def move_to_open_backlog(task, content):
    """Move task from In Progress back to Open Backlog."""
    content = re.sub(rf'^- {re.escape(task)}\n', '', content, flags=re.MULTILINE)
    marker = "## Open Backlog"
    if marker in content:
        content = re.sub(rf'({re.escape(marker)}\s*\n)', rf'\1- {task}\n', content)
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


def log_completed_task(task, output_path, category="general"):
    """Append completed task to tasks-log.md with ✅ and verified output path."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    cat_match = re.match(r'\[(\w+)\]', task)
    if cat_match:
        category = cat_match.group(1)

    rel_output = str(Path(output_path).relative_to(WORKSPACE)) if output_path else ""
    log_entry = f"- ✅ [{timestamp}] [{category}] {task} | Output: {rel_output}\n"

    if TASKS_LOG_FILE.exists():
        existing = TASKS_LOG_FILE.read_text()
    else:
        existing = "# Completed Tasks Log\n\n**Append-only.** Sub-agents: Only add new lines at the bottom. Never edit existing lines.\n\n---\n\n"

    TASKS_LOG_FILE.write_text(existing + log_entry)


def parse_task_structure(task):
    """Extract emoji, title, and sections from task text."""
    # Extract emoji (simple approach - find leading emoji characters)
    emoji = ""
    remaining = task
    
    # Try simple emoji extraction at start
    emoji_chars = []
    for char in task:
        if ord(char) > 127000 or char in "🎨📝🚀🔨🤖💡📋🔓✅❌🎵🦞":
            emoji_chars.append(char)
        else:
            break
    
    if emoji_chars:
        emoji = "".join(emoji_chars)
        remaining = task[len(emoji):].strip()
    else:
        remaining = task
    
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


def task_requires_subagent(parsed):
    """Return True for rich deliverables that should be delegated, not stubbed."""
    title = parsed.get("title", "").lower()
    deliverable = parsed.get("sections", {}).get("deliverable", "").lower()
    combined = f"{title} | {deliverable}"

    subagent_signals = [
        "portfolio", "case-study", "case study", "content plan", "social media",
        "instagram", "motion design", "mp4", "caption", "analysis", "company",
        "trading brief", "market setup", "deck", "markdown deck", "research",
        "draft", "creative mvp"
    ]

    direct_signals = ["python", "script", "automation", "workflow"]

    if any(sig in combined for sig in direct_signals):
        return False
    return any(sig in combined for sig in subagent_signals)


def queue_subagent_task(task, parsed):
    """Append task to sub-agent queue if not already pending."""
    queue_file = MEMORY_DIR / "executor-subagent-queue.json"
    queue = []
    if queue_file.exists():
        try:
            queue = json.loads(queue_file.read_text())
        except json.JSONDecodeError:
            queue = []

    for entry in queue:
        if entry.get("task") == task and entry.get("status") in {"pending", "spawned"}:
            return queue_file, False

    label, instruction = spawn_subagent(task, parsed.get("category", "general"))
    queue.append({
        "task": task,
        "parsed": parsed,
        "label": label,
        "instruction": instruction,
        "queuedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "status": "pending"
    })
    queue_file.write_text(json.dumps(queue, indent=2))
    return queue_file, True


def is_substantial_completion(parsed, file_path, content):
    """Only mark done when the promised artifact exists and is more than a placeholder."""
    if not file_path or not Path(file_path).exists():
        return False

    title = parsed.get("title", "").lower()
    deliverable = parsed.get("sections", {}).get("deliverable", "").lower()
    blob = content.lower()

    placeholder_markers = [
        "[describe",
        "[explain",
        "[document",
        "[brief",
        "[additional",
        "[tbd]",
        "todo:",
        "todo ",
        "*this is an ai-generated draft",
    ]
    if any(marker in blob for marker in placeholder_markers):
        return False

    if str(file_path).endswith(".py"):
        try:
            proc = subprocess.run(["python3", str(file_path)], cwd=WORKSPACE, capture_output=True, text=True, timeout=20)
            return proc.returncode == 0 and "TODO" not in content and len(content.strip().splitlines()) >= 8
        except Exception:
            return False

    if any(key in title or key in deliverable for key in ["analysis", "brief", "case-study", "content", "deck"]):
        return len(content.strip()) >= 400 and "##" in content

    return False


def write_last_result(task, outcome, details="", output_path=""):
    payload = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "task": task,
        "outcome": outcome,
        "details": details,
        "output_path": str(Path(output_path).relative_to(WORKSPACE)) if output_path else "",
        "completed": outcome == "completed",
    }
    LAST_RESULT_FILE.write_text(json.dumps(payload, indent=2))


def execute_task_bounded(task):
    """
    Execute task - attempts pattern-based first, falls back to marking for sub-agent.
    Returns (completed: bool, result: str, blocked: bool, blocker_note: str, output_path: str)
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
    
    if task_requires_subagent(parsed):
        queue_file, added = queue_subagent_task(task, parsed)
        note = "Queued for sub-agent execution" if added else "Already queued for sub-agent execution"
        return False, note, True, note, str(queue_file)

    # Simple tasks - execute directly (pattern-based)
    if "python" in deliverable.lower() or "script" in deliverable.lower() or "automation" in deliverable.lower():
        # Create a Python script
        file_path = WORKSPACE / "scripts" / f"auto-generated-{datetime.now().strftime('%Y%m%d%H%M')}.py"
        script_name = file_path.name.replace(".py", "")
        content = f'''#!/usr/bin/env python3
"""
Auto-generated script
Task: {title}
Created: {timestamp}
"""

def main():
    print("Hello from {script_name}!")
    # TODO: Implement actual logic based on task requirements

if __name__ == "__main__":
    main()
'''
        print(f"  Creating Python script: {file_path.name}")
        
    elif "portfolio" in deliverable.lower() or "case-study" in deliverable.lower():
        # Create a case study draft
        file_path = WORKSPACE / "projects" / "portfolio" / "case-studies" / f"case-study-{datetime.now().strftime('%Y-%m-%d')}.md"
        content = f'''# Case Study Draft

**Generated:** {timestamp}
**Task:** {title}

## The Problem

[Describe the challenge or problem you addressed]

## The Approach

[Explain your methodology and key steps]

## The Result

[Document outcomes and impact]

## What I Learned

[Key insights from this work]

---
*This is an AI-generated draft. Review and expand before use.*
'''
        print(f"  Creating case study: {file_path.name}")
        
    elif "trading" in deliverable.lower() or "market" in deliverable.lower() or "brief" in deliverable.lower():
        # Create a trading brief
        file_path = WORKSPACE / "projects" / "trading-briefs" / f"brief-{datetime.now().strftime('%Y-%m-%d')}.md"
        content = f'''# Trading Brief

**Generated:** {timestamp}
**Task:** {title}

## Setup 1: [Name]

- **Entry:** [Price level]
- **Invalidation:** [Stop level]
- **Risk:** [Position size / $ risk]
- **Thesis:** [Why this setup makes sense]

## Setup 2: [Name]

- **Entry:** [Price level]
- **Invalidation:** [Stop level]
- **Risk:** [Position size / $ risk]
- **Thesis:** [Why this setup makes sense]

## Notes

[Additional context and observations]

---
*This is an AI-generated draft. Verify with market data before trading.*
'''
        print(f"  Creating trading brief: {file_path.name}")
        
    elif "company" in deliverable.lower() or "analysis" in deliverable.lower():
        # Create company analysis
        file_path = WORKSPACE / "projects" / "company-research" / f"analysis-{datetime.now().strftime('%Y-%m-%d')}.md"
        content = f'''# Company Analysis

**Generated:** {timestamp}
**Task:** {title}

## Thesis

[Brief investment thesis - bull case]

## Risks

- Risk 1
- Risk 2
- Risk 3

## Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Revenue | [TBD] | |
| Growth | [TBD] | |
| Margins | [TBD] | |
| Debt | [TBD] | |

## Conclusion

[Summary and recommendation]

---
*This is an AI-generated draft. Complete with actual research.*
'''
        print(f"  Creating company analysis: {file_path.name}")
        
    elif "content" in deliverable.lower() or "social" in deliverable.lower() or "instagram" in deliverable.lower():
        # Create content plan
        file_path = WORKSPACE / "projects" / "content" / f"content-plan-{datetime.now().strftime('%Y-%m-%d')}.md"
        content = f'''# Content Plan

**Generated:** {timestamp}
**Task:** {title}

## Ideas

### Idea 1: [Hook]
- **Format:** [Reel/Post/Story]
- **Topic:** [Subject]
- **Posting slot:** [Day & Time]

### Idea 2: [Hook]
- **Format:** [Reel/Post/Story]
- **Topic:** [Subject]
- **Posting slot:** [Day & Time]

### Idea 3: [Hook]
- **Format:** [Reel/Post/Story]
- **Topic:** [Subject]
- **Posting slot:** [Day & Time]

## Notes

[Additional content strategy notes]

---
*This is an AI-generated draft. Expand with specific content.*
'''
        print(f"  Creating content plan: {file_path.name}")
        
    else:
        return False, "No direct executor for this task type", True, "Needs sub-agent or manual routing", ""

    # Write the file
    if file_path:
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content)
            print(f"  SUCCESS: Created {file_path.relative_to(WORKSPACE)}")
            
            if is_substantial_completion(parsed, file_path, content):
                return True, f"Completed: {file_path.name}", False, "", str(file_path)
            return False, f"In progress: {file_path.name}", False, "", str(file_path)

        except Exception as e:
            return False, f"Error: {str(e)}", False, "", ""

    return False, "No deliverable matched", False, "", ""


def run_executor():
    """Main executor loop - runs once per cron invocation."""
    
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Starting autonomous task executor...")
    
    # Read current state
    if not AUTONOMOUS_FILE.exists():
        print("ERROR: AUTONOMOUS.md not found")
        write_last_result("", "error", "AUTONOMOUS.md not found", "")
        return
    
    content = AUTONOMOUS_FILE.read_text()
    open_backlog, in_progress = read_autonomous_file()
    
    print(f"Open Backlog: {len(open_backlog)} tasks")
    print(f"In Progress: {len(in_progress)} tasks")
    
    # Select highest-value task from Open Backlog
    selected_task, score = select_task(open_backlog, in_progress)
    
    if not selected_task:
        print("No tasks available in Open Backlog")
        write_last_result("", "skipped", "No tasks in Open Backlog", "")
        log_execution("none", "skipped", "No tasks in Open Backlog")
        return
    
    print(f"Selected task (score={score}): {selected_task[:80]}...")
    
    # Check if task is already in progress
    was_in_progress = selected_task in in_progress
    
    if not was_in_progress:
        # Move from Open Backlog to In Progress
        content = move_to_in_progress(selected_task, content)
        AUTONOMOUS_FILE.write_text(content)
        if sync_kanban_board():
            publish_kanban_board_if_changed()
        print(f"Moved task to In Progress")
    
    # Execute bounded work chunk
    completed, result, blocked, blocker_note, output_path = execute_task_bounded(selected_task)
    
    print(f"Execution result: {result}")
    
    if completed:
        # Log as completed
        log_completed_task(selected_task, output_path, "autonomous")
        write_last_result(selected_task, "completed", result, output_path)

        # Remove from In Progress
        content = AUTONOMOUS_FILE.read_text()
        content = move_to_done(selected_task, content)
        AUTONOMOUS_FILE.write_text(content)
        if sync_kanban_board():
            publish_kanban_board_if_changed()

        log_execution(selected_task, "completed", result)
        print(f"Task completed and logged")
    
    elif blocked:
        queued = "sub-agent" in blocker_note.lower() or "subagent" in blocker_note.lower()
        if queued or not output_path:
            content = AUTONOMOUS_FILE.read_text()
            content = move_to_open_backlog(selected_task, content)
            AUTONOMOUS_FILE.write_text(content)
            if sync_kanban_board():
                publish_kanban_board_if_changed()
        outcome = "queued_for_subagent" if queued else "blocked"
        result_path = output_path if (output_path and not queued) else ""
        write_last_result(selected_task, outcome, blocker_note, result_path)
        log_execution(selected_task, outcome, blocker_note)
        print(f"Task blocked: {blocker_note}")

    else:
        if not output_path:
            content = AUTONOMOUS_FILE.read_text()
            content = move_to_open_backlog(selected_task, content)
            AUTONOMOUS_FILE.write_text(content)
            if sync_kanban_board():
                publish_kanban_board_if_changed()
        write_last_result(selected_task, "in_progress", result, output_path)
        log_execution(selected_task, "in_progress", result)
        print(f"Task work chunk complete, remains in In Progress")
    
    print("Executor run complete")


if __name__ == "__main__":
    run_executor()