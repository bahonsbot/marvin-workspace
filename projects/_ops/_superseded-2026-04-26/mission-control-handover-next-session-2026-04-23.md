# Mission Control Handover for New Session — 2026-04-23

Start here if the current session is near compaction.

## Current truth
Mission Control has moved past basic R3 bridge debugging.

### Phase read
- **R1:** done
- **R2:** effectively done
- **R3:** complete for the bounded server-owned bridge slice
- **R4:** next
- **R5:** later

## What is already proved
### Transport and connect
- Direct Gateway websocket is healthy and challenge-first.
- Preview-visible websocket path can now surface `connect.challenge`.
- Guarded server-owned connect can now return successful `mc-server-connect`.
- Preview proxy raw TCP tunnel bug was fixed earlier in commit:
  - `3f8f904` `mission-control: proxy runtime bridge via websocket client`

### New action layer
The bridge architecture has pivoted to:
- websocket for connect + inbound events
- same-origin HTTP for bounded actions

These routes now exist and are wired into the hook:
- `/api/runtime-bridge/session`
- `/api/runtime-bridge/send`
- `/api/runtime-bridge/stop`

### End-to-end HTTP bridge proof
Verified successfully against throwaway session key:
- `agent:main:r3-http-bridge-proof`

Proof results:
1. `POST /api/runtime-bridge/session`
   - returned `200`
   - bootstrapped the session successfully
2. `POST /api/runtime-bridge/send`
   - returned `200`
   - returned a real `runId`
   - returned `status: "started"`
3. `GET /api/runtime-bridge/history?sessionKey=agent:main:r3-http-bridge-proof`
   - returned `source: "gateway"`
   - returned assistant reply body exactly:
     - `HTTP bridge proof acknowledged.`
4. `POST /api/runtime-bridge/stop`
   - returned success with:
     - `{"ok":true,"aborted":true,"runIds":[...]}`

## Important contract update
Preview descriptor mismatch was fixed.

Now verified live:
- `composerSend: true`
- `stop: true`

This matches the actual HTTP action routes and the hook behavior.

## Best source files
### Main savepoint
- `projects/_ops/mission-control-savepoint-r3-http-bridge-pivot-2026-04-23.md`

### Daily memory
- `memory/2026-04-23.md`

### Core code files
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/app/api/runtime-bridge/session/route.ts`
- `projects/mission-control/app/api/runtime-bridge/send/route.ts`
- `projects/mission-control/app/api/runtime-bridge/stop/route.ts`
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

## What to do next
This is now **R4 work**, not more basic R3 proof work.

### Recommended next sequence
1. Preserve/commit the current Mission Control bridge checkpoint if not done yet.
2. Inspect the live/dashboard lane behavior specifically, not preview proof behavior.
3. Start retiring live-lane dependence on preview-era assumptions.
4. Make dashboard/live use the real server-owned path cleanly.
5. Keep preview only as rollback/proof lane, not as hidden live infrastructure.

## Practical next technical target
The most sensible first R4 move is:
- inspect how `deriveLiveRuntimeBridge(...)` and the live lane currently expose read-only behavior
- then enable or wire the same server-owned action shape for the live/dashboard lane without reintroducing browser token relay

## Avoid stale assumptions
Do **not** restart from any of these outdated assumptions:
- “preview path is dead before challenge”
- “Gateway UI is fighting over the lane”
- “R3 is only groundwork in code”
- “stop is still disabled in descriptor”

Those are no longer current.

## Short plain-English summary
We proved the bounded bridge.
The next session should stop debugging whether the bridge basically works and start converting that success into a cleaner live/dashboard runtime path.
