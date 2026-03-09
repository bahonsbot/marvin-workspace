#!/usr/bin/env python3
"""
Daily task generator for Philippe's Goal-Driven workflow.
Reads goals from AUTONOMOUS.md, generates 4-5 actionable tasks using structured synthesis.
Now includes skill-level awareness and goal-coherent reasoning.

Generation Rules (enforced via constants):
- Must be executable by agent without extra user input
- Must map clearly to a goal with explicit Why/Proof/Unlocks
- Enforce difficulty gate from skill-profile.json
- Include strategy and build/make tasks mix
- At most one "creative surprise MVP" task per run
- Lightweight dedupe against recent tasks-log.md

Task Format: [category] Task: ... | Why: ... | Proof: ... | Unlocks: ...
"""

import os
import re
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
AUTONOMOUS_FILE = WORKSPACE / "AUTONOMOUS.md"
TASKS_LOG_FILE = WORKSPACE / "memory" / "tasks-log.md"
SKILL_PROFILE_FILE = WORKSPACE / "config" / "skill-profile.json"
KANBAN_DIR = WORKSPACE / "projects" / "autonomous-kanban"
KANBAN_BOARD_FILE = WORKSPACE / "projects" / "autonomous-kanban" / "public" / "board.json"
LATEST_ASSESSMENT_FILE = WORKSPACE / "memory" / "skill-assessments" / "latest.json"

# Ensure memory directory exists
TASKS_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Generation constants
NUM_TASKS = 5
MAX_CREATIVE_MVP = 1  # At most one creative surprise MVP per run


def load_skill_profile():
    """Load skill profile from config/skill-profile.json."""
    if not SKILL_PROFILE_FILE.exists():
        return {}
    try:
        return json.loads(SKILL_PROFILE_FILE.read_text())
    except (json.JSONDecodeError, IOError):
        return {}


def get_skill_level(skill_name):
    """Get skill level from profile, default to 'intermediate' if unknown."""
    profile = load_skill_profile()
    return profile.get(skill_name, {}).get("level", "intermediate")


def get_skill_constraints(skill_name):
    """Get skill-specific constraints."""
    profile = load_skill_profile()
    return profile.get(skill_name, {}).get("constraints", [])


def get_skill_milestones(skill_name):
    """Get next milestones for a skill."""
    profile = load_skill_profile()
    return profile.get(skill_name, {}).get("nextMilestones", [])


def load_latest_assessment():
    """Load latest skill assessment summary if available."""
    if not LATEST_ASSESSMENT_FILE.exists():
        return {}
    try:
        return json.loads(LATEST_ASSESSMENT_FILE.read_text())
    except (json.JSONDecodeError, IOError):
        return {}


def get_weakest_dimension(skill):
    """Get the weakest rubric dimension for a skill from assessment."""
    assessment = load_latest_assessment()
    skills_data = assessment.get("skills", {})
    
    if skill not in skills_data:
        return None
    
    skill_data = skills_data[skill]
    dimensions = skill_data.get("dimensions", {})
    
    if not dimensions:
        return None
    
    # Find dimension with lowest score
    weakest = min(dimensions.items(), key=lambda x: x[1])
    return weakest[0] if weakest[1] < 70 else None  # Only return if below 70%


def is_task_appropriate_for_level(task_type, skill_name, goal_text):
    """Check if task difficulty matches skill level."""
    level = get_skill_level(skill_name)
    goal_lower = goal_text.lower()
    
    # Beginner-level constraints
    if level == "novice":
        if any(kw in goal_lower for kw in ["pytorch", "neural", "deep learning", "api", "cli"]):
            return False, "Advanced topic - too complex for novice level"
    
    if level == "beginner":
        if any(kw in goal_lower for kw in ["advanced", "complex", "production"]):
            return False, "Too advanced for beginner level"
    
    if level in ["novice", "beginner"]:
        if "analytics" in task_type.lower() and "cli" in goal_lower:
            return False, "CLI analytics too complex for current level"
    
    return True, ""


