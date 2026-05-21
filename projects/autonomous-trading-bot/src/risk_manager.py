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
    max_symbol_position_qty: float = 0.0
    max_symbol_position_value: float = 0.0
    max_sector_positions: int = 0


@dataclass(frozen=True)
class AccountState:
    daily_pnl: float
    open_positions: int
    positions: Dict[str, float] | None = None
    position_values: Dict[str, float] | None = None
    position_sectors: Dict[str, str] | None = None


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


def _check_max_open_positions(config: RiskConfig, signal: Dict[str, Any], state: AccountState) -> str | None:
    side = str(signal.get("side", "")).lower().strip()
    if side == "sell":
        return None
    if state.open_positions >= config.max_open_positions:
        return (
            f"Max open positions reached: open_positions={state.open_positions} "
            f">= max_open_positions={config.max_open_positions}."
        )
    return None


def _check_symbol_concentration(config: RiskConfig, signal: Dict[str, Any], state: AccountState) -> str | None:
    side = str(signal.get("side", "")).lower().strip()
    if side == "sell":
        return None

    symbol = str(signal.get("symbol", "")).upper().strip()
    if not symbol:
        return None
    positions = state.positions or {}
    position_values = state.position_values or {}
    current_qty = float(positions.get(symbol, 0.0) or 0.0)
    current_value = float(position_values.get(symbol, 0.0) or 0.0)

    if config.max_symbol_position_qty > 0 and current_qty >= config.max_symbol_position_qty:
        return (
            f"Symbol concentration reached: {symbol} qty={current_qty:g} "
            f">= max_symbol_position_qty={config.max_symbol_position_qty:g}."
        )
    if config.max_symbol_position_value > 0 and current_value >= config.max_symbol_position_value:
        return (
            f"Symbol concentration reached: {symbol} value={current_value:.2f} "
            f">= max_symbol_position_value={config.max_symbol_position_value:.2f}."
        )
    return None


def _check_sector_concentration(config: RiskConfig, signal: Dict[str, Any], state: AccountState) -> str | None:
    side = str(signal.get("side", "")).lower().strip()
    if side == "sell" or config.max_sector_positions <= 0:
        return None

    symbol = str(signal.get("symbol", "")).upper().strip()
    sectors = state.position_sectors or {}
    sector = sectors.get(symbol)
    if not sector:
        return None
    positions = state.positions or {}
    symbols_in_sector = {pos_symbol for pos_symbol in positions if sectors.get(pos_symbol) == sector}
    if len(symbols_in_sector) >= config.max_sector_positions:
        return (
            f"Sector concentration reached: sector={sector} positions={len(symbols_in_sector)} "
            f">= max_sector_positions={config.max_sector_positions}."
        )
    return None


def _check_sell_inventory(signal: Dict[str, Any], state: AccountState) -> str | None:
    side = str(signal.get("side", "")).lower().strip()
    if side != "sell":
        return None

    symbol = str(signal.get("symbol", "")).upper().strip()
    qty = float(signal.get("qty", 0) or 0)
    positions = state.positions or {}
    available_qty = float(positions.get(symbol, 0.0) or 0.0)
    if available_qty <= 0:
        return f"Sell blocked: no long position available for {symbol}."
    if qty > available_qty:
        return f"Sell blocked: qty={qty} exceeds long position for {symbol} ({available_qty})."
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
        _check_max_open_positions(config, signal, state),
        _check_symbol_concentration(config, signal, state),
        _check_sector_concentration(config, signal, state),
        _check_sell_inventory(signal, state),
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
            "symbol_concentration",
            "sector_concentration",
            "sell_inventory",
        ],
    }
