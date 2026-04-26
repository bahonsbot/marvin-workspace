#!/usr/bin/env python3
"""
Tiered lifecycle script for life/entities.

Default mode is report-only. Use --apply for mutation.

Categorizes entity facts based on lastUsed timestamp:
- HOT: used in last 30 days (keep as-is)
- WARM: 30-90 days unused (would add status: "warm" marker in --apply mode)
- COLD: 90+ days unused (would move file to archive/ in --apply mode)

Also audits security log rotation status. Rotation is applied only with --apply.
"""

import argparse
import json
import shutil
import gzip
from datetime import datetime, timedelta
from pathlib import Path

# Absolute paths
WORKSPACE = Path("/data/.openclaw/workspace")
LIFE_DIR = WORKSPACE / "life"
ARCHIVE_DIR = LIFE_DIR / "archive"
LOG_DIR = WORKSPACE / "logs"

# Thresholds (in days)
HOT_DAYS = 30
WARM_DAYS = 90
LOG_RETENTION_DAYS = 90


def ensure_directories():
    """Create required directories if they don't exist."""
    LIFE_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Life directory: {LIFE_DIR}")
    print(f"Archive directory: {ARCHIVE_DIR}")


def get_days_since_last_used(last_used_str: str) -> int:
    """Calculate days since lastUsed timestamp."""
    try:
        last_used = datetime.fromisoformat(last_used_str.replace('Z', '+00:00'))
        # Convert to naive datetime for comparison (assume UTC)
        if last_used.tzinfo:
            last_used = last_used.replace(tzinfo=None)
        now = datetime.now()
        return (now - last_used).days
    except (ValueError, TypeError):
        return -1  # Unknown/missing timestamp


def add_last_used_if_missing(fact: dict, *, apply: bool) -> bool:
    """Add lastUsed timestamp if missing. Returns True if added."""
    if 'lastUsed' not in fact:
        if apply:
            fact['lastUsed'] = datetime.now().isoformat()
        return True
    return False


def process_entity_file(filepath: Path, *, apply: bool) -> tuple[dict, list[dict]]:
    """
    Process a single entity JSON file.
    Returns dict with counts: hot, warm, cold, modified
    """
    counts = {'hot': 0, 'warm': 0, 'cold': 0, 'modified': 0}
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"  ERROR: Failed to read {filepath}: {e}")
        return counts, []
    
    # Handle both list of facts and dict with 'facts' key
    facts = data.get('facts', []) if isinstance(data, dict) else data
    if not isinstance(facts, list):
        facts = [facts]
    
    warm_facts = []
    cold_files = []
    
    for fact in facts:
        # Add lastUsed if missing
        if add_last_used_if_missing(fact, apply=apply):
            counts['modified'] += 1
        
        last_used = fact.get('lastUsed', '')
        days_unused = get_days_since_last_used(last_used)
        
        if days_unused < 0:
            # Unknown timestamp - treat as HOT (preserve)
            counts['hot'] += 1
        elif days_unused <= HOT_DAYS:
            # HOT: 0-30 days
            counts['hot'] += 1
        elif days_unused <= WARM_DAYS:
            # WARM: 30-90 days - add marker
            if fact.get('status') != 'warm':
                if apply:
                    fact['status'] = 'warm'
                counts['modified'] += 1
            counts['warm'] += 1
            warm_facts.append(fact)
        else:
            # COLD: 90+ days
            counts['cold'] += 1
            cold_files.append(fact)
    
    # Write back modifications only in explicit apply mode.
    if apply and counts['modified'] > 0:
        if isinstance(data, dict):
            data['facts'] = facts
        else:
            data = facts
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"  ERROR: Failed to write {filepath}: {e}")
    
    return counts, cold_files


def archive_file(filepath: Path, *, apply: bool) -> bool:
    """Move file to archive directory."""
    if not apply:
        print(f"  DRY RUN: would archive {filepath.name}")
        return False
    try:
        dest = ARCHIVE_DIR / filepath.name
        # Handle name conflicts
        counter = 1
        while dest.exists():
            stem = filepath.stem
            suffix = filepath.suffix
            dest = ARCHIVE_DIR / f"{stem}_{counter}{suffix}"
            counter += 1
        
        shutil.move(str(filepath), str(dest))
        print(f"  → Archived: {filepath.name} → {dest.name}")
        return True
    except IOError as e:
        print(f"  ERROR: Failed to archive {filepath}: {e}")
        return False

