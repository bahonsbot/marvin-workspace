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
            {
                "id": "p026",
                "name": "VIX ETN Volmageddon 2018",
                "category": "financial_credit",
                "confidence": "HIGH",
                "time_horizon": "intraday",
            },
            {
                "id": "p027",
                "name": "Swiss Franc Unpeg Shock 2015",
                "category": "macroeconomic",
                "confidence": "HIGH",
                "time_horizon": "intraday",
            },
            {
                "id": "p028",
                "name": "Yen Carry Unwind Regime",
                "category": "macroeconomic",
                "confidence": "MEDIUM_HIGH",
                "time_horizon": "short-term",
            },
            {
                "id": "p029",
                "name": "US Regional CRE Stress Wave",
                "category": "financial_credit",
                "confidence": "MEDIUM_HIGH",
                "time_horizon": "medium-term",
            },
            {
                "id": "p030",
                "name": "Mega-Cap Earnings Shock",
                "category": "corporate",
                "confidence": "MEDIUM_HIGH",
                "time_horizon": "intraday",
            },
            {
                "id": "p031",
                "name": "M&A Antitrust Block",
                "category": "corporate",
                "confidence": "MEDIUM_HIGH",
                "time_horizon": "short-term",
            },
            {
                "id": "p032",
                "name": "US Government Shutdown",
                "category": "political",
                "confidence": "MEDIUM_HIGH",
                "time_horizon": "short-term",
            },
            {
                "id": "p033",
                "name": "US Tariff War Escalation",
                "category": "political",
                "confidence": "HIGH",
                "time_horizon": "short-term",
            },
            {
                "id": "p034",
                "name": "Major Accounting Scandal",
                "category": "corporate",
                "confidence": "MEDIUM_HIGH",
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
        self.assertEqual(report["unsupported_patterns"], [])
        self.assertEqual(report["total_patterns"], 12)
        self.assertEqual(report["supported_count"], 12)

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

    def test_p025_to_p034_supported_patterns_match_targeted_positive_cases(self) -> None:
        gen = self._generator()
        cases = {
            "p025": "BoE emergency gilt purchases follow LDI funds margin calls",
            "p026": "Short VIX ETN liquidation sparks Volmageddon-style selloff",
            "p027": "SNB removes floor as Swiss franc unpeg shocks brokers",
            "p028": "Yen carry unwind accelerates after BOJ YCC adjustment",
            "p029": "Regional bank CRE exposure rises as office refinancing wall nears",
            "p030": "Nvidia guidance cut triggers mega-cap earnings shock across Nasdaq",
            "p031": "FTC sues to block merger as antitrust lawsuit rattles deal stocks",
            "p032": "Congress shutdown talks stall before federal government shutdown deadline",
            "p033": "US announces new tariffs on China in trade war escalation",
            "p034": "Auditor resigns after short seller report alleges accounting fraud",
        }
        for expected_id, title in cases.items():
            with self.subTest(pattern_id=expected_id):
                matches = gen.match_alert_to_patterns({"source": "rss", "title": title})
                self.assertTrue(any(item["pattern_id"] == expected_id for item in matches), matches)

    def test_p025_to_p034_broad_false_positive_cases_remain_suppressed(self) -> None:
        gen = self._generator()
        cases = [
            "Pension app adds retirement planning calculator for corporate employees",
            "Analyst explains VIX options tutorial for beginner volatility traders",
            "Hardware store launches new floor price target campaign",
            "Travelers complain about yen travel money and carry-on luggage fees",
            "Commercial real estate brokers celebrate office leasing rebound without defaults",
            "Small-cap retailer reports earnings miss after local business slowdown",
            "Blockchain merger rumor appears in crypto newsletter block trade section",
            "Factory shutdown follows maintenance issue at Midwest plant",
            "Mobile phone tariff plan changes anger telecom customers",
            "Accounting software company launches bookkeeping tips newsletter",
        ]
        for title in cases:
            with self.subTest(title=title):
                self.assertEqual(gen.match_alert_to_patterns({"source": "rss", "title": title}), [])


if __name__ == "__main__":
    unittest.main()
