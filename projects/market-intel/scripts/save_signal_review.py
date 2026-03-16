#!/usr/bin/env python3
"""Save structured signal review results and keep feedback artifacts in sync.

Usage examples:
  python3 scripts/save_signal_review.py \
    --index 0 \
    --outcome correct \
    --verification-note "Volatility spike and risk repricing confirmed" \
    --summary "Headline catalyst behaved as expected" \
    --driver "Brent swung 12% intraday" \
    --metric brent_move_pct=12 \
    --session-file data/signal-verification-evidence-2026-03-16.md \
    --append-session-note

  python3 scripts/save_signal_review.py --backfill-md data/signal-verification-evidence-2026-03-15.md
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
TRACKED_FILE = DATA_DIR / "tracked_signals.json"


def load_tracked() -> list[dict[str, Any]]:
    if not TRACKED_FILE.exists():
        return []
    return json.loads(TRACKED_FILE.read_text())


def save_tracked(rows: list[dict[str, Any]]) -> None:
    TRACKED_FILE.write_text(json.dumps(rows, indent=2) + "\n")


def normalize_title(value: str) -> str:
    value = (value or "").lower()
    value = value.replace("’", "'").replace("‘", "'").replace('“', '"').replace('”', '"')
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def find_signal(rows: list[dict[str, Any]], index: int | None, title_contains: str | None) -> tuple[int, dict[str, Any]]:
    if index is not None:
        if index < 0 or index >= len(rows):
            raise SystemExit(f"Invalid index: {index}")
        return index, rows[index]

    if not title_contains:
        raise SystemExit("Provide --index or --title-contains")

    needle = normalize_title(title_contains)
    matches = []
    for i, row in enumerate(rows):
        title = row.get("signal", {}).get("title", "")
        if needle in normalize_title(title):
            matches.append((i, row))

    if not matches:
        raise SystemExit(f"No signal matches title fragment: {title_contains}")
    if len(matches) > 1:
        titles = "\n".join(f"- [{i}] {m.get('signal', {}).get('title', '')}" for i, m in matches)
        raise SystemExit(f"Multiple matches for '{title_contains}':\n{titles}")
    return matches[0]


def parse_metric(items: list[str]) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    for item in items:
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if re.fullmatch(r"-?\d+", value):
            metrics[key] = int(value)
        elif re.fullmatch(r"-?\d+\.\d+", value):
            metrics[key] = float(value)
        else:
            metrics[key] = value
    return metrics


def build_evidence_pack(args: argparse.Namespace) -> dict[str, Any]:
    evidence_pack = {
        "summary": args.summary or args.verification_note or "",
        "drivers": args.driver or [],
        "metrics": parse_metric(args.metric or []),
        "sector_impact": args.sector_impact or [],
        "confidence": args.confidence,
    }
    if args.causal_verdict:
        evidence_pack["causal_verdict"] = args.causal_verdict
    if args.asset_expression_verdict:
        evidence_pack["asset_expression_verdict"] = args.asset_expression_verdict
    if args.duplicate_of:
        evidence_pack["duplicate_of"] = args.duplicate_of
    if args.session_file:
        evidence_pack["session_evidence_file"] = str(args.session_file)
    return evidence_pack


def apply_review(row: dict[str, Any], outcome: str, verification_note: str, evidence_pack: dict[str, Any]) -> None:
    row["verified"] = True
    row["actual_outcome"] = outcome.upper() if outcome != "duplicate" else "DUPLICATE"
    row["outcome"] = outcome.lower()
    row["verified_at"] = datetime.now().astimezone().isoformat()
    row["verification_note"] = verification_note
    row["notes"] = verification_note
    row["evidence_pack"] = evidence_pack


def append_session_note(row: dict[str, Any], session_file: Path, outcome: str, evidence_pack: dict[str, Any], verification_note: str) -> None:
    session_file.parent.mkdir(parents=True, exist_ok=True)
    signal = row.get("signal", {})
    drivers = evidence_pack.get("drivers") or []
    sector_impact = evidence_pack.get("sector_impact") or []
    metrics = evidence_pack.get("metrics") or {}
    existing = session_file.read_text() if session_file.exists() else f"# Signal Verification Evidence Pack — {datetime.now().date()}\n\n"
    next_num = len(re.findall(r"^## Signal ", existing, flags=re.MULTILINE)) + 1
    block = [
        "\n---\n",
        f"\n## Signal {next_num}: {signal.get('pattern', signal.get('pattern_id', 'Review'))}\n",
        f"**Title:** {signal.get('title', '')}  \n",
        f"**Date:** {str(signal.get('timestamp', ''))[:10]}  \n",
        f"**Pattern:** {signal.get('pattern', signal.get('pattern_id', ''))}  \n",
        f"**Predicted outcomes:** {', '.join(signal.get('predicted_outcomes', []))}\n\n",
        "**Verification:**\n",
    ]
    if evidence_pack.get("summary"):
        block.append(f"- Summary: {evidence_pack['summary']}\n")
    for driver in drivers:
        block.append(f"- {driver}\n")
    for key, value in metrics.items():
        block.append(f"- Metric `{key}`: {value}\n")
    if sector_impact:
        block.append(f"- Sector impact: {', '.join(sector_impact)}\n")
    if evidence_pack.get("duplicate_of"):
        block.append(f"- Duplicate of: {evidence_pack['duplicate_of']}\n")
    block.extend([
        f"\n**Verdict:** {outcome.upper()}\n",
        f"**Verification note:** {verification_note}\n",
    ])
    session_file.write_text(existing + "".join(block))


def refresh_feedback() -> None:
    import importlib.util
    spec = importlib.util.spec_from_file_location("accuracy_tracker", ROOT / "src" / "accuracy_tracker.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    old_cwd = Path.cwd()
    try:
        import os
        os.chdir(ROOT)
        tracker = module.AccuracyTracker()
        tracker.update_accuracy_history()
    finally:
        os.chdir(old_cwd)


def parse_evidence_markdown(path: Path) -> list[dict[str, Any]]:
    text = path.read_text()
    chunks = re.split(r"\n## Signal \d+: ", text)
    entries = []
    for chunk in chunks[1:]:
        title_match = re.search(r"\*\*Title:\*\*\s*(.+)", chunk)
        verdict_match = re.search(r"\*\*Verdict:\*\*\s*([^\n]+)", chunk)
        verif_match = re.search(r"\*\*Verification:\*\*\n(.+?)(?:\n\*\*Verdict:|\Z)", chunk, flags=re.S)
        pattern_match = re.search(r"\*\*Pattern:\*\*\s*(.+)", chunk)
        if not title_match or not verdict_match:
            continue
        bullets = []
        if verif_match:
            for line in verif_match.group(1).splitlines():
                line = line.strip()
                if line.startswith("- "):
                    bullets.append(line[2:].strip())
        verdict_text = verdict_match.group(1).strip()
        outcome = "duplicate" if "duplicate" in chunk.lower() else ("correct" if "✅" in verdict_text or "strong buy" in verdict_text.lower() else "partial")
        entries.append({
            "title": title_match.group(1).strip(),
            "pattern": pattern_match.group(1).strip() if pattern_match else "",
            "outcome": outcome,
            "verification_note": bullets[0] if bullets else verdict_text,
            "evidence_pack": {
                "summary": "; ".join(bullets[:2]) if bullets else verdict_text,
                "drivers": bullets,
                "metrics": {"observations": [b for b in bullets if re.search(r"\d|%|\$|bps|bpd|barrels", b, flags=re.I)]},
                "sector_impact": [],
                "confidence": "HIGH",
                "session_evidence_file": str(path.relative_to(ROOT)),
                "causal_verdict": "correct" if outcome == "correct" else outcome,
                "asset_expression_verdict": "correct" if outcome == "correct" else outcome,
            },
        })
        if outcome == "duplicate":
            entries[-1]["evidence_pack"]["duplicate_of"] = "see related verified signal in same session"
    return entries


def backfill_from_markdown(path: Path) -> None:
    rows = load_tracked()
    updates = 0
    unmatched = []
    for entry in parse_evidence_markdown(path):
        matches = []
        needle = normalize_title(entry["title"])
        for i, row in enumerate(rows):
            hay = normalize_title(row.get("signal", {}).get("title", ""))
            if needle == hay or needle in hay or hay in needle:
                matches.append((i, row))
        if not matches:
            unmatched.append(entry["title"])
            continue
        idx, row = matches[0]
        apply_review(row, entry["outcome"], entry["verification_note"], entry["evidence_pack"])
        rows[idx] = row
        updates += 1
    save_tracked(rows)
    refresh_feedback()
    print(json.dumps({"updated": updates, "unmatched": unmatched}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=int)
    parser.add_argument("--title-contains")
    parser.add_argument("--outcome", choices=["correct", "partial", "incorrect", "duplicate"])
    parser.add_argument("--verification-note")
    parser.add_argument("--summary")
    parser.add_argument("--driver", action="append")
    parser.add_argument("--metric", action="append")
    parser.add_argument("--sector-impact", action="append")
    parser.add_argument("--confidence", default="HIGH")
    parser.add_argument("--causal-verdict", choices=["correct", "partial", "incorrect"])
    parser.add_argument("--asset-expression-verdict", choices=["correct", "partial", "incorrect"])
    parser.add_argument("--duplicate-of")
    parser.add_argument("--session-file", type=Path)
    parser.add_argument("--append-session-note", action="store_true")
    parser.add_argument("--backfill-md", type=Path)
    args = parser.parse_args()

    if args.backfill_md:
        path = args.backfill_md if args.backfill_md.is_absolute() else ROOT / args.backfill_md
        backfill_from_markdown(path)
        return

    if not args.outcome or not args.verification_note:
        raise SystemExit("Manual save requires --outcome and --verification-note")

    rows = load_tracked()
    idx, row = find_signal(rows, args.index, args.title_contains)
    session_file = None
    if args.session_file:
        session_file = args.session_file if args.session_file.is_absolute() else ROOT / args.session_file
        args.session_file = session_file.relative_to(ROOT)
    evidence_pack = build_evidence_pack(args)
    apply_review(row, args.outcome, args.verification_note, evidence_pack)
    rows[idx] = row
    save_tracked(rows)
    refresh_feedback()
    if session_file and args.append_session_note:
        append_session_note(row, session_file, args.outcome, evidence_pack, args.verification_note)
    print(json.dumps({"updated_index": idx, "title": row.get('signal', {}).get('title', ''), "outcome": args.outcome}, indent=2))


if __name__ == "__main__":
    main()
