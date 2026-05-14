import sys
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from signal_generator import SignalGenerator  # noqa: E402


class SignalGeneratorTest(unittest.TestCase):
    def _generator(self) -> SignalGenerator:
        with mock.patch.object(SignalGenerator, "load_data", lambda self: None):
            gen = SignalGenerator()
        gen.patterns = [
            {
                "id": "p005",
                "name": "GameStop Short Squeeze",
                "category": "sentiment_social",
                "confidence": "HIGH",
                "time_horizon": "intraday",
            },
            {
                "id": "p018",
                "name": "Regional Banking Crisis 2023",
                "category": "financial_credit",
                "confidence": "HIGH",
                "time_horizon": "intraday",
            },
            {
                "id": "p025",
                "name": "UK LDI/Gilt Crisis 2022",
                "category": "financial_credit",
                "confidence": "HIGH",
                "time_horizon": "intraday",
            },
        ]
        return gen

    def test_keyword_matching_uses_word_boundaries(self) -> None:
        gen = self._generator()
        matches = gen.match_alert_to_patterns({"source": "rss", "title": "Shipping company unveils naval architecture redesign"})
        self.assertEqual(matches, [])

    def test_broad_bank_terms_require_stress_context(self) -> None:
        gen = self._generator()
        normal = gen.match_alert_to_patterns({"source": "rss", "title": "ABN Amro CEO says loan growth can withstand rate hikes"})
        stressed = gen.match_alert_to_patterns({"source": "rss", "title": "Regional bank deposit outflows trigger funding pressure"})
        self.assertEqual(normal, [])
        self.assertTrue(any(item["pattern_id"] == "p018" for item in stressed))

    def test_pattern_coverage_report_exposes_unsupported_patterns(self) -> None:
        gen = self._generator()
        report = gen.pattern_coverage_report()
        unsupported = {item["pattern_id"] for item in report["unsupported_patterns"]}
        self.assertIn("p025", unsupported)
        self.assertEqual(report["total_patterns"], 3)
        self.assertEqual(report["supported_count"], 2)

    def test_false_positive_regression_cases_remain_suppressed(self) -> None:
        gen = self._generator()
        cases = [
            "Quick favor: 1-minute survey for college research project",
            "MSTR investor Q&A delayed while retail holders ask questions",
            "ABN Amro CEO says loan growth can withstand rate hikes",
        ]
        for title in cases:
            with self.subTest(title=title):
                self.assertEqual(gen.match_alert_to_patterns({"source": "rss", "title": title}), [])


if __name__ == "__main__":
    unittest.main()
