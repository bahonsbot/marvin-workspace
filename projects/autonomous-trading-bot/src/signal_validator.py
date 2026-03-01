"""Basic webhook payload schema validation for paper-mode foundation."""

from typing import Any, Dict, List

REQUIRED_FIELDS = {
    "symbol": str,
    "side": str,
    "qty": (int, float),
    "timestamp": str,
}

ALLOWED_SIDES = {"buy", "sell"}


def validate_signal_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Validate minimal payload shape and types.

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

    side = str(payload.get("side", "")).lower()
    if side and side not in ALLOWED_SIDES:
        errors.append("Field 'side' must be 'buy' or 'sell'.")
    if side:
        normalized["side"] = side

    qty = payload.get("qty")
    if isinstance(qty, (int, float)) and qty <= 0:
        errors.append("Field 'qty' must be greater than 0.")

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "normalized": normalized,
    }
