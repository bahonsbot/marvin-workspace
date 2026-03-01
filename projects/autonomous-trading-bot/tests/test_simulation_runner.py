import json
import tempfile
import unittest
from pathlib import Path

from src.simulation_runner import load_signals, run_simulation


class TestSimulationRunner(unittest.TestCase):
    def test_load_signals_json_and_jsonl(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            jsonl_path = root / "signals.jsonl"
            json_path = root / "signals.json"

            jsonl_path.write_text(
                "\n".join(
                    [
                        json.dumps({"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}),
                        json.dumps({"symbol": "TSLA", "side": "sell", "qty": 1, "timestamp": "2026-03-01T00:01:00Z"}),
                    ]
                ),
                encoding="utf-8",
            )
            json_path.write_text(
                json.dumps(
                    {
                        "signals": [
                            {"symbol": "MSFT", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:02:00Z"}
                        ]
                    }
                ),
                encoding="utf-8",
            )

            self.assertEqual(len(load_signals(jsonl_path)), 2)
            self.assertEqual(len(load_signals(json_path)), 1)

    def test_run_simulation_pipeline_outputs_expected_fields(self):
        signals = [
            {
                "signal": {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"},
                "state": {"daily_pnl": 0, "open_positions": 0},
                "config": {
                    "kill_switch_enabled": False,
                    "daily_loss_cap": 100,
                    "max_position_size": 2,
                    "max_open_positions": 3,
                },
            },
            {
                "signal": {"symbol": "NVDA", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:01:00Z"},
                "state": {"daily_pnl": 0, "open_positions": 0},
                "config": {
                    "kill_switch_enabled": True,
                    "daily_loss_cap": 100,
                    "max_position_size": 2,
                    "max_open_positions": 3,
                },
            },
        ]

        output = run_simulation(signals)

        self.assertTrue(output["paper_only"])
        self.assertEqual(output["pipeline"], ["validate", "context_fusion", "risk_checks"])
        self.assertEqual(len(output["results"]), 2)
        self.assertIn("summary", output)
        self.assertEqual(output["summary"]["counts"]["total"], 2)
        self.assertGreaterEqual(output["summary"]["counts"]["denied"], 1)


if __name__ == "__main__":
    unittest.main()
