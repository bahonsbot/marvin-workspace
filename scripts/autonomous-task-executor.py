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
FOLLOWED_COMPANIES_FILE = WORKSPACE / "projects" / "company-research" / "followed-companies.md"
AGENT_TEAM_DIR = WORKSPACE / "projects" / "_ops" / "agent-team"


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

This is a CREATIVE PORTFOLIO task. The output must clearly help Philippe with portfolio presentation, creative positioning, or landing creative roles.

Relevance rules:
1. Prefer creative-relevant source material first.
2. Do NOT default to infra, trading, ops, or backend/system projects unless they can be framed credibly as creative-direction, product storytelling, visual communication, or portfolio-worthy presentation work.
3. Before writing, explicitly check: \"Does this project clearly belong in a creative portfolio?\"
4. If the answer is no, do NOT force a weak match. Mark the task blocked instead of producing an unrelated case study.

Preferred source order:
- existing visual / motion / design / branding / creative-direction work
- portfolio-ready presentation work with a strong visual or storytelling angle
- only then hybrid product/creative work if it can be framed honestly for creative roles

Create a complete case study in projects/portfolio/case-studies/. Include:
- The Problem
- The Approach
- The Result
- What I Learned
- Portfolio Angle
- Target Role Relevance

Write actual content, not templates. If no suitable creative-relevant source project exists, stop and report that it is blocked for lack of an appropriate portfolio source."""
        
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
    Higher-signal task scoring for autonomous selection.

    Intent:
    - prefer clearly scoped build/fix tasks over lightweight learn tasks
    - prefer tasks with explicit deliverables + proof
    - prefer implementation work suitable for agent-team routing
    - avoid selecting duplicates of work already in progress
    """
    score = 0
    task_lower = task.lower()
    parsed = parse_task_structure(task)
    title = parsed.get("title", "").lower()
    sections = parsed.get("sections", {})
    deliverable = sections.get("deliverable", "").lower()
    proof = sections.get("proof", "").lower()
    why = sections.get("why", "").lower()
    combined = f"{task_lower} | {title} | {deliverable} | {proof} | {why}"

    # Strong structure signals
    if 'deliverable:' in task_lower or deliverable:
        score += 3
    if 'proof:' in task_lower or proof:
        score += 3
    if 'unlocks:' in task_lower:
        score += 1

    # Action priority: build/fix beats learn/draft when autonomy can create a real artifact
    if 'build:' in combined or '🔨' in task:
        score += 5
    elif 'fix:' in combined or '🔧' in task:
        score += 4
    elif 'launch:' in combined or '🚀' in task:
        score += 3
    elif 'draft:' in combined or '📝' in task:
        score += 2
    elif 'learn:' in combined or '📚' in task:
        score += 1

    # Prefer implementation-heavy work that benefits from agent-team execution
    execution_mode = classify_execution_mode(task, parsed)
    if execution_mode == 'agent_team':
        score += 4
    elif execution_mode == 'subagent':
        score += 2

    # Reward concrete software/artifact language
    implementation_signals = [
        'working page', 'working tool', 'tool', 'page', 'generator', 'automation',
        'diagnostics', 'reporting', 'workflow', 'utility', 'spec'
    ]
    if any(sig in combined for sig in implementation_signals):
        score += 2

    # De-prioritize duplicate/overlapping work already in progress
    for ip in in_progress_tasks:
        if task[:60] in ip[:60] or ip[:60] in task[:60]:
            score -= 6

    return score


def select_task(open_backlog, in_progress_tasks):
    """Select the highest-value task from Open Backlog, skipping already-satisfied work."""
    if not open_backlog:
        return None, None, []

    scored = []
    skipped_satisfied = []
    for task in open_backlog:
        satisfied, output_paths = task_already_satisfied(task)
        if satisfied:
            skipped_satisfied.append((task, output_paths))
            continue
        score = score_task(task, in_progress_tasks)
        parsed = parse_task_structure(task)
        execution_mode = classify_execution_mode(task, parsed)
        scored.append((score, execution_mode, task))

    if not scored:
        return None, None, skipped_satisfied

    # Sort by score, then prefer agent_team over subagent over direct on ties, then lexical fallback
    mode_rank = {'agent_team': 0, 'subagent': 1, 'direct': 2}
    scored.sort(key=lambda x: (-x[0], mode_rank.get(x[1], 9), x[2]))

    best_score, _best_mode, best_task = scored[0]
    return best_task, best_score, skipped_satisfied


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
    content = re.sub(rf'^- {re.escape(task)}\n', '', content, flags=re.MULTILINE)
    return content


