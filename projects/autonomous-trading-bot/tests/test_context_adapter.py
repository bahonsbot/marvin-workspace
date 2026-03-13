import json
import tempfile
import unittest
from pathlib import Path

from src.context_adapter import load_context_snapshot


class TestContextAdapter(unittest.TestCase):
    def test_missing_files_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            snapshot = load_context_snapshot(
                market_intel_dir=base / "market-intel-data",
                news_reader_dir=base / "news-reader-data",
            )

        self.assertTrue(snapshot["paper_only"])
        self.assertFalse(snapshot["summary"]["available_context"])
        self.assertEqual(snapshot["summary"]["risk_bias"], "neutral")
        self.assertEqual(snapshot["summary"]["role"], "macro_overlay_only")
        self.assertGreaterEqual(len(snapshot["warnings"]), 3)

    def test_reads_available_market_intel_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            market_dir = base / "market"
            news_dir = base / "news"
            market_dir.mkdir(parents=True, exist_ok=True)
            news_dir.mkdir(parents=True, exist_ok=True)

            (market_dir / "signals_enriched_shadow.json").write_text(
                json.dumps(
                    [
                        {"category": "geopolitical", "confidence": "HIGH"},
                        {"category": "macroeconomic", "confidence": "HIGH"},
                        {"category": "geopolitical", "confidence": "HIGH"},
                    ]
                ),
                encoding="utf-8",
            )
            (market_dir / "tracked_signals.json").write_text(
                json.dumps(
                    [
                        {"signal": {"recommendation": "TAKE"}},
                        {"signal": {"recommendation": "SKIP"}},
                    ]
                ),
                encoding="utf-8",
            )
            (market_dir / "signal_ab_comparison.json").write_text(
                json.dumps([{"enriched_lift": 12}]),
                encoding="utf-8",
            )
            (news_dir / "latest.json").write_text(
                json.dumps({"headlines": [{"t": 1}, {"t": 2}]}),
                encoding="utf-8",
            )

            snapshot = load_context_snapshot(market_intel_dir=market_dir, news_reader_dir=news_dir)

        self.assertTrue(snapshot["summary"]["available_context"])
        self.assertEqual(snapshot["summary"]["risk_bias"], "risk_off")
        self.assertEqual(snapshot["summary"]["severity"], "low")
        self.assertEqual(snapshot["sources"]["selection_layer"], "execution_candidates")
        self.assertEqual(snapshot["summary"]["ab_enriched_lift"], 12)
        self.assertEqual(snapshot["summary"]["news_headline_count"], 2)


if __name__ == "__main__":
    unittest.main()
