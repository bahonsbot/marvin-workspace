import hashlib
import hmac
import os
import unittest
from datetime import UTC, datetime, timedelta

from src.webhook_receiver import _authorized


class TestWebhookAuth(unittest.TestCase):
    def setUp(self):
        self.prev_secret = os.environ.get("WEBHOOK_SHARED_SECRET")
        os.environ["WEBHOOK_SHARED_SECRET"] = "test-secret"
        self.payload = {"symbol": "/ES", "side": "buy", "qty": 1}
        self.body = b'{"symbol":"/ES","side":"buy","qty":1}'

    def tearDown(self):
        if self.prev_secret is None:
            os.environ.pop("WEBHOOK_SHARED_SECRET", None)
        else:
            os.environ["WEBHOOK_SHARED_SECRET"] = self.prev_secret

    def _signed_headers(self, ts: str):
        sig = hmac.new(
            b"test-secret",
            f"{ts}:{self.body.decode('utf-8')}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return {
            "Authorization": "Bearer test-secret",
            "X-Timestamp": ts,
            "X-Signature": sig,
        }

    def test_accepts_valid_bearer_auth_with_hmac(self):
        ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        headers = {
            "Authorization": "Bearer test-secret",
            "X-Timestamp": ts,
            "X-Signature": hmac.new(
                b"test-secret",
                f"{ts}:{self.body.decode('utf-8')}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest(),
        }
        self.assertTrue(_authorized(headers, body_bytes=self.body))

    def test_accepts_valid_hmac_signature(self):
        ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        headers = self._signed_headers(ts)
        self.assertTrue(_authorized(headers, body_bytes=self.body))

    def test_rejects_stale_timestamp(self):
        ts = (datetime.now(UTC) - timedelta(minutes=10)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        headers = self._signed_headers(ts)
        self.assertFalse(_authorized(headers, body_bytes=self.body))

    def test_rejects_invalid_signature(self):
        ts = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        headers = {
            "Authorization": "Bearer test-secret",
            "X-Timestamp": ts,
            "X-Signature": "bad-signature",
        }
        self.assertFalse(_authorized(headers, body_bytes=self.body))


if __name__ == "__main__":
    unittest.main()
