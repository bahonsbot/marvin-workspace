# HEARTBEAT.md

## Active Hours
- **Default:** Active between 09:00 - 22:00 Ho Chi Minh (Asia/Ho_Chi_Minh) time
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
