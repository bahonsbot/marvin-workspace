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
TASK_SUGGESTIONS_FILE = WORKSPACE / "memory" / "task-suggestions.json"
SKILL_PROFILE_FILE = WORKSPACE / "config" / "skill-profile.json"
KANBAN_DIR = WORKSPACE / "projects" / "autonomous-kanban"
KANBAN_BOARD_FILE = WORKSPACE / "projects" / "autonomous-kanban" / "public" / "board.json"
LATEST_ASSESSMENT_FILE = WORKSPACE / "memory" / "skill-assessments" / "latest.json"
CONTENT_SOURCE_DIRS = [
    WORKSPACE / "projects" / "creative-practice",
    WORKSPACE / "projects" / "portfolio",
    WORKSPACE / "projects" / "creative-challenges",
]

# Ensure memory directory exists
TASKS_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Generation constants
NUM_TASKS = 5
MAX_SURPRISE_MVP = 1  # Allowed only for useful tools/system improvements, not creative-output filler
DISALLOWED_TASK_PHRASES = [
    "case-study",
    "case study",
]
REQUIRES_NAMED_SUBJECT_PHRASES = [
    "company analysis",
    "financial analysis",
    "business analysis",
]
DELIVERABLE_PATH_PATTERN = re.compile(r'(?:deliverable|output):\s*([^|]+)', re.IGNORECASE)


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
        "creative_3d": "Directly builds 3D modeling and animation skill through Philippe-owned practice",
        "motion_design": "Creates structured After Effects practice that Philippe can personally execute and learn from",
        "game_dev": "Builds Unreal understanding through scoped hands-on scene work",
        "portfolio": "Improves portfolio direction by identifying what Philippe should personally make next, not by generating filler artifacts",
        "social_growth": "Supports Instagram growth through publishable work or process content tied to Philippe's real practice",
        "content": "Creates content support material only when it reinforces real work, not filler output",
        "programming": "Python should be learned like a language: fundamentals first, then reading, guided exercises, and only then practical scripts",
        "language": "Spaced repetition with focused vocabulary and pattern practice builds usable language skill",
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
        "creative_3d": "Task produces a practice brief or exercise artifact plus clear learning notes tied to Blender/3D skill",
        "motion_design": "Task produces a practice plan, reference pack, or exercise brief Philippe can execute in After Effects",
        "game_dev": "Task produces a scoped Unreal exercise or scene plan with concrete next actions",
        "portfolio": "Output ranks portfolio-worthy directions or gaps with a concrete next build choice",
        "social_growth": "Output ties content ideas to real work Philippe made or will make, with clear posting angle",
        "content": "Output is directly reusable as support for real work, not standalone filler",
        "programming": "Task advances Python fundamentals, reading, or guided practice at the current level with a verifiable exercise outcome",
        "language": "Deck or exercise set has complete entries and is usable for deliberate practice",
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
        "programming": "Unlocks the next Python learning stage after fundamentals are stable",
        "creative_3d": "Unlocks more advanced Blender exercises and stronger portfolio pieces Philippe can make himself",
        "motion_design": "Unlocks more intentional After Effects practice and stronger self-made motion pieces",
        "trading": "Unlocks better watchlist discipline, named analyses, and more credible setup work",
        "language": "Unlocks the next stage of reading and basic output practice",
        "portfolio": "Unlocks better portfolio decisions about what to build next",
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


def has_content_source_work():
    """Return True only when there is concrete source work or a concrete build item to anchor content tasks."""
    for path in CONTENT_SOURCE_DIRS:
        if not path.exists():
            continue
        if path.is_file() and path.stat().st_size > 0:
            return True
        if path.is_dir():
            for child in path.rglob("*"):
                if child.is_file() and child.suffix.lower() in {".md", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".blend", ".aep", ".ai", ".txt"}:
                    if child.stat().st_size > 0:
                        return True
    return False


