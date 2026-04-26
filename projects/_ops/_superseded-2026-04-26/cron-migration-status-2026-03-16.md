# Cron Migration Status

Date: 2026-03-16
Status: current migrated set after Wave 1, Wave 2A, and Wave 2B singleton

## Summary

The script-first cron runner is now the execution path for the following deterministic jobs:

### Migrated to runner path
- `data-manager`
- `entity-lifecycle-manager`
- `dependency-update-audit`
- `weekly-test-suite`
- `rss-feed-monitor`
- `rss-feed-monitor-weekend-light`
- `reddit-monitor`
- `reddit-monitor-weekend-light`
- `enrichment-ab-review`
- `auto-signal-dispatcher`
- `trading-daily-report`
- `pre-market-brief`

All of the above still run as OpenClaw cron agentTurn sessions for now, but they now hand off execution to:

```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task <task-name>
```

This means:
- prompt complexity is reduced
- deterministic logic is centralized
- locking/logging are standardized
- token/runtime overhead is reduced but **not yet eliminated**

## Still not on runner path

### Mixed jobs still using direct agentTurn payloads
- `signal-accuracy-review`

### Explicitly model-backed for now
- `nightly-memory-extraction`
- `platform-health-council`
- `nightly-security-review`
- `self-improvement`
- `daily-task-generator`

## Runner coverage status

### Completed
- Wave 1 deterministic migration
- Wave 2A deterministic migration
- Wave 2B singleton migration for execution-adjacent dispatcher

### Hold-back rationale
The remaining unmigrated jobs were held back for one of two reasons:

1. They are **mixed** jobs where the boundary between deterministic execution and reasoning/reporting still needs design work
2. They are **intentionally model-backed** governance/reporting jobs where LLM reasoning is part of the intended behavior

## Operational interpretation

Seeing `Cron: <job>` sessions in OpenClaw still means those jobs are launched through cron/agentTurn. The current migration reduced token waste and prompt fragility, but did not create zero-token execution yet.

A zero-token or near-zero-token path would require a stronger non-agentTurn bridge, such as a host-side scheduler or equivalent external execution layer.
