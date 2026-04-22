# HEARTBEAT.md

## Status
- Active
- Poll cadence: every 180 minutes
- Goal: quiet monitoring only
- Current live posture: keep heartbeat sparse and low-noise; use it for monitoring, not proactive execution

## Active Hours (messaging)
- 09:00 - 22:00 Asia/Ho_Chi_Minh (GMT+7)
- Outside active hours: stay silent unless urgent
- These hours apply to heartbeat messaging only; proactive execution is governed by `AUTONOMY.md`

## Default Behavior
- keep heartbeat replies minimal
- do not broadcast routine updates to Telegram groups
- do not interfere with active user conversations/tasks
- do not use heartbeat as a trigger for proactive maintenance or autonomous execution
- if nothing needs attention: `HEARTBEAT_OK`

## Check Loop
1. review latest daily memory notes
2. check open issues or blockers
3. run quick health checks, including trading webhook/watchdog
   - for the trading bot, prefer endpoint truth (`/health` and `/health/auth`) over raw process-name checks
   - do not alert just because a watchdog process name is missing if the health endpoint is returning OK
4. surface only meaningful alerts or blockers

## Scope Boundary
- heartbeat is for monitoring, not building
- proactive execution rules live in `AUTONOMY.md`
- if a proactive task exists but is not urgent, do not execute it from heartbeat

## Related Runtime
- webhook watchdog: continuous 60s loop

## Quiet Conditions
Return `HEARTBEAT_OK` when:
- outside active hours
- nothing significant changed
- the user is actively engaged elsewhere
- a recent check already covered the current state