def synthesize_task(goal, category, recent_tasks, use_assessment_bias=False):
    """Convert a goal into a concrete autonomous task with Why/Proof/Unlocks.

    Generation policy:
    - prefer Philippe-owned progress over agent-made artifacts
    - treat Python as staged language learning, similar to Japanese
    - do not generate case studies unless explicitly requested
    - do not generate unspecified company analyses
    """
    goal_lower = goal.lower()

    goal_type, target_outcome, skill = classify_goal(goal)

    if skill:
        is_appropriate, reason = is_task_appropriate_for_level("", skill, goal)
        if not is_appropriate:
            goal = "Learn Python basics with simple exercises"
            goal_lower = goal.lower()
            goal_type, target_outcome, skill = classify_goal(goal)

    level = get_skill_level(skill) if skill else "intermediate"
    why = generate_why(goal_type, goal)
    proof = generate_proof(goal_type)
    unlocks = generate_unlocks(goal_type, skill)

    if 'blender' in goal_lower:
        task_prefix = "📚 Learn:"
        task_desc = "pick one beginner-intermediate Blender exercise focused on primitives, modifiers, or lighting; deliverable: practice brief in projects/creative-practice/ with steps, target outcome, and self-review checklist"
    elif 'after effects' in goal_lower or 'after_effects' in goal_lower:
        task_prefix = "📚 Learn:"
        task_desc = "create one After Effects practice brief focused on keyframes, easing, or a simple loop; deliverable: markdown exercise in projects/creative-practice/ with references and execution checklist"
    elif 'unreal' in goal_lower:
        task_prefix = "📚 Learn:"
        task_desc = "prepare one scoped Unreal practice exercise using pre-made assets and one mechanic only; deliverable: scene brief in projects/game-dev/ with setup steps and success checklist"
    elif 'portfolio' in goal_lower:
        task_prefix = "📊 Analyze:"
        task_desc = "rank 3 portfolio directions or existing projects by creative relevance and personal ownership; deliverable: markdown shortlist in projects/portfolio/ with recommendation for what Philippe should build next"
    elif 'instagram' in goal_lower or 'social' in goal_lower:
        if not has_content_source_work():
            return None
        task_prefix = "📝 Draft:"
        task_desc = "draft 3 Instagram content angles tied to a specific real work item Philippe has made or is actively building; deliverable: content-plan markdown with hook, named source work item, and posting angle"
    elif 'python' in goal_lower:
        task_prefix = "📚 Learn:"
        if level == "novice":
            task_desc = "build one beginner Python study sheet on variables, input/output, and simple conditionals; deliverable: markdown lesson in projects/python-learning/ with 5 read-and-predict examples and 3 tiny exercises"
            proof = "Lesson includes explanations, read-first examples, and beginner exercises Philippe can complete without advanced concepts"
        elif level == "beginner":
            task_desc = "create one guided Python reading-and-practice exercise on functions, loops, or lists; deliverable: markdown exercise in projects/python-learning/ plus a small starter script"
            proof = "Exercise includes code reading, prediction questions, and one guided practice task at the current level"
        else:
            task_desc = "create one guided Python practice task that bridges reading and small real-world application; deliverable: markdown exercise in projects/python-learning/ plus starter code"
            proof = "Exercise clearly advances the next Python milestone with both comprehension and practice"
    elif 'japanese' in goal_lower:
        task_prefix = "📚 Learn:"
        task_desc = "create one focused Japanese study pack from a single beginner theme; deliverable: markdown lesson in projects/language/ with vocab, readings, and 5 short practice prompts"
    elif 'business analysis' in goal_lower or 'financial' in goal_lower:
        task_prefix = "📚 Learn:"
        task_desc = "create one beginner business-analysis lesson on reading key company metrics and earnings basics; deliverable: markdown lesson in projects/company-research/ with one guided example and 3 short practice prompts"
        proof = "Lesson teaches a concrete beginner concept without requiring an unstated ticker list and includes guided practice"
        unlocks = "Unlocks later analysis tasks based on real followed companies once the watchlist is defined"
    elif 'equity' in goal_lower or 'futures' in goal_lower:
        task_prefix = "🔧 Fix:"
        task_desc = "identify one safe improvement opportunity in the trading-bot workspace, such as diagnostics, reporting, review tooling, or non-execution reliability; deliverable: markdown spec in the relevant bot project notes folder"
        proof = "Spec targets a real bot-support improvement and avoids unsafe live-trading config changes"
        unlocks = "Unlocks a higher-quality system improvement task for the trading bots"
    elif 'trading' in goal_lower:
        task_prefix = "📊 Analyze:"
        task_desc = "prepare one market-prep checklist for the next trading session; deliverable: markdown checklist in projects/trading-briefs/ covering watchlist, setups, invalidation, and risk rules"
    elif 'automate' in goal_lower:
        task_prefix = "🔧 Fix:"
        task_desc = "identify one repetitive workspace workflow that wastes time, excluding openclaw.json and any live config mutation path; deliverable: markdown spec in projects/automation/ with evidence, proposed automation, and safe boundaries"
        proof = "Spec identifies a real workspace bottleneck, excludes risky config edits, and defines safe input/output clearly"
    elif 'openclaw' in goal_lower:
        task_prefix = "🔧 Fix:"
        task_desc = "identify one OpenClaw process weakness and propose a small reliability improvement with clear input/output, excluding openclaw.json and any live config mutation path; deliverable: markdown spec in projects/automation/"
        proof = "Spec targets an OpenClaw process weakness without proposing risky live config edits"
    elif 'saas' in goal_lower or 'product' in goal_lower:
        task_prefix = "📝 Draft:"
        task_desc = "define one thin MVP increment with explicit scope, dependencies, and success criteria; deliverable: spec note in the relevant project folder"
    elif 'partnership' in goal_lower or 'community' in goal_lower:
        task_prefix = "📝 Draft:"
        task_desc = "create a ranked outreach target list of 10 relevant people or communities; deliverable: markdown list in projects/outreach/ with rationale"
    else:
        task_prefix = "📝 Draft:"
        task_desc = f"an actionable next step toward: {goal[:50]}"

    focus_dimension = None
    if use_assessment_bias and skill and skill in DIMENSION_FOCUS:
        task_desc, focus_dimension = bias_toward_weakest_dimension(skill, task_desc)
        if focus_dimension:
            focus_text = DIMENSION_FOCUS.get(skill, {}).get(focus_dimension, "")
            if focus_text:
                unlocks = f"Focus on {focus_text}. {unlocks}"

    task = f"[{category}] {task_prefix} {task_desc} | Why: {why} | Proof: {proof} | Unlocks: {unlocks}"
    return task


