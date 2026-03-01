import unittest

from src.simulation_report import build_simulation_summary


class TestSimulationReport(unittest.TestCase):
    def test_build_simulation_summary(self):
        rows = [
            {
                "accepted": True,
                "reasons": [],
                "proposal": {"size_multiplier": 1.0, "confidence_adjustment": 0.1},
                "context": {"warnings": ["missing:tracked_signals.json"]},
                "decision_context": {"reasons": ["Risk-on backdrop supports buy signal."]},
            },
            {
                "accepted": False,
                "reasons": ["Kill switch is enabled. Trading is blocked."],
                "proposal": {"size_multiplier": 0.0, "confidence_adjustment": -0.5},
                "context": {"warnings": ["missing:tracked_signals.json"]},
                "decision_context": {"reasons": ["High-severity regime triggers overall de-leveraging."]},
            },
        ]

        summary = build_simulation_summary(rows)

        self.assertEqual(summary["counts"]["total"], 2)
        self.assertEqual(summary["counts"]["accepted"], 1)
        self.assertEqual(summary["counts"]["denied"], 1)
        self.assertEqual(
            summary["denial_reason_breakdown"],
            {"Kill switch is enabled. Trading is blocked.": 1},
        )
        self.assertEqual(summary["avg_size_multiplier"], 0.5)
        self.assertEqual(summary["avg_confidence_adjustment"], -0.2)
        self.assertTrue(len(summary["top_context_warnings"]) >= 1)


if __name__ == "__main__":
    unittest.main()
