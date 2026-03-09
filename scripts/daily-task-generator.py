#!/usr/bin/env python3
"""
Daily task generator for Philippe's Goal-Driven workflow.
Reads goals from AUTONOMOUS.md, generates 4-5 actionable tasks using structured synthesis.

Generation Rules (enforced via constants):
- Must be executable by agent without extra user input
- Must map clearly to a goal
- Include strategy and build/make tasks mix
- At most one "creative surprise MVP" task per run
- Lightweight dedupe against recent tasks-log.md

Task Format: [category] action + deliverable + scope + success criterion
"""

import os
import re
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
TASKS_LOG_FILE = WORKSPACE / "memory" / "tasks-log.md"
KANBAN_DIR = WORKSPACE / "projects" / "autonomous-kanban"
KANBAN_BOARD_FILE = WORKSPACE / "projects" / "autonomous-kanban" / "public" / "board.json"

# Ensure memory directory exists
TASKS_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Generation constants
NUM_TASKS = 5
MAX_CREATIVE_MVP = 1  # At most one creative surprise MVP per run

# Task type prefixes for variety
TASK_TYPES = [
    "🔨 Build:",    # Build/create something
    "📊 Analyze:",  # Research/analyze
    "📝 Draft:",    # Write/create draft
    "🎨 Design:",   # Creative work
    "⚡ Optimize:", # Improve existing
    "🚀 Launch:",   # Execute/deploy
    "📚 Learn:",    # Study/practice
    "🔧 Fix:",      # Repair/improve
]

# Creative surprise MVP patterns (limited to 1 per run)
CREATIVE_MVP_PATTERNS = [
    "Create a quick 10-second motion design loop for Instagram",
    "Draft a 300-word blog post about learning progress",
    "Build a simple Python automation script for a daily task",
    "Record a 1-minute screen capture tutorial",
    "Design a simple logo/concept for a side project",
]


def read_autonomous_file():
    """Read the AUTONOMOUS.md file and extract goals from Goals section only."""
    if not AUTONOMOUS_FILE.exists():
        return {}, []
    
    content = AUTONOMOUS_FILE.read_text()
    
    # Extract goals by section - only from under ## Goals
    goals = {}
    current_section = None
    current_goals = []
    in_goals_section = False
    
    for line in content.split('\n'):
        # Detect section headers
        section_match = re.match(r'^##\s+(\w+)\s*$', line)
        if section_match:
            if section_match.group(1) == "Goals":
                in_goals_section = True
                continue
            elif in_goals_section and current_section and current_goals:
                goals[current_section] = current_goals
                current_goals = []
                in_goals_section = False
        elif in_goals_section:
            # Check for subsections like ### Career
            subsection_match = re.match(r'^###\s+(\w+)\s*$', line)
            if subsection_match:
                if current_section and current_goals:
                    goals[current_section] = current_goals
                current_section = subsection_match.group(1)
                current_goals = []
            elif line.strip().startswith('- '):
                current_goals.append(line.strip()[2:])
    
    if current_section and current_goals:
        goals[current_section] = current_goals
    
    return goals, []


def get_recent_tasks(days=14):
    """Get tasks completed in the last N days to avoid repetition."""
    if not TASKS_LOG_FILE.exists():
        return set()
    
    recent = set()
    cutoff = datetime.now() - timedelta(days=days)
    
    for line in TASKS_LOG_FILE.read_text().split('\n'):
        # Parse: - ✅ [2026-03-08 08:15] [Career] task description
        match = re.match(r'- ✅ \[(\d{4}-\d{2}-\d{2})', line)
        if match:
            try:
                task_date = datetime.strptime(match.group(1), "%Y-%m-%d")
                if task_date >= cutoff:
                    # Add task content (everything after category)
                    content_match = re.search(r'\].*?\] (.*)$', line)
                    if content_match:
                        recent.add(content_match.group(1).strip().lower())
            except ValueError:
                continue
    
    return recent