def maybe_add_surprise_mvp(tasks, goals, seen):
    """Add at most one useful surprise MVP in system/tool/project-improvement lanes."""
    import random

    if MAX_SURPRISE_MVP <= 0:
        return tasks

    goal_text = " ".join(item.lower() for items in goals.values() for item in items)
    candidates = []

    if "openclaw" in goal_text or "automate" in goal_text:
        candidates.extend([
            "[Other] 🎁 Surprise MVP: build a tiny workspace utility that turns one repeated OpenClaw or workspace step into a one-command helper; deliverable: working script in scripts/ plus short usage note | Why: Useful surprise MVPs should reduce real operational friction | Proof: Script runs on a real workspace example and documents safe boundaries | Unlocks: Faster iteration on future automation ideas",
            "[Other] 🎁 Surprise MVP: build a lightweight daily check page or script for one recurring workspace status view; deliverable: runnable utility in projects/automation/ or scripts/ | Why: A small system tool can create durable daily value without touching risky config | Proof: Tool shows one genuinely useful status snapshot from local workspace data | Unlocks: Better operational visibility for future automation"
        ])

    if "equity trading" in goal_text or "autonomous-trading-bot" in goal_text or "futures" in goal_text:
        candidates.extend([
            "[Trading] 🎁 Surprise MVP: add one small non-execution improvement concept for the trading bots, such as a diagnostics view, reporting helper, or review utility; deliverable: build brief or MVP spec in projects/autonomous-trading-bot/notes/ or projects/futures-bot/notes/ | Why: Useful surprise MVPs should strengthen systems that support trading outcomes | Proof: MVP is tightly scoped, clearly useful, and avoids unsafe live-trading config changes | Unlocks: Faster iteration on bot quality improvements"
        ])

    if "japanese" in goal_text or "python" in goal_text or "business analysis" in goal_text:
        candidates.extend([
            "[Personal] 🎁 Surprise MVP: build a tiny learning helper for Japanese, Python, or business-analysis practice, such as a prompt generator, drill picker, or review tracker; deliverable: small working tool or spec in projects/learning-tools/ | Why: A useful learning helper can turn practice into a repeatable daily habit | Proof: Tool or spec supports one real daily exercise loop without requiring advanced setup | Unlocks: Better consistency in staged skill development"
        ])

    filtered = [c for c in candidates if c.lower() not in seen]
    if not filtered:
        return tasks

    # Prefer keeping the surprise MVP visible over weaker replaceable generated tasks.
    surprise = random.choice(filtered)
    if len(tasks) >= NUM_TASKS:
        replaceable_prefixes = [
            "[trading] 📊 analyze: prepare one market-prep checklist",
            "[career] 📚 learn: pick one beginner-intermediate blender exercise",
            "[personal] 📚 learn: create one focused japanese study pack",
            "[personal] 📚 learn: build one beginner python study sheet",
            "[other] 🔧 fix: identify one openclaw process weakness",
            "[other] 🔧 fix: identify one repetitive workspace workflow",
        ]
        for i in range(len(tasks) - 1, -1, -1):
            lower = tasks[i].lower()
            if any(lower.startswith(prefix) for prefix in replaceable_prefixes):
                tasks[i] = surprise
                return tasks[:NUM_TASKS]
        return tasks[:NUM_TASKS]

    tasks.append(surprise)
    return tasks[:NUM_TASKS]