def remove_task_everywhere(task, content):
    """Remove a task from Open Backlog / In Progress / Needs Input style bullet lines."""
    content = re.sub(rf'^- {re.escape(task)}\n', '', content, flags=re.MULTILINE)
    return content


def move_to_needs_input(task, content, question):
    """Move task from Open Backlog/In Progress to Needs Input with a focused blocker question."""
    content = re.sub(rf'^- {re.escape(task)}\n', '', content, flags=re.MULTILINE)

    entry = f"- {task}\n  - Needs input: {question}\n"
    marker = "## Needs Input"
    if marker in content:
        pattern = rf'({re.escape(marker)}\s*\n)'
        content = re.sub(pattern, rf'\1{entry}', content)
    else:
        insert_before = "## Done Today"
        if insert_before in content:
            content = content.replace(insert_before, f"## Needs Input\n\n{entry}\n{insert_before}")
        else:
            content += f"\n## Needs Input\n\n{entry}\n"

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


def classify_execution_mode(task, parsed):
    """Choose execution mode: direct | subagent | agent_team."""
    title = parsed.get("title", "").lower()
    deliverable = parsed.get("sections", {}).get("deliverable", "").lower()
    proof = parsed.get("sections", {}).get("proof", "").lower()
    combined = f"{task.lower()} | {title} | {deliverable} | {proof}"

    direct_signals = ["python", "script", "automation", "workflow"]
    agent_team_signals = [
        "🔨 build", "build:", "tool", "page", "working page", "working tool",
        "runnable utility", "diagnostics", "reporting", "review tooling",
        "reliability", "internal utility", "workspace status", "challenge generator"
    ]
    risky_or_excluded = ["openclaw.json", "live config mutation"]
    subagent_signals = [
        "portfolio", "case-study", "case study", "content plan", "social media",
        "instagram", "motion design", "mp4", "caption", "analysis", "company",
        "trading brief", "market setup", "deck", "markdown deck", "research",
        "draft", "creative mvp"
    ]

    if any(sig in combined for sig in direct_signals):
        return "direct"

    if any(sig in combined for sig in agent_team_signals) and not any(sig in combined for sig in risky_or_excluded):
        return "agent_team"

    if any(sig in combined for sig in subagent_signals):
        return "subagent"

    return "direct"


def task_requires_subagent(task, parsed):
    return classify_execution_mode(task, parsed) in {"subagent", "agent_team"}


def normalize_task_text(value):
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def deliverable_paths_from_text(text):
    if not text:
        return []
    matches = re.findall(r'([A-Za-z0-9_./-]+/[A-Za-z0-9_./-]+)', text)
    cleaned = []
    for match in matches:
        path = match.strip(" .,;:()[]{}\"'")
        if "/" in path:
            cleaned.append(path)
    return sorted(set(cleaned))


def duplicate_completed_entry(task, parsed, queue):
    normalized_task = normalize_task_text(task)
    deliverable = parsed.get("sections", {}).get("deliverable", "")
    candidate_paths = deliverable_paths_from_text(deliverable)

    for entry in queue:
        if entry.get("status") != "completed":
            continue

        same_task = normalize_task_text(entry.get("task", "")) == normalized_task
        output_paths = deliverable_paths_from_text(entry.get("outputPath", ""))
        verified_paths = output_paths and all((WORKSPACE / rel_path).exists() for rel_path in output_paths)
        same_paths = bool(candidate_paths) and bool(output_paths) and set(candidate_paths).issubset(set(output_paths))

        if same_task and verified_paths:
            return entry, output_paths
        if same_paths and verified_paths:
            return entry, output_paths

    return None, []


def task_already_satisfied(task):
    parsed = parse_task_structure(task)
    queue_file = MEMORY_DIR / "executor-subagent-queue.json"
    queue = []
    if queue_file.exists():
        try:
            queue = json.loads(queue_file.read_text())
        except json.JSONDecodeError:
            queue = []

    completed_entry, completed_paths = duplicate_completed_entry(task, parsed, queue)
    if completed_entry:
        return True, completed_paths

    return False, []


