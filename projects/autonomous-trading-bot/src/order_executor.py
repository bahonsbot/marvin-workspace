"""Order executor placeholder.

This module intentionally does NOT place orders.
It only exists as a safe scaffold during paper foundation work.
"""


def simulate_order_intent(signal: dict) -> dict:
    """Return a non-executing order intent representation."""
    return {
        "paper_only": True,
        "executed": False,
        "intent": signal,
        "message": "Order execution disabled in foundation phase.",
    }
