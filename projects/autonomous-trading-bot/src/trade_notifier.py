"""Telegram notification module for trading alerts.

Sends trade execution alerts to the configured Telegram group.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib import error, request

# Default chat ID for the autonomous trading bot group
DEFAULT_CHAT_ID = "-1003711398278"


class TelegramNotifier:
    """Sends trade notifications to Telegram."""

    # Allowed chat IDs for notifications (comma-separated env var)
    ALLOWED_CHAT_IDS: set[str] = set()

    def __init__(
        self,
        *,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
        workspace: Path = Path("/data/.openclaw/workspace"),
    ) -> None:
        self.bot_token = bot_token or self._get_token(workspace)
        self.chat_id = chat_id or DEFAULT_CHAT_ID
        # Load allowed chat IDs from environment
        allowed = os.getenv("TELEGRAM_ALLOWED_CHAT_IDS", "").strip()
        if allowed:
            TelegramNotifier.ALLOWED_CHAT_IDS = {c.strip() for c in allowed.split(",") if c.strip()}

    def _is_allowed(self, chat_id: str) -> bool:
        """Check if chat ID is in the allowed list."""
        # If no allowlist configured, allow the default (backward compatible)
        if not TelegramNotifier.ALLOWED_CHAT_IDS:
            return True
        return chat_id in TelegramNotifier.ALLOWED_CHAT_IDS

    def _get_token(self, workspace: Path) -> str:
        """Get bot token from environment or OpenClaw config."""
        token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        if token:
            return token

        # Try OpenClaw config
        cfg_path = workspace.parent / "openclaw.json"
        if cfg_path.exists():
            # Verify file permissions before reading (security: prevent reading world-readable configs)
            import stat
            file_mode = cfg_path.stat().st_mode
            if file_mode & stat.S_IROTH:  # Others can read
                print(f"Warning: {cfg_path} is world-readable - consider chmod 600")
            try:
                config = json.loads(cfg_path.read_text(encoding="utf-8"))
                token = (
                    config.get("channels", {})
                    .get("telegram", {})
                    .get("botToken", "")
                )
                if token:
                    return token
            except (json.JSONDecodeError, OSError):
                pass

        # Try openclaw CLI
        import subprocess

        try:
            result = subprocess.run(
                ["openclaw", "config", "get", "channels.telegram.botToken"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                token = result.stdout.strip().strip('"')
                if token:
                    return token
        except (subprocess.SubprocessError, FileNotFoundError):
            pass

        raise RuntimeError("Telegram bot token not configured")

    def _send(self, message: str, parse_mode: str = "Markdown") -> Dict[str, Any]:
        """Send message via Telegram Bot API."""
        # Validate chat ID against allowlist
        if not self._is_allowed(self.chat_id):
            raise RuntimeError(f"Chat ID {self.chat_id} not in TELEGRAM_ALLOWED_CHAT_IDS allowlist")
        
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = json.dumps(
            {
                "chat_id": self.chat_id,
                "text": message,
                "parse_mode": parse_mode,
            }
        ).encode("utf-8")

        req = request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        try:
            with request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Telegram API error: status={exc.code} body={raw}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Telegram API connection error: {exc.reason}") from exc

    def notify_trade_execution(
        self,
        *,
        ticker: str,
        side: str,
        quantity: float,
        price: Optional[float] = None,
        order_id: str = "",
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send notification for an executed trade."""
        ts = timestamp or datetime.now(timezone.utc).isoformat()

        # Format price if available
        price_str = f"${price:.2f}" if price else "Market"

        # Build message
        emoji = "🟢" if side.lower() == "buy" else "🔴"
        message = (
            f"{emoji} *Trade Executed*\n"
            f"*Ticker:* `{ticker}`\n"
            f"*Side:* {side.upper()}\n"
            f"*Quantity:* {quantity}\n"
            f"*Price:* {price_str}\n"
            f"*Order ID:* `{order_id}`\n"
            f"*Time:* `{ts}`"
        )

        return self._send(message)

    def notify_trade_rejected(
        self,
        *,
        ticker: str,
        side: str,
        reason: str,
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send notification for a rejected trade."""
        ts = timestamp or datetime.now(timezone.utc).isoformat()

        message = (
            f"❌ *Trade Rejected*\n"
            f"*Ticker:* `{ticker}`\n"
            f"*Side:* {side.upper()}\n"
            f"*Reason:* {reason}\n"
            f"*Time:* `{ts}`"
        )

        return self._send(message)


# Module-level convenience function
def send_trade_alert(
    *,
    ticker: str,
    side: str,
    quantity: float,
    price: Optional[float] = None,
    order_id: str = "",
    timestamp: Optional[str] = None,
    rejected: bool = False,
    reject_reason: str = "",
) -> Dict[str, Any]:
    """Send trade alert to Telegram."""
    notifier = TelegramNotifier()

    if rejected:
        return notifier.notify_trade_rejected(
            ticker=ticker,
            side=side,
            reason=reject_reason,
            timestamp=timestamp,
        )

    return notifier.notify_trade_execution(
        ticker=ticker,
        side=side,
        quantity=quantity,
        price=price,
        order_id=order_id,
        timestamp=timestamp,
    )
