#!/usr/bin/env python3
"""
Daily task generator for Philippe's Goal-Driven workflow.
Reads goals from AUTONOMOUS.md, generates 4-5 tasks, updates Open Backlog.
Logs completed actions to memory/tasks-log.md with ✅ prefix.
"""

import os
import re
from datetime import datetime
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
TASKS_LOG_FILE = WORKSPACE / "memory" / "tasks-log.md"

# Ensure memory directory exists
TASKS_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

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
    
    return goals, []  # Return empty backlog - we always replace

def generate_tasks(goals):
    """Generate 4-5 actionable tasks from goals using simple rotation."""
    import random
    
    all_goals = []
    for category, items in goals.items():
        for item in items:
            all_goals.append((category, item))
    
    if not all_goals:
        return []
    
    # Pick 4-5 random goals and create actionable tasks
    num_tasks = min(5, len(all_goals))
    selected = random.sample(all_goals, num_tasks)
    
    tasks = []
    for category, goal in selected:
        # Create actionable task format
        task = f"[{category}] {goal}"
        tasks.append(task)
    
    return tasks

def update_autonomous_file(new_tasks):
    """Update AUTONOMOUS.md with new tasks, keeping it token-light."""
    
    # Keep max 5 tasks to stay light (~50 lines total)
    limited = new_tasks[:5]
    
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

def log_completed_task(task, category="general"):
    """Append completed task to tasks-log.md with ✅."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    log_entry = f"- ✅ [{timestamp}] [{category}] {task}\n"
    
    if TASKS_LOG_FILE.exists():
        existing = TASKS_LOG_FILE.read_text()
    else:
        existing = "# Completed Tasks Log\n\n**Append-only.** Sub-agents: Only add new lines at the bottom. Never edit existing lines.\n\n---\n\n"
    
    TASKS_LOG_FILE.write_text(existing + log_entry)

if __name__ == "__main__":
    # Read goals
    goals, _ = read_autonomous_file()
    
    # Generate new tasks
    new_tasks = generate_tasks(goals)
    
    # Update AUTONOMOUS.md with new tasks only
    if new_tasks:
        update_autonomous_file(new_tasks)
        print(f"Generated {len(new_tasks)} tasks and updated AUTONOMOUS.md")
    else:
        print("No goals found in AUTONOMOUS.md")