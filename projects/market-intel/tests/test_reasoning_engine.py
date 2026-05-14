import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from reasoning_engine import ReasoningEngine  # noqa: E402


class ReasoningEngineTest(unittest.TestCase):
    def test_source_credibility_canonicalizes_feed_names(self) -> None:
        with self._engine_in_tmp() as engine:
            self.assertEqual(engine.calculate_source_credibility("Reuters_Finance"), 0.95)
            self.assertEqual(engine.calculate_source_credibility("Financial_Times"), 0.90)

    def test_feedback_bias_requires_minimum_sample_size(self) -> None:
        with self._engine_in_tmp(feedback={
            "sample_size": 3,
            "by_category": {"macro": {"count": 3, "bias_points": 5}},
            "by_pattern": {"Test Pattern": {"count": 3, "bias_points": 5}},
        }) as engine:
            bias = engine.get_feedback_bias({"category": "macro", "pattern": "Test Pattern"})
            self.assertEqual(bias["total_bias_points"], 0.0)
            self.assertEqual(bias["feedback_status"], "insufficient_sample")

    def test_confidence_labels_are_research_priority_not_trade_advice(self) -> None:
        with self._engine_in_tmp() as engine:
            self.assertEqual(engine.get_confidence_label(85), "HIGH_PRIORITY")
            self.assertEqual(engine.get_confidence_label(67), "WATCH")
            self.assertEqual(engine.get_confidence_label(55), "OBSERVE")

    def _engine_in_tmp(self, feedback: dict | None = None):
        return _EngineTmp(feedback=feedback)


class _EngineTmp:
    def __init__(self, feedback: dict | None = None):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        (self.data / "patterns.json").write_text(json.dumps({"patterns": [{"id": "p001", "name": "Test Pattern", "confidence": "HIGH", "time_horizon": "short-term"}]}), encoding="utf-8")
        (self.data / "signals.json").write_text("[]", encoding="utf-8")
        if feedback is not None:
            (self.data / "model_feedback.json").write_text(json.dumps(feedback), encoding="utf-8")

    def __enter__(self):
        self.cwd = Path.cwd()
        os.chdir(self.root)
        data = self.data

        def load_data(engine):
            engine.data_dir = data
            engine.patterns = json.loads((data / "patterns.json").read_text(encoding="utf-8"))["patterns"]
            engine.signals = []
            feedback_path = data / "model_feedback.json"
            engine.feedback = json.loads(feedback_path.read_text(encoding="utf-8")) if feedback_path.exists() else {}

        patcher = mock.patch.object(ReasoningEngine, "load_data", load_data)
        self.patcher = patcher
        patcher.start()
        engine = ReasoningEngine()
        return engine

    def __exit__(self, exc_type, exc, tb):
        self.patcher.stop()
        os.chdir(self.cwd)
        self.tmp.cleanup()


if __name__ == "__main__":
    unittest.main()
