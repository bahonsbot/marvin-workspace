"""Basic webhook payload schema validation for paper-mode foundation."""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List

REQUIRED_FIELDS = {
    "symbol": str,
    "side": str,
    "qty": (int, float),
    "timestamp": str,
}

ALLOWED_SIDES = {"buy", "sell"}

# Validation constants
MAX_SYMBOL_LENGTH = 10
MAX_TITLE_LENGTH = 500
MAX_URL_LENGTH = 2048
MAX_STRING_LENGTH = 1000

# Ticker regex: 1-10 uppercase letters/numbers, optional dot for share classes (e.g., BRK.A)
TICKER_REGEX = re.compile(r'^[A-Z0-9]{1,10}(\.[A-Z0-9]{1,5})?$')


def _validate_timestamp(ts: str) -> bool:
    """Validate ISO-8601 timestamp format."""
    try:
        # Accept various ISO-8601 formats
        ts_clean = ts.replace("Z", "+00:00")
        datetime.fromisoformat(ts_clean)
        return True
    except (ValueError, TypeError):
        return False


def _validate_ticker(symbol: str) -> bool:
    """Validate stock ticker format."""
    return bool(TICKER_REGEX.match(symbol.upper()))


def _validate_string_length(value: str, max_len: int, field_name: str) -> str | None:
    """Validate string length, return error message if invalid."""
    if len(value) > max_len:
        return f"Field '{field_name}' exceeds max length {max_len} (got {len(value)})"
    return None


def validate_signal_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Validate payload schema, types, and formats.

    Returns:
        {"ok": bool, "errors": list[str], "normalized": dict}
    """
    errors: List[str] = []

    if not isinstance(payload, dict):
        return {"ok": False, "errors": ["Payload must be a JSON object/dict."], "normalized": {}}

    normalized = dict(payload)

    for field, expected_type in REQUIRED_FIELDS.items():
        if field not in payload:
            errors.append(f"Missing required field: {field}")
            continue
        if not isinstance(payload[field], expected_type):
            errors.append(
                f"Field '{field}' must be of type {expected_type}, got {type(payload[field]).__name__}"
            )

    # Validate symbol format and length
    symbol = str(payload.get("symbol", "")).upper()
    if symbol:
        if len(symbol) > MAX_SYMBOL_LENGTH:
            errors.append(f"Field 'symbol' exceeds max length {MAX_SYMBOL_LENGTH}")
        elif not _validate_ticker(symbol):
            errors.append(f"Field 'symbol' must be valid ticker format (1-10 chars, A-Z0-9)")
        normalized["symbol"] = symbol

    # Validate side
    side = str(payload.get("side", "")).lower()
    if side and side not in ALLOWED_SIDES:
        errors.append("Field 'side' must be 'buy' or 'sell'.")
    if side:
        normalized["side"] = side

    # Validate qty
    qty = payload.get("qty")
    if isinstance(qty, (int, float)) and qty <= 0:
        errors.append("Field 'qty' must be greater than 0.")

    # Validate timestamp format
    timestamp = str(payload.get("timestamp", ""))
    if timestamp and not _validate_timestamp(timestamp):
        errors.append("Field 'timestamp' must be valid ISO-8601 format")

    # Validate optional string fields length
    for field_name, max_len in [
        ("source_title", MAX_TITLE_LENGTH),
        ("source_url", MAX_URL_LENGTH),
        ("strategy", MAX_STRING_LENGTH),
    ]:
        if field_name in payload and isinstance(payload[field_name], str):
            err = _validate_string_length(payload[field_name], max_len, field_name)
            if err:
                errors.append(err)

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "normalized": normalized,
    }
