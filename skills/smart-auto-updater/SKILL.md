---
name: smart-auto-updater
description: AI-powered OpenClaw updater workflow that checks OpenClaw and skill updates, assesses risk, decides whether to auto-update, and reports to Telegram in phases. Use when asked to run update checks, auto-update safely, or schedule daily maintenance updates with reporting.
---

# Smart Auto-Updater

Run a safe update workflow in four phases and always report progress to Telegram.

## Required defaults

- Set `SMART_UPDATER_MODEL=minimax/MiniMax-M2.5`.
- Default `SMART_UPDATER_AUTO_UPDATE=LOW`.
- Default `SMART_UPDATER_RISK_TOLERANCE=MEDIUM`.
- Default `SMART_UPDATER_REPORT_LEVEL=detailed`.
- Set `SMART_UPDATER_TELEGRAM_TO=8471960624` unless explicitly overridden.
- Send Telegram updates in 3 moments: **check started/result**, **decision**, **final report**.

## Phase workflow

### 1) Check phase

- Run `openclaw update --check`.
- Run `clawhub update --all --no-input --dry-run` when available.
- Capture changelog notes and what would change.
- Send Telegram phase update: check summary.

### 2) Analysis phase

Assess risk for:
- architecture impact,
- performance impact,
- compatibility impact,
- operational risk.

Classify as `HIGH`, `MEDIUM`, `LOW` with short evidence.

### 3) Decision phase

- `HIGH`: skip update and report why.
- `MEDIUM`: skip update and report warning.
- `LOW`: auto-update and report outcome.

Send Telegram phase update: decision + rationale.

### 4) Report phase

Send final Telegram report containing:
- current version and target version,
- risk level,
- decision taken,
- changed components,
- rollback notes if update applied,
- next scheduled check time.

## Telegram delivery rule

When sending Telegram updates, use `message` tool with:
- `action: send`
- `channel: telegram`
- `target: 8471960624` by default
- `target: SMART_UPDATER_TELEGRAM_TO` only if explicitly set to override default

Never send phase updates without an explicit `target`.

## Scheduling rule

For automation, schedule daily at `10:00` in `Asia/Kuala_Lumpur` and run this workflow in isolated session with model pinned to `minimax/MiniMax-M2.5`.
