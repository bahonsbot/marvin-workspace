# Signal Review Workflow

Purpose: make signal verification durable, machine-readable, and consistent even when lighter models handle the review pass.

## Core Rule

A signal review is only complete when it writes **all three**:

1. **Structured per-signal review data** into `data/tracked_signals.json`
2. **An append-only structured ledger record** into `data/signal_review_ledger.jsonl`
3. **A dated human-readable session note** in `data/signal-verification-evidence-YYYY-MM-DD.md`

If only the markdown note is written, the review is incomplete.
If only a shallow verification note is written to `tracked_signals.json`, the review is incomplete.
If the append-only ledger is not updated, aggregate accuracy/model feedback is incomplete.

## Required Review Outputs

Each reviewed signal must store:

- `outcome` — `correct | partial | incorrect | duplicate`
- `verification_note` — short verdict line
- `evidence_pack.summary` — what actually happened
- `evidence_pack.drivers` — main causal observations
- `evidence_pack.metrics` — numeric or named observations when available
- `evidence_pack.sector_impact` — impacted sectors/assets if relevant
- `evidence_pack.causal_verdict` — was the causal thesis right?
- `evidence_pack.asset_expression_verdict` — was the market expression right?
- `evidence_pack.session_evidence_file` — dated session note path
- `evidence_pack.duplicate_of` — required when outcome is `duplicate`

## Canonical Write Path

Use the helper, not hand-edits:

```bash
cd /data/.openclaw/workspace/projects/market-intel
python3 scripts/save_signal_review.py \
  --index 0 \
  --outcome correct \
  --verification-note "Volatility spike and risk repricing confirmed" \
  --summary "Headline catalyst behaved as expected" \
  --driver "Brent swung 12% intraday" \
  --metric brent_move_pct=12 \
  --sector-impact energy \
  --causal-verdict correct \
  --asset-expression-verdict correct \
  --session-file data/signal-verification-evidence-2026-03-16.md \
  --append-session-note
```

## Backfill Path

To backfill an existing dated markdown evidence file into structured tracked-signal evidence:

```bash
cd /data/.openclaw/workspace/projects/market-intel
python3 scripts/save_signal_review.py --backfill-md data/signal-verification-evidence-2026-03-15.md
```

## Review Session Reporting

Every review summary should report:

- raw reviewed count
- unique reviewed count
- duplicate count
- verified total
- pending total
- evidence-pack coverage
- session evidence file path

## Evidence Integrity Guard

After structured reviews or backfills, run the non-destructive integrity guard:

```bash
cd /data/.openclaw/workspace/projects/market-intel
python3 src/accuracy_tracker.py --integrity-report
```

This writes `data/evidence_integrity_report.json` and **does not mutate** `tracked_signals.json` or `signal_review_ledger.jsonl`.
Use it to catch semantic cross-wiring where the signal title/pattern and evidence pack discuss different catalysts, e.g. a Saudi Aramco/oil signal with Putin/Ukraine ceasefire evidence.
Suspicious rows should be reviewed manually and fixed through the canonical helper/backfill path, not auto-rewritten.

## Guidance for Lighter Models

When running signal review:

1. Never stop at verdict-only updates
2. Always create or update the dated session evidence markdown file
3. Always write structured `evidence_pack` fields into `tracked_signals.json`
4. Mark duplicates explicitly as `duplicate` with `duplicate_of`
5. Always regenerate feedback artifacts after updates
6. Report evidence-pack coverage and duplicate count in the final summary

## Downstream Learning Contract

- `tracked_signals.json` is the rolling active/pending queue
- `signal_review_ledger.jsonl` is the canonical append-only reviewed-signal corpus
- `model_feedback.json` is the aggregate learning output regenerated from the ledger when present
- the dated markdown session file is the human audit trail, not the primary machine-learning store
