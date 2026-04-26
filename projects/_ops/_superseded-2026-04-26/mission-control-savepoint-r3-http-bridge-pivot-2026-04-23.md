# Mission Control Savepoint — R3 HTTP Bridge Pivot — 2026-04-23

## Purpose
This savepoint captures the current Mission Control chat/runtime migration state after the long Apr 23 investigation moved from preview websocket debugging into a cleaner server-owned action-layer rebuild.

It is meant to prevent loss of detail if a session gets compacted or stuck, and to let a future agent resume without re-discovering which assumptions from last night are now outdated.

---

## Executive summary
Mission Control is in a materially different place than it was at the end of the previous savepoint.

The most important updates are:

1. **R1 remains done and verified.**
   - preview still gets the legacy `v2` descriptor
   - dashboard/live still gets the secret-free `v3` descriptor
   - host/lane split is still real

2. **R2 remains effectively done.**
   - history/bootstrap still prefers gateway `chat.history`
   - JSONL remains fallback only
   - the client’s hydration/retry behavior is still materially improved

3. **R3 is now complete for the bounded server-owned bridge slice.**
   - the full preview-visible websocket path has now been proved to surface `connect.challenge`
   - the guarded server-owned connect path has now been proved to return a successful `mc-server-connect`
   - preview descriptor/runtime contract now advertises `composerSend: true` and `stop: true` honestly
   - the same-origin HTTP action layer has now been proved end-to-end for session bootstrap, send, history reconciliation, and stop
   - the old claim that preview “still remains the old browser-owned connect path” is now outdated for the current local proof environment, because preview is explicitly running with `MISSION_CONTROL_SERVER_CONNECT=1`

4. **A real preview transport bug was fixed and kept.**
   - the preview runtime websocket path had been using a brittle raw upgraded TCP tunnel
   - that was replaced with a proper websocket-to-websocket bridge in `projects/mission-control/scripts/preview-origin-proxy.js`
   - that fix was committed as `3f8f904` (`mission-control: proxy runtime bridge via websocket client`)

5. **The bridge architecture has now pivoted in the cleaner direction.**
   - websocket is no longer being treated as the place for every outbound RPC
   - same-origin server-owned HTTP routes now exist for:
     - `sessions.patch`
     - `chat.send`
     - `chat.abort`
   - the hook now uses those HTTP routes for bootstrap/send/abort
   - websocket is now effectively being reduced to **connect + inbound events**

6. **The first post-pivot contract mismatch was fixed.**
   - preview descriptor still exposes `/api/runtime-bridge/stop`
   - the stop route exists and is implemented
   - the hook calls the HTTP stop route
   - preview descriptor now also reports `capabilities.stop = true`
   - result: abort is now both implemented and truthfully advertised in the UI contract

Bottom line:

> The Mission Control bridge slice is now standing on the architecture we actually want for the bounded bridge proof.
> The main remaining work is no longer R3 validation. It is R4: moving the live/dashboard lane off preview-era assumptions cleanly.

---

## What we know now that we did not know last night

### 1. The Gateway websocket contract is healthy
Direct websocket probes to `ws://127.0.0.1:18789` consistently returned `connect.challenge` immediately.

Durable conclusion:
- the upstream Gateway websocket contract is not the blocker
- the problem was always in the Mission Control bridge path, not the Gateway itself

### 2. The preview-visible path is not dead
After the proxy fix plus temporary debug logging, a full preview-path probe to:
- `ws://127.0.0.1:3005/api/runtime-bridge/ws?bridgeToken=...`

was able to show:
- socket open
- `connect.challenge`
- successful `mc-server-connect`

Durable conclusion:
- the earlier diagnosis that preview “never reaches challenge/connect” is no longer current
- preview transport is now proven alive enough to complete the guarded handshake path

### 3. Gateway UI is not the real blocker
The earlier hypothesis that Gateway UI and Mission Control might be “fighting over one lane” did not hold up.

What the evidence now supports instead:
- connecting to the busy main session can flood the probe with existing event traffic
- that can make a proof run noisy or misleading
- but it does not prove the lane is exclusively owned by Gateway UI

Durable conclusion:
- the remaining seam is local to Mission Control bridge behavior and method semantics
- it is not primarily a shared-lane ownership issue

### 4. The old preview proxy tunnel really was a bug
The old runtime WS path in `preview-origin-proxy.js` manually replayed the upgrade request over a raw TCP socket and then piped bytes.

That is no longer speculative technical debt. It was a real bug and a valid thing to replace.

Durable conclusion:
- `3f8f904` is a legitimate fix worth keeping unless it later proves harmful

### 5. The cleaner rebuild seam is smaller than feared
A focused verification pass showed that the hook already moved these actions off websocket RPC:
- `sessions.patch`
- `chat.send`
- `chat.abort`

So the hook does **not** need a giant rewrite to reach the desired architecture.

Durable conclusion:
- the new same-origin server-owned action layer is already the real seam
- only the remaining capability/proof issues need cleanup

---

## What landed today

## A. Preview websocket proxy transport fix
### File
- `projects/mission-control/scripts/preview-origin-proxy.js`

