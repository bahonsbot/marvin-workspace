"""Risk guard checks for paper-mode foundation.

No broker calls. No side effects. Pure decision logic only.
"""

from dataclasses import dataclass
from typing import Dict, List, Any


@dataclass(frozen=True)
class RiskConfig:
    kill_switch_enabled: bool
    daily_loss_cap: float
    max_position_size: float
    max_open_positions: int


@dataclass(frozen=True)
class AccountState:
    daily_pnl: float
    open_positions: int


def _check_kill_switch(config: RiskConfig) -> str | None:
    if config.kill_switch_enabled:
        return "Kill switch is enabled. Trading is blocked."
    return None


def _check_daily_loss_cap(config: RiskConfig, state: AccountState) -> str | None:
    # Loss is represented by negative PnL.
    if state.daily_pnl <= -abs(config.daily_loss_cap):
        return (
            f"Daily loss cap breached: daily_pnl={state.daily_pnl:.2f} "
            f"<= -{abs(config.daily_loss_cap):.2f}."
        )
    return None


def _check_max_position_size(config: RiskConfig, signal: Dict[str, Any]) -> str | None:
    qty = signal.get("qty", 0)
    if qty > config.max_position_size:
        return (
            f"Position size exceeds max: qty={qty} > max_position_size={config.max_position_size}."
        )
    return None


def _check_max_open_positions(config: RiskConfig, state: AccountState) -> str | None:
    if state.open_positions >= config.max_open_positions:
        return (
            f"Max open positions reached: open_positions={state.open_positions} "
            f">= max_open_positions={config.max_open_positions}."
        )
    return None


def evaluate_risk_decision(
    signal: Dict[str, Any],
    state: AccountState,
    config: RiskConfig,
) -> Dict[str, Any]:
    """Return allow/deny decision plus explicit reasons."""
    reasons: List[str] = []

    for check in (
        _check_kill_switch(config),
        _check_daily_loss_cap(config, state),
        _check_max_position_size(config, signal),
        _check_max_open_positions(config, state),
    ):
        if check:
            reasons.append(check)

    return {
        "allow": len(reasons) == 0,
        "reasons": reasons,
        "paper_only": True,
        "checked_rules": [
            "kill_switch",
            "daily_loss_cap",
            "max_position_size",
            "max_open_positions",
        ],
    }
