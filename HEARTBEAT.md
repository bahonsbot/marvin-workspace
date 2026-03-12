# HEARTBEAT.md

## Status
- **Active**
- Poll cadence: every 60 minutes
- Goal: quiet monitoring + bounded progress

## Active Hours (messaging)
- 09:00 - 22:00 Asia/Ho_Chi_Minh (GMT+7)
- Outside active hours: stay silent unless urgent

## Default Behavior
- Keep heartbeat replies minimal
- Do not broadcast routine updates to Telegram groups
- Do not interfere with active user conversations/tasks
- If nothing needs attention: reply `HEARTBEAT_OK`

## Heartbeat Check Loop (lightweight)
1. Review latest daily memory notes
2. Check open issues or blockers
3. Run quick health checks (including trading webhook/watchdog)
4. Optionally execute one proactive work chunk (10-20 min, safe + bounded)

## Proactive Execution Rules
- Queue source: `memory/executor-subagent-queue.json`
- Process one task at a time (concurrency = 1)
- Execute one bounded chunk only
- Log outcomes to daily memory
- Stay quiet on routine progress; message only on milestone/blocker

## Related Runtime
- `auto-signal-dispatcher`: every 15 minutes
- webhook watchdog: continuous loop (60s interval)

## Quiet Conditions
Return `HEARTBEAT_OK` when:
- outside active hours
- no significant changes
- user is actively engaged elsewhere
- recent check was already completed