### Change
Replaced raw upgraded-socket byte tunneling with a real websocket-to-websocket bridge using `ws`.

### Why
The raw tunnel path was brittle and made debugging the preview-visible runtime bridge much harder.

### Commit
- `3f8f904` `mission-control: proxy runtime bridge via websocket client`

### Current recommendation
Keep this fix.

Rollback only if future proof shows it causes a real regression:
- revert `3f8f904`

---

## B. Temporary debug logging for bridge tracing
### Files
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

### Purpose
Added explicit logging around:
- upgrade acceptance
- first browser -> sidecar frame
- first sidecar -> browser frame
- first gateway -> client frame
- `mc-server-connect` send
- close/error ordering

### Durable value
These logs were what finally disproved the stale “preview path is dead before challenge” read.

### Current status
Still local workspace state, useful for current tracing, not yet a deliberately preserved permanent observability design.

---

## C. Same-origin server-owned action layer
### New route files
- `projects/mission-control/app/api/runtime-bridge/session/route.ts`
- `projects/mission-control/app/api/runtime-bridge/send/route.ts`
- `projects/mission-control/app/api/runtime-bridge/stop/route.ts`

### What they do
- `session` route calls:
  - `openclaw gateway call sessions.patch --json --params ...`
- `send` route calls:
  - `openclaw gateway call chat.send --json --params ...`
- `stop` route calls:
  - `openclaw gateway call chat.abort --json --params ...`

### Why this matters
This is the architectural pivot away from preview-era “generic outbound RPC over the browser websocket for everything”.

It makes Mission Control more live-shaped:
- websocket for connect and inbound events
- same-origin HTTP for bounded server-owned actions

---

## D. Hook refactor already landed farther than expected
### File
- `projects/mission-control/hooks/useRuntimeBridge.ts`

### What is now true
The hook already uses HTTP routes for:
- session bootstrap in `ensureSessionExists()`
- send in `sendPrompt()`
- abort in `abortPrompt()`

### What remains websocket-originated
At this point websocket is mainly still responsible for:
- opening the transport
- connect handshake behavior
- inbound runtime events
- legacy generic `rpc()` helper that now appears unused for session/send/abort

### Important consequence
The action-layer refactor is already functionally real.

This is not just a plan anymore.

---

