#!/usr/bin/env python3
"""Paper-mode dry-run script.

Validates a sample signal and evaluates it through risk guards.
No external calls and no execution side effects.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.signal_validator import validate_signal_payload
from src.risk_manager import AccountState, RiskConfig, evaluate_risk_decision
SAMPLE_SIGNAL_PATH = ROOT / "data" / "sample_signal.json"


def main() -> int:
    payload = json.loads(SAMPLE_SIGNAL_PATH.read_text(encoding="utf-8"))

    validation = validate_signal_payload(payload)
    print("=== PAPER MODE DRY RUN ===")
    print(f"Sample payload: {SAMPLE_SIGNAL_PATH}")
    print("Validation:")
    print(json.dumps(validation, indent=2))

    if not validation["ok"]:
        print("\nDecision: DENY (invalid signal payload)")
        return 1

    config = RiskConfig(
        kill_switch_enabled=False,
        daily_loss_cap=100.0,
        max_position_size=1,
        max_open_positions=3,
    )
    state = AccountState(
        daily_pnl=-25.0,
        open_positions=1,
    )

    decision = evaluate_risk_decision(validation["normalized"], state, config)

    print("\nRisk decision:")
    print(json.dumps(decision, indent=2))
    print("\nNote: This is paper-only simulation. No orders are placed.")

    return 0 if decision["allow"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
