# Integration (Custom)

This version is intentionally minimal and only covers the setup we use.

## Runtime defaults

```bash
export SMART_UPDATER_MODEL="minimax/MiniMax-M2.5"
export SMART_UPDATER_AUTO_UPDATE="LOW"
export SMART_UPDATER_RISK_TOLERANCE="MEDIUM"
export SMART_UPDATER_REPORT_LEVEL="detailed"
# Optional explicit destination
export SMART_UPDATER_TELEGRAM_TO="8471960624"
```

## Manual run

```bash
openclaw sessions spawn \
  --agentId main \
  --model minimax/MiniMax-M2.5 \
  --message "Use smart-auto-updater skill. Run full check/analysis/decision/report now. Send Telegram updates for check, decision, and final report."
```

## Daily automation at 10:00 (Asia/Kuala_Lumpur)

```bash
openclaw cron add \
  --name "smart-auto-updater-daily" \
  --cron "0 10 * * *" \
  --tz "Asia/Kuala_Lumpur" \
  --session isolated \
  --wake now \
  --announce \
  --channel telegram \
  --message "Use smart-auto-updater skill. Set SMART_UPDATER_MODEL=minimax/MiniMax-M2.5. Run check, analysis, decision, and final report. Send Telegram updates at check, decision, and report phases."
```

## Verify

```bash
openclaw cron list
openclaw cron runs --limit 5
```