## E. Descriptor contract expanded
### Files
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`

### New endpoint contract surfaced in descriptor
- `sessionPatch`
- `send`
- `stop`

### Verified runtime state after rebuild/restart
`/api/orchestrator` returned:
- status `200`
- mode `polling-ws-sidecar`
- endpoints included:
  - `/api/runtime-bridge`
  - `/api/runtime-bridge/history`
  - `/api/runtime-bridge/session`
  - `/api/runtime-bridge/send`
  - `/api/runtime-bridge/stop`
  - `/api/runtime-bridge/ws`

This confirms the browser-visible descriptor now knows about the new action layer.

---

## What was verified after the pivot

### Build state
`next build` completed successfully after the new routes and hook changes.

Known non-blocking warnings remained:
- Next.js `middleware` deprecation warning
- dynamic module resolution warning around `run-autonomous-task.mjs`
- NFT tracing warning from `next.config.js` / `lib/adapters/files.ts`

These warnings are not new to this bridge slice.

### Preview runtime state
Preview restart remained healthy.
Root returned the expected `307` redirect to `/general/home`.

### Descriptor state
The descriptor now exposes the action routes and advertises them honestly:
- `composerSend: true`
- `stop: true`

The stop route exists, the hook is wired to it, and the descriptor now matches that runtime truth.

---

## The contract mismatch that was fixed

### Previous mismatch
In `projects/mission-control/lib/adapters/orchestrator.ts`, preview descriptor had been setting:
- `capabilities.composerSend: sidecar.configured && gatewaySessionAuthConfigured`
- `capabilities.stop: false`

Even though:
- `/api/runtime-bridge/stop` existed
- `app/api/runtime-bridge/stop/route.ts` was implemented
- `hooks/useRuntimeBridge.ts` already called that route from `abortPrompt()`

### Fix applied
Preview descriptor now sets:
- `stop: sidecar.configured && gatewaySessionAuthConfigured`

That matches the same readiness gate used for send.

### Verified outcome
After rebuild/restart, runtime descriptor reported:
- `composerSend: true`
- `stop: true`

So abort is now both implemented and truthfully advertised in UI capability logic.

---

## Current relevant repo state

### Committed Mission Control transport fix
- `3f8f904` `mission-control: proxy runtime bridge via websocket client`

### Current Mission Control-local workspace changes relevant to this slice
Modified:
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

Untracked/new:
- `projects/mission-control/app/api/runtime-bridge/session/route.ts`
- `projects/mission-control/app/api/runtime-bridge/send/route.ts`
- `projects/mission-control/app/api/runtime-bridge/stop/route.ts`

There are many unrelated dirty files elsewhere in the workspace. Do **not** confuse those with the Mission Control bridge slice.

### Durable handoff note
The HTTP action-layer work is currently preserved in local workspace state and build-verified, but not yet isolated into a clean checkpoint commit.

---

## Current phase read

## R1
Still done and verified.

Safe claim:
- preview gets `v2`
- dashboard/live gets secret-free `v3`
- lane split works

## R2
Still effectively done.

Safe claim:
- gateway-backed history/bootstrap is preferred
- JSONL is fallback only
- client hydration/retry handling is improved

## R3
**Complete for the bounded server-owned bridge slice.**

What is now done within R3:
- explicit guarded server-owned connect proof path exists in preview env
- direct Gateway challenge is healthy
- preview-visible handshake path can now surface `connect.challenge`
- preview-visible handshake path can now return successful `mc-server-connect`
- action layer for session/send/stop has been moved to same-origin HTTP
- hook is already using that HTTP action layer
- `POST /api/runtime-bridge/session` has been proved successfully against a throwaway session key
- `POST /api/runtime-bridge/send` has been proved successfully and returns a real `runId` with `status: 'started'`
- `/api/runtime-bridge/history` has been proved successfully and returned the assistant reply body exactly as expected (`HTTP bridge proof acknowledged.`) from gateway-backed history
- `POST /api/runtime-bridge/stop` has been proved successfully and returned `{"ok":true,"aborted":true,...}` against a live run

What this means:
- the bounded R3 proof target is no longer hypothetical
- the bridge path now works for handshake, bootstrap, send, history reconciliation, and abort
- the next real work is R4 rather than more basic R3 validation

What is still outside R3:
- fix the descriptor `stop` capability mismatch
- prove one clean post-connect action path end-to-end using the new action layer
- decide whether the current temporary bridge logging stays, is reduced, or is replaced by cleaner observability
- confirm whether any remaining post-connect seam is real runtime behavior or just proof-harness noise

### Safe R3 summary
R3 is **no longer just dormant groundwork**.
It now has real verified pieces.
But it is still not honest to call it done.

## R4
Not done.

Current read:
- dashboard/live still uses the secret-free `v3` descriptor
- live lane still advertises read-only style behavior (`composerSend: false`, `stop: false`, `eventStream: false`)
- live lane now also exposes the new action endpoints in the descriptor, but still keeps those capabilities disabled

Meaning:
- the codebase is now edging toward the shape R4 wants
- but dashboard/live is **not yet** using a truly finished server-owned live runtime path
- preview machinery is still part of the working transport story

## R5
Not done.

Still to come:
- real durable production deployment shape for dashboard/live
- correct lab wiring
- trusted-edge/private gateway reachability hardening
- allowed origins / rollback / health / observability hardening
- persistent preview/runtime startup posture if preview stays as rollback lane

---

## What should happen next

### Immediate next move
1. fix preview `capabilities.stop`
2. rebuild/restart and verify descriptor now matches reality
3. run one bounded end-to-end proof using the new HTTP action layer over the current bridge state:
   - bootstrap a known session
   - confirm send ack path cleanly
   - confirm stop works when a run is active
   - confirm history/final-event reconciliation still behaves correctly

### Architectural next move after that
Once the capability mismatch is fixed and one action proof is clean, decide whether to:
- keep browser-side connect only for preview experiments
- or move connect fully server-side as the final R3 cleanup, leaving browser websocket behavior as passive event consumption only

### Strategic direction
Do **not** spend more time polishing preview-era WS RPC behavior.
The correct direction is the one already started today:
- keep the live-shaped server-owned action layer
- let preview be a proof lane, not a design center
- use that to push cleanly into R4

---

## Safe statements for a future agent
A future agent can safely say:
- R1 is done and still verified
- R2 is effectively done
- R3 is materially further along than last night
- the preview-visible path can now complete guarded `connect.challenge -> mc-server-connect`
- the proxy bug fixed in `3f8f904` is real and should not be dismissed as churn
- the hook already uses same-origin HTTP for session/send/abort
- a descriptor capability mismatch currently blocks abort in the UI even though the stop route exists

A future agent should **not** say without new proof:
- R3 is complete
- dashboard/live already has the final live runtime path
- preview is no longer part of the bridge story
- all remaining issues are solved by the HTTP action-layer pivot alone

---

## Key files for the next agent
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/app/api/runtime-bridge/session/route.ts`
- `projects/mission-control/app/api/runtime-bridge/send/route.ts`
- `projects/mission-control/app/api/runtime-bridge/stop/route.ts`
- `projects/_ops/mission-control-savepoint-after-r2-verification-2026-04-23.md`
- `projects/_ops/mission-control-savepoint-r3-preview-ws-debug-2026-04-23.md`
- this file: `projects/_ops/mission-control-savepoint-r3-http-bridge-pivot-2026-04-23.md`

---

## Bottom line
The bridge work crossed an important line today.

This is no longer just “debug the old preview websocket and hope”.

Mission Control now has:
- a proved preview-visible guarded handshake path
- a kept proxy transport fix
- a real server-owned same-origin action layer
- a hook that already uses that action layer
- one clear contract bug left in the descriptor

That is the right base to finish R3 honestly and then move into R4 without dragging preview-era assumptions into the live dashboard architecture.
