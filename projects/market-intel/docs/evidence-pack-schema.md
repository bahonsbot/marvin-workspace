# Market Intel Evidence-Pack Schema

Canonical reference for signal verification data used in learning loops.

## Purpose
When signals are verified (correct/partial/incorrect), store structured context so future scoring can be improved with real outcomes.

## File Locations
- `projects/market-intel/data/model_feedback.json` — central feedback tracker
- `projects/market-intel/data/enhanced_signals.json` — generated signals with reasoning scores
- `projects/autonomous-trading-bot/data/tracked_signals.json` — executed equity trades linked to signals
- `projects/futures-bot/data/` — futures-specific signal tracking

## Evidence Pack Schema (example)
```json
{
  "signal_id": "mi-042",
  "timestamp": "2026-03-06T14:30:00Z",
  "title": "Fed signals rate cut pause",
  "category": "financial",
  "confidence_level": "STRONG BUY",
  "reasoning_score": 87,
  "evidence_pack": {
    "summary": "Fed Chair Powell hints at pausing rate cuts amid inflation concerns",
    "drivers": ["inflation uptick", "employment strong", "Fed commentary"],
    "metrics": {"cpi_mo": 0.4, "unemployment": 3.7, "fed_funds": "4.75-5.0%"},
    "sector_impact": ["financials", "real_estate", "utilities"],
    "confidence": 0.85
  },
  "outcome": "correct|partial|incorrect",
  "outcome_date": "2026-03-07",
  "outcome_notes": "Market moved as predicted, SPY +1.2%"
}
```

## Accuracy Tracker Commands
```bash
# Review pending signals (interactive)
cd /data/.openclaw/workspace/projects/market-intel
python3 src/accuracy_tracker.py --review

# Evaluate a specific signal
python3 src/accuracy_tracker.py --eval 42 correct
python3 src/accuracy_tracker.py --eval 43 partial
python3 src/accuracy_tracker.py --eval 44 incorrect

# Generate accuracy report
python3 src/accuracy_tracker.py --report
```

## Feedback Loop
1. Signal generated with reasoning score
2. Trade executed (if STRONG BUY and risk checks pass)
3. Outcome verified after 24-48 hours
4. Evidence pack saved to `model_feedback.json`
5. Reasoning engine adjusts future score weighting
6. `signal-accuracy-review` cron tracks daily verification