def synthesize_task(goal, category, recent_tasks):
    """
    Convert a goal into an actionable, executable task.
    
    Task format: [category] action + deliverable + scope + success criterion
    """
    goal_lower = goal.lower()
    
    # Detect goal type and synthesize appropriate task
    if 'blender' in goal_lower or 'after effects' in goal_lower or 'unreal' in goal_lower:
        # Creative/3D work
        action = "Complete a 30-minute practice session on"
        deliverable = "one new technique demonstration"
        scope = "focusing on [specific technique from goal]"
        success = "success: has practiced for 30min with output file"
        task = f"[{category}] {action} {goal.split(',')[0].strip()}; {deliverable}; {scope}; {success}"
    
    elif 'portfolio' in goal_lower:
        # Portfolio building
        action = "Add one new piece to portfolio:"
        deliverable = "create/update [specific work]"
        scope = "for [target audience: motion designer/3D designer]"
        success = "success: piece is published and looks professional"
        task = f"[{category}] {action} {deliverable}; {scope}; {success}"
    
    elif 'instagram' in goal_lower or 'social' in goal_lower or '10k' in goal_lower:
        # Social growth
        action = "Post one engagement-optimized content piece"
        deliverable = "[describe content type]"
        scope = "using 3 relevant hashtags and engaging caption"
        success = "success: posted within 2 hours"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    elif 'python' in goal_lower or 'pytorch' in goal_lower or 'programming' in goal_lower:
        # Programming learning
        action = "Complete one coding exercise/practice"
        deliverable = "write [X] lines of working code"
        scope = "focused on [specific Python concept]"
        success = "success: code runs without errors"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    elif 'japanese' in goal_lower or 'language' in goal_lower:
        # Language learning
        action = "Study vocabulary/grammar for 20 minutes"
        deliverable = "learn [X] new words/phrases"
        scope = "using [app/method: Anki/Duolingo]"
        success = "success: can recall [X] items"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    elif 'trading' in goal_lower or 'equity' in goal_lower or 'futures' in goal_lower:
        # Trading
        action = "Execute one trading setup with documented rationale"
        deliverable = "record trade in journal with entry/exit/lesson"
        scope = "using [strategy/indicator]"
        success = "success: trade documented with P&L"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    elif 'business analysis' in goal_lower or 'financial' in goal_lower:
        # Financial analysis
        action = "Analyze one company from watchlist"
        deliverable = "write 500-word analysis covering key metrics"
        scope = "including revenue, margins, and growth"
        success = "success: analysis saved to trading journal"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    elif 'automate' in goal_lower:
        # Automation
        action = "Identify and script one repetitive task"
        deliverable = "create Python/bash script that does [task]"
        scope = "reducing manual effort by [estimate]"
        success = "success: script runs and achieves task"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    elif 'openclaw' in goal_lower or 'optimise' in goal_lower or 'optimize' in goal_lower:
        # OpenClaw optimization
        action = "Audit one area for optimization opportunity"
        deliverable = "document finding + propose fix"
        scope = "focusing on [efficiency/cost/quality]"
        success = "success: finding documented with impact estimate"
        task = f"[{category}] {action}; {deliverable}; {scope}; {success}"
    
    else:
        # Default: make it actionable with clear deliverable
        action = "Work on:"
        deliverable = "[specific deliverable]"
        scope = "spend 30 minutes focused on"
        success = "success: measurable progress made"
        task = f"[{category}] {action} {goal}; {deliverable}; {scope}; {success}"
    
    return task


