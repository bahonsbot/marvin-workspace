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

    def test_performance_groups_outcomes_and_fit_scores(self) -> None:
        records = [
            {
                "timestamp": "2026-05-20T13:30:00Z",
                "request": {
                    "symbol": "NVDA",
                    "side": "buy",
                    "strategy": "market-intel-auto",
                    "market_intel_mode": "execution_candidates",
                    "pattern_name": "Reddit GPU/Semis Thread",
                    "semantic_fit_score": 0.92,
                    "ticker_fit_score": 0.90,
                    "ticker_fit_directness": "direct_company",
                },
                "result": {
                    "accepted": True,
                    "execution": {"status": "submitted", "paper_execute": True},
                },
            },
            {
                "timestamp": "2026-05-20T13:31:00Z",
                "request": {
                    "symbol": "LMT",
                    "side": "buy",
                    "strategy": "market-intel-auto",
                    "market_intel_mode": "execution_candidates",
                    "pattern_name": "Russia-Ukraine Conflict",
                    "semantic_fit_score": 0.34,
                    "ticker_fit_score": 0.48,
                    "ticker_fit_directness": "weak_proxy",
                },
                "result": {
                    "accepted": False,
                    "reasons": ["Field 'timestamp' is stale: age_seconds=1200 > max_signal_age_seconds=900."],
                    "execution": {"status": "validation_failed", "paper_execute": True},
                },
            },
        ]

        perf = daily_diagnostics_report.collect_performance(records)

        self.assertEqual(perf["outcomes"]["submitted"], 1)
        self.assertEqual(perf["outcomes"]["validation_failed"], 1)
        self.assertEqual(perf["denial_reason_buckets"]["stale_timestamp"], 1)
        self.assertEqual(perf["strategies"]["market-intel-auto"], 2)
        self.assertEqual(perf["patterns"]["Reddit GPU/Semis Thread"], 1)
        self.assertEqual(perf["semantic_fit_buckets"][">=0.85"], 1)
        self.assertEqual(perf["semantic_fit_buckets"]["<0.55"], 1)
        self.assertEqual(perf["ticker_fit_buckets"][">=0.85"], 1)
        self.assertEqual(perf["ticker_fit_buckets"]["<0.55"], 1)
        self.assertEqual(perf["ticker_directness"]["direct_company"], 1)


if __name__ == "__main__":
    unittest.main()
