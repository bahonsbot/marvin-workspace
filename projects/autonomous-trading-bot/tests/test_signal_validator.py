import unittest

from src.signal_validator import validate_signal_payload
from tests.fixtures import VALID_PAYLOADS, INVALID_PAYLOADS, EDGE_CASE_PAYLOADS


class TestSignalValidator(unittest.TestCase):
    """Tests for signal payload schema validation."""

    # === Valid Payload Tests ===

    def test_valid_payload_basic_buy(self):
        """Test basic valid buy signal."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertTrue(result["ok"])
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["normalized"]["side"], "buy")

    def test_valid_payload_basic_sell(self):
        """Test basic valid sell signal."""
        payload = {
            "symbol": "TSLA",
            "side": "sell",
            "qty": 5,
            "timestamp": "2026-03-01T11:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertTrue(result["ok"])
        self.assertEqual(result["normalized"]["side"], "sell")

    def test_valid_payload_float_quantity(self):
        """Test valid payload with float quantity."""
        payload = {
            "symbol": "SPY",
            "side": "buy",
            "qty": 1.5,
            "timestamp": "2026-03-01T12:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertTrue(result["ok"])

    def test_valid_payload_side_normalization_uppercase(self):
        """Test that uppercase side is normalized to lowercase."""
        payload = {
            "symbol": "MSFT",
            "side": "BUY",
            "qty": 20,
            "timestamp": "2026-03-01T13:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertTrue(result["ok"])
        self.assertEqual(result["normalized"]["side"], "buy")

    def test_valid_payload_side_normalization_mixed_case(self):
        """Test that mixed case side is normalized to lowercase."""
        payload = {
            "symbol": "NVDA",
            "side": "SeLl",
            "qty": 8,
            "timestamp": "2026-03-01T14:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertTrue(result["ok"])
        self.assertEqual(result["normalized"]["side"], "sell")

    # === Invalid Payload Tests - Missing Fields ===

    def test_missing_required_fields(self):
        """Test that all missing required fields are reported."""
        result = validate_signal_payload({"symbol": "AAPL"})

        self.assertFalse(result["ok"])
        self.assertIn("Missing required field: side", result["errors"])
        self.assertIn("Missing required field: qty", result["errors"])
        self.assertIn("Missing required field: timestamp", result["errors"])

    def test_missing_symbol(self):
        """Test missing symbol field."""
        payload = {
            "side": "buy",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertTrue(any("Missing required field: symbol" in e for e in result["errors"]))

    def test_missing_side(self):
        """Test missing side field."""
        payload = {
            "symbol": "AAPL",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertTrue(any("Missing required field: side" in e for e in result["errors"]))

    def test_missing_qty(self):
        """Test missing qty field."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertTrue(any("Missing required field: qty" in e for e in result["errors"]))

    def test_missing_timestamp(self):
        """Test missing timestamp field."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertTrue(any("Missing required field: timestamp" in e for e in result["errors"]))

    # === Invalid Payload Tests - Invalid Values ===

    def test_invalid_side_hold(self):
        """Test invalid side value 'HOLD'."""
        payload = {
            "symbol": "AAPL",
            "side": "HOLD",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertIn("Field 'side' must be 'buy' or 'sell'.", result["errors"])

    def test_invalid_side_long(self):
        """Test invalid side value 'long'."""
        payload = {
            "symbol": "AAPL",
            "side": "long",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertIn("Field 'side' must be 'buy' or 'sell'.", result["errors"])

    def test_negative_qty(self):
        """Test negative quantity."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": -5,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertIn("Field 'qty' must be greater than 0.", result["errors"])

    def test_zero_qty(self):
        """Test zero quantity."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 0,
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertIn("Field 'qty' must be greater than 0.", result["errors"])

    def test_string_qty(self):
        """Test string instead of number for qty."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": "10",
            "timestamp": "2026-03-01T10:00:00Z",
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertTrue(any("Field 'qty' must be of type" in e for e in result["errors"]))

    def test_integer_timestamp(self):
        """Test integer instead of string for timestamp."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
            "timestamp": 1234567890,
        }
        result = validate_signal_payload(payload)
        self.assertFalse(result["ok"])
        self.assertTrue(any("Field 'timestamp' must be of type" in e for e in result["errors"]))

    # === Invalid Payload Tests - Type Errors ===

    def test_not_a_dict(self):
        """Test that non-dict payload is rejected."""
        result = validate_signal_payload("just a string")
        self.assertFalse(result["ok"])
        self.assertIn("Payload must be a JSON object/dict.", result["errors"])

    def test_list_instead_of_dict(self):
        """Test that list payload is rejected."""
        result = validate_signal_payload(["AAPL", "buy", 10])
        self.assertFalse(result["ok"])
        self.assertIn("Payload must be a JSON object/dict.", result["errors"])

    # === Edge Case Tests ===

    def test_empty_payload(self):
        """Test empty dict payload."""
        result = validate_signal_payload({})
        self.assertFalse(result["ok"])
        # Should have errors for all 4 required fields
        self.assertGreaterEqual(len(result["errors"]), 4)

    def test_extra_fields_ignored(self):
        """Test that extra fields are ignored and don't cause errors."""
        payload = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
            "price": 150.00,
            "strategy": "momentum",
            "confidence": 0.95,
        }
        result = validate_signal_payload(payload)
        self.assertTrue(result["ok"])
        # Extra fields should be in normalized output
        self.assertIn("price", result["normalized"])
        self.assertIn("strategy", result["normalized"])

    # === Fixture-Based Tests ===

    def test_all_valid_payloads_from_fixtures(self):
        """Test all valid payloads from fixtures."""
        for fixture in VALID_PAYLOADS:
            with self.subTest(name=fixture["name"]):
                result = validate_signal_payload(fixture["payload"])
                self.assertTrue(
                    result["ok"],
                    f"Fixture '{fixture['name']}' should be valid but got errors: {result['errors']}"
                )

    def test_all_invalid_payloads_from_fixtures(self):
        """Test all invalid payloads from fixtures."""
        for fixture in INVALID_PAYLOADS:
            with self.subTest(name=fixture["name"]):
                result = validate_signal_payload(fixture["payload"])
                self.assertFalse(
                    result["ok"],
                    f"Fixture '{fixture['name']}' should be invalid"
                )
                if "expected_error" in fixture:
                    self.assertTrue(
                        any(fixture["expected_error"] in e for e in result["errors"]),
                        f"Expected error containing '{fixture['expected_error']}' not found in {result['errors']}"
                    )

    def test_all_edge_cases_from_fixtures(self):
        """Test all edge case payloads from fixtures."""
        for fixture in EDGE_CASE_PAYLOADS:
            with self.subTest(name=fixture["name"]):
                result = validate_signal_payload(fixture["payload"])
                if fixture.get("should_pass", False):
                    self.assertTrue(
                        result["ok"],
                        f"Fixture '{fixture['name']}' should pass but got errors: {result['errors']}"
                    )
                else:
                    self.assertFalse(
                        result["ok"],
                        f"Fixture '{fixture['name']}' should fail"
                    )


if __name__ == "__main__":
    unittest.main()
