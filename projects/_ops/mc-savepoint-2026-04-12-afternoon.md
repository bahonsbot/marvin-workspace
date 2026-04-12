# Mission Control savepoint — 2026-04-12 afternoon

## Context
Post-rollback Mission Control work resumed in the **Chat-only safe lane** first, before touching broader runtime or Tasks work again.

This savepoint is for resuming after quota/account switch.

## What was completed in this session

### Morning Meeting / workspace hygiene
Applied and verified:
1. `market-signal-generator` cron fix
   - added explicit `tz: Asia/Ho_Chi_Minh`
   - commit: `30350f1` was kernel doc fix; cron fix itself was applied via OpenClaw cron update and logged in daily memory
2. clarified `TOOLS.md` vs `MEMORY.md` vs daily note separation
   - commit: `66b8c89`
3. updated recorded host kernel version in `TOOLS.md`
   - commit: `30350f1`
4. batched remaining tiny doc/model-guidance cleanups
   - commit: `fc39b63`
5. promoted durable cron-timezone lesson into `MEMORY.md`
   - commit: `ba409f0`
6. workspace home-improvement earlier that morning:
   - added WS connection lifecycle logging to:
     - `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
     - `projects/mission-control/scripts/preview-origin-proxy.js`
   - commit: `bdefbfd`

### Chat-only safe structural refactor lane
All of these were build-verified and preview-verified:
1. message/event rendering extraction
   - new file: `projects/mission-control/components/chat/chat-message-blocks.tsx`
   - commit: `8520722`
2. transcript-adjacent UI extraction
   - new file: `projects/mission-control/components/chat/chat-transcript-adjacent.tsx`
   - commit: `7dda3a8`
3. composer extraction
   - new file: `projects/mission-control/components/chat/chat-composer.tsx`
   - commit: `312cdd2`
4. recent sessions rail extraction
   - new file: `projects/mission-control/components/chat/chat-session-rail.tsx`
   - commit: `e0acaaa`

### Nerve-anchored Chat hardening
Before hardening, the Nerve repo was checked at `/tmp/openclaw-nerve`.
Relevant reference patterns:
- `src/hooks/useChatRecovery.ts` → generation-based stale recovery guard
- `src/hooks/useWebSocket.ts` → connection generation so older sockets cannot overwrite newer state
- `server/lib/kanban-store.test.ts` → stale run/session results rejected after rerun

Applied Mission Control equivalents:
1. stale load/session-switch guard in `useRuntimeBridge.ts`
   - added `activeSessionKeyRef` and `sessionGenerationRef`
   - `load(...)` now discards late success/error/finalizer work when session or generation changed
   - `switchSession(...)` increments generation before resetting state
   - commit: `d895969`
2. stale send/abort guard in `useRuntimeBridge.ts`
   - `sendPrompt(...)` and `abortPrompt(...)` now bail if generation/session changed before async completion returns
   - commit: `2d498c6`

## Current verified state
- `npm run build` passed after each slice and again after hardening
- fresh preview restarts were completed for the recent slices/hardening passes
- route truth after restart:
  - `http://127.0.0.1:3005/general/chat` → 200
  - `http://127.0.0.1:3005/general/agents` → 200
- Philippe visually confirmed Chat still looked good after the structural refactor slices
- known unrelated issue: minor autonomous board issue on Tasks page existed already before this Chat lane work

## Current Chat posture
The major structural cleanup for `MissionControlChatSurface.tsx` is largely done.

Done:
- rich text helpers
- UI helpers
- tool-group rendering
- message/event rendering
- transcript-adjacent UI
- composer UI
- recent sessions rail
- first two stale-state hardening passes in `useRuntimeBridge.ts`

Still remaining in/around the Chat surface:
- top control strip remains inline and somewhat bulky
- Sudo/dev-team delegation panel remains inline
- transcript assembly/tool-burst grouping is still local logic in `MissionControlChatSurface.tsx`
- socket/reconnect/hydration hardening is only partially addressed

## Recommended next move
Because quota was running low, work paused here deliberately.

### Best next step
Do a **manual Chat sanity check first**, then continue with the next Nerve-style hardening slice.

Recommended order:
1. quick manual sanity test in Chat:
   - switch sessions quickly
   - send prompt, then switch sessions
   - abort while switching if possible
   - confirm no old send/abort state bleeds into the newer session
2. if stable, continue hardening in `projects/mission-control/hooks/useRuntimeBridge.ts`

### Most likely next hardening target
**socket/reconnect generation hardening**, or if inspection shows it is safer first, **hydration/recovery merge tightening**.

The principle should stay the same:
- do not broaden scope
- follow Nerve’s stale-result discipline
- one async seam at a time
- build
- fresh preview restart
- route verification
- commit

## Important boundaries
Do **not** reopen Tasks structural refactor yet just because the Chat lane went well.
The safe pattern was:
- one narrow slice
- verify real build
- fresh restart
- verify routes
- commit

Keep that discipline.

## Files most relevant to resume
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/components/chat/chat-message-blocks.tsx`
- `projects/mission-control/components/chat/chat-transcript-adjacent.tsx`
- `projects/mission-control/components/chat/chat-composer.tsx`
- `projects/mission-control/components/chat/chat-session-rail.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `/tmp/openclaw-nerve/src/hooks/useChatRecovery.ts`
- `/tmp/openclaw-nerve/src/hooks/useWebSocket.ts`

## Daily memory
Session details, decisions, and verifications are logged in:
- `memory/2026-04-12.md`

## Resume prompt suggestion
On next session start:
1. read this savepoint
2. read `memory/2026-04-12.md`
3. inspect `projects/mission-control/hooks/useRuntimeBridge.ts`
4. perform a quick manual Chat sanity check
5. continue the next narrow Nerve-style hardening slice
