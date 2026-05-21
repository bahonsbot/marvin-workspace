import unittest

from src.signal_fusion import derive_decision_context


class TestSignalFusion(unittest.TestCase):
    def test_neutral_when_no_context(self):
        signal = {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}
        context = {"summary": {"available_context": False}}

        result = derive_decision_context(signal, context)

        self.assertEqual(result["confidence_adjustment"], 0.0)
        self.assertEqual(result["size_multiplier"], 1.0)
        self.assertIsNone(result["block_reason"])

    def test_risk_off_high_severity_reduces_buy_size(self):
        signal = {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}
        context = {
            "summary": {
                "available_context": True,
                "risk_bias": "risk_off",
                "severity": "high",
                "geopolitical_count": 10,
                "tracked_take_ratio": 0.5,
            }
        }

        result = derive_decision_context(signal, context)

        self.assertLess(result["size_multiplier"], 1.0)
        self.assertLess(result["confidence_adjustment"], 0.0)
        self.assertIsNone(result["block_reason"])

    def test_severe_conflict_blocks_buy(self):
        signal = {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}
        context = {
            "summary": {
                "available_context": True,
                "risk_bias": "risk_off",
                "severity": "high",
                "geopolitical_count": 30,
                "tracked_take_ratio": 0.7,
            }
        }

        result = derive_decision_context(signal, context)

        self.assertEqual(result["size_multiplier"], 0.0)
        self.assertIsNotNone(result["block_reason"])

    def test_risk_off_geopolitical_defense_buy_is_not_bluntly_throttled(self):
        signal = {
            "symbol": "LMT",
            "side": "buy",
            "qty": 1,
            "timestamp": "2026-03-01T00:00:00Z",
            "pattern_name": "Russia-Ukraine Conflict",
            "source_title": "Ukraine reports large Russian missile and drone strike",
            "semantic_fit_score": 0.9,
            "ticker_fit_score": 0.88,
            "ticker_fit_directness": "theme_proxy",
        }
        context = {
            "summary": {
                "available_context": True,
                "risk_bias": "risk_off",
                "severity": "medium",
                "geopolitical_count": 22,
                "tracked_take_ratio": 0.5,
            }
        }

        result = derive_decision_context(signal, context)

        self.assertGreater(result["size_multiplier"], 0.7)
        self.assertIsNone(result["block_reason"])
        self.assertEqual(result["signal_context"]["risk_alignment"], "supports_signal")

    def test_risk_off_unrelated_growth_buy_is_signal_specific_throttled(self):
        signal = {
            "symbol": "NVDA",
            "side": "buy",
            "qty": 1,
            "timestamp": "2026-03-01T00:00:00Z",
            "pattern_name": "Reddit GPU/Semis Thread",
            "source_title": "Nvidia AI chips rally on strong demand",
            "semantic_fit_score": 0.92,
            "ticker_fit_score": 0.9,
            "ticker_fit_directness": "direct_company",
        }
        context = {
            "summary": {
                "available_context": True,
                "risk_bias": "risk_off",
                "severity": "medium",
                "geopolitical_count": 22,
                "tracked_take_ratio": 0.5,
            }
        }

        result = derive_decision_context(signal, context)

        self.assertLess(result["size_multiplier"], 0.5)
        self.assertLess(result["confidence_adjustment"], 0.0)
        self.assertEqual(result["signal_context"]["risk_alignment"], "conflicts_signal")

    def test_low_fit_mapping_gets_cautious_even_in_risk_on(self):
        signal = {
            "symbol": "SPY",
            "side": "buy",
            "qty": 1,
            "timestamp": "2026-03-01T00:00:00Z",
            "pattern_name": "0DTE SPY Advice",
            "source_title": "I need advice trading 0DTE SPY",
            "semantic_fit_score": 0.56,
            "ticker_fit_score": 0.55,
            "ticker_fit_directness": "theme_proxy",
        }
        context = {
            "summary": {
                "available_context": True,
                "risk_bias": "risk_on",
                "severity": "low",
                "geopolitical_count": 0,
                "tracked_take_ratio": 0.7,
            }
        }

        result = derive_decision_context(signal, context)

        self.assertLess(result["size_multiplier"], 1.0)
        self.assertEqual(result["signal_context"]["fit_quality"], "weak")


if __name__ == "__main__":
    unittest.main()
