# Cron Wave 2A Migration Brief

Date: 2026-03-16
Depends on:
- `projects/_ops/cron-script-first-migration-plan-2026-03-16.md`
- `projects/_ops/cron-runner-spec-2026-03-16.md`
- `projects/_ops/cron-wave1-migration-brief-2026-03-16.md`
- validated Wave 1 runner scaffold and same-day direct verification

## Purpose

Define the next migration batch for higher-frequency deterministic jobs that should benefit quickly from the script-first runner while staying below the sensitivity line of dispatching actual trades.

## Wave 2A Jobs

1. `rss-feed-monitor`
2. `rss-feed-monitor-weekend-light`
3. `reddit-monitor`
4. `reddit-monitor-weekend-light`
5. `enrichment-ab-review`

## Why These Jobs Belong in 2A

- deterministic script execution or simple deterministic read/report logic
- frequent enough to show token-efficiency gains quickly
- lower operational sensitivity than the trade dispatcher
- clear success/failure states

## Not Included Yet

Still hold for later:
- `auto-signal-dispatcher`
- `signal-accuracy-review`
- `trading-daily-report`
- `pre-market-brief`

Reason:
- higher downstream sensitivity or mixed reasoning/reporting behavior

## Required Runner Expansion

Before applying Wave 2A cron mutations, the runner should be extended with registry entries for:
- `rss-feed-monitor`
- `rss-feed-monitor-weekend-light`
- `reddit-monitor`
- `reddit-monitor-weekend-light`
- `enrichment-ab-review`

Implementation preference:
- use thin wrapper scripts where needed to keep registry clean
- preserve the current `cron-context.json` rule: scripts update it atomically, runner does not touch it directly

## Per-Job Mapping

### 1) rss-feed-monitor
Target payload:
```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task rss-feed-monitor
```
Verification:
- monitor script runs successfully
- `memory/cron-run-log.jsonl` row exists
- `cron-context.json` is only script-managed

### 2) rss-feed-monitor-weekend-light
Target payload:
```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task rss-feed-monitor-weekend-light
```
Verification:
- same as rss-feed-monitor
- schedule semantics unchanged

### 3) reddit-monitor
Target payload:
```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task reddit-monitor
```
Verification:
- script runs successfully
- runner logging works
- no direct manual edits to `cron-context.json`

### 4) reddit-monitor-weekend-light
Target payload:
```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task reddit-monitor-weekend-light
```
Verification:
- same as reddit-monitor
- schedule semantics unchanged

### 5) enrichment-ab-review
Target payload:
```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task enrichment-ab-review
```
Verification:
- current summary logic preserved
- runner logs execution
- no new side effects introduced

## Standard Payload Style

Suggested cron message template:

```text
Run only this command and nothing else:

cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task <task-name>

Reply with NO_REPLY.
```

## Verification Plan

Before cron mutation:
1. extend runner for Wave 2A tasks
2. directly run each new task through runner with `--json`
3. confirm expected logs/artifacts and no unexpected side effects

After cron mutation:
1. force-run each migrated cron job once
2. confirm `memory/cron-run-log.jsonl` row appears
3. confirm underlying script behavior still matches current expectations
4. confirm no cron-context rule violations

## Rollout Order

Recommended order:
1. `enrichment-ab-review`
2. `rss-feed-monitor`
3. `rss-feed-monitor-weekend-light`
4. `reddit-monitor`
5. `reddit-monitor-weekend-light`

Reason:
- smallest/simple summary task first
- then production monitors in weekday + weekend pairs

## Rollback

Per job:
1. restore original cron payload command
2. keep runner entry in place if not harmful
3. revert only the specific migrated job, not the whole runner framework

## Recommendation

Proceed only after runner expansion for these five tasks is implemented and directly verified. Wave 2A is a good next batch, but it should still be gated by actual runner support first.
