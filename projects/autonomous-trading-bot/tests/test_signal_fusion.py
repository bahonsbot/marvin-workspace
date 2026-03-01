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


if __name__ == "__main__":
    unittest.main()