def queue_subagent_task(task, parsed, execution_mode="subagent"):
    """Append task to sub-agent queue if not already pending and skip verified duplicates already completed."""
    queue_file = MEMORY_DIR / "executor-subagent-queue.json"
    queue = []
    if queue_file.exists():
        try:
            queue = json.loads(queue_file.read_text())
        except json.JSONDecodeError:
            queue = []

    active_spawned = [entry for entry in queue if entry.get("status") == "spawned"]
    normalized_task = normalize_task_text(task)

    completed_entry, completed_paths = duplicate_completed_entry(task, parsed, queue)
    if completed_entry:
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        changed = False
        for entry in queue:
            if normalize_task_text(entry.get("task", "")) == normalized_task and entry.get("status") in {"pending", "spawned"}:
                entry["status"] = "blocked"
                entry["updatedAt"] = stamp
                entry["note"] = "Duplicate queue entry suppressed because verified completed deliverables already exist"
                changed = True
        if changed:
            queue_file.write_text(json.dumps(queue, indent=2))
        output_path = ", ".join(completed_paths) if completed_paths else completed_entry.get("outputPath", "")
        return queue_file, False, "already_completed", output_path

    for entry in queue:
        if entry.get("task") == task and entry.get("status") in {"pending", "spawned"}:
            return queue_file, False, "already_queued", entry.get("outputPath", "")

    label, instruction = spawn_subagent(task, parsed.get("category", "general"))
    queue.append({
        "task": task,
        "parsed": parsed,
        "label": label,
        "instruction": instruction,
        "queuedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "status": "pending",
        "executionMode": execution_mode,
        "agentTeam": execution_mode == "agent_team"
    })
    queue_file.write_text(json.dumps(queue, indent=2))

    if active_spawned:
        return queue_file, True, "queued_waiting_for_active_slot", ""
    return queue_file, True, "queued_ready", ""


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


def write_last_result(task, outcome, details="", output_path="", pruned_satisfied=None):
    payload = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "task": task,
        "outcome": outcome,
        "details": details,
        "output_path": str(Path(output_path).relative_to(WORKSPACE)) if output_path else "",
        "completed": outcome == "completed",
    }
    if pruned_satisfied:
        payload["pruned_satisfied"] = pruned_satisfied
    LAST_RESULT_FILE.write_text(json.dumps(payload, indent=2))


