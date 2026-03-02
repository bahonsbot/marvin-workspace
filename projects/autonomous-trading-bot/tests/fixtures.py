"""Sample payload fixtures for testing signal validation and risk management."""

# Valid payloads
VALID_PAYLOADS = [
    {
        "name": "basic_buy",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        },
    },
    {
        "name": "basic_sell",
        "payload": {
            "symbol": "TSLA",
            "side": "sell",
            "qty": 5,
            "timestamp": "2026-03-01T11:00:00Z",
        },
    },
    {
        "name": "float_quantity",
        "payload": {
            "symbol": "SPY",
            "side": "buy",
            "qty": 1.5,
            "timestamp": "2026-03-01T12:00:00Z",
        },
    },
    {
        "name": "uppercase_side_normalized",
        "payload": {
            "symbol": "MSFT",
            "side": "BUY",
            "qty": 20,
            "timestamp": "2026-03-01T13:00:00Z",
        },
    },
    {
        "name": "mixed_case_side_normalized",
        "payload": {
            "symbol": "NVDA",
            "side": "SeLl",
            "qty": 8,
            "timestamp": "2026-03-01T14:00:00Z",
        },
    },
]

# Invalid payloads (schema validation failures)
INVALID_PAYLOADS = [
    {
        "name": "missing_symbol",
        "payload": {
            "side": "buy",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Missing required field: symbol",
    },
    {
        "name": "missing_side",
        "payload": {
            "symbol": "AAPL",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Missing required field: side",
    },
    {
        "name": "missing_qty",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Missing required field: qty",
    },
    {
        "name": "missing_timestamp",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
        },
        "expected_error": "Missing required field: timestamp",
    },
    {
        "name": "invalid_side_hold",
        "payload": {
            "symbol": "AAPL",
            "side": "HOLD",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Field 'side' must be 'buy' or 'sell'.",
    },
    {
        "name": "invalid_side_long",
        "payload": {
            "symbol": "AAPL",
            "side": "long",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Field 'side' must be 'buy' or 'sell'.",
    },
    {
        "name": "negative_qty",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": -5,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Field 'qty' must be greater than 0.",
    },
    {
        "name": "zero_qty",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 0,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Field 'qty' must be greater than 0.",
    },
    {
        "name": "string_qty",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": "10",
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "expected_error": "Field 'qty' must be of type",
    },
    {
        "name": "integer_timestamp",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
            "timestamp": 1234567890,
        },
        "expected_error": "Field 'timestamp' must be of type",
    },
    {
        "name": "not_a_dict",
        "payload": "just a string",
        "expected_error": "Payload must be a JSON object/dict.",
    },
    {
        "name": "list_instead_of_dict",
        "payload": ["AAPL", "buy", 10],
        "expected_error": "Payload must be a JSON object/dict.",
    },
]

# Edge cases
EDGE_CASE_PAYLOADS = [
    {
        "name": "empty_payload",
        "payload": {},
        "should_pass": False,
    },
    {
        "name": "very_large_qty",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 999999999,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "should_pass": True,  # Schema allows it, risk manager handles size limits
    },
    {
        "name": "very_small_decimal_qty",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 0.001,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "should_pass": True,
    },
    {
        "name": "unicode_symbol",
        "payload": {
            "symbol": "🦞",
            "side": "buy",
            "qty": 1,
            "timestamp": "2026-03-01T10:00:00Z",
        },
        "should_pass": True,  # Schema validates type, not content
    },
    {
        "name": "extra_fields_ignored",
        "payload": {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 10,
            "timestamp": "2026-03-01T10:00:00Z",
            "price": 150.00,
            "strategy": "momentum",
            "confidence": 0.95,
        },
        "should_pass": True,  # Extra fields are ignored
    },
]

# Risk guard test fixtures
RISK_GUARD_CONFIGS = [
    {
        "name": "strict_config",
        "config": {
            "kill_switch_enabled": False,
            "daily_loss_cap": 100.0,
            "max_position_size": 10.0,
            "max_open_positions": 3,
        },
    },
    {
        "name": "kill_switch_on",
        "config": {
            "kill_switch_enabled": True,
            "daily_loss_cap": 100.0,
            "max_position_size": 10.0,
            "max_open_positions": 3,
        },
    },
    {
        "name": "tight_loss_cap",
        "config": {
            "kill_switch_enabled": False,
            "daily_loss_cap": 50.0,
            "max_position_size": 10.0,
            "max_open_positions": 3,
        },
    },
    {
        "name": "small_max_position",
        "config": {
            "kill_switch_enabled": False,
            "daily_loss_cap": 100.0,
            "max_position_size": 5.0,
            "max_open_positions": 3,
        },
    },
    {
        "name": "few_max_positions",
        "config": {
            "kill_switch_enabled": False,
            "daily_loss_cap": 100.0,
            "max_position_size": 10.0,
            "max_open_positions": 1,
        },
    },
]

RISK_GUARD_STATES = [
    {
        "name": "fresh_account",
        "state": {
            "daily_pnl": 0.0,
            "open_positions": 0,
        },
    },
    {
        "name": "profitable_account",
        "state": {
            "daily_pnl": 500.0,
            "open_positions": 2,
        },
    },
    {
        "name": "breached_loss_cap",
        "state": {
            "daily_pnl": -100.0,
            "open_positions": 1,
        },
    },
    {
        "name": "max_positions_reached",
        "state": {
            "daily_pnl": 50.0,
            "open_positions": 3,
        },
    },
]