# Goal type mapping: goal keyword -> (goal_type, target_outcome, relevant_skill)
GOAL_TYPE_MAP = {
    "blender": ("creative_3d", "create 3D model or animation", "blender"),
    "after effects": ("motion_design", "create motion graphic", "after_effects"),
    "unreal": ("game_dev", "build interactive scene", "unreal"),
    "portfolio": ("portfolio", "document work for showcase", None),
    "instagram": ("social_growth", "grow audience", None),
    "youtube": ("content", "create video content", None),
    "python": ("programming", "write working code", "python"),
    "pytorch": ("programming", "implement ML code", "python"),
    "japanese": ("language", "learn vocabulary", None),
    "trading": ("trading", "analyze and execute trades", "trading"),
    "equity": ("trading", "trade equities profitably", "trading"),
    "futures": ("trading", "trade futures profitably", "trading"),
    "automate": ("automation", "reduce manual effort", "python"),
    "openclaw": ("ops", "improve OpenClaw workflows", "python"),
    "business analysis": ("research", "analyze company fundamentals", "trading"),
    "financial": ("research", "evaluate financial data", "trading"),
    "saas": ("product", "build product feature", None),
    "partnership": ("outreach", "build relationships", None),
}


def classify_goal(goal_text):
    """Map a goal to goal_type, target_outcome, and relevant_skill."""
    goal_lower = goal_text.lower()
    
    for keyword, (goal_type, target, skill) in GOAL_TYPE_MAP.items():
        if keyword in goal_lower:
            return goal_type, target, skill
    
    return "general", "make progress on goal", None


def generate_why(goal_type, goal_text):
    """Generate explicit reasoning why this task advances the goal."""
    why_templates = {
        "creative_3d": "Directly builds 3D modeling/animation skills needed for Blender/Unreal goals",
        "motion_design": "Creates practice opportunity for After Effects motion design skills",
        "game_dev": "Hands-on experience with Unreal Engine world-building",
        "portfolio": "Documents existing work - essential for landing creative roles",
        "social_growth": "Consistent content is required to grow Instagram audience to 10k",
        "content": "Video content drives YouTube/channel growth metrics",
        "programming": "Writing code is the only way to actually learn Python - hands-on practice beats reading",
        "language": "Spaced repetition with new vocabulary builds Japanese fluency",
        "trading": "Real market analysis and execution builds trading skill faster than passive learning",
        "automation": "Reduces repetitive manual work, freeing time for skill-building",
        "ops": "Improves OpenClaw reliability - essential for autonomous operations",
        "research": "Understanding company financials is required for informed trading decisions",
        "product": "Shipping incremental features builds product development skill",
        "outreach": "Partnerships/community are force multipliers for any goal",
    }
    return why_templates.get(goal_type, f"Makes tangible progress toward: {goal_text[:50]}")


def generate_proof(goal_type):
    """Generate verification criterion for task completion."""
    proof_templates = {
        "creative_3d": "Export renders MP4/image and notes what was learned",
        "motion_design": "Motion file exports and plays without errors",
        "game_dev": "Scene runs in editor with basic interaction working",
        "portfolio": "Case-study markdown has problem/approach/result sections",
        "social_growth": "Content scheduled in planner with specific post times",
        "content": "Video file exists and thumbnail created",
        "programming": "pytest passes - code runs without errors",
        "language": "Deck has 25+ complete entries with readings",
        "trading": "Brief shows entry/invalidation/risk for 2+ setups",
        "automation": "Script executes end-to-end on test input",
        "ops": "Process runs successfully with measurable improvement",
        "research": "Analysis note has thesis, risks, and 3+ key metrics",
        "product": "Feature runs locally and has README notes",
        "outreach": "List has 10 targets with priority tiers and rationale",
    }
    return proof_templates.get(goal_type, "Task artifact exists and matches requirements")