def rotate_logs(*, apply: bool):
    """Rotate audit logs: weekly rotation, compress old, retain 90 days."""
    log_files = [
        LOG_DIR / "security-actions.log",
        LOG_DIR / "security-actions.jsonl",
    ]
    
    today = datetime.now()
    one_week_ago = today - timedelta(days=7)
    
    for log_file in log_files:
        if not log_file.exists():
            print(f"  {log_file.name}: not found, skipping")
            continue
        
        # Get file modification time
        mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
        
        # If file hasn't been rotated in over 7 days, rotate it
        if mtime < one_week_ago:
            timestamp = mtime.strftime("%Y-%m-%d")
            archived_name = f"{log_file.stem}-{timestamp}.log.gz"
            archived_path = LOG_DIR / archived_name
            
            # Compress and rename
            if not apply:
                print(f"  DRY RUN: would rotate {log_file.name} → {archived_name}")
                continue

            try:
                with open(log_file, 'rb') as f_in:
                    with gzip.open(archived_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                
                # Truncate original file
                open(log_file, 'w').close()
                
                print(f"  ✓ Rotated: {log_file.name} → {archived_name}")
            except Exception as e:
                print(f"  ✗ Error rotating {log_file.name}: {e}")
        else:
            print(f"  {log_file.name}: up to date")
    
    # Clean up old rotated logs (older than retention period)
    cutoff = today - timedelta(days=LOG_RETENTION_DAYS)
    for f in LOG_DIR.glob("security-actions*.log.gz"):
        try:
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            if mtime < cutoff:
                if not apply:
                    print(f"  DRY RUN: would delete old: {f.name}")
                    continue
                f.unlink()
                print(f"  ✓ Deleted old: {f.name}")
        except Exception as e:
            print(f"  ✗ Error deleting {f.name}: {e}")
    
    print("  Log rotation complete.")


def write_report(report_lines: list[str]) -> Path:
    report_dir = WORKSPACE / "memory" / "health-council"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"entity-lifecycle-{datetime.now().strftime('%Y-%m-%d')}.md"
    report_path.write_text("\n".join(report_lines).rstrip() + "\n", encoding="utf-8")
    return report_path


def main():
    parser = argparse.ArgumentParser(description="Report or apply lifecycle maintenance for life/ entities")
    parser.add_argument("--apply", action="store_true", help="Apply warm markers, archive cold files, and rotate logs")
    parser.add_argument("--dry-run", action="store_true", help="Report only; default behavior")
    args = parser.parse_args()
    apply_changes = bool(args.apply)

    report_lines = [
        f"# Entity Lifecycle Report - {datetime.now().strftime('%Y-%m-%d')}",
        "",
        f"Mode: {'APPLY' if apply_changes else 'DRY RUN'}",
        "",
    ]

    print("=" * 60)
    print("Entity Lifecycle Manager + Log Rotation")
    print(f"Mode: {'APPLY' if apply_changes else 'DRY RUN'}")
    print("=" * 60)
    
    ensure_directories()
    
    # === Log Rotation ===
    print("\n--- Log Rotation ---")
    rotate_logs(apply=apply_changes)
    
    # === Entity Lifecycle ===
    print("\n--- Entity Lifecycle ---")
    
    # Find all JSON files recursively in life/ directory
    json_files = list(LIFE_DIR.rglob("*.json"))
    # Exclude archive directory
    json_files = [f for f in json_files if ARCHIVE_DIR not in f.parents and f.parent != ARCHIVE_DIR]
    
    if not json_files:
        print(f"\nNo JSON files found in {LIFE_DIR}")
        print("Nothing to process.")
        return
    
    print(f"\nFound {len(json_files)} entity file(s)\n")
    
    # Track totals
    totals = {'hot': 0, 'warm': 0, 'cold': 0, 'modified': 0, 'archived': 0}
    cold_file_paths = []
    
    for filepath in json_files:
        rel = filepath.relative_to(WORKSPACE)
        print(f"Processing: {rel}")
        result, cold_facts = process_entity_file(filepath, apply=apply_changes)
        
        for key in totals:
            if key in result:
                totals[key] += result[key]
        
        if result['cold'] > 0:
            cold_file_paths.append(filepath)
        
        line = f"- `{rel}`: HOT={result['hot']}, WARM={result['warm']}, COLD={result['cold']}, would_modify={result['modified']}"
        report_lines.append(line)
        print(f"  HOT: {result['hot']}, WARM: {result['warm']}, COLD: {result['cold']}, {'Modified' if apply_changes else 'Would modify'}: {result['modified']}")
    
    # Archive COLD files
    if cold_file_paths:
        print(f"\nArchiving {len(cold_file_paths)} file(s) with COLD facts...")
        for filepath in cold_file_paths:
            if archive_file(filepath, apply=apply_changes):
                totals['archived'] += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"HOT (0-30 days):     {totals['hot']} facts")
    print(f"WARM (30-90 days):   {totals['warm']} facts (marked)")
    print(f"COLD (90+ days):     {totals['cold']} facts")
    print(f"{'Modified' if apply_changes else 'Would modify'}:        {totals['modified']} updates")
    print(f"Archived:            {totals['archived']} files moved to archive/")
    print("=" * 60)

    report_lines.extend([
        "",
        "## Summary",
        f"- HOT facts: {totals['hot']}",
        f"- WARM facts: {totals['warm']}",
        f"- COLD facts: {totals['cold']}",
        f"- {'Modified' if apply_changes else 'Would modify'}: {totals['modified']} updates",
        f"- Archived: {totals['archived']} files moved to archive/",
        "",
        "Note: scheduled runs are report-only. Use `python3 scripts/lifecycle_entities.py --apply` for intentional mutation.",
    ])
    report_path = write_report(report_lines)
    print(f"Wrote lifecycle report: {report_path}")


if __name__ == "__main__":
    main()
