import unittest

from src.signal_validator import validate_signal_payload


class TestSignalValidator(unittest.TestCase):
    def test_missing_required_fields(self):
        result = validate_signal_payload({"symbol": "AAPL"})

        self.assertFalse(result["ok"])
        self.assertIn("Missing required field: side", result["errors"])
        self.assertIn("Missing required field: qty", result["errors"])
        self.assertIn("Missing required field: timestamp", result["errors"])

    def test_invalid_values(self):
        payload = {
            "symbol": "AAPL",
            "side": "HOLD",
            "qty": -1,
            "timestamp": 12345,
        }

        result = validate_signal_payload(payload)

        self.assertFalse(result["ok"])
        self.assertIn("Field 'side' must be 'buy' or 'sell'.", result["errors"])
        self.assertIn("Field 'qty' must be greater than 0.", result["errors"])
        self.assertTrue(any("Field 'timestamp' must be of type" in e for e in result["errors"]))


if __name__ == "__main__":
    unittest.main()