def generate_unlocks(goal_type, skill):
    """Generate what this task enables next."""
    milestones = get_skill_milestones(skill) if skill else []
    
    if milestones:
        return f"Progress toward: {milestones[0]}"
    
    unlocks_templates = {
        "programming": "Unlocks more complex Python utilities and basic CLI tools",
        "creative_3d": "Unlocks longer-form animations and character work",
        "motion_design": "Unlocks commercial-ready motion graphics",
        "trading": "Unlocks larger position sizes and more setups",
        "language": "Unlocks basic conversation and reading practice",
        "portfolio": "Unlocks job applications and client pitches",
    }
    return unlocks_templates.get(goal_type, "Advances goal progress measurably")


# Task type prefixes for variety
TASK_TYPES = [
    ("🔨 Build:", "Build/create something"),
    ("📊 Analyze:", "Research/analyze"),
    ("📝 Draft:", "Write/create draft"),
    ("🎨 Design:", "Creative work"),
    ("⚡ Optimize:", "Improve existing"),
    ("🚀 Launch:", "Execute/deploy"),
    ("📚 Learn:", "Study/practice"),
    ("🔧 Fix:", "Repair/improve"),
]

# Beginner-appropriate task templates with skill-aware content
TASK_TEMPLATES = {
    "python": {
        "novice": "Write a simple Python script that [task]; deliverable: script.py with clear comments; success: runs without errors",
        "beginner": "Create Python script with basic input validation for [task]; deliverable: script + basic pytest test; success: pytest passes",
    },
    "blender": {
        "beginner-intermediate": "Create [task] using Blender primitives; deliverable: .blend file + 3 bullet notes on technique; success: render exports cleanly",
    },
    "after_effects": {
        "beginner": "Create [task] using built-in effects only; deliverable: AE project file + 5-sec loop; success: composition renders without errors",
    },
    "unreal": {
        "beginner": "Set up [task] using pre-made assets; deliverable: UE project with working scene; success: scene runs in editor",
    },
    "trading": {
        "intermediate": "Analyze [task] using available metrics; deliverable: markdown brief with thesis and 2 setups; success: brief saved with entry/invalidation/risk",
    },
}


# Dimension-to-focus mapping for task biasing
DIMENSION_FOCUS = {
    "python": {
        "variables_and_types": "work with different data types and type conversion",
        "control_flow": "practice conditional logic and loops",
        "functions": "define and call functions with parameters",
        "data_structures": "use lists and dictionaries effectively",
        "file_operations": "read and write files",
        "testing_basics": "write basic pytest tests"
    },
    "japanese": {
        "hiragana_recognition": "practice hiragana reading and writing",
        "katakana_recognition": "practice katakana reading and writing",
        "basic_vocabulary": "learn new vocabulary words",
        "sentence_structure": "form simple sentences with particles",
        "writing_practice": "write self-introduction sentences"
    },
    "blender": {
        "modeling": "practice modeling with primitives and modifiers",
        "timing_and_animation": "work on smooth animation timing",
        "lighting": "experiment with scene lighting",
        "materials_and_textures": "apply materials and colors",
        "cleanliness": "organize outliner and optimize file"
    },
    "after_effects": {
        "keyframe_animation": "practice keyframe timing and easing",
        "composition_setup": "set up clean compositions",
        "effects_usage": "use built-in effects creatively",
        "render_and_export": "configure render settings",
        "creativity": "develop motion design style"
    },
    "unreal": {
        "project_setup": "set up UE project structure",
        "level_design": "create and arrange level geometry",
        "blueprints_basics": "write Blueprint logic",
        "player_movement": "implement character movement",
        "build_and_export": "package the project"
    }
}


def bias_toward_weakest_dimension(skill, task_desc):
    """Adjust task description to focus on weakest dimension if assessment available."""
    weakest = get_weakest_dimension(skill)
    
    if not weakest:
        return task_desc, None
    
    focus = DIMENSION_FOCUS.get(skill, {}).get(weakest)
    if not focus:
        return task_desc, weakest
    
    # Modify task description to include focus area
    # This is a simple heuristic - actual implementation could be more sophisticated
    return task_desc, weakest