def generate_tasks(goals):
    """Generate 4-5 actionable tasks from goals using structured synthesis."""
    import random

    all_goals = []
    for category, items in goals.items():
        for item in items:
            all_goals.append((category, item))

    if not all_goals:
        return []

    recent_tasks = get_recent_tasks()
    completed_deliverables = get_completed_deliverables()
    existing_deliverables = get_existing_autonomous_deliverables()
    blocked_deliverables = completed_deliverables | existing_deliverables

    available_goals = []
    for category, goal in all_goals:
        goal_key = goal.lower().strip()
        if goal_key not in recent_tasks:
            available_goals.append((category, goal))

    if len(available_goals) < 3:
        available_goals = all_goals[:]

    num_regular = min(NUM_TASKS - MAX_SURPRISE_MVP, len(available_goals))
    selected_goals = random.sample(available_goals, min(num_regular, len(available_goals))) if num_regular > 0 else []

    use_assessment_bias = os.environ.get("TASK_ASSESSMENT_BIAS", "false").lower() == "true"

    tasks = []
    seen = set()
    for category, goal in selected_goals:
        task = synthesize_task(goal, category, recent_tasks, use_assessment_bias=use_assessment_bias)
        if not task:
            continue
        key = task.lower().strip()

        if any(phrase in key for phrase in DISALLOWED_TASK_PHRASES):
            continue

        if any(phrase in key for phrase in REQUIRES_NAMED_SUBJECT_PHRASES) and "named ticker" not in key and "shortlist" not in key and "template" not in key:
            continue

        task_deliverables = extract_deliverable_paths(task)
        if task_deliverables and task_deliverables & blocked_deliverables:
            continue

        if key not in seen:
            tasks.append(task)
            seen.add(key)
            blocked_deliverables.update(task_deliverables)

    tasks = maybe_add_surprise_mvp(tasks, goals, seen)
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


def normalize_pathish(text):
    return text.strip().strip('`').rstrip('.,)').lower()


def extract_deliverable_paths(text):
    match = DELIVERABLE_PATH_PATTERN.search(text)
    if not match:
        return set()

    raw = match.group(1)
    candidates = re.split(r'[,\n]+', raw)
    paths = set()
    for candidate in candidates:
        cleaned = normalize_pathish(candidate)
        if '/' in cleaned or cleaned.endswith(('.md', '.py', '.html', '.json', '.txt', '.blend', '.aep')):
            paths.add(cleaned)
    return paths


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


def get_completed_deliverables(days=30):
    """Collect recently completed deliverable/output paths from tasks-log.md."""
    if not TASKS_LOG_FILE.exists():
        return set()

    completed = set()
    cutoff = datetime.now() - timedelta(days=days)

    for line in TASKS_LOG_FILE.read_text().split('\n'):
        match = re.match(r'- ✅ \[(\d{4}-\d{2}-\d{2})', line)
        if not match:
            continue
        try:
            task_date = datetime.strptime(match.group(1), "%Y-%m-%d")
        except ValueError:
            continue
        if task_date < cutoff:
            continue
        completed.update(extract_deliverable_paths(line))

    return completed


def get_existing_autonomous_deliverables():
    """Collect deliverable/output paths already referenced in AUTONOMOUS.md."""
    if not AUTONOMOUS_FILE.exists():
        return set()

    paths = set()
    for line in AUTONOMOUS_FILE.read_text().splitlines():
        paths.update(extract_deliverable_paths(line))
    return paths


def load_task_suggestions():
    if not TASK_SUGGESTIONS_FILE.exists():
        return []
    try:
        data = json.loads(TASK_SUGGESTIONS_FILE.read_text())
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def get_active_suggestion_tasks():
    tasks = []
    for item in load_task_suggestions():
        if item.get("status") in {"suggested", "promoted"} and item.get("task"):
            tasks.append(item["task"])
    return tasks


def update_autonomous_file(new_tasks):
    """Update AUTONOMOUS.md with new tasks, preserving Philippe suggestions at the top."""

    suggestion_tasks = get_active_suggestion_tasks()
    combined = []
    seen = set()

    for task in suggestion_tasks + new_tasks:
        key = task.strip().lower()
        if key and key not in seen:
            combined.append(task)
            seen.add(key)

    limited = combined[:NUM_TASKS]
    content = AUTONOMOUS_FILE.read_text()

    new_section = "## Open Backlog\n\n"
    if limited:
        for task in limited:
            new_section += f"- {task}\n"
    else:
        new_section += "*(Empty - no active tasks)*\n"

    if "## Open Backlog" in content:
        pattern = r'## Open Backlog\s*\n.*?(?=\n##|\Z)'
        content = re.sub(pattern, new_section.rstrip() + "\n\n", content, flags=re.DOTALL)
    else:
        content += "\n" + new_section

    AUTONOMOUS_FILE.write_text(content)


def sync_kanban_board_json():
    """Refresh autonomous-kanban public/board.json after backlog updates.

    NOTE: sync-board.js must preserve todo + inprogress + done consistently.
    """
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