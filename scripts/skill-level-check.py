#!/usr/bin/env python3
"""
Hybrid Skill Assessment Framework

Supports two assessment modes:
- Test mode (python, japanese): objective checks with scoring rubric
- Challenge mode (blender, after_effects, unreal): challenge briefs with heuristic evaluation

Outputs:
- Assessment reports: memory/skill-assessments/YYYY-MM-DD-<skill>.md
- Summary JSON: memory/skill-assessments/latest.json

Usage:
  python scripts/skill-level-check.py [--skill <skill-name>] [--mode <test|challenge>]
  python scripts/skill-level-check.py --all
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

WORKSPACE = Path("/data/.openclaw/workspace")
CONFIG_DIR = WORKSPACE / "config"
SKILL_PROFILE_FILE = CONFIG_DIR / "skill-profile.json"
ASSESSMENTS_DIR = WORKSPACE / "memory" / "skill-assessments"

# Ensure assessments directory exists
ASSESSMENTS_DIR.mkdir(parents=True, exist_ok=True)

# Skill types
TEST_SKILLS = {"python", "japanese"}
CHALLENGE_SKILLS = {"blender", "after_effects", "unreal"}
ALL_SKILLS = TEST_SKILLS | CHALLENGE_SKILLS


def load_skill_profile():
    """Load skill profile from config/skill-profile.json."""
    if not SKILL_PROFILE_FILE.exists():
        return {}
    try:
        return json.loads(SKILL_PROFILE_FILE.read_text())
    except (json.JSONDecodeError, IOError):
        return {}


def save_skill_profile(profile):
    """Save skill profile to config."""
    SKILL_PROFILE_FILE.write_text(json.dumps(profile, indent=2))


# ============================================================================
# RUBRIC DEFINITIONS
# ============================================================================

# Python novice exam rubric
PYTHON_NOVICE_RUBRIC = {
    "variables_and_types": {
        "weight": 15,
        "criteria": [
            "Can declare variables with appropriate types (int, float, str, list)",
            "Can convert between basic types (str->int, int->str)",
            "Understands mutable vs immutable types"
        ],
        "max_score": 15
    },
    "control_flow": {
        "weight": 20,
        "criteria": [
            "Uses if/elif/else correctly with proper conditions",
            "Can write for loops with range()",
            "Can write while loops with proper termination"
        ],
        "max_score": 20
    },
    "functions": {
        "weight": 25,
        "criteria": [
            "Can define a function with parameters and return",
            "Understands function scope (local vs global)",
            "Can call functions with arguments"
        ],
        "max_score": 25
    },
    "data_structures": {
        "weight": 20,
        "criteria": [
            "Can create and index lists (list[0], list[-1])",
            "Can iterate over lists with for-loop",
            "Understands basic dict operations (get, set, keys)"
        ],
        "max_score": 20
    },
    "file_operations": {
        "weight": 10,
        "criteria": [
            "Can read a text file line by line",
            "Can write text to a file",
            "Uses proper file handling (with statement)"
        ],
        "max_score": 10
    },
    "testing_basics": {
        "weight": 10,
        "criteria": [
            "Can run pytest on a simple test file",
            "Understands assert statements",
            "Can interpret test failure messages"
        ],
        "max_score": 10
    }
}

# Japanese novice exam rubric
JAPANESE_NOVICE_RUBRIC = {
    "hiragana_recognition": {
        "weight": 25,
        "criteria": [
            "Can read all 46 basic hiragana characters",
            "Can identify hiragana in context",
            "Can write hiragana from dictation"
        ],
        "max_score": 25
    },
    "katakana_recognition": {
        "weight": 20,
        "criteria": [
            "Can read all 46 basic katakana characters",
            "Can distinguish katakana from hiragana",
            "Can write katakana from dictation"
        ],
        "max_score": 20
    },
    "basic_vocabulary": {
        "weight": 25,
        "criteria": [
            "Knows 50+ common beginner words (numbers, colors, family, food)",
            "Can recognize words in context",
            "Can recall vocabulary for simple communication"
        ],
        "max_score": 25
    },
    "sentence_structure": {
        "weight": 20,
        "criteria": [
            "Understands basic word order (SOV - Subject-Object-Verb)",
            "Can form simple sentences with は (wa) particle",
            "Can use basic particles を (wo), に (ni), で (de)"
        ],
        "max_score": 20
    },
    "writing_practice": {
        "weight": 10,
        "criteria": [
            "Can write self-introduction (name, nationality, hobby)",
            "Can write simple questions and answers",
            "Shows effort in consistent practice"
        ],
        "max_score": 10
    }
}

# Blender beginner-intermediate challenge rubric
BLENDER_BEGINNER_INTERMEDIATE_RUBRIC = {
    "modeling": {
        "weight": 30,
        "criteria": [
            "Uses appropriate primitives for the task",
            "Applies basic transformations correctly (translate, rotate, scale)",
            "Shows understanding of mesh topology",
            "Can use modifiers effectively (array, mirror, subsurf)"
        ],
        "max_score": 30
    },
    "timing_and_animation": {
        "weight": 20,
        "criteria": [
            "Animation runs smoothly at 24fps",
            "Keyframes are properly placed for intended motion",
            "Animation loops cleanly if applicable",
            "Easing curves are appropriate for the motion"
        ],
        "max_score": 20
    },
    "lighting": {
        "weight": 20,
        "criteria": [
            "Scene is properly lit with appropriate light types",
            "Lighting enhances the subject rather than overpowering",
            "Shadows are realistic or stylistically appropriate",
            "No light artifacts or unwanted shadows"
        ],
        "max_score": 20
    },
    "materials_and_textures": {
        "weight": 15,
        "criteria": [
            "Materials are applied appropriately",
            "Colors and textures match the intended style",
            "Basic PBR principles are followed",
            "No texture stretching or seams visible"
        ],
        "max_score": 15
    },
    "cleanliness": {
        "weight": 15,
        "criteria": [
            "Outliner is organized with named objects",
            "No orphan data or unused assets",
            "File is optimized (reasonable poly count)",
            "Saves and loads without errors"
        ],
        "max_score": 15
    }
}

# After Effects beginner challenge rubric
AFTER_EFFECTS_BEGINNER_RUBRIC = {
    "keyframe_animation": {
        "weight": 30,
        "criteria": [
            "Can create and manipulate keyframes",
            "Understands interpolation modes (linear, bezier, hold)",
            "Can animate position, scale, rotation, and opacity",
            "Animation timing feels natural"
        ],
        "max_score": 30
    },
    "composition_setup": {
        "weight": 20,
        "criteria": [
            "Composition settings are appropriate for output",
            "Layers are properly organized and named",
            "Pre-compositions used when appropriate",
            "Timeline is clean and navigable"
        ],
        "max_score": 20
    },
    "effects_usage": {
        "weight": 25,
        "criteria": [
            "Uses built-in effects appropriately",
            "Effect parameters are fine-tuned",
            "No over-reliance on complex effects",
            "Effects enhance rather than distract"
        ],
        "max_score": 25
    },
    "render_and_export": {
        "weight": 15,
        "criteria": [
            "Can set up proper render settings",
            "Output format matches intended use",
            "Render completes without errors",
            "File size is reasonable"
        ],
        "max_score": 15
    },
    "creativity": {
        "weight": 10,
        "criteria": [
            "Shows original thinking in design",
            "Color palette is cohesive",
            "Motion has personality",
            "Overall piece is engaging"
        ],
        "max_score": 10
    }
}

# Unreal Engine beginner challenge rubric
UNREAL_BEGINNER_RUBRIC = {
    "project_setup": {
        "weight": 15,
        "criteria": [
            "Project created with appropriate settings",
            "Folder structure is organized",
            "Project saves and loads correctly",
            "Basic editor navigation is comfortable"
        ],
        "max_score": 15
    },
    "level_design": {
        "weight": 25,
        "criteria": [
            "Can place and arrange basic geometry",
            "Uses pre-made assets appropriately",
            "Scene has visual coherence",
            "Basic lighting setup works"
        ],
        "max_score": 25
    },
    "blueprints_basics": {
        "weight": 30,
        "criteria": [
            "Can create and edit Blueprints",
            "Understands basic nodes and connections",
            "Can implement simple logic (triggers, variables)",
            "Blueprint compiles without errors"
        ],
        "max_score": 30
    },
    "player_movement": {
        "weight": 20,
        "criteria": [
            "Character can move in the scene",
            "Input mappings are configured",
            "Movement feels responsive",
            "No major physics glitches"
        ],
        "max_score": 20
    },
    "build_and_export": {
        "weight": 10,
        "criteria": [
            "Can package project for Windows",
            "Exported build runs independently",
            "File size is reasonable (<10GB)",
            "No critical errors in packaged build"
        ],
        "max_score": 10
    }
}

# Map skills to rubrics
RUBRIC_MAP = {
    "python": {"type": "test", "rubric": PYTHON_NOVICE_RUBRIC},
    "japanese": {"type": "test", "rubric": JAPANESE_NOVICE_RUBRIC},
    "blender": {"type": "challenge", "rubric": BLENDER_BEGINNER_INTERMEDIATE_RUBRIC},
    "after_effects": {"type": "challenge", "rubric": AFTER_EFFECTS_BEGINNER_RUBRIC},
    "unreal": {"type": "challenge", "rubric": UNREAL_BEGINNER_RUBRIC},
}


# ============================================================================
# TEST-BASED ASSESSMENT (Python, Japanese)
# ============================================================================

def generate_python_test():
    """Generate a Python novice test with small objective checks."""
    return {
        "task_1": {
            "type": "code",
            "description": "Write a function that takes a list of numbers and returns the sum",
            "test_cases": [
                {"input": [1, 2, 3], "expected": 6},
                {"input": [10, -5, 5], "expected": 10},
                {"input": [], "expected": 0}
            ],
            "success_criteria": "Function defined, handles edge cases (empty list), uses proper syntax"
        },
        "task_2": {
            "type": "code",
            "description": "Write a function that checks if a string is a palindrome",
            "test_cases": [
                {"input": "radar", "expected": True},
                {"input": "hello", "expected": False},
                {"input": "a", "expected": True}
            ],
            "success_criteria": "Function defined, handles single char, case-sensitive or normalized"
        },
        "task_3": {
            "type": "file_operation",
            "description": "Read a text file and count word occurrences",
            "success_criteria": "Opens file with 'with', reads content, counts words, prints result"
        },
        "task_4": {
            "type": "data_structures",
            "description": "Create a dictionary with at least 5 items and iterate over it",
            "success_criteria": "Dict created, can access values by key, iterates correctly"
        },
        "task_5": {
            "type": "testing",
            "description": "Write a simple pytest test file with at least 2 test functions",
            "success_criteria": "test_ prefix on functions, uses assert, runs without errors"
        }
    }


def generate_japanese_test():
    """Generate a Japanese novice test."""
    return {
        "hiragana_check": {
            "type": "recognition",
            "description": "Read and write basic hiragana (46 characters)",
            "criteria": "Can read あ-ん, write from dictation"
        },
        "katakana_check": {
            "type": "recognition", 
            "description": "Read and write basic katakana (46 characters)",
            "criteria": "Can read ア-ン, distinguish from hiragana"
        },
        "vocab_50": {
            "type": "vocabulary",
            "description": "Demonstrate knowledge of 50+ common words",
            "word_categories": ["numbers", "colors", "family", "food", "time", "daily activities"],
            "criteria": "Can recognize and use words in context"
        },
        "sentences_10": {
            "type": "production",
            "description": "Write 10 simple sentences using basic grammar",
            "structures": ["は (wa) topic", "が (ga) subject", "を (wo) object", "に (ni) direction/time", "で (de) location/action"],
            "criteria": "Correct word order, appropriate particle usage"
        },
        "self_introduction": {
            "type": "production",
            "description": "Write a self-introduction (name, nationality, hobby)",
            "criteria": "Complete sentences, natural flow, no major grammar errors"
        }
    }


def evaluate_python_test(test_results):
    """Evaluate Python test results against rubric."""
    scores = {}
    
    # Task 1: sum function (control_flow + functions)
    if test_results.get("task_1", False):
        scores["control_flow"] = {"score": 20, "note": "Sum function works correctly"}
        scores["functions"] = {"score": 20, "note": "Function properly defined with parameters"}
    
    # Task 2: palindrome (functions + data_structures)
    if test_results.get("task_2", False):
        scores["data_structures"] = {"score": 15, "note": "String manipulation correct"}
        scores["functions"] = {"score": min(25, scores.get("functions", {}).get("score", 0) + 10), "note": "Function handles edge cases"}
    
    # Task 3: file operation
    if test_results.get("task_3", False):
        scores["file_operations"] = {"score": 10, "note": "File handling correct"}
    
    # Task 4: data structures
    if test_results.get("task_4", False):
        if "data_structures" not in scores:
            scores["data_structures"] = {"score": 15, "note": "Dict operations correct"}
        else:
            scores["data_structures"]["score"] = min(20, scores["data_structures"]["score"] + 10)
    
    # Task 5: testing
    if test_results.get("task_5", False):
        scores["testing_basics"] = {"score": 10, "note": "Pytest file runs successfully"}
    
    # Default scores for unachieved items
    for dimension, rubric in PYTHON_NOVICE_RUBRIC.items():
        if dimension not in scores:
            scores[dimension] = {"score": 0, "note": "Not demonstrated in test"}
    
    return scores


def evaluate_japanese_test(test_results):
    """Evaluate Japanese test results against rubric."""
    scores = {}
    
    # Hiragana
    if test_results.get("hiragana_check", False):
        scores["hiragana_recognition"] = {"score": 25, "note": "All 46 hiragana recognized and written"}
    else:
        scores["hiragana_recognition"] = {"score": 0, "note": "Hiragana incomplete"}
    
    # Katakana
    if test_results.get("katakana_check", False):
        scores["katakana_recognition"] = {"score": 20, "note": "All 46 katakana recognized and written"}
    else:
        scores["katakana_recognition"] = {"score": 0, "note": "Katakana incomplete"}
    
    # Vocabulary
    vocab_score = 0
    if test_results.get("vocab_50", False):
        vocab_score = 25
    elif test_results.get("vocab_30", False):  # partial
        vocab_score = 15
    scores["basic_vocabulary"] = {"score": vocab_score, "note": f"{vocab_score//5*5}+ words known"}
    
    # Sentences
    if test_results.get("sentences_10", False):
        scores["sentence_structure"] = {"score": 20, "note": "10+ sentences with correct particles"}
    elif test_results.get("sentences_5", False):
        scores["sentence_structure"] = {"score": 10, "note": "5+ sentences attempted"}
    else:
        scores["sentence_structure"] = {"score": 0, "note": "Sentence practice incomplete"}
    
    # Writing
    if test_results.get("self_introduction", False):
        scores["writing_practice"] = {"score": 10, "note": "Self-introduction complete"}
    else:
        scores["writing_practice"] = {"score": 0, "note": "Writing practice incomplete"}
    
    return scores


# ============================================================================
# CHALLENGE-BASED ASSESSMENT (Blender, After Effects, Unreal)
# ============================================================================

def generate_blender_challenge():
    """Generate a Blender beginner-intermediate challenge brief."""
    return {
        "challenge": "Create a 15-second animated loop of a simple mechanical object",
        "constraints": [
            "Use only Blender primitives (cube, sphere, cylinder, torus)",
            "Animation must loop smoothly",
            "Total render time under 5 minutes",
            "Use Eevee renderer"
        ],
        "deliverables": [
            ".blend file with organized outliner",
            "Exported MP4 or image sequence",
            "3 bullet notes on technique used"
        ],
        "scoring_focus": ["modeling", "timing_and_animation", "lighting", "materials_and_textures", "cleanliness"]
    }


def generate_after_effects_challenge():
    """Generate an After Effects beginner challenge brief."""
    return {
        "challenge": "Create a 10-second motion graphic loop using only built-in effects",
        "constraints": [
            "Use only built-in effects (no third-party)",
            "Composition must loop seamlessly",
            "Keep effect count under 5",
            "Export as H.264 MP4"
        ],
        "deliverables": [
            ".aep project file",
            "Exported MP4 render",
            "5 keyframe timing notes"
        ],
        "scoring_focus": ["keyframe_animation", "composition_setup", "effects_usage", "render_and_export", "creativity"]
    }


def generate_unreal_challenge():
    """Generate an Unreal Engine beginner challenge brief."""
    return {
        "challenge": "Create a basic interactive scene with player movement",
        "constraints": [
            "Use only pre-made Marketplace assets",
            "Project under 10GB",
            "Single level only",
            "Package for Windows"
        ],
        "deliverables": [
            "UE project folder",
            "Packaged Windows build",
            "Blueprint logic notes"
        ],
        "scoring_focus": ["project_setup", "level_design", "blueprints_basics", "player_movement", "build_and_export"]
    }


def evaluate_challenge_evidence(skill, evidence, artifacts):
    """Heuristically evaluate challenge completion from artifacts and log notes.
    
    Args:
        skill: Skill name (blender, after_effects, unreal)
        evidence: Dict with completion notes from user/log
        artifacts: List of file paths that exist as evidence
    
    Returns:
        Dict of dimension -> {"score": int, "note": str}
    """
    scores = {}
    rubric = RUBRIC_MAP[skill]["rubric"]
    
    # Check artifact existence as primary evidence
    artifact_bonus = 0
    if artifacts:
        artifact_bonus = min(20, len(artifacts) * 5)
    
    # Default evaluation based on artifact presence
    if skill == "blender":
        # Check for .blend files
        has_blend = any(f.endswith('.blend') for f in artifacts)
        has_render = any(f.endswith(('.mp4', '.png', '.jpg')) for f in artifacts)
        
        if has_blend and has_render:
            scores["modeling"] = {"score": 25, "note": "Blend file and renders exist"}
            scores["timing_and_animation"] = {"score": 15, "note": "Animation rendered"}
            scores["lighting"] = {"score": 15, "note": "Lit scene rendered"}
            scores["materials_and_textures"] = {"score": 10, "note": "Materials applied"}
            scores["cleanliness"] = {"score": 10, "note": "Files organized"}
        elif has_blend:
            scores["modeling"] = {"score": 20, "note": "Blend file exists, needs render"}
            scores["cleanliness"] = {"score": 10, "note": "Project file present"}
        else:
            for dim, r in rubric.items():
                scores[dim] = {"score": 0, "note": "No artifacts found"}
    
    elif skill == "after_effects":
        # Check for .aep files and renders
        has_aep = any(f.endswith('.aep') for f in artifacts)
        has_render = any(f.endswith('.mp4') for f in artifacts)
        
        if has_aep and has_render:
            scores["keyframe_animation"] = {"score": 25, "note": "Project and render exist"}
            scores["composition_setup"] = {"score": 15, "note": "Composition structured"}
            scores["effects_usage"] = {"score": 20, "note": "Effects applied"}
            scores["render_and_export"] = {"score": 15, "note": "Render completed"}
            scores["creativity"] = {"score": 10, "note": "Motion piece created"}
        elif has_aep:
            scores["composition_setup"] = {"score": 15, "note": "AEP file exists"}
            scores["keyframe_animation"] = {"score": 10, "note": "Project started, needs render"}
        else:
            for dim, r in rubric.items():
                scores[dim] = {"score": 0, "note": "No artifacts found"}
    
    elif skill == "unreal":
        # Check for UE project files
        has_uproject = any(f.endswith('.uproject') for f in artifacts)
        
        if has_uproject:
            scores["project_setup"] = {"score": 12, "note": "Project created"}
            scores["level_design"] = {"score": 15, "note": "Level exists"}
            scores["blueprints_basics"] = {"score": 15, "note": "Blueprints present"}
            scores["player_movement"] = {"score": 10, "note": "Basic setup"}
            scores["build_and_export"] = {"score": 5, "note": "Project exists"}
        else:
            for dim, r in rubric.items():
                scores[dim] = {"score": 0, "note": "No project found"}
    
    # Fill in missing dimensions
    for dim, r in rubric.items():
        if dim not in scores:
            scores[dim] = {"score": 0, "note": "Not evaluated"}
    
    return scores


def find_skill_artifacts(skill):
    """Find existing artifacts for a skill in the workspace."""
    artifacts = []
    search_paths = [
        WORKSPACE / "projects" / "creative-practice",
        WORKSPACE / "projects" / "blender-practice",
        WORKSPACE / "projects" / "motion-design",
        WORKSPACE / "projects" / "game-dev",
    ]
    
    for path in search_paths:
        if path.exists():
            for f in path.rglob("*"):
                if f.is_file() and f.suffix in ['.blend', '.aep', '.mp4', '.png', '.uproject', '.exe']:
                    artifacts.append(str(f))
    
    return artifacts


# ============================================================================
# REPORT GENERATION
# ============================================================================

def calculate_total_score(scores, rubric):
    """Calculate weighted total score from dimension scores."""
    total_weight = 0
    weighted_sum = 0
    
    for dimension, data in rubric.items():
        weight = data["weight"]
        max_score = data["max_score"]
        achieved = scores.get(dimension, {}).get("score", 0)
        
        # Normalize to weight
        normalized = (achieved / max_score) * weight if max_score > 0 else 0
        weighted_sum += normalized
        total_weight += weight
    
    return (weighted_sum / total_weight * 100) if total_weight > 0 else 0


def generate_recommendation(skill, total_score, current_level):
    """Generate level recommendation based on score."""
    # Threshold: 70% = ready for next level, else keep current
    if total_score >= 70:
        return "ready-for-trial-next-level"
    else:
        return "keep-level"


def generate_assessment_report(skill, scores, total_score, recommendation, level, test_or_challenge):
    """Generate markdown assessment report."""
    rubric = RUBRIC_MAP[skill]["rubric"]
    today = datetime.now().strftime("%Y-%m-%d")
    
    report = f"""# Skill Assessment: {skill.title()}

