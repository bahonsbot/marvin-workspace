# Mission Control Savepoint — 2026-04-13 transcript foundation

## Scope
Late-night Mission Control continuation after the Apr 12 savepoints, focused on Chat responsiveness and transcript foundations before Slice 2.

## Current accepted state
Mission Control Chat is meaningfully healthier than it was at the start of the night:
- `/general/chat` no longer blocks on the heavy runtime summary before first render
- the runtime-summary refresh path is slimmer and cached
- preview was restarted and verified after the changes
- transcript/history foundations for richer Nerve-style rendering are now in place

This is a **foundation savepoint**, not a final transcript UX savepoint.
The visible transcript should feel somewhat better indirectly because the plumbing is cleaner, but the real renderer upgrade is still ahead.

## What landed tonight

### 1) Hard-refresh responsiveness fix
Commit: `cbb0e1b` — `Defer Mission Control chat summary on hard refresh`

What changed:
- `app/general/chat/page.tsx` now awaits transcript history only
- server render seeds a deferred placeholder summary instead of waiting on the heavy runtime summary
- live summary still hydrates client-side in the existing background refresh path

Why it matters:
- chat becomes available quickly on hard refresh
- transcript authority was left alone, so the duplicate-message bug was not reintroduced through a rushed performance hack

### 2) Runtime-summary refresh optimization
Commit: `e1dd89d` — `Speed Mission Control runtime summary refresh path`

What changed:
- `lib/adapters/orchestrator.ts` now prefers `openclaw status --json` + the on-disk session registry at `/data/.openclaw/agents/main/sessions/sessions.json`
- removed redundant expensive session-list probes from the summary path
- added a short-lived summary cache
- primed the summary fetch during `/general/chat` render
- updated `lib/chat/thread-model.ts` copy so the Tools rail matches the slimmer truth

Verification during this pass:
- local production timings improved from roughly:
  - `/api/runtime-bridge`: `~11.22s` -> `~5.81s cold`, `~0.012s warm`
  - `/general/chat`: `~0.24s`
  - history: `~0.13s`
- preview stack restart completed and verified on `:3005`
- preview timings were roughly:
  - `/general/chat`: `~0.46s`
  - history: `~0.10s`
  - `/api/runtime-bridge`: `~4.89s`
- duplicate-id probe on history payload remained clean (`80 messages`, `80 unique ids`, `0 duplicate ids`)

### 3) Transcript foundation — Slice 1
Commit: `b0ae60b` — `Lay transcript foundation for richer Mission Control chat`

What changed:
- added `lib/chat/runtime-bridge-transcript.ts`
- extended runtime-bridge contracts so transcript history can carry structured `entries`
- upgraded `lib/runtime-bridge-history.ts` so hydrated history emits richer normalized transcript entries instead of flattening everything down to plain text messages
- updated `hooks/useRuntimeBridge.ts` and `components/chat/MissionControlRuntimeProvider.tsx` so history/live transcript material merges through the same transcript-entry path
- added focused transcript regression tests:
  - `tests/runtime-bridge-transcript.test.ts`
  - `tsconfig.transcript-tests.json`

Validation during this pass:
- `npx tsc -p tsconfig.transcript-tests.json && node --test .test-dist/tests/runtime-bridge-transcript.test.js` passed
- `npx tsc --noEmit --pretty false` passed
- `npm run build` passed

## Important truths to preserve

### Duplicate-bug guardrail
Do **not** let history and live runtime actions become separate competing transcript truths again.
The whole point of Slice 1 is to push Mission Control toward a single normalized transcript-entry path with dedupe.

### Thinking display guardrail
Do **not** expose hidden chain-of-thought.
Only model/render explicit runtime-visible process/thinking events when they actually exist.

### Artifact fidelity guardrail
Do **not** build the future diff/file UI primarily by regex-parsing assistant prose when structured tool data exists.
Structured runtime/session evidence comes first.

## Comparison outcome vs Nerve
The Nerve comparison still stands:
- Nerve has the better transcript event model and better renderer primitives
- Mission Control was losing too much semantic information on hydrated history
- Slice 1 fixes the foundation problem, not the renderer problem

## Best next move: Slice 2
Recommended next target:
**richer history reconstruction + renderer-facing transcript shaping**

That means:
- continue improving how history/live material becomes semantic transcript entries
- shape the data so the renderer can distinguish assistant text, system notices, tool groups, tool results, and file actions cleanly
- keep UI work restrained until the transcript truth is stable

## Likely files for the next continuation
- `projects/mission-control/lib/chat/runtime-bridge-transcript.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/components/chat/*`
- `projects/mission-control/tests/runtime-bridge-transcript.test.ts`

## If resuming after compaction
Start from this assumption:
- Chat responsiveness work is in a good state for now
- Slice 1 transcript foundation is in
- the next work should not reopen performance or duplicate-risk carelessly
- Slice 2 should build on the new transcript-entry foundation rather than bypassing it with ad hoc UI hacks