def generate_tasks(goals):
    """Generate 4-5 actionable tasks from goals using structured synthesis."""
    import random
    
    all_goals = []
    for category, items in goals.items():
        for item in items:
            all_goals.append((category, item))
    
    if not all_goals:
        return []
    
    # Get recent tasks for deduplication
    recent_tasks = get_recent_tasks()
    
    # Prioritize goals not recently worked on
    available_goals = []
    for category, goal in all_goals:
        goal_key = goal.lower().strip()
        if goal_key not in recent_tasks:
            available_goals.append((category, goal))
    
    # If we've covered most goals, allow some overlap but prefer variety
    if len(available_goals) < 3:
        available_goals = all_goals[:]
    
    # Pick up to NUM_TASKS-1 from available goals (save 1 for creative MVP)
    num_regular = min(NUM_TASKS - MAX_CREATIVE_MVP, len(available_goals))
    if num_regular > 0:
        selected_goals = random.sample(available_goals, min(num_regular, len(available_goals)))
    else:
        selected_goals = []
    
    # Synthesize regular tasks
    tasks = []
    for category, goal in selected_goals:
        task = synthesize_task(goal, category, recent_tasks)
        tasks.append(task)
    
    # Add at most one creative surprise MVP task
    if MAX_CREATIVE_MVP and tasks:
        creative_task = random.choice(CREATIVE_MVP_PATTERNS)
        # Find a category to tag it with
        cat = selected_goals[0][0] if selected_goals else "Creative"
        mvp_task = f"[{cat}] 🎨 Creative MVP: {creative_task}; success: MVP created and demonstrated"
        tasks.append(mvp_task)
    
    return tasks[:NUM_TASKS]


def update_autonomous_file(new_tasks):
    """Update AUTONOMOUS.md with new tasks, keeping it token-light."""
    
    # Keep max 5 tasks to stay light (~50 lines total)
    limited = new_tasks[:NUM_TASKS]
    
    # Read current file
    content = AUTONOMOUS_FILE.read_text()
    
    # Replace Open Backlog section
    new_section = "## Open Backlog\n\n"
    if limited:
        for task in limited:
            new_section += f"- {task}\n"
    else:
        new_section += "*(Empty - no active tasks)*\n"
    
    # Rebuild file with updated section
    if "## Open Backlog" in content:
        # Find and replace existing section
        pattern = r'## Open Backlog\s*\n.*?(?=\n##|\Z)'
        content = re.sub(pattern, new_section.rstrip() + "\n\n", content, flags=re.DOTALL)
    else:
        content += "\n" + new_section
    
    AUTONOMOUS_FILE.write_text(content)


def sync_kanban_board_json():
    """Refresh autonomous-kanban public/board.json after backlog updates."""
    if not KANBAN_DIR.exists():
        print("Kanban sync skipped: autonomous-kanban project not found")
        return False

    try:
        subprocess.run(
            ["npm", "run", "sync-board"],
            cwd=KANBAN_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        print("Synced autonomous-kanban public/board.json")
        return True
    except FileNotFoundError:
        print("Kanban sync skipped: npm not available")
        return False
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        print(f"Kanban sync failed: {stderr or exc}")
        return False


def publish_kanban_board_if_changed():
    """Commit and push board.json updates to keep GitHub Pages in sync."""
    if not KANBAN_BOARD_FILE.exists():
        print("Kanban publish skipped: board.json not found")
        return

    rel_board = str(KANBAN_BOARD_FILE.relative_to(WORKSPACE))

    diff = subprocess.run(
        ["git", "diff", "--quiet", "--", rel_board],
        cwd=WORKSPACE,
        capture_output=True,
        text=True,
    )

    if diff.returncode == 0:
        print("Kanban publish skipped: board.json unchanged")
        return

    branch = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=WORKSPACE,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    message = f"chore(kanban): sync board snapshot ({timestamp})"

    try:
        subprocess.run(["git", "add", rel_board], cwd=WORKSPACE, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=WORKSPACE, check=True)
        subprocess.run(["git", "push", "origin", branch], cwd=WORKSPACE, check=True)
        print(f"Published kanban board to origin/{branch}")
    except subprocess.CalledProcessError as exc:
        print(f"Kanban publish failed: {exc}")


if __name__ == "__main__":
    # Read goals
    goals, _ = read_autonomous_file()

    # Generate new tasks
    new_tasks = generate_tasks(goals)

    # Update AUTONOMOUS.md with new tasks only
    if new_tasks:
        update_autonomous_file(new_tasks)
        print(f"Generated {len(new_tasks)} tasks and updated AUTONOMOUS.md")
        print("Tasks created:")
        for i, task in enumerate(new_tasks, 1):
            print(f"  {i}. {task[:80]}...")
        
        if sync_kanban_board_json():
            publish_kanban_board_if_changed()
    else:
        print("No goals found in AUTONOMOUS.md")