def detect_missing_prerequisite(task, parsed):
    """Return a focused user question when a task lacks required human input."""
    lower_task = task.lower()
    title = parsed.get("title", "")
    deliverable = parsed.get("sections", {}).get("deliverable", "")
    combined = f"{title} | {deliverable}".lower()

    if "followed companies" in combined or "named tickers" in combined:
        if not FOLLOWED_COMPANIES_FILE.exists() or not FOLLOWED_COMPANIES_FILE.read_text().strip():
            return "Which companies should be in your starting followed-companies list, or do you want me to propose a starter list for approval?"

    if "real work philippe has made or plans to make" in lower_task or "source work" in lower_task:
        return "Which specific work item should this be based on?"

    if "personal workflow" in lower_task:
        return "Which personal workflow do you want this to optimize?"

    return None


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

    missing_input_question = detect_missing_prerequisite(task, parsed)
    if missing_input_question:
        note = f"Needs input: {missing_input_question}"
        return False, note, True, note, ""

    execution_mode = classify_execution_mode(task, parsed)
    print(f"  Execution mode: {execution_mode}")

    if task_requires_subagent(task, parsed):
        queue_file, added, queue_state, existing_output = queue_subagent_task(task, parsed, execution_mode=execution_mode)
        mode_label = "agent-team" if execution_mode == "agent_team" else "sub-agent"
        if queue_state == "already_completed":
            note = f"Already completed earlier; verified deliverables exist"
            return True, note, False, "", existing_output
        if queue_state == "already_queued":
            note = f"Already queued for {mode_label} execution"
        elif queue_state == "queued_waiting_for_active_slot":
            note = f"Queued for {mode_label} execution (waiting for active task to finish)"
        else:
            note = f"Queued for {mode_label} execution"
        return False, note, True, note, str(queue_file)

    # Simple tasks - execute directly (pattern-based)
    deliverable_lower = deliverable.lower()
    title_lower = title.lower()
    combined_lower = f"{title_lower} | {deliverable_lower} | {proof.lower()} | {why.lower()}"

    if "python" in deliverable_lower or "script" in deliverable_lower or "automation" in deliverable_lower:
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

    elif any(sig in combined_lower for sig in ["blender", "after effects", "unreal", "creative-practice", "practice brief", "self-review checklist"]):
        # Create a creative practice brief
        file_path = WORKSPACE / "projects" / "creative-practice" / f"practice-brief-{datetime.now().strftime('%Y-%m-%d')}.md"
        content = f'''# Creative Practice Brief

**Generated:** {timestamp}
**Task:** {title}

## Exercise Focus

- **Discipline:** [Blender / After Effects / Unreal / other]
- **Skill target:** [What this exercise is meant to build]
- **Timebox:** [30-90 minutes]

## Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]

## Target Outcome

[Describe the finished mini exercise or scene Philippe should complete]

## Self-Review Checklist

- [ ] I finished the exercise within the timebox
- [ ] I practiced the intended technique
- [ ] I exported or saved the result
- [ ] I noted one thing that went well
- [ ] I noted one thing to improve next time

## Learning Notes

[Short reflection prompts or notes section]

---
*This is an AI-generated draft. Replace placeholders before treating it as done.*
'''
        print(f"  Creating creative practice brief: {file_path.name}")

    elif "portfolio" in deliverable_lower or "case-study" in deliverable_lower:
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

    elif any(sig in combined_lower for sig in ["trading brief", "market setup", "price level", "entry", "invalidation", "position size"]):
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

    elif "company" in deliverable_lower or "analysis" in deliverable_lower:
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
    
    # Select highest-value task from Open Backlog, pruning already-satisfied work first
    selected_task, score, skipped_satisfied = select_task(open_backlog, in_progress)
    pruned_summary = []

    if skipped_satisfied:
        for task, output_paths in skipped_satisfied:
            content = remove_task_everywhere(task, content)
            print(f"Pruned already-satisfied task from backlog: {task[:80]}...")
            if output_paths:
                print(f"  Verified outputs: {', '.join(output_paths)}")
            pruned_summary.append({
                "task": task,
                "output_paths": output_paths,
            })
        AUTONOMOUS_FILE.write_text(content)
        if sync_kanban_board():
            publish_kanban_board_if_changed()
        prune_details = f"Pruned {len(pruned_summary)} already-satisfied task(s) from Open Backlog"
        log_execution("prune", "pruned_satisfied", prune_details)
        open_backlog, in_progress = read_autonomous_file()

    if not selected_task:
        reason = "No selectable tasks in Open Backlog" if skipped_satisfied else "No tasks in Open Backlog"
        print(reason)
        write_last_result("", "skipped", reason, "", pruned_satisfied=pruned_summary)
        log_execution("none", "skipped", reason)
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
        write_last_result(selected_task, "completed", result, output_path, pruned_satisfied=pruned_summary)

        # Remove from In Progress
        content = AUTONOMOUS_FILE.read_text()
        content = move_to_done(selected_task, content)
        AUTONOMOUS_FILE.write_text(content)
        if sync_kanban_board():
            publish_kanban_board_if_changed()

        log_execution(selected_task, "completed", result)
        print(f"Task completed and logged")
    
    elif blocked:
        queued = any(token in blocker_note.lower() for token in ["sub-agent", "subagent", "agent-team"])
        agent_team = "agent-team" in blocker_note.lower()
        needs_input = blocker_note.lower().startswith("needs input:")
        content = AUTONOMOUS_FILE.read_text()

        if needs_input:
            question = blocker_note.split(": ", 1)[1] if ": " in blocker_note else blocker_note
            content = move_to_needs_input(selected_task, content, question)
        elif queued or not output_path:
            content = move_to_open_backlog(selected_task, content)

        AUTONOMOUS_FILE.write_text(content)
        if sync_kanban_board():
            publish_kanban_board_if_changed()

        outcome = "needs_input" if needs_input else ("queued_for_agent_team" if agent_team else ("queued_for_subagent" if queued else "blocked"))
        result_path = output_path if (output_path and not queued and not needs_input) else ""
        write_last_result(selected_task, outcome, blocker_note, result_path, pruned_satisfied=pruned_summary)
        log_execution(selected_task, outcome, blocker_note)
        print(f"Task blocked: {blocker_note}")

    else:
        if not output_path:
            content = AUTONOMOUS_FILE.read_text()
            content = move_to_open_backlog(selected_task, content)
            AUTONOMOUS_FILE.write_text(content)
            if sync_kanban_board():
                publish_kanban_board_if_changed()
        write_last_result(selected_task, "in_progress", result, output_path, pruned_satisfied=pruned_summary)
        log_execution(selected_task, "in_progress", result)
        print(f"Task work chunk complete, remains in In Progress")
    
    print("Executor run complete")


if __name__ == "__main__":
    run_executor()