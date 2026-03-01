"""Webhook receiver placeholder.

Future scope:
- Accept TradingView-style webhook payloads
- Pass payload to signal validator and risk manager
- Persist decision logs

Paper mode only. No external endpoint wiring is implemented in this foundation.
"""


def handle_webhook(payload: dict) -> dict:
    """Placeholder webhook handler.

    Returns a static response to keep this module non-destructive.
    """
    return {
        "received": isinstance(payload, dict),
        "paper_only": True,
        "executed": False,
        "message": "Webhook receiver is a placeholder in foundation phase.",
    }
