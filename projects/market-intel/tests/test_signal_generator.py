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


if __name__ == "__main__":
    unittest.main()