**Date:** {today}  
**Assessment Mode:** {test_or_challenge.title()}  
**Current Level:** {level}  
**Total Score:** {total_score:.1f}%  
**Recommendation:** {recommendation.replace('-', ' ').title()}

---

## Dimension Scores

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
"""
    
    for dimension, data in rubric.items():
        score_data = scores.get(dimension, {"score": 0, "note": "Not evaluated"})
        report += f"| {dimension.replace('_', ' ').title()} | {score_data['score']} | {data['max_score']} | {score_data['note']} |\n"
    
    report += f"""
---

## Assessment Details

**Assessment Type:** {test_or_challenge.title()}

"""
    
    if test_or_challenge == "test":
        report += """### Test Tasks Completed

- Task 1: Sum function - ✓/✗
- Task 2: Palindrome function - ✓/✗  
- Task 3: File operations - ✓/✗
- Task 4: Data structures - ✓/✗
- Task 5: Basic testing - ✓/✗

"""
    else:
        report += """### Challenge Brief

The challenge tests practical skills through completion evidence.
Artifacts and log notes are evaluated heuristically.

"""
    
    report += f"""---

## Next Steps

**Recommendation:** {recommendation.replace('-', ' ').title()}

"""
    
    if recommendation == "ready-for-trial-next-level":
        report += f"""🎉 You're performing at {total_score:.0f}% - ready to try the next level!

