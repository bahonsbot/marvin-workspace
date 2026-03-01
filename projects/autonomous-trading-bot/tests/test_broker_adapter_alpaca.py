import unittest

from src.broker_adapter_alpaca import AlpacaPaperAdapter, PaperOnlyViolationError


class TestAlpacaPaperAdapter(unittest.TestCase):
    def test_hard_fails_when_live_mode_enabled(self):
        with self.assertRaises(PaperOnlyViolationError):
            AlpacaPaperAdapter(base_url="https://paper-api.alpaca.markets", paper_mode=False)

    def test_hard_fails_when_live_endpoint_used(self):
        with self.assertRaises(PaperOnlyViolationError):
            AlpacaPaperAdapter(base_url="https://api.alpaca.markets", paper_mode=True)


if __name__ == "__main__":
    unittest.main()
