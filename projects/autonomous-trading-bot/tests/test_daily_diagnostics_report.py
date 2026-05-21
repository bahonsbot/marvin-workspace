import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "daily_diagnostics_report.py"
spec = importlib.util.spec_from_file_location("daily_diagnostics_report", SCRIPT_PATH)
daily_diagnostics_report = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(daily_diagnostics_report)


class DailyDiagnosticsReportTest(unittest.TestCase):
    def test_rejected_paper_execute_request_is_denied_not_paper_executed(self) -> None:
        records = [
            {
                "timestamp": "2026-05-20T13:30:00Z",
                "request": {"symbol": "LMT", "side": "buy"},
                "result": {
                    "accepted": False,
                    "reasons": ["Kill switch is enabled. Trading is blocked."],
                    "execution": {"status": "denied", "paper_execute": True},
                },
            }
        ]

        perf = daily_diagnostics_report.collect_performance(records)

        self.assertEqual(perf["total"], 1)
        self.assertEqual(perf["accepted"], 0)
        self.assertEqual(perf["denied"], 1)
        self.assertEqual(perf["submitted"], 0)
        self.assertEqual(perf["paper_execute"], 0)
        self.assertEqual(perf["blocked"], 1)

    def test_submitted_paper_order_counts_as_paper_executed(self) -> None:
        records = [
            {
                "timestamp": "2026-05-20T13:30:00Z",
                "request": {"symbol": "LMT", "side": "buy"},
                "result": {
                    "accepted": True,
                    "execution": {"status": "submitted", "paper_execute": True},
                },
            }
        ]

        perf = daily_diagnostics_report.collect_performance(records)

        self.assertEqual(perf["accepted"], 1)
        self.assertEqual(perf["denied"], 0)
        self.assertEqual(perf["submitted"], 1)
        self.assertEqual(perf["paper_execute"], 1)
        self.assertEqual(perf["blocked"], 0)


if __name__ == "__main__":
    unittest.main()