def synthesize_task(goal, category, recent_tasks, use_assessment_bias=False):
    """Convert a goal into a concrete autonomous task with Why/Proof/Unlocks.
    
    Args:
        use_assessment_bias: If True, bias task toward weakest rubric dimension
    """
    goal_lower = goal.lower()
    
    # Classify the goal
    goal_type, target_outcome, skill = classify_goal(goal)
    
    # Check skill-level appropriateness
    if skill:
        is_appropriate, reason = is_task_appropriate_for_level("", skill, goal)
        if not is_appropriate:
            # Fall back to simpler task
            goal = "Learn Python basics with simple exercises"
            goal_type, target_outcome, skill = classify_goal(goal)
    
    # Get skill level for task generation
    level = get_skill_level(skill) if skill else "intermediate"
    
    # Generate reasoning components
    why = generate_why(goal_type, goal)
    proof = generate_proof(goal_type)
    unlocks = generate_unlocks(goal_type, skill)
    
    # Build task description based on goal type
    if 'blender' in goal_lower:
        task_desc = "one 15-second practice clip in Blender; deliverable: MP4 in projects/creative-practice/ with 3 bullet notes on what improved"
    elif 'after effects' in goal_lower or 'after_effects' in goal_lower:
        task_desc = "one 10-second motion design loop; deliverable: MP4 with built-in effects in projects/creative-practice/"
    elif 'unreal' in goal_lower:
        task_desc = "one basic interactive scene setup; deliverable: UE project with basic movement in projects/game-dev/"
    elif 'portfolio' in goal_lower:
        task_desc = "one portfolio case-study draft from existing project; deliverable: 250-400 word markdown in projects/portfolio/case-studies/"
    elif 'instagram' in goal_lower or 'social' in goal_lower:
        task_desc = "3 content ideas for social media; deliverable: content-plan markdown with hooks and posting slots"
    elif 'python' in goal_lower:
        # Skill-aware Python task
        if level == "novice":
            task_desc = "a simple Python utility script with clear structure; deliverable: script.py with comments, runs on sample input"
        else:
            task_desc = "a Python utility with tests; deliverable: script.py + test_file.py with pytest passing"
    elif 'japanese' in goal_lower:
        task_desc = "a 25-term Japanese study deck from one theme; deliverable: markdown deck in projects/language/"
    elif 'trading' in goal_lower or 'equity' in goal_lower or 'futures' in goal_lower:
        task_desc = "one market setup brief for next session; deliverable: markdown brief in projects/trading-briefs/ with entry/invalidation/risk"
    elif 'business analysis' in goal_lower or 'financial' in goal_lower:
        task_desc = "one company analysis using available metrics; deliverable: structured note in projects/company-research/"
    elif 'automate' in goal_lower or 'openclaw' in goal_lower:
        task_desc = "one repetitive workflow automation; deliverable: runnable script in scripts/ with usage header"
    elif 'saas' in goal_lower or 'product' in goal_lower:
        task_desc = "one thin MVP increment; deliverable: working prototype in relevant project folder"
    elif 'partnership' in goal_lower or 'community' in goal_lower:
        task_desc = "a partner/outreach target list; deliverable: ranked list of 10 targets in projects/outreach/"
    else:
        task_desc = f"an actionable step toward: {goal[:50]}"
    
    # Apply assessment bias if enabled (targets weakest dimension)
    focus_dimension = None
    if use_assessment_bias and skill and skill in DIMENSION_FOCUS:
        task_desc, focus_dimension = bias_toward_weakest_dimension(skill, task_desc)
        if focus_dimension:
            # Update unlocks to mention the focus area
            focus_text = DIMENSION_FOCUS.get(skill, {}).get(focus_dimension, "")
            if focus_text:
                unlocks = f"Focus on {focus_text}. {unlocks}"
    
    # Select task type prefix
    task_prefix = TASK_TYPES[hash(goal) % len(TASK_TYPES)][0]
    
    # Build full task with Why/Proof/Unlocks
    task = f"[{category}] {task_prefix} {task_desc} | Why: {why} | Proof: {proof} | Unlocks: {unlocks}"
    
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
    
    # Check if assessment-based task biasing is enabled
    use_assessment_bias = os.environ.get("TASK_ASSESSMENT_BIAS", "false").lower() == "true"
    assessment_info = ""
    if use_assessment_bias:
        assessment = load_latest_assessment()
        if assessment.get("skills"):
            assessment_info = " (assessment-biased toward weakest dimensions)"
    
    # Synthesize regular tasks with lightweight dedupe
    tasks = []
    seen = set()
    for category, goal in selected_goals:
        task = synthesize_task(goal, category, recent_tasks, use_assessment_bias=use_assessment_bias)
        key = task.lower().strip()
        if key not in seen:
            tasks.append(task)
            seen.add(key)
    
    # Add at most one creative surprise MVP task (skill-appropriate)
    if MAX_CREATIVE_MVP and tasks:
        # Choose skill-appropriate creative MVP
        python_level = get_skill_level("python")
        
        if python_level == "novice":
            creative_options = [
                "Create a simple Python print script that outputs an encouraging message",
                "Write a Python script that organizes files in one folder",
            ]
        else:
            creative_options = [
                "Build a quick Python automation script for a daily task",
                "Create a simple data visualization with matplotlib",
                "Write a Python script that fetches and saves web content",
            ]
        
        creative_task = random.choice(creative_options)
        cat = selected_goals[0][0] if selected_goals else "Creative"
        
        # Creative MVP also gets Why/Proof/Unlocks
        why = "Creative MVPs build confidence and generate content for portfolio/social"
        proof = "Artifact created and demo note saved"
        unlocks = "Unlocks more ambitious creative projects"
        
        mvp_task = f"[{cat}] 🎨 Creative MVP: {creative_task} | Why: {why} | Proof: {proof} | Unlocks: {unlocks}"
        if mvp_task.lower() not in seen:
            tasks.append(mvp_task)
    
    return tasks[:NUM_TASKS]


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
                candidate = line.strip()[2:].strip()
                # Guardrail: keep Goals section clean, ignore task-like lines
                if candidate.startswith('[') or 'success:' in candidate.lower():
                    continue
                current_goals.append(candidate)
    
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
    # Load and display skill profile info
    skill_profile = load_skill_profile()
    if skill_profile:
        print("Skill profile loaded:")
        for skill, data in skill_profile.items():
            print(f"  - {skill}: {data.get('level', 'unknown')}")
    else:
        print("Warning: No skill profile found, using defaults")
    
    # Check for assessment bias
    use_assessment_bias = os.environ.get("TASK_ASSESSMENT_BIAS", "false").lower() == "true"
    if use_assessment_bias:
        assessment = load_latest_assessment()
        if assessment.get("skills"):
            print("\n📊 Assessment-based task biasing enabled")
            for skill, data in assessment["skills"].items():
                weakest = min(data.get("dimensions", {}).items(), key=lambda x: x[1]) if data.get("dimensions") else None
                if weakest:
                    print(f"   - {skill}: weakest = {weakest[0]} ({weakest[1]}%)")
    
    print()
    
    # Read goals
    goals, _ = read_autonomous_file()
    print(f"Found goals in {len(goals)} categories")

    # Generate new tasks
    new_tasks = generate_tasks(goals)

    # Update AUTONOMOUS.md with new tasks only
    if new_tasks:
        update_autonomous_file(new_tasks)
        print(f"Generated {len(new_tasks)} tasks and updated AUTONOMOUS.md")
        print("\nTasks created:")
        for i, task in enumerate(new_tasks, 1):
            # Show abbreviated version
            print(f"  {i}. {task[:100]}...")
        
        if sync_kanban_board_json():
            publish_kanban_board_if_changed()
    else:
        print("No goals found in AUTONOMOUS.md")