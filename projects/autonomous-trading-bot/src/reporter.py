"""Reporting placeholder for paper-mode foundation."""


def build_decision_report(validation_result: dict, risk_result: dict) -> dict:
    """Assemble a minimal local report structure."""
    return {
        "paper_only": True,
        "validation": validation_result,
        "risk": risk_result,
    }
