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
- Reads recent tasks-log.md completion history for dedupe only, while active state stays in AUTONOMOUS.md and Mission Control

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
MISSION_CONTROL_TASK_STORE = WORKSPACE / "projects" / "mission-control" / "data" / "autonomous-tasks.json"
KANBAN_SYNC_TIMEOUT_SECONDS = 20
KANBAN_GIT_TIMEOUT_SECONDS = 15
KANBAN_PUSH_TIMEOUT_SECONDS = 30
CONTENT_SOURCE_DIRS = [
    WORKSPACE / "projects" / "creative-practice",
    WORKSPACE / "projects" / "portfolio",
    WORKSPACE / "projects" / "creative-challenges",
]

# Ensure memory directory exists
TASKS_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Generation constants
NUM_TASKS = 5
GENERATION_VARIANT_ROUNDS = 4
MAX_SURPRISE_MVP = 1  # Allowed only for useful tools/system improvements, not creative-output filler
COMPLETION_LINE_TEMPLATE = "🎯 Daily Tasks Generated: {count} new tasks added to Open Backlog"
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

    if any(phrase in goal_lower for phrase in ("automation script", "automation scripts", "automating routine tasks", "procedural scene setup")):
        return "automation", "build workflow automation", "python"
    if "openclaw" in goal_lower and any(phrase in goal_lower for phrase in ("logs", "looping", "recursive", "reactive", "proactive")):
        return "ops", "improve OpenClaw workflows", "python"

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
    ("Build", "Build/create something"),
    ("Analyze", "Research/analyze"),
    ("Draft", "Write/create draft"),
    ("Design", "Creative work"),
    ("Optimize", "Improve existing"),
    ("Launch", "Execute/deploy"),
    ("Practice", "Study/practice"),
    ("Fix", "Repair/improve"),
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


def clean_generated_brief(text):
    if not text:
        return text
    cleaned = re.sub(r'^an actionable next step toward:\s*', '', text.strip(), flags=re.IGNORECASE).strip()
    if not cleaned:
        return cleaned
    return cleaned[0].upper() + cleaned[1:]


def shorten_generated_title(text, max_length=None):
    text = re.sub(r'\s+', ' ', text.strip())
    if not max_length or len(text) <= max_length:
        return text
    sliced = text[: max_length - 3]
    last_space = sliced.rfind(' ')
    if last_space > 16:
        sliced = sliced[:last_space]
    return sliced.strip() + '...'


