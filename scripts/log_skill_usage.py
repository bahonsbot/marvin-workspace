#!/usr/bin/env python3
"""
Log skill usage for tracking which skills are actually used.

Usage:
    python3 log_skill_usage.py <skill_name> [context]

Example:
    python3 log_skill_usage.py google_maps_pro "restaurant search Da Lat"
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Resolve paths
SCRIPT_DIR = Path(__file__).resolve().parent
MEMORY_DIR = SCRIPT_DIR.parent / "memory"
USAGE_LOG = MEMORY_DIR / "skill-usage.jsonl"

def log_usage(skill_name: str, context: str = ""):
    """Log a skill usage event."""
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "skill": skill_name,
        "context": context,
        "session": "main"
    }
    
    with open(USAGE_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    
    print(f"✓ Logged: {skill_name} - {context[:50] if context else 'no context'}")

def generate_summary():
    """Generate a summary of skill usage."""
    if not USAGE_LOG.exists():
        print("No usage data found yet.")
        return
    
    usage = {}
    with open(USAGE_LOG, "r", encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
                skill = entry.get("skill", "unknown")
                usage[skill] = usage.get(skill, 0) + 1
            except:
                continue
    
    print("\n=== Skill Usage Summary ===\n")
    for skill, count in sorted(usage.items(), key=lambda x: x[1], reverse=True):
        print(f"{skill:<30} {count:>5} uses")
    print(f"\nTotal logged: {sum(usage.values())} skill invocations")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "--summary":
            generate_summary()
        else:
            skill = sys.argv[1]
            context = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else ""
            log_usage(skill, context)
    else:
        print("Usage: python3 log_skill_usage.py <skill_name> [context]")
        print("       python3 log_skill_usage.py --summary")
