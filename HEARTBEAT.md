# HEARTBEAT.md

## Status
- **Active** — polls every 60 minutes but replies are minimal to avoid Telegram spam

## Active Hours
- **Default:** Active between 09:00 - 22:00 Asia/Ho_Chi_Minh (GMT+7) time
- Outside these hours: stay quiet unless urgent
- **Note:** Heartbeat runs 24/7 for project work, only messages during active hours

## Model
- **Default model:** bailian/MiniMax-M2.5
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
4. Proactive Execution (active - Phase 2)
5. Monitor webhook watchdog status (trading bot health)

## Proactive Execution (Phase 2)

Goal: make steady progress on project tasks between prompts.

**Proactive Queue File:** `memory/proactive-queue.json`
- Format: JSON array of task objects with `id`, `title`, `priority`, `ready`, `phase2_eligible`, `project`
- Updated by: daily memory extraction, manual additions, task completion

Per heartbeat:
1. Check for candidate work in this order:
   - `memory/proactive-queue.json` (if present)
   - `projects/*/TASKS.md`
   - latest `memory/YYYY-MM-DD.md` open items
2. Select one eligible task (priority, ready=true, phase2_eligible=true)
3. Execute one focused chunk (10-20 min):
   - Safe, bounded work
   - Verify result before marking done
4. Log outcome to queue file + daily memory
5. If milestone/blocker, message user

Restrictions:
- No external/public actions
- No destructive operations without approval
- Stay quiet on routine progress

Sub-agent routing:
- Use Codex for coding tasks
- Use MiniMax for research/data tasks
- Announce every spawn + completion

**Related Cron Jobs:**
- `auto-signal-dispatcher` — Every 15 minutes, dispatches STRONG BUY signals from Market Intel to trading bot
- Webhook watchdog — Continuous loop (60s sleep), restarts webhook receiver if down

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
