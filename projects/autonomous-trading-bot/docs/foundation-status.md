# Foundation Status (Paper-Only)

## Implemented
- Backlog with prioritized P1/P2 tasks (`TASKS.md`)
- Safe project scaffold (`README.md`, `.env.example`, `config/settings.example.yaml`, `src/`, `scripts/`, `logs/`)
- Risk guards in `src/risk_manager.py`:
  - kill switch
  - daily loss cap
  - max position size
  - max open positions
- Minimal payload validator in `src/signal_validator.py`
- Dry-run simulation command in `scripts/dry_run.py`
- Unit tests for validator and risk decision logic in `tests/`
- Local paper-only webhook receiver in `src/webhook_receiver.py`:
  - `POST /webhook`
  - validates payload via `signal_validator`
  - reads local context artifacts via `context_adapter`
  - applies deterministic fusion modifiers via `signal_fusion`
  - adjusts proposed `qty` in paper simulation only
  - evaluates adjusted decision via `risk_manager`
  - logs structured events to `logs/webhook_decisions.jsonl`
  - returns JSON `accepted/denied` response with reasons + context modifiers
- Unit tests for context adapter, fusion rules, and webhook context application

## Context Layer Details (Paper-Only)
- Context source files:
  - `projects/market-intel/data/signals_enriched_shadow.json`
  - `projects/market-intel/data/tracked_signals.json`
  - `projects/market-intel/data/signal_ab_comparison.json`
  - Optional `projects/market-intel-news-reader/data/*`
- Fusion output fields:
  - `confidence_adjustment`
  - `size_multiplier`
  - `block_reason` (when severe conflict)
- Example log/result fields:
  - `result.context.summary.risk_bias`
  - `result.context.summary.severity`
  - `result.proposal.raw_qty`
  - `result.proposal.adjusted_qty`
  - `result.proposal.size_multiplier`
  - `result.decision_context.confidence_adjustment`
  - `result.decision_context.block_reason`

### Current Limitations
- Missing or stale context files degrade to neutral behavior (graceful fallback)
- Rule set is deterministic and static (no adaptive weighting)
- News Reader artifact formats are loosely detected, best-effort only
- Context is portfolio-level and not symbol-sensitive yet

## Not Implemented (By Design)
- Live trading execution
- Broker integrations
- External API calls
- API key usage

## Run/Test Commands
- Run tests:
  - `python3 -m unittest discover -s tests -v`
- Run local webhook server:
  - `python3 -m src.webhook_receiver`
- Send sample request:
  - `curl -X POST http://127.0.0.1:8000/webhook -H "Content-Type: application/json" -d '{"symbol":"AAPL","side":"buy","qty":1,"timestamp":"2026-03-01T12:00:00Z"}'`

## Next Suggested Steps
1. Add paper execution simulator that writes structured events to logs.
2. Add a daily summary report from local logs.
