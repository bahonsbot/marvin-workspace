# HEARTBEAT.md

## Status
- **Active** — polls every 60 minutes but replies are minimal to avoid Telegram spam

## Active Hours
- **Default:** Active between 09:00 - 22:00 Asia/Ho_Chi_Minh (GMT+7) time
- Outside these hours: stay quiet unless urgent

## Model
- **Default model:** MiniMax-M2.5 (minimax/MiniMax-M2.5)
- **Reasoning:** Disabled for heartbeat checks

## Behavior
- Do not broadcast to Telegram groups during heartbeats
- Do not interfere with any tasks, commands, or chats currently running
- HEARTBEAT_OK should NOT be considered as a reply to any questions
- Keep responses minimal and concise

## Tasks (rotate through)
1. Review recent memory/daily notes for updates
2. Check for pending fixes or documented issues
3. Run quick system health checks
4. Proactive Execution Phase 1 (discovery-only, no autonomous file-changing actions)

## Proactive Execution (Phase 1: Discovery Only)

Goal: build proactive rhythm without taking autonomous write actions yet.

Per heartbeat:
1. Check for candidate work in this order:
   - `memory/proactive-queue.json` (if present)
   - `projects/*/TASKS.md`
   - latest `memory/YYYY-MM-DD.md` open items
2. Select one best next task and perform readiness checks only:
   - Is scope clear enough?
   - Is it safe and non-destructive?
   - Is required context/access available?
3. If ready, prepare a one-line proposed action for next execution window.
4. If blocked, prepare blocker summary with recommendation.

Restrictions in Phase 1:
- Do not execute autonomous file edits for project tasks.
- Do not run risky/destructive commands.
- Do not send routine status pings.
- Only message user on meaningful blocker or priority conflict.

## When to Stay Quiet (HEARTBEAT_OK)
- Outside active hours (22:00-09:00)
- Human is clearly busy or in an active conversation
- In the middle of a task, command, or ongoing conversation
- Nothing significant needs attention
- Recently checked (<30 min ago)

## Notes
- Default behavior: do not infer or repeat old tasks from prior chats
- If nothing needs attention, reply HEARTBEAT_OK
- Keep token usage low - focus on 2-3 quick checks per heartbeat
