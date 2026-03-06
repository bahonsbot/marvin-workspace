"""Alpaca broker adapter with hard paper-only enforcement.

This module intentionally blocks any live-trading configuration.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional
from urllib import error, request
from urllib.parse import urlparse


PAPER_BASE_URL = "https://paper-api.alpaca.markets"


class PaperOnlyViolationError(RuntimeError):
    """Raised when any non-paper Alpaca mode is detected."""


class AlpacaPaperAdapter:
    """Minimal Alpaca adapter constrained to paper endpoint only."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        base_url: Optional[str] = None,
        paper_mode: Optional[bool] = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self.api_key = api_key or os.getenv("ALPACA_API_KEY", "")
        self.api_secret = api_secret or os.getenv("ALPACA_API_SECRET", "")
        self.base_url = (base_url or os.getenv("ALPACA_BASE_URL", PAPER_BASE_URL)).rstrip("/")

        if paper_mode is None:
            raw = os.getenv("PAPER_MODE", "true").strip().lower()
            paper_mode = raw in {"1", "true", "yes", "on"}

        self.paper_mode = paper_mode
        self.timeout_seconds = timeout_seconds

        self._enforce_paper_only()

    def _enforce_paper_only(self) -> None:
        if not self.paper_mode:
            raise PaperOnlyViolationError("Live mode is prohibited. PAPER_MODE must be true.")

        # Parse URLs to compare hostnames (not full paths which may include /v2, etc.)
        parsed_config = urlparse(self.base_url)
        parsed_paper = urlparse(PAPER_BASE_URL)
        
        config_hostname = parsed_config.hostname or ""
        paper_hostname = parsed_paper.hostname or ""
        
        if config_hostname != paper_hostname:
            raise PaperOnlyViolationError(
                f"Invalid Alpaca base URL for paper mode: {self.base_url}. "
                f"Hostname must be: {paper_hostname} (got: {config_hostname})."
            )

        # Extra hard guard against known live endpoint aliases.
        lowered = self.base_url.lower()
        if "api.alpaca.markets" in lowered and "paper-api.alpaca.markets" not in lowered:
            raise PaperOnlyViolationError("Live Alpaca endpoint detected. Paper endpoint required.")

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.api_secret,
        }

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        self._enforce_paper_only()
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None

        req = request.Request(url=url, method=method, data=data, headers=self._headers())
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:  # nosec: B310 (fixed URL host)
                raw = resp.read().decode("utf-8")
                if not raw:
                    return {}
                return json.loads(raw)
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            # Redact sensitive fields from error response (account_id, keys, etc.)
            try:
                body = json.loads(raw)
                redacted = {k: "[REDACTED]" if k.lower() in ("account_id", "api_key", "secret", "token") else v for k, v in body.items()}
                raw = json.dumps(redacted)
            except Exception:
                raw = "[Non-JSON error response]"
            raise RuntimeError(f"Alpaca API error: status={exc.code} body={raw}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Alpaca API connection error: {exc.reason}") from exc

    def submit_order(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "symbol": intent["symbol"],
            "qty": str(intent["qty"]),
            "side": intent["side"],
            "type": intent.get("type", "market"),
            "time_in_force": intent.get("time_in_force", "day"),
            "client_order_id": intent.get("client_order_id"),
        }
        # Drop null optionals for cleaner audit payloads.
        payload = {k: v for k, v in payload.items() if v is not None}
        return self._request("POST", "/v2/orders", payload)

    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        return self._request("DELETE", f"/v2/orders/{order_id}")

    def get_order(self, order_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/v2/orders/{order_id}")

    def list_positions(self) -> List[Dict[str, Any]]:
        data = self._request("GET", "/v2/positions")
        if isinstance(data, list):
            return data
        return []
