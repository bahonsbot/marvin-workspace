import unittest

from src.broker_adapter_alpaca import AlpacaPaperAdapter, PaperOnlyViolationError


class TestAlpacaPaperAdapter(unittest.TestCase):
    def test_hard_fails_when_live_mode_enabled(self):
        with self.assertRaises(PaperOnlyViolationError):
            AlpacaPaperAdapter(base_url="https://paper-api.alpaca.markets", paper_mode=False)

    def test_hard_fails_when_live_endpoint_used(self):
        with self.assertRaises(PaperOnlyViolationError):
            AlpacaPaperAdapter(base_url="https://api.alpaca.markets", paper_mode=True)

    def test_get_account_uses_paper_request_path(self):
        adapter = AlpacaPaperAdapter(base_url="https://paper-api.alpaca.markets", paper_mode=True)
        calls = []

        def fake_request(method, path, body=None):
            calls.append((method, path, body))
            return {"equity": "1010.50", "last_equity": "1000.00"}

        adapter._request = fake_request

        result = adapter.get_account()

        self.assertEqual(result["equity"], "1010.50")
        self.assertEqual(calls, [("GET", "/v2/account", None)])


if __name__ == "__main__":
    unittest.main()
