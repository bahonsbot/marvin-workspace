# HEARTBEAT.md

## Status
- **Active**
- Poll cadence: every 60 minutes
- Goal: quiet monitoring only

## Active Hours (messaging)
- 09:00 - 22:00 Asia/Ho_Chi_Minh (GMT+7)
- Outside active hours: stay silent unless urgent

## Default Behavior
- Keep heartbeat replies minimal
- Do not broadcast routine updates to Telegram groups
- Do not interfere with active user conversations/tasks
- If nothing needs attention: reply `HEARTBEAT_OK`
- Do not use heartbeat as the trigger for proactive maintenance or autonomous execution

## Heartbeat Check Loop (lightweight)
1. Review latest daily memory notes
2. Check open issues or blockers
3. Run quick health checks (including trading webhook/watchdog)
4. Surface only meaningful alerts or blockers

## Scope Boundary
- Heartbeat is for monitoring, not building
- Proactive execution rules live in `AUTONOMY.md`
- If a proactive task exists but does not require urgent attention, do not execute it from heartbeat

## Related Runtime
- `auto-signal-dispatcher`: every 15 minutes
- webhook watchdog: continuous loop (60s interval)

## Quiet Conditions
Return `HEARTBEAT_OK` when:
- outside active hours
- no significant changes
- user is actively engaged elsewhere
- recent check was already completed
