# Mission Control savepoint — R4 HTTP live lane — 2026-04-23

## Current phase truth
- R1 done
- R2 effectively done
- R3 complete for the bounded server-owned bridge slice
- R4 now active
- R5 later

## What changed in this slice
Mission Control live/dashboard is no longer treated as read-only purely because there is no browser websocket path.

A minimal honest R4 slice is now implemented:
- live/dashboard advertises server-owned same-origin HTTP send and stop capability
- the runtime hook allows interactive live use without requiring a browser websocket session
- the chat surface no longer calls the live lane disconnected just because websocket transport is unavailable
- live completion still does **not** rely on fake websocket state; it uses bounded history refresh/polling after send acknowledgement

## Important architectural truth
This is **not** the final gateway-native permanent live transport yet.

Current live/dashboard behavior is now:
- secret-free browser descriptor
- same-origin server-owned HTTP actions for:
  - `sessions.patch`
  - `chat.send`
  - `chat.abort`
  - `chat.history`
- no browser token relay
- no browser websocket session required
- no live event stream yet

So the dashboard/live lane is now interactive through a server-owned HTTP bridge, but still not equivalent to the full native Gateway UI transport model.

## Files changed in this slice
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/lib/chat/thread-model.ts`

## Behavior changes by file

### `lib/adapters/orchestrator.ts`
`deriveLiveRuntimeBridge()` now truthfully exposes the live lane as an HTTP server-owned bridge with:
- `composerSend: true`
- `stop: true`
- `eventStream: false`
- websocket still unavailable/null

Limitations text now says the live lane uses same-origin server-owned HTTP actions and bounded history refresh instead of browser websocket deltas.

### `hooks/useRuntimeBridge.ts`
Main change: live interaction no longer hard-requires `session.state === 'connected'` from a websocket path.

Added logic for HTTP interactive mode:
- detect server-owned HTTP action mode from descriptor transport/capabilities/endpoints
- treat that mode as interactive/usable without fake websocket state
- keep `wsState = 'unavailable'` honest
- when no websocket transport exists but HTTP mode is valid, session is exposed as usable with explicit detail text explaining that live websocket events are unavailable

Send behavior:
- still uses same-origin send endpoint
- after send ack, if no event stream is available, starts bounded polling against `/api/runtime-bridge/history`
- completion heuristic currently looks for a terminal history entry for the acknowledged `runId`, primarily an assistant final message or system error
- on poll expiry, clears the active run and surfaces a soft notice telling the operator to refresh if final output has not appeared yet

Stop behavior:
- HTTP stop is allowed in live mode without websocket
- abort clears the active run immediately and forces refresh/history hydration

History:
- added helper to fetch/hydrate history and return the payload directly so polling logic does not depend on async React state timing

### `components/chat/MissionControlChatSurface.tsx`
The live lane UI is now less websocket-centric for readiness:
- runtime status no longer automatically becomes `Disconnected` just because `wsState !== 'open'`
- when the live lane is usable through the server-owned HTTP bridge, status can show `Ready` or `Working` with honest copy explaining websocket events are unavailable
- refresh tooltip changed from `Refresh the bounded runtime bridge snapshot.` to `Refresh runtime bridge state.`
- composer no longer hard-locks purely on websocket absence
- placeholder copy no longer says `Composer unlocks after the real gateway session connects.`

### `lib/chat/thread-model.ts`
Operator summary / handoff copy was updated so the Mission Control surface no longer implies that live send/stop must remain outside the page until full event streaming exists.

The HTTP live bridge is now described as:
- `Same-origin runtime bridge (HTTP)` when send is available in polling mode

## Validation
Validation was run from `projects/mission-control`.

### Lint
`npm run lint`
- passed

### Build
`npm run build`
- passed
- existing unrelated build warnings remain elsewhere in the repo, including:
  - dynamic runner resolution in `app/api/tasks/autonomous/[taskId]/execute/route.ts`
  - NFT tracing warning involving `next.config.js` and `lib/adapters/files.ts`

These warnings were not introduced by this slice.

## Remaining gaps after this slice
This is the important part.

### 1. Live is interactive, but not yet permanent-gateway-live equivalent
It still lacks a durable live event stream comparable to the default Gateway UI.

### 2. Completion heuristics are still bounded and imperfect
HTTP-only completion currently depends on history polling and `runId`-based inference.
That is workable for this slice, but not the ideal permanent model.

### 3. Some UI paths are still transport-flavored
There is still websocket-oriented status chrome and some copy in the wider Mission Control UI that should be cleaned up later.

### 4. Activation/session effects may still assume connected-state semantics in secondary paths
Main live chat path is patched, but future cleanup should review any remaining `sessionState === 'connected'` assumptions outside the primary send/readiness path.

## Best current interpretation of R4
R4 is now concretely underway as:
- retire the live lane’s dependency on preview-only assumptions
- keep secrets out of the browser
- make dashboard/live useful through server-owned same-origin HTTP actions
- defer full permanent live parity until Gateway-style native live transport wiring is understood and adopted cleanly

## Recommended next step
Compare this implementation directly against the default Gateway UI live wiring and then decide the shortest safe path to permanent live parity:
- likely focus on the Gateway UI’s real-time session/chat subscription wiring
- identify how Gateway UI handles run completion and live updates without the Mission Control preview bridge assumptions
- then either:
  - lift the same model into Mission Control, or
  - deliberately keep this HTTP bridge as an intermediate state and document that clearly
