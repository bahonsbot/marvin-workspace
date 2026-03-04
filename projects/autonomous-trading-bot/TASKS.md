# Execution Backlog (Paper-Only Foundation)

Source: `PRD.md`
Scope in this backlog is **paper trading only**. No live broker execution, no API secrets, no external calls.

## P1 - Must Complete First (Safety + Core Flow)

### P1.1 Safety baseline and configuration
- Create explicit paper-only safety rules in docs and config.
- Add `.env.example` with placeholders only.
- Add `config/settings.example.yaml` with conservative defaults:
  - `paper: true`
  - `kill_switch: true` by default
  - daily loss cap
  - max position size
  - max open positions

**Completion criteria**
- [x] README states paper-only restriction and non-live policy.
- [x] Config has `paper: true` and kill switch defaults.
- [x] No secrets committed.

### P1.2 Python package skeleton for core components
- Create `src/` package and placeholders:
  - `webhook_receiver.py`
  - `signal_validator.py`
  - `risk_manager.py`
  - `order_executor.py`
  - `reporter.py`

**Completion criteria**
- [x] All listed modules exist with docstrings/TODO stubs.
- [x] `src/__init__.py` exists.

### P1.3 Risk guard engine (non-execution)
- Implement guards only, no broker calls:
  - kill-switch check
  - daily loss cap check
  - max position size check
  - max open positions check
- Add decision function returning `allow/deny` and reasons.

**Completion criteria**
- [x] Guard decision returns deterministic structured result.
- [x] Deny reasons are explicit and human-readable.
- [x] No external/network dependencies.

### P1.4 Minimal webhook payload validation
- Validate basic signal shape:
  - required fields present
  - expected primitive types
  - valid side (`buy`/`sell`)
  - positive quantity

**Completion criteria**
- [x] Validator returns `ok/errors`.
- [x] Invalid payloads are rejected before risk checks.

### P1.5 Dry-run CLI for end-to-end paper simulation
- Add local CLI script that:
  1) loads sample signal
  2) validates payload
  3) evaluates risk guards
  4) prints allow/deny decision and reasons

**Completion criteria**
- [x] Single command runs locally with no external services.
- [x] Output clearly shows paper mode and non-execution behavior.

## P2 - Next After Foundation

### P2.1 Local webhook receiver (paper mode)
- Implement HTTP endpoint to receive TradingView-style payloads.
- Route through validator + risk guards.
- Log decisions only.

**Completion criteria**
- [x] Receives payloads locally.
- [x] Never places real orders.

### P2.2 Paper order simulation layer
- Build paper executor that records intended orders to local logs.

**Completion criteria**
- [x] Generates simulated order IDs.
- [x] Persists order events with timestamp and reason.

### P2.3 Reporting baseline
- Daily summary from local logs (signals received, allowed, denied, reasons).

**Completion criteria**
- [x] Report generated from log data.
- [x] No external messaging dependency required.

### P2.4 Test harness and fixtures
- Add unit tests for validator and risk guards.
- Add sample payload fixtures (valid/invalid/edge cases).

**Completion criteria**
- [x] Tests cover all guard deny paths.
- [x] Regression checks for schema validation.

### P2.5 Live-readiness gate (future, still disabled)
- Define objective checklist before any live mode discussion.

**Completion criteria**
- [ ] 30-day paper run evidence.
- [ ] Loss cap not breached.
- [x] Manual approval step documented.

## Out of Scope Right Now
- Live broker credentials
- Real order placement
- External API calls
- Autonomous parameter self-adjustment
