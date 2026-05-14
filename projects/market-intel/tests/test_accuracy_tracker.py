import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from accuracy_tracker import AccuracyTracker  # noqa: E402


class AccuracyTrackerTest(unittest.TestCase):
    def test_review_pending_prints_original_tracked_indexes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            data_dir.mkdir()
            rows = [
                self._row("Reviewed signal", outcome="correct"),
                self._row("First pending"),
                self._row("Second pending"),
            ]
            (data_dir / "tracked_signals.json").write_text(json.dumps(rows), encoding="utf-8")

            cwd = Path.cwd()
            try:
                os.chdir(tmp)
                tracker = AccuracyTracker()
                rendered = tracker.format_pending_reviews()
            finally:
                os.chdir(cwd)

            self.assertIn("[1] First pending", rendered)
            self.assertIn("[2] Second pending", rendered)
            self.assertNotIn("[0] First pending", rendered)

    def test_accuracy_uses_review_ledger_when_present(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            data_dir.mkdir()
            (data_dir / "tracked_signals.json").write_text(json.dumps([self._row("Current only", outcome="correct")]), encoding="utf-8")
            ledger_rows = [
                self._row("Old correct", outcome="correct"),
                self._row("Old miss", outcome="incorrect"),
                self._row("Duplicate", outcome="duplicate"),
            ]
            (data_dir / "signal_review_ledger.jsonl").write_text(
                "".join(json.dumps(row) + "\n" for row in ledger_rows),
                encoding="utf-8",
            )

            cwd = Path.cwd()
            try:
                os.chdir(tmp)
                tracker = AccuracyTracker()
                tracker.update_accuracy_history()
                stats = json.loads((data_dir / "signal_accuracy_history.json").read_text(encoding="utf-8"))
            finally:
                os.chdir(cwd)

            self.assertEqual(stats["total_verified"], 2)
            self.assertEqual(stats["duplicate_count"], 1)
            self.assertEqual(stats["weighted_accuracy"], 50.0)

    def test_evidence_coverage_requires_structured_evidence_not_notes_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            data_dir.mkdir()
            rows = [
                self._row("Thin note", outcome="correct", notes="looks fine", evidence_pack={"summary": "looks fine", "drivers": [], "metrics": {}}),
                self._row("Structured", outcome="correct", evidence_pack={"summary": "confirmed", "drivers": ["driver"], "metrics": {}}),
            ]
            (data_dir / "tracked_signals.json").write_text(json.dumps(rows), encoding="utf-8")

            cwd = Path.cwd()
            try:
                os.chdir(tmp)
                tracker = AccuracyTracker()
                tracker.update_accuracy_history()
                stats = json.loads((data_dir / "signal_accuracy_history.json").read_text(encoding="utf-8"))
            finally:
                os.chdir(cwd)

            self.assertEqual(stats["evidence_coverage"], 50.0)

    def _row(self, title: str, *, outcome: str | None = None, notes: str = "", evidence_pack: dict | None = None) -> dict:
        row = {
            "signal": {"title": title, "category": "macro", "pattern": "Test Pattern"},
            "added_at": "2026-05-14T00:00:00",
            "verified": bool(outcome),
            "actual_outcome": outcome.upper() if outcome and outcome != "duplicate" else ("DUPLICATE" if outcome == "duplicate" else None),
            "notes": notes,
        }
        if outcome:
            row["outcome"] = outcome
            row["verified_at"] = "2026-05-14T01:00:00"
        if evidence_pack is not None:
            row["evidence_pack"] = evidence_pack
        elif outcome:
            row["evidence_pack"] = {"summary": "confirmed", "drivers": ["driver"], "metrics": {}}
        return row


if __name__ == "__main__":
    unittest.main()