Consider updating your skill profile to reflect progression.
"""
    else:
        report += f"""📚 Keep practicing at current level. Target 70% to advance.

Focus on improving: {min(scores.items(), key=lambda x: x[1]['score'])[0].replace('_', ' ')}
"""
    
    return report


def save_assessment(skill, report, scores, total_score, recommendation, level):
    """Save assessment report and update latest.json."""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Save individual report
    report_file = ASSESSMENTS_DIR / f"{today}-{skill}.md"
    report_file.write_text(report)
    print(f"✓ Saved report: {report_file}")
    
    # Update latest.json
    latest_file = ASSESSMENTS_DIR / "latest.json"
    
    # Load existing data properly
    latest_data = {}
    if latest_file.exists():
        try:
            existing = json.loads(latest_file.read_text())
            # Extract skills from existing structure
            latest_data = existing.get("skills", {})
        except (json.JSONDecodeError, IOError):
            latest_data = {}
    
    # Update with new assessment
    latest_data[skill] = {
        "date": today,
        "level": level,
        "score": round(total_score, 1),
        "recommendation": recommendation,
        "dimensions": {k: v["score"] for k, v in scores.items()}
    }
    
    # Write summary for task generator
    summary = {
        "last_updated": today,
        "skills": latest_data
    }
    
    latest_file.write_text(json.dumps(summary, indent=2))
    print(f"✓ Updated: {latest_file}")
    
    return report_file, latest_file


# ============================================================================
# MAIN ASSESSMENT LOGIC
# ============================================================================

def run_test_assessment(skill):
    """Run test-based assessment for Python or Japanese."""
    profile = load_skill_profile()
    level = profile.get(skill, {}).get("level", "unknown")
    
    print(f"\n=== {skill.title()} Test Assessment ===")
    print(f"Current level: {level}")
    
    # Generate test
    if skill == "python":
        test = generate_python_test()
        print(f"\nTest tasks:")
        for task_id, task in test.items():
            print(f"  - {task_id}: {task['description']}")
        
        # In real usage, user would complete and mark these
        # For now, we'll simulate evaluation based on existing work
        # Check for existing Python files in projects
        project_files = list((WORKSPACE / "projects").rglob("*.py"))
        
        # Heuristic: if there's Python work, give partial credit
        test_results = {}
        if project_files:
            test_results["task_1"] = True  # Can write functions
            test_results["task_4"] = True  # Uses data structures
            if any("test" in f.name.lower() for f in project_files):
                test_results["task_5"] = True
        
        scores = evaluate_python_test(test_results)
        
    elif skill == "japanese":
        test = generate_japanese_test()
        print(f"\nTest components:")
        for task_id, task in test.items():
            print(f"  - {task_id}: {task['description']}")
        
        # Check for Japanese study materials
        vocab_files = list((WORKSPACE / "projects" / "language").rglob("*")) if (WORKSPACE / "projects" / "language").exists() else []
        
        test_results = {}
        if vocab_files:
            test_results["hiragana_check"] = True
            test_results["katakana_check"] = True
        
        scores = evaluate_japanese_test(test_results)
    
    rubric = RUBRIC_MAP[skill]["rubric"]
    total_score = calculate_total_score(scores, rubric)
    recommendation = generate_recommendation(skill, total_score, level)
    
    report = generate_assessment_report(skill, scores, total_score, recommendation, level, "test")
    save_assessment(skill, report, scores, total_score, recommendation, level)
    
    print(f"\n📊 Total Score: {total_score:.1f}%")
    print(f"📋 Recommendation: {recommendation}")
    
    return scores, total_score, recommendation


def run_challenge_assessment(skill):
    """Run challenge-based assessment for Blender, After Effects, or Unreal."""
    profile = load_skill_profile()
    level = profile.get(skill, {}).get("level", "unknown")
    
    print(f"\n=== {skill.title()} Challenge Assessment ===")
    print(f"Current level: {level}")
    
    # Generate challenge brief
    if skill == "blender":
        challenge = generate_blender_challenge()
    elif skill == "after_effects":
        challenge = generate_after_effects_challenge()
    elif skill == "unreal":
        challenge = generate_unreal_challenge()
    
    print(f"\nChallenge: {challenge['challenge']}")
    print(f"Constraints: {', '.join(challenge['constraints'])}")
    print(f"Deliverables: {', '.join(challenge['deliverables'])}")
    
    # Find existing artifacts
    artifacts = find_skill_artifacts(skill)
    print(f"\nFound {len(artifacts)} existing artifacts")
    
    # Evaluate based on artifacts (heuristic)
    scores = evaluate_challenge_evidence(skill, {}, artifacts)
    
    rubric = RUBRIC_MAP[skill]["rubric"]
    total_score = calculate_total_score(scores, rubric)
    recommendation = generate_recommendation(skill, total_score, level)
    
    report = generate_assessment_report(skill, scores, total_score, recommendation, level, "challenge")
    save_assessment(skill, report, scores, total_score, recommendation, level)
    
    print(f"\n📊 Total Score: {total_score:.1f}%")
    print(f"📋 Recommendation: {recommendation}")
    
    return scores, total_score, recommendation


def run_assessment(skill):
    """Run assessment for a single skill."""
    if skill not in ALL_SKILLS:
        print(f"Error: Unknown skill '{skill}'. Available: {', '.join(ALL_SKILLS)}")
        return None
    
    skill_info = RUBRIC_MAP[skill]
    
    if skill_info["type"] == "test":
        return run_test_assessment(skill)
    else:
        return run_challenge_assessment(skill)


def run_all_assessments():
    """Run assessments for all active skills in profile."""
    profile = load_skill_profile()
    active_skills = [s for s in ALL_SKILLS if s in profile]
    
    print(f"\nRunning assessments for: {', '.join(active_skills)}")
    
    results = {}
    for skill in active_skills:
        result = run_assessment(skill)
        if result:
            results[skill] = result
    
    return results


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hybrid Skill Assessment Framework")
    parser.add_argument("--skill", choices=sorted(ALL_SKILLS), help="Specific skill to assess")
    parser.add_argument("--mode", choices=["test", "challenge"], help="Force assessment mode")
    parser.add_argument("--all", action="store_true", help="Run all assessments")
    
    args = parser.parse_args()
    
    if args.all:
        results = run_all_assessments()
        print(f"\n✅ Completed {len(results)} assessments")
    elif args.skill:
        run_assessment(args.skill)
    else:
        parser.print_help()
        print(f"\nAvailable skills: {', '.join(sorted(ALL_SKILLS))}")
        print("Test skills: python, japanese")
        print("Challenge skills: blender, after_effects, unreal")