def clean_goal_title(goal):
    cleaned = goal.strip()
    cleaned = re.sub(r'^an actionable next step toward:\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^find ways to\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^ways to\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^how to\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip(' .:-')
    cleaned = re.sub(r'\s+', ' ', cleaned)
    if not cleaned:
        return 'Concrete next step'
    return cleaned[0].upper() + cleaned[1:]


def strip_category_tag(title):
    return re.sub(r'^\[[^\]]+\]\s*', '', title.strip())


def extract_task_title_and_description(task_text):
    normalized = task_text.replace('\r\n', '\n').strip()
    if not normalized:
        return 'Untitled task', None

    lines = [line.strip() for line in normalized.split('\n') if line.strip()]
    if not lines:
        return 'Untitled task', None

    title = lines[0]
    description = None
    for line in lines[1:]:
        if line.startswith('**Brief:**'):
            description = clean_generated_brief(re.sub(r'^\*\*Brief:\*\*\s*', '', line, flags=re.IGNORECASE).strip())
            break

    title = normalize_task_title(title, description)
    return strip_category_tag(title), description


def normalize_task_title(title, description=None):
    stripped_title = strip_category_tag(title)
    match = re.match(r'^(.*?:\s*)an actionable next step toward:\s*(.*)$', stripped_title.strip(), flags=re.IGNORECASE)
    if not match:
        return stripped_title.strip()

    candidate = clean_generated_brief(description or match.group(2))
    candidate = re.sub(r'^find ways to\s*', '', candidate, flags=re.IGNORECASE)
    candidate = re.sub(r'^ways to\s*', '', candidate, flags=re.IGNORECASE)
    candidate = re.sub(r'^how to\s*', '', candidate, flags=re.IGNORECASE)
    candidate = clean_goal_title(candidate)
    return f"{match.group(1)}{candidate}"


def build_task_text(category, task_prefix, task_title, task_desc, why, proof, unlocks):
    return (
        f"[{category}] {task_prefix}: {task_title}\n"
        f"**Brief:** {task_desc}\n"
        f"| Why: {why} | Proof: {proof} | Unlocks: {unlocks}"
    )


def build_completion_line(count):
    return COMPLETION_LINE_TEMPLATE.format(count=count)


def remember_generated_task(task, seen_keys, blocked_deliverables):
    key = normalize_legacy_task_key(task)
    match_key = normalize_task_match_key(task)
    if key:
        seen_keys.add(key)
    if match_key:
        seen_keys.add(match_key)
    blocked_deliverables.update(extract_deliverable_paths(task))


def count_new_backlog_entries(tasks, existing_backlog_keys):
    count = 0
    for task in tasks:
        key = normalize_legacy_task_key(task)
        match_key = normalize_task_match_key(task)
        if key not in existing_backlog_keys and match_key not in existing_backlog_keys:
            count += 1
    return count


def print_created_tasks(tasks):
    print("\nTasks created:")
    for i, task in enumerate(tasks, 1):
        print(f"  {i}. {task[:100]}...")


def _variant_specs_for_goal(goal, goal_lower, goal_type, skill, level, why, proof, unlocks):
    def spec(prefix, title, desc, why_override=None, proof_override=None, unlocks_override=None):
        return {
            "prefix": prefix,
            "title": title,
            "desc": desc,
            "why": why_override or why,
            "proof": proof_override or proof,
            "unlocks": unlocks_override or unlocks,
        }

    if any(phrase in goal_lower for phrase in ("automation script", "automation scripts", "automating routine tasks", "procedural scene setup")):
        return [
            spec("Draft", "Creative-tool automation script plan", "define one scoped automation script for Blender, Unreal Engine, or After Effects that removes a real repetitive setup step; deliverable: markdown spec in projects/creative-practice/ or the relevant tool workspace with target app, inputs/outputs, edge cases, and first prototype step", "Reduces repetitive manual setup work while moving directly toward the current creative-tool automation goal", "Spec names one target app, one concrete repetitive task, the intended input/output flow, and a believable first prototype scope", "Unlocks a first real automation prototype instead of another generic practice exercise"),
            spec("Analyze", "Creative-tool workflow friction shortlist", "identify 3 repetitive setup steps across Blender, Unreal Engine, or After Effects and rank them by automation value and implementation simplicity; deliverable: markdown shortlist in projects/creative-practice/ with recommended first target and rationale", "Makes the automation goal smarter by choosing the highest-leverage repetitive step instead of repeating an already-finished plan", "Shortlist names 3 concrete frictions, scores them, and recommends one first automation target with clear reasoning", "Unlocks a fresher automation plan or prototype against the best remaining workflow pain point"),
            spec("Design", "Automation prototype acceptance checklist", "define the acceptance checklist for one creative-tool automation prototype, including sample inputs, expected outputs, edge cases, and rollback path; deliverable: markdown test checklist in projects/creative-practice/", "Moves the automation goal from vague planning toward a prototype Philippe can evaluate safely", "Checklist covers happy path, at least 3 edge cases, and a concrete rollback or manual fallback", "Unlocks a safer implementation pass for the next automation helper"),
        ]

    if "actionable alpha" in goal_lower or ("ui/ux" in goal_lower and "trading dashboard" in goal_lower) or ("aggregate sentiment" in goal_lower and "fundamental" in goal_lower):
        return [
            spec("Draft", "Actionable Alpha dashboard slice", "spec one concrete UI module for the Actionable Alpha dashboard that combines sentiment, technical indicators, and fundamentals into one operator decision view; deliverable: markdown spec in projects/market-intel/notes/ with module layout, required inputs, and the exact decision the module should support", "Turns the dashboard goal into one specific operator-facing slice that can actually be designed or built next", "Spec defines one named module, its inputs, presentation logic, and why it improves trading decisions", "Unlocks a buildable next UI/UX implementation step for the trading dashboard"),
            spec("Analyze", "Actionable Alpha operator decision flow", "map the operator decision flow for one Actionable Alpha workflow, from inputs to go/no-go output, and identify the minimum data needed at each step; deliverable: markdown flow note in projects/market-intel/notes/", "Keeps moving the dashboard goal forward even after a module-spec task is already done", "Flow note shows one full operator decision path, required inputs, and the specific bottleneck or ambiguity to solve next", "Unlocks a sharper next dashboard build task or module spec grounded in operator behavior"),
            spec("Design", "Actionable Alpha data contract map", "define the data contract for one dashboard slice, including required sentiment fields, technical indicators, refresh cadence, and fallback states; deliverable: markdown contract note in projects/market-intel/notes/", "Shifts the same dashboard goal into implementation-ready data thinking instead of repeating the same slice brief", "Contract note names the fields, source expectations, refresh behavior, and how missing data should be handled", "Unlocks a safer implementation step for the next dashboard component"),
        ]

    if "real-time data ingestion" in goal_lower or ("api" in goal_lower and "trading data" in goal_lower):
        return [
            spec("Research", "Real-time trading API shortlist", "compare 3 candidate APIs for real-time market-data ingestion and score them on latency, coverage, pricing, integration friction, and output usefulness; deliverable: markdown shortlist in projects/market-intel/notes/ with a recommendation and integration notes", "Bridges the gap between raw market data sources and a real integration decision instead of leaving the API goal vague", "Shortlist names 3 concrete APIs with decision criteria, recommendation, and next integration step", "Unlocks a more credible real-time data integration task for the trading stack"),
            spec("Draft", "Market-data ingestion scorecard", "define a reusable scoring rubric for evaluating future real-time market-data APIs across latency, coverage, compliance, and integration cost; deliverable: markdown scorecard template in projects/market-intel/notes/", "Lets the API goal progress with a reusable evaluation tool instead of regenerating the same shortlist", "Scorecard defines weighted criteria, acceptable thresholds, and one example scored provider", "Unlocks faster comparison of the next API candidates without redoing the framework"),
            spec("Design", "Real-time API adapter contract", "design a thin adapter interface for real-time trading data ingestion, including normalized symbols, timestamps, quote fields, and error handling expectations; deliverable: markdown interface note in projects/market-intel/notes/", "Turns the same ingestion goal into an integration-ready contract rather than another research note", "Interface note defines input/output shape, failure cases, and how multiple providers could plug in", "Unlocks a cleaner implementation task once the preferred API is chosen"),
        ]

    if "sec filings" in goal_lower or "quarterly reports" in goal_lower or "sensitivity-analysis" in goal_lower:
        return [
            spec("Draft", "SEC filing ingestion pipeline", "define a first-pass pipeline that pulls SEC filings and quarterly reports for a small ticker set, extracts the inputs needed for sensitivity ranges, and maps the outputs into the dashboard; deliverable: markdown pipeline note in projects/market-intel/notes/ with source flow, parser stages, and storage/output contract", "Makes the filings-and-sensitivity goal concrete enough to implement in stages", "Pipeline note defines source, extraction stages, target output fields, and one believable starter ticker set", "Unlocks a scoped implementation task for filings ingestion instead of leaving the goal at idea level"),
            spec("Design", "Sensitivity-range output schema", "define the output schema for sensitivity-analysis ranges derived from filings, including core assumptions, range fields, source references, and dashboard display needs; deliverable: markdown schema note in projects/market-intel/notes/", "Pushes the filings goal into a reusable output contract instead of repeating a broad pipeline task", "Schema note names the fields, assumptions, source references, and one example output record", "Unlocks parser and dashboard tasks that can share a stable structure"),
            spec("Analyze", "Filing parser edge-case review", "identify the top parser edge cases for SEC and quarterly report ingestion, such as missing tables, changing labels, and inconsistent periods; deliverable: markdown risk note in projects/market-intel/notes/ with mitigation ideas", "Improves the same filings goal by front-loading parser risks before implementation time is wasted", "Risk note names at least 3 edge cases, why they matter, and one mitigation per case", "Unlocks a more durable first parser implementation"),
        ]

    if "signal tracking" in goal_lower or "evidence verification" in goal_lower:
        return [
            spec("Analyze", "Signal evidence-verification gaps", "audit the current signal tracking flow and identify the top 3 gaps in evidence capture, reviewability, or outcome linkage; deliverable: markdown audit in projects/market-intel/notes/ with the current flow, concrete gaps, and one recommended first fix", "Targets the exact signal-tracking goal directly instead of hiding it behind a generic next-step placeholder", "Audit names the current flow, at least 3 concrete gaps, and one prioritized improvement with rationale", "Unlocks a sharper implementation task for signal evidence and review quality"),
            spec("Draft", "Signal review evidence template", "define a reusable evidence template for signal reviews, covering screenshots, source citations, outcome logic, and ambiguity notes; deliverable: markdown template in projects/market-intel/notes/", "Keeps the same signal-tracking goal moving by turning gaps into a reusable review aid", "Template includes all required evidence fields and one filled example for a hypothetical signal", "Unlocks more consistent future verification work across signals"),
            spec("Design", "Signal outcome-linkage checklist", "design a checklist that links each tracked signal to its verification evidence, outcome status, and follow-up review notes; deliverable: markdown checklist in projects/market-intel/notes/", "Turns signal-tracking improvement into a concrete operator checklist instead of another high-level audit", "Checklist shows how a signal moves from creation to verified outcome without losing evidence context", "Unlocks cleaner data integrity and review quality in the signal workflow"),
        ]

    if "openclaw" in goal_lower and any(phrase in goal_lower for phrase in ("logs", "looping", "repetitive prompts")):
        return [
            spec("Analyze", "OpenClaw loop-pattern audit", "review recent OpenClaw logs to identify one concrete repetitive prompt or looping behavior, then propose a bounded gate, prompt fix, or tool-definition improvement; deliverable: markdown audit in projects/_ops/ with evidence, root-cause hypothesis, and recommended guard", "Turns the log-analysis goal into a concrete anti-looping audit with an operator-usable output", "Audit cites one real loop pattern, why it happens, and one bounded mitigation that avoids risky control-plane drift", "Unlocks a safer token-efficiency or reliability fix with clear evidence behind it"),
            spec("Draft", "Loop-mitigation gate spec", "define one bounded gate or tool-usage rule that should interrupt a known OpenClaw loop pattern before it burns more tokens; deliverable: markdown spec in projects/_ops/ with trigger, safe action, and rollback", "Keeps the same anti-looping goal moving by shifting from audit to one concrete mitigation concept", "Spec names one loop trigger, one bounded intervention, and why it is safer than broader control-plane changes", "Unlocks a directly implementable next step after the current backlog audit item"),
            spec("Design", "Prompt-tool guardrail test matrix", "design a small test matrix for validating one proposed anti-looping prompt or tool guardrail against expected good and bad cases; deliverable: markdown matrix in projects/_ops/", "Improves the loop-reduction goal with a validation step instead of another near-duplicate audit", "Matrix covers at least 3 expected good paths and 3 loop-risk cases with pass criteria", "Unlocks safer evaluation of a future anti-looping change"),
        ]

    if "proactive operations manager" in goal_lower or "reactive" in goal_lower or "recursive" in goal_lower:
        return [
            spec("Draft", "Proactive operations guardrails", "define one safe recursive operations loop for OpenClaw that improves self-checking without overreach; deliverable: markdown guardrail note in projects/_ops/ covering trigger, allowed actions, stop conditions, rollback, and operator visibility", "Moves the proactive-operations goal toward an explicit safe operating loop instead of a vague ambition", "Guardrail note defines one bounded loop with clear trigger, limits, escalation path, and rollback", "Unlocks a safer proactive-ops prototype without blurring governance boundaries"),
            spec("Analyze", "Recursive-ops failure modes", "analyze the top failure modes for a recursive OpenClaw operations loop, including runaway retries, stale context, and unsafe scope expansion; deliverable: markdown failure-mode note in projects/_ops/", "Keeps the same proactive-ops goal advancing after the first guardrail note is already done", "Failure-mode note names at least 3 realistic risks, why they matter, and one mitigation each", "Unlocks a more trustworthy next proactive-ops experiment"),
            spec("Design", "Operator visibility checklist", "define the operator-visible checkpoints for any recursive operations loop, including when to notify, when to stay quiet, and what proof to record; deliverable: markdown checklist in projects/_ops/", "Strengthens the same proactive-ops goal by improving oversight rather than repeating the original guardrail task", "Checklist clearly distinguishes silent progress, notification thresholds, and required proof artifacts", "Unlocks safer execution of future proactive loops with clearer human visibility"),
        ]

    if 'blender' in goal_lower:
        return [
            spec("Practice", "Blender primitives exercise", "choose one beginner-intermediate Blender exercise focused on primitives, modifiers, or lighting; deliverable: practice brief in projects/creative-practice/ with steps, target outcome, and self-review checklist"),
            spec("Practice", "Blender lighting drill", "prepare one Blender exercise focused on simple lighting and scene readability; deliverable: practice brief in projects/creative-practice/ with setup steps and self-review rubric"),
            spec("Practice", "Blender modifier workflow practice", "prepare one Blender exercise focused on one modifier chain and clean object organization; deliverable: practice brief in projects/creative-practice/ with execution checklist"),
        ]

    if 'after effects' in goal_lower or 'after_effects' in goal_lower:
        return [
            spec("Practice", "AE keyframe practice", "create one After Effects practice brief focused on keyframes, easing, or a simple loop; deliverable: markdown exercise in projects/creative-practice/ with references and execution checklist"),
            spec("Practice", "AE easing drill", "create one After Effects practice brief focused on easing curves and timing polish for a short motion exercise; deliverable: markdown exercise in projects/creative-practice/"),
            spec("Practice", "AE loop timing checklist", "prepare one short After Effects loop exercise with a timing and export checklist; deliverable: markdown exercise in projects/creative-practice/"),
        ]

    if 'unreal' in goal_lower:
        return [
            spec("Practice", "UE scene setup", "prepare one scoped Unreal practice exercise using pre-made assets and one mechanic only; deliverable: scene brief in projects/game-dev/ with setup steps and success checklist"),
            spec("Practice", "UE single-mechanic prototype", "prepare one Unreal exercise centered on one simple mechanic and one test map only; deliverable: practice brief in projects/game-dev/"),
            spec("Practice", "UE graybox flow drill", "prepare one Unreal graybox exercise focused on layout clarity and one interaction checkpoint; deliverable: practice brief in projects/game-dev/"),
        ]

    if 'portfolio' in goal_lower:
        return [
            spec("Analyze", "Portfolio direction check", "rank 3 portfolio directions or existing projects by creative relevance and personal ownership; deliverable: markdown shortlist in projects/portfolio/ with recommendation for what Philippe should build next"),
            spec("Draft", "Portfolio build priority ladder", "define a short priority ladder for the next 3 portfolio-worthy builds, including why each one matters and what proof it should show; deliverable: markdown note in projects/portfolio/"),
            spec("Design", "Portfolio proof checklist", "define the proof checklist a future portfolio piece should satisfy, including authorship, craft, and presentability; deliverable: markdown checklist in projects/portfolio/"),
        ]

    if 'instagram' in goal_lower or 'social' in goal_lower:
        if not has_content_source_work():
            return []
        return [
            spec("Draft", "Instagram content angles", "draft 3 Instagram content angles tied to a specific real work item Philippe has made or is actively building; deliverable: content-plan markdown with hook, named source work item, and posting angle"),
            spec("Draft", "Process-post outline", "draft one process-post outline tied to a real current build, including hook, progress beats, and one supporting image or clip idea; deliverable: markdown note in projects/portfolio/ or projects/creative-practice/"),
            spec("Analyze", "Source-work content shortlist", "identify 3 real current work items that are strongest candidates for content repurposing and explain the best angle for each; deliverable: markdown shortlist in projects/portfolio/"),
        ]

    if 'python' in goal_lower:
        if level == "novice":
            return [
                spec("Practice", "Python practice sheet", "create one beginner Python study sheet on variables, input/output, and simple conditionals; deliverable: markdown lesson in projects/python-learning/ with 5 read-and-predict examples and 3 tiny exercises", proof_override="Lesson includes explanations, read-first examples, and beginner exercises Philippe can complete without advanced concepts"),
                spec("Practice", "Python reading drill", "create one beginner Python reading drill on small scripts using variables and if-statements; deliverable: markdown exercise in projects/python-learning/ with prediction questions and answers", proof_override="Reading drill includes multiple tiny code snippets, prediction prompts, and answer explanations"),
                spec("Practice", "Python micro-script exercise", "create one micro-script exercise focused on input, output, and one branching decision; deliverable: markdown exercise in projects/python-learning/ with starter code and expected behavior", proof_override="Exercise stays beginner-safe and defines one tiny script Philippe can complete without advanced concepts"),
            ]
        if level == "beginner":
            return [
                spec("Practice", "Python practice sheet", "create one guided Python reading-and-practice exercise on functions, loops, or lists; deliverable: markdown exercise in projects/python-learning/ plus a small starter script", proof_override="Exercise includes code reading, prediction questions, and one guided practice task at the current level"),
                spec("Practice", "Python function drill", "create one beginner Python function exercise with parameters, return values, and short test cases; deliverable: markdown exercise in projects/python-learning/"),
                spec("Practice", "Python list-processing exercise", "create one beginner Python exercise focused on list iteration and simple conditionals; deliverable: markdown exercise in projects/python-learning/ with starter code"),
            ]
        return [
            spec("Practice", "Python practice sheet", "create one guided Python practice task that bridges reading and small real-world application; deliverable: markdown exercise in projects/python-learning/ plus starter code", proof_override="Exercise clearly advances the next Python milestone with both comprehension and practice"),
            spec("Practice", "Python utility drill", "create one small Python utility exercise that manipulates simple local data and prints a useful summary; deliverable: markdown exercise in projects/python-learning/ with starter code"),
            spec("Practice", "Python testing drill", "create one guided Python exercise that adds small tests around a simple helper function; deliverable: markdown exercise in projects/python-learning/ plus starter code"),
        ]

    if 'japanese' in goal_lower:
        return [
            spec("Practice", "Japanese study pack", "create one focused Japanese study pack from a single beginner theme; deliverable: markdown lesson in projects/language/ with vocab, readings, and 5 short practice prompts"),
            spec("Practice", "Japanese sentence drill", "create one beginner Japanese sentence drill focused on one grammar pattern and 5 short examples; deliverable: markdown lesson in projects/language/"),
            spec("Practice", "Japanese vocab review set", "create one beginner vocabulary review set from a single practical theme with readings and mini prompts; deliverable: markdown lesson in projects/language/"),
        ]

    if 'business analysis' in goal_lower or 'financial' in goal_lower:
        return [
            spec("Practice", "Business metrics lesson", "create one beginner business-analysis lesson on reading key company metrics and earnings basics; deliverable: markdown lesson in projects/company-research/ with one guided example and 3 short practice prompts", proof_override="Lesson teaches a concrete beginner concept without requiring an unstated ticker list and includes guided practice", unlocks_override="Unlocks later analysis tasks based on real followed companies once the watchlist is defined"),
            spec("Practice", "Earnings-reading drill", "create one beginner drill on reading an earnings snapshot and identifying the few metrics that matter most; deliverable: markdown lesson in projects/company-research/"),
            spec("Analyze", "Company metric comparison template", "create one simple comparison template for reviewing two companies on a small set of core metrics; deliverable: markdown template in projects/company-research/"),
        ]

    if 'equity' in goal_lower or 'futures' in goal_lower:
        return [
            spec("Fix", "Trading bot reliability spec", "identify one safe improvement opportunity in the trading-bot workspace, such as diagnostics, reporting, review tooling, or non-execution reliability; deliverable: markdown spec in the relevant bot project notes folder", proof_override="Spec targets a real bot-support improvement and avoids unsafe live-trading config changes", unlocks_override="Unlocks a higher-quality system improvement task for the trading bots"),
            spec("Analyze", "Bot diagnostics gap review", "review the current bot support flow and identify one diagnostics or reporting blind spot worth fixing next; deliverable: markdown note in the relevant bot project notes folder"),
            spec("Draft", "Trading review-tool improvement brief", "define one small review or reporting helper that would improve confidence in bot behavior without touching live trading config; deliverable: markdown brief in the relevant bot project notes folder"),
        ]

    if 'trading' in goal_lower:
        return [
            spec("Analyze", "Trading setup checklist", "prepare one market-prep checklist for the next trading session; deliverable: markdown checklist in projects/trading-briefs/ covering watchlist, setups, invalidation, and risk rules"),
            spec("Draft", "Watchlist decision rubric", "define one short rubric for deciding which tickers or markets deserve attention in the next session; deliverable: markdown note in projects/trading-briefs/"),
            spec("Analyze", "Setup invalidation checklist", "prepare one checklist focused only on invalidation and risk-exit rules for the next trading session; deliverable: markdown checklist in projects/trading-briefs/"),
        ]

    if 'automate' in goal_lower:
        return [
            spec("Fix", "Workspace automation helper", "build one small automation utility that addresses one specific documented workspace friction point; deliverable: working script in scripts/ or projects/automation/ with a clear run command and verifiable output", proof_override="Script runs on a real workspace example, is bounded to one specific task, and produces an observable result without touching openclaw.json or live config"),
            spec("Analyze", "Workspace friction shortlist", "identify 3 concrete workspace frictions that are good automation candidates and rank them by payoff and implementation safety; deliverable: markdown shortlist in projects/automation/"),
            spec("Design", "Automation helper acceptance test", "define the acceptance test for one future workspace automation helper, including input sample, expected output, and rollback behavior; deliverable: markdown test note in projects/automation/"),
        ]

    if 'openclaw' in goal_lower:
        return [
            spec("Fix", "OpenClaw helper utility", "build one small OpenClaw helper utility, such as a diagnostics view, status reporter, or glue script that makes one known operational task faster; deliverable: working script in scripts/ plus short usage note", proof_override="Script runs on a real OpenClaw workspace task, has a clear use case, and avoids openclaw.json or auth/routing mutations"),
            spec("Analyze", "OpenClaw operator friction shortlist", "identify 3 concrete operator frictions in current OpenClaw use and rank them by frequency, annoyance, and implementation safety; deliverable: markdown shortlist in projects/_ops/"),
            spec("Draft", "OpenClaw helper usage contract", "define the usage contract for one future OpenClaw helper, including inputs, expected output, and safe failure behavior; deliverable: markdown note in projects/_ops/"),
        ]

    if 'saas' in goal_lower or 'product' in goal_lower:
        return [
            spec("Draft", "Thin MVP increment", "define one thin MVP increment with explicit scope, dependencies, and success criteria; deliverable: spec note in the relevant project folder"),
            spec("Analyze", "MVP dependency check", "identify the minimum dependencies and blockers for one thin MVP increment; deliverable: markdown note in the relevant project folder"),
            spec("Design", "MVP success checklist", "define the success checklist for one thin MVP increment, including user-visible proof and rollback; deliverable: markdown note in the relevant project folder"),
        ]

    if 'partnership' in goal_lower or 'community' in goal_lower:
        return [
            spec("Draft", "Outreach target list", "create a ranked outreach target list of 10 relevant people or communities; deliverable: markdown list in projects/outreach/ with rationale"),
            spec("Analyze", "Partnership fit criteria", "define the criteria that make a partnership or community target worth pursuing; deliverable: markdown note in projects/outreach/"),
            spec("Draft", "Outreach message angle set", "draft 3 message angles suitable for future outreach to relevant people or communities; deliverable: markdown note in projects/outreach/"),
        ]

    cleaned_goal = clean_goal_title(goal)
    return [
        spec("Draft", cleaned_goal, f"define one concrete next-step deliverable for this goal: {goal}; deliverable: markdown note with exact output, success criteria, and next action"),
        spec("Analyze", f"{cleaned_goal} constraints", f"identify the main constraints, unknowns, or blockers around this goal and rank them by importance; deliverable: markdown note with recommended next move for: {goal}"),
        spec("Design", f"{cleaned_goal} success checklist", f"define the success checklist and review criteria for one believable next step toward this goal; deliverable: markdown note with proof markers and rollback for: {goal}"),
    ]


def synthesize_task(goal, category, use_assessment_bias=False, variant_index=0):
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

    variants = _variant_specs_for_goal(goal, goal_lower, goal_type, skill, level, why, proof, unlocks)
    if variant_index >= len(variants):
        return None

    variant = dict(variants[variant_index])
    task_prefix = variant["prefix"]
    task_title = variant["title"]
    task_desc = variant["desc"]
    why = variant["why"]
    proof = variant["proof"]
    unlocks = variant["unlocks"]

    focus_dimension = None
    if use_assessment_bias and skill and skill in DIMENSION_FOCUS:
        task_desc, focus_dimension = bias_toward_weakest_dimension(skill, task_desc)
        if focus_dimension:
            focus_text = DIMENSION_FOCUS.get(skill, {}).get(focus_dimension, "")
            if focus_text:
                unlocks = f"Focus on {focus_text}. {unlocks}"

    def _short_title(goal, category, prefix, task_desc):
        fallback = task_desc.split(";")[0].strip()
        for pfx in ("create one ", "identify ", "build ", "prepare ", "define ", "choose one ", "draft ", "review ", "compare ", "spec "):
            if fallback.startswith(pfx):
                fallback = fallback[len(pfx):]
        if fallback.lower().startswith("one concrete next-step deliverable for this goal:"):
            return clean_goal_title(goal)
        return shorten_generated_title(fallback.capitalize())

    task_title = task_title or _short_title(goal, category, task_prefix, task_desc)
    return build_task_text(category, task_prefix, task_title, task_desc, why, proof, unlocks)


def maybe_add_surprise_mvp(tasks, goals, seen_keys, blocked_task_keys, blocked_deliverables):
    """Add at most one useful surprise MVP in system/tool/project-improvement lanes."""
    if MAX_SURPRISE_MVP <= 0 or len(tasks) >= NUM_TASKS:
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

    if "japanese" in goal_text or "business analysis" in goal_text or ("python" in goal_text and any(term in goal_text for term in ("learn", "study", "practice", "beginner", "basics"))):
        candidates.extend([
            "[Personal] 🎁 Surprise MVP: build a tiny learning helper for Japanese, Python, or business-analysis practice, such as a prompt generator, drill picker, or review tracker; deliverable: small working tool or spec in projects/learning-tools/ | Why: A useful learning helper can turn practice into a repeatable daily habit | Proof: Tool or spec supports one real daily exercise loop without requiring advanced setup | Unlocks: Better consistency in staged skill development"
        ])

    filtered = [c for c in candidates if task_passes_generation_filters(c, seen_keys, blocked_task_keys, blocked_deliverables)]
    if not filtered:
        return tasks

    surprise = filtered[0]
    tasks.append(surprise)
    return tasks[:NUM_TASKS]


def interleave_goals_by_category(goals):
    ordered = []
    buckets = {category: list(items) for category, items in goals.items() if items}
    categories = list(buckets.keys())
    index = 0

    while buckets:
        category = categories[index % len(categories)]
        items = buckets.get(category)
        if items:
            ordered.append((category, items.pop(0)))
            if not items:
                buckets.pop(category, None)
        categories = [name for name in categories if name in buckets]
        if not categories:
            break
        index += 1

    return ordered


def generate_tasks(goals):
    """Generate 4-5 actionable tasks from goals using structured synthesis."""
    all_goals = interleave_goals_by_category(goals)

    if not all_goals:
        return []

    completed_deliverables = get_completed_deliverables()
    existing_deliverables = get_existing_autonomous_deliverables()
    blocked_deliverables = completed_deliverables | existing_deliverables
    blocked_task_keys = get_generation_blocked_task_keys()

    use_assessment_bias = os.environ.get("TASK_ASSESSMENT_BIAS", "false").lower() == "true"

    tasks = []
    seen_keys = set()

    for variant_index in range(GENERATION_VARIANT_ROUNDS):
        if len(tasks) >= NUM_TASKS:
            break
        for category, goal in all_goals:
            if len(tasks) >= NUM_TASKS:
                break
            task = synthesize_task(goal, category, use_assessment_bias=use_assessment_bias, variant_index=variant_index)
            if not task:
                continue
            if not task_passes_generation_filters(task, seen_keys, blocked_task_keys, blocked_deliverables):
                continue

            tasks.append(task)
            remember_generated_task(task, seen_keys, blocked_deliverables)

    tasks = maybe_add_surprise_mvp(tasks, goals, seen_keys, blocked_task_keys, blocked_deliverables)
    return tasks[:NUM_TASKS]


def read_autonomous_file():
    """Read AUTONOMOUS.md and extract only bullet goals under the ## Goals section."""
    if not AUTONOMOUS_FILE.exists():
        return {}, []

    content = AUTONOMOUS_FILE.read_text()

    goals = {}
    current_section = None
    current_goals = []
    in_goals_section = False

    for line in content.split('\n'):
        section_match = re.match(r'^##\s+(.+?)\s*$', line)
        if section_match:
            section_name = section_match.group(1).strip().lower()
            if section_name == "goals":
                in_goals_section = True
                current_section = None
                current_goals = []
                continue

            if in_goals_section:
                if current_section and current_goals:
                    goals[current_section] = current_goals
                in_goals_section = False
                current_section = None
                current_goals = []
            continue

        if not in_goals_section:
            continue

        subsection_match = re.match(r'^###\s+(.+?)\s*$', line)
        if subsection_match:
            if current_section and current_goals:
                goals[current_section] = current_goals
            current_section = subsection_match.group(1).strip()
            current_goals = []
            continue

        if line.strip().startswith('- '):
            candidate = line.strip()[2:].strip()
            # Guardrail: keep Goals section clean, ignore task-like lines
            if candidate.startswith('[') or 'success:' in candidate.lower():
                continue
            current_goals.append(candidate)

    if in_goals_section and current_section and current_goals:
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


def parse_tasks_log_date(raw_timestamp):
    try:
        return datetime.strptime((raw_timestamp or "")[:10], "%Y-%m-%d")
    except ValueError:
        return None



def extract_completed_task_label(log_line):
    match = re.match(r'- ✅ \[([^\]]+)\]\s+(.*)$', (log_line or '').strip())
    if not match:
        return ""

    remainder = match.group(2).strip()
    remainder = re.sub(r'^\[[^\]]+\]\s+', '', remainder, count=1)
    remainder = re.split(r'\s+\|\s+Output:\s+', remainder, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    remainder = re.sub(r'^Queue replay handled:\s*', '', remainder, flags=re.IGNORECASE)
    return remainder.strip()



def get_recent_completed_task_keys(days=14):
    """Read recent completion-history task keys from tasks-log.md."""
    if not TASKS_LOG_FILE.exists():
        return set()

    recent = set()
    cutoff = datetime.now() - timedelta(days=days)

    for line in TASKS_LOG_FILE.read_text().splitlines():
        match = re.match(r'- ✅ \[([^\]]+)\]', line)
        if not match:
            continue
        task_date = parse_tasks_log_date(match.group(1))
        if not task_date or task_date < cutoff:
            continue
        label = extract_completed_task_label(line)
        key = normalize_legacy_task_key(label)
        match_key = normalize_task_match_key(label)
        if key:
            recent.add(key)
        if match_key:
            recent.add(match_key)

    return recent



def get_structured_active_task_keys():
    """Return normalized keys for active structured tasks so generation does not resurrect them into backlog."""
    store = load_structured_task_store()
    keys = set()

    for task in store.get("tasks", []):
        if not isinstance(task, dict) or task.get("status") == "done":
            continue
        link = task.get("linkedAutonomyRef") or {}
        linked_key = normalize_legacy_task_key(link.get("taskText") or "")
        title_key = normalize_legacy_task_key(task.get("title", ""))
        linked_match_key = normalize_task_match_key(link.get("taskText") or "")
        title_match_key = normalize_task_match_key(task.get("title", ""))
        if linked_key:
            keys.add(linked_key)
        if title_key:
            keys.add(title_key)
        if linked_match_key:
            keys.add(linked_match_key)
        if title_match_key:
            keys.add(title_match_key)

    return keys



def get_structured_done_task_keys():
    """Return normalized keys for done structured tasks to avoid stale backlog carry-forward."""
    store = load_structured_task_store()
    keys = set()

    for task in store.get("tasks", []):
        if not isinstance(task, dict) or task.get("status") != "done":
            continue
        link = task.get("linkedAutonomyRef") or {}
        linked_key = normalize_legacy_task_key(link.get("taskText") or "")
        title_key = normalize_legacy_task_key(task.get("title", ""))
        linked_match_key = normalize_task_match_key(link.get("taskText") or "")
        title_match_key = normalize_task_match_key(task.get("title", ""))
        if linked_key:
            keys.add(linked_key)
        if title_key:
            keys.add(title_key)
        if linked_match_key:
            keys.add(linked_match_key)
        if title_match_key:
            keys.add(title_match_key)

    return keys



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


def normalize_task_text(text):
    return re.sub(r'\s+', ' ', (text or '').strip()).lower()


def normalize_legacy_task_key(text):
    if not text:
        return ""
    first_line = ""
    for line in str(text).replace("\r\n", "\n").split("\n"):
        stripped = line.strip()
        if stripped:
            first_line = stripped
            break
    if not first_line:
        return ""
    first_line = re.sub(r'^[-*]\s+', '', first_line)
    return normalize_task_text(first_line)



def normalize_task_match_key(text):
    """Normalize task identity while ignoring leading category tags like [Career]."""
    key = normalize_legacy_task_key(text)
    if not key:
        return ""
    return normalize_task_text(strip_category_tag(key))



def load_structured_task_store():
    if not MISSION_CONTROL_TASK_STORE.exists():
        return {"tasks": [], "meta": {"schemaVersion": 2, "updatedAt": 0, "suppressedLegacyTaskKeys": []}}
    try:
        data = json.loads(MISSION_CONTROL_TASK_STORE.read_text())
        if not isinstance(data, dict):
            raise ValueError("task store must be a JSON object")
    except (json.JSONDecodeError, IOError, ValueError):
        return {"tasks": [], "meta": {"schemaVersion": 2, "updatedAt": 0, "suppressedLegacyTaskKeys": []}}

    data.setdefault("tasks", [])
    data.setdefault("meta", {})
    data["meta"].setdefault("schemaVersion", 2)
    data["meta"].setdefault("updatedAt", 0)
    data["meta"].setdefault("suppressedLegacyTaskKeys", [])
    return data



def get_suppressed_legacy_task_keys():
    store = load_structured_task_store()
    suppressed = store.get("meta", {}).get("suppressedLegacyTaskKeys", [])
    return {entry for entry in suppressed if isinstance(entry, str) and entry.strip()}



def get_existing_open_backlog_task_map():
    """Read current Open Backlog task blocks from AUTONOMOUS.md keyed by normalized first line."""
    if not AUTONOMOUS_FILE.exists():
        return {}

    content = AUTONOMOUS_FILE.read_text()
    in_open_backlog = False
    current_block = []
    task_map = {}

    def flush_current_block():
        nonlocal current_block
        if not current_block:
            return
        block_lines = current_block[:]
        block_lines[0] = re.sub(r'^[-*]\s+', '', block_lines[0].lstrip())
        block = "\n".join(block_lines).strip()
        normalized = normalize_legacy_task_key(block)
        if normalized:
            existing = task_map.get(normalized, "")
            if len(block) > len(existing):
                task_map[normalized] = block
        current_block = []

    for line in content.splitlines():
        stripped = line.strip()
        if stripped == "## Open Backlog":
            in_open_backlog = True
            current_block = []
            continue
        if in_open_backlog and stripped.startswith("## "):
            break
        if not in_open_backlog:
            continue
        if stripped.startswith("- "):
            flush_current_block()
            current_block = [line.rstrip()]
            continue
        if current_block:
            current_block.append(line.rstrip())

    flush_current_block()
    return task_map


def get_current_open_backlog_tasks():
    """Read the current Open Backlog task texts, preferring the structured task store."""
    store = load_structured_task_store()
    tasks = []
    markdown_task_map = get_existing_open_backlog_task_map()

    structured_backlog = sorted(
        [task for task in store.get("tasks", []) if task.get("status") == "backlog"],
        key=lambda task: task.get("columnOrder", 0),
    )
    for task in structured_backlog:
        link = task.get("linkedAutonomyRef") or {}
        linked_text = (link.get("taskText") or "").strip()
        fallback_title = (task.get("title") or "").strip()
        normalized = normalize_legacy_task_key(linked_text or fallback_title)
        task_text = linked_text or fallback_title
        markdown_text = markdown_task_map.get(normalized, "")
        if markdown_text and len(markdown_text) > len(task_text):
            task_text = markdown_text
        if task_text:
            tasks.append(task_text)

    if tasks:
        return tasks

    if not AUTONOMOUS_FILE.exists():
        return []

    content = AUTONOMOUS_FILE.read_text()
    in_open_backlog = False

    for line in content.splitlines():
        stripped = line.strip()
        if stripped == "## Open Backlog":
            in_open_backlog = True
            continue
        if in_open_backlog and stripped.startswith("## "):
            break
        if in_open_backlog and stripped.startswith("- "):
            task = stripped[2:].strip()
            if task and not task.startswith("*("):
                tasks.append(task)

    return tasks



def get_current_open_backlog_task_keys():
    keys = set()
    for task in get_current_open_backlog_tasks():
        key = normalize_legacy_task_key(task)
        match_key = normalize_task_match_key(task)
        if key:
            keys.add(key)
        if match_key:
            keys.add(match_key)
    return keys



def get_generation_blocked_task_keys():
    blocked = set()
    blocked.update(get_suppressed_legacy_task_keys())
    blocked.update(get_structured_active_task_keys())
    blocked.update(get_structured_done_task_keys())
    blocked.update(get_recent_completed_task_keys())
    blocked.update(get_current_open_backlog_task_keys())
    return blocked



def task_passes_generation_filters(task, seen_keys, blocked_task_keys, blocked_deliverables):
    key = normalize_legacy_task_key(task)
    match_key = normalize_task_match_key(task)

    if not key or key in seen_keys or match_key in seen_keys:
        return False
    if key in blocked_task_keys or match_key in blocked_task_keys:
        return False

    lowered = task.lower().strip()
    if any(phrase in lowered for phrase in DISALLOWED_TASK_PHRASES):
        return False

    if any(phrase in lowered for phrase in REQUIRES_NAMED_SUBJECT_PHRASES) and "named ticker" not in lowered and "shortlist" not in lowered and "template" not in lowered:
        return False

    task_deliverables = extract_deliverable_paths(task)
    if task_deliverables and task_deliverables & blocked_deliverables:
        return False

    return True



def build_combined_backlog_tasks(new_tasks):
    suggestion_tasks = get_active_suggestion_tasks()
    existing_backlog_tasks = get_current_open_backlog_tasks()
    suppressed = get_suppressed_legacy_task_keys()
    active_structured_keys = get_structured_active_task_keys()
    done_structured_keys = get_structured_done_task_keys()
    recent_completed_keys = get_recent_completed_task_keys()
    combined = []
    seen = set()

    def add_task(task, source="generated"):
        if len(combined) >= NUM_TASKS:
            return
        key = normalize_legacy_task_key(task)
        match_key = normalize_task_match_key(task)
        if not key or key in seen or key in suppressed:
            return
        if source != "existing-backlog" and (
            key in active_structured_keys or match_key in active_structured_keys or
            key in recent_completed_keys or match_key in recent_completed_keys or
            key in done_structured_keys or match_key in done_structured_keys
        ):
            return
        if source == "existing-backlog" and (
            key in recent_completed_keys or match_key in recent_completed_keys or
            key in done_structured_keys or match_key in done_structured_keys
        ):
            return
        combined.append(task)
        seen.add(key)

    # Add newly generated tasks first. This ensures fresh generated tasks are never
    # silently dropped when suggestions or existing backlog already fill NUM_TASKS,
    # while still avoiding active-task and recent-completion duplicates.
    for task in new_tasks:
        add_task(task, source="generated")

    # Fill remaining slots with existing backlog tasks (de-duped against new tasks).
    # This preserves older in-flight work when there's room for it.
    for task in existing_backlog_tasks:
        add_task(task, source="existing-backlog")

    # Suggestions fill any final remaining slots.
    for task in suggestion_tasks:
        add_task(task, source="suggestion")

    return combined



def sync_generated_backlog_to_structured_store(backlog_tasks):
    """Ensure generated AUTONOMOUS backlog tasks also exist in the structured MC task store."""
    store = load_structured_task_store()
    tasks = store.get("tasks", [])
    meta = store.get("meta", {})
    suppressed = {entry for entry in meta.get("suppressedLegacyTaskKeys", []) if isinstance(entry, str) and entry.strip()}
    existing_ids = {task.get("id") for task in tasks if isinstance(task, dict) and task.get("id")}
    existing_norms = set()
    existing_tasks_by_norm = {}
    backlog_max_order = -1

    for task in tasks:
        if not isinstance(task, dict):
            continue
        link = task.get("linkedAutonomyRef") or {}
        linked_norm = normalize_legacy_task_key(link.get("taskText") or task.get("title", ""))
        title_norm = normalize_legacy_task_key(task.get("title", ""))
        if linked_norm:
            existing_norms.add(linked_norm)
            existing_tasks_by_norm.setdefault(linked_norm, []).append(task)
        if title_norm:
            existing_norms.add(title_norm)
            existing_tasks_by_norm.setdefault(title_norm, []).append(task)
        if task.get("status") == "backlog":
            backlog_max_order = max(backlog_max_order, int(task.get("columnOrder", 0) or 0))

    def unique_task_id(title):
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:48].rstrip('-') or 'task'
        candidate = slug
        suffix = 2
        while candidate in existing_ids:
            candidate = f"{slug}-{suffix}"
            suffix += 1
        existing_ids.add(candidate)
        return candidate

    added = 0
    updated_existing = 0
    now_ms = int(datetime.now().timestamp() * 1000)
    for task_text in backlog_tasks:
        normalized = normalize_legacy_task_key(task_text)
        parsed_title, parsed_description = extract_task_title_and_description(task_text)

        matching_tasks = existing_tasks_by_norm.get(normalized, [])
        preferred_match = None
        for candidate in matching_tasks:
            if candidate.get("status") == "backlog":
                preferred_match = candidate
                break
        if preferred_match is None and matching_tasks:
            preferred_match = matching_tasks[0]

        if preferred_match is not None:
            link = preferred_match.setdefault("linkedAutonomyRef", {})
            existing_text = (link.get("taskText") or "").strip()
            richer_text = task_text.strip()
            changed = False
            if richer_text and len(richer_text) > len(existing_text):
                link["taskText"] = task_text
                link["taskTextNormalized"] = normalized
                changed = True
            if parsed_description and (not preferred_match.get("description") or len(parsed_description) > len(preferred_match.get("description") or "")):
                preferred_match["description"] = parsed_description
                changed = True
            if changed:
                preferred_match["updatedAt"] = now_ms
                preferred_match["version"] = int(preferred_match.get("version", 1) or 1) + 1
                updated_existing += 1
            continue

        if not normalized or normalized in suppressed or normalized in existing_norms:
            continue
        backlog_max_order += 1
        tasks.append({
            "id": unique_task_id(task_text),
            "title": parsed_title,
            "description": parsed_description,
            "status": "backlog",
            "priority": "normal",
            "sourceType": "generated",
            "agentTarget": "marvin",
            "createdAt": now_ms,
            "updatedAt": now_ms,
            "version": 1,
            "columnOrder": backlog_max_order,
            "editable": True,
            "chatAnnouncementSent": False,
            "feedback": [],
            "artifacts": [],
            "linkedAutonomyRef": {
                "kind": "autonomous-md",
                "sourceFile": str(AUTONOMOUS_FILE),
                "section": "open-backlog",
                "taskText": task_text,
                "taskTextNormalized": normalized,
            },
            "sourceMeta": {
                "generator": {
                    "createdBy": "daily-task-generator",
                    "createdAt": now_ms,
                }
            },
        })
        existing_norms.add(normalized)
        added += 1

    if added > 0 or updated_existing > 0:
        meta["updatedAt"] = now_ms
        meta["schemaVersion"] = 2
        meta["suppressedLegacyTaskKeys"] = sorted(suppressed)
        store["tasks"] = tasks
        store["meta"] = meta
        MISSION_CONTROL_TASK_STORE.write_text(json.dumps(store, indent=2) + "\n")

    return added



def update_autonomous_file(new_tasks):
    """Update AUTONOMOUS.md by preserving existing backlog and only topping back up to NUM_TASKS."""

    existing_backlog_keys = get_current_open_backlog_task_keys()
    combined = build_combined_backlog_tasks(new_tasks)
    content = AUTONOMOUS_FILE.read_text()
    original_content = content

    new_section = "## Open Backlog\n\n"
    if combined:
        for task in combined:
            new_section += f"- {task}\n"
    else:
        new_section += "*(Empty - no active tasks)*\n"

    if "## Open Backlog" in content:
        pattern = r'## Open Backlog\s*\n.*?(?=\n##|\Z)'
        content = re.sub(pattern, new_section.rstrip() + "\n\n", content, flags=re.DOTALL)
    else:
        content += "\n" + new_section

    # Remove known-empty structural sections so stale placeholders do not linger.
    content = re.sub(r'\n## In Progress\s*\n(?=\n##|\Z)', '\n', content, flags=re.DOTALL)

    markdown_changed = content != original_content
    if markdown_changed:
        AUTONOMOUS_FILE.write_text(content)

    added_to_store = sync_generated_backlog_to_structured_store(combined)
    new_backlog_entries = count_new_backlog_entries(combined, existing_backlog_keys)
    return len(combined), added_to_store, markdown_changed, new_backlog_entries


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
            timeout=KANBAN_SYNC_TIMEOUT_SECONDS,
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
        timeout=KANBAN_GIT_TIMEOUT_SECONDS,
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
        timeout=KANBAN_GIT_TIMEOUT_SECONDS,
    ).stdout.strip()

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    message = f"chore(kanban): sync board snapshot ({timestamp})"

    try:
        subprocess.run(["git", "add", rel_board], cwd=WORKSPACE, check=True, timeout=KANBAN_GIT_TIMEOUT_SECONDS)
        subprocess.run(["git", "commit", "-m", message], cwd=WORKSPACE, check=True, timeout=KANBAN_GIT_TIMEOUT_SECONDS)
        subprocess.run(["git", "push", "origin", branch], cwd=WORKSPACE, check=True, timeout=KANBAN_PUSH_TIMEOUT_SECONDS)
        print(f"Published kanban board to origin/{branch}")
    except subprocess.TimeoutExpired as exc:
        print(f"Kanban publish timed out after {exc.timeout}s: {exc.cmd}")
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
        added_count, store_added_count, markdown_changed, new_backlog_entries = update_autonomous_file(new_tasks)
        print(f"Generated {len(new_tasks)} task candidates → AUTONOMOUS.md backlog has {added_count} items")
        print(f"New backlog entries added this run: {new_backlog_entries}")
        print(f"Structured Tasks store sync: {store_added_count} new backlog entr{'y' if store_added_count == 1 else 'ies'} added")
        print(f"AUTONOMOUS.md {'updated' if markdown_changed else 'unchanged'}")
        if new_backlog_entries < len(new_tasks):
            print(f"  NOTE: {len(new_tasks) - new_backlog_entries} generated task candidate(s) were filtered against active tasks, recent completions, existing backlog, suggestions, or suppressed deletions")
        print_created_tasks(new_tasks)
    else:
        new_backlog_entries = 0
        print("No goals found in AUTONOMOUS.md")

    if sync_kanban_board_json():
        publish_kanban_board_if_changed()

    print(build_completion_line(new_backlog_entries))
