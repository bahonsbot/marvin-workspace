# Mission Control Savepoint After R2 Verification — 2026-04-23

## Purpose
This savepoint captures the exact state after the late-night verification pass that followed the R1 and R2 Mission Control chat/runtime work.

It is meant to let a future agent continue safely without re-auditing which parts are actually finished, which parts merely compile, and which transport ideas are present in code but intentionally not enabled by default.

---

## Executive summary
Mission Control is in a meaningfully better state than it was before the evening migration work, but the story is split cleanly into three parts:

1. **R1 is real and active**
   - host/lane-aware runtime-bridge exposure is working
   - dashboard/live hosts receive a secret-free descriptor
   - preview hosts still receive the legacy token-bearing preview descriptor

2. **R2 is effectively landed**
   - transcript/bootstrap now prefers gateway-backed history
   - local JSONL is fallback only
   - client/runtime/UI track history source and retry state better
   - stale history metadata is handled more safely on failure or session switch

3. **R3 groundwork exists, but the first transport slice is intentionally NOT active by default**
   - client and sidecar code now contain server-owned-connect groundwork
   - however, verification showed it would have been too broad to leave enabled implicitly
   - preview `serverConnectConfigured` is now gated behind explicit opt-in env `MISSION_CONTROL_SERVER_CONNECT=1`
   - current preview behavior remains the older browser-owned connect path unless someone deliberately enables the new mode and proves it end-to-end

The most important durable truth after this savepoint is:

> **Do not describe server-owned connect as “done” yet.**
> The code groundwork is present, but the default running system is still preview/browser-owned connect. The late-night verification pass intentionally tightened the guardrail so the new transport slice cannot turn on accidentally.

---

## What was verified in this pass

### 1. Validation remained green after the latest runtime/client/orchestrator changes
Executed locally in `projects/mission-control`:
- `npm run lint` ✅
- `npm run build` ✅
- `node --check scripts/preview-origin-proxy.js && node --check scripts/runtime-bridge-ws-sidecar.js` ✅

Only pre-existing/non-blocking warnings remained during build:
- Next.js `middleware` convention deprecation warning
- dynamic module resolution warning around `run-autonomous-task.mjs` in `app/api/tasks/autonomous/[taskId]/execute/route.ts`
- NFT tracing warning around `next.config.js` / `lib/adapters/files.ts`

These warnings are not new to the runtime-bridge work.

---

### 2. Lane behavior was checked against the running preview stack, not just source code
After rebuilding/restarting preview, the runtime descriptor was checked via host-specific requests.

#### Preview lane check
Request shape:
- `Host: preview.motiondisplay.cloud`
- target: `http://127.0.0.1:3005/api/runtime-bridge`

Observed descriptor truth:
- `descriptorVersion: 'v2'`
- `browserTokenRelay: true`
- `serverConnectConfigured: false`
- `composerSend: true`
- `websocketBridgeToken` still present
- `gatewaySessionToken` still present

#### Live/dashboard lane check
Request shape:
- `Host: dashboard.motiondisplay.cloud`
- target: `http://127.0.0.1:3005/api/runtime-bridge`

Observed descriptor truth:
- `descriptorVersion: 'v3'`
- `browserTokenRelay: false`
- `serverConnectConfigured: false`
- no browser websocket URL/token fields beyond the secret-free live shape
- no `websocketBridgeToken`
- no `gatewaySessionToken`

This is the real current runtime truth, not just intended design.

---

### 3. Preview restart/health remained good
Ran the standard restart path:
- `projects/mission-control/scripts/preview-restart.sh`

Observed outcomes:
- preview rebuilt successfully
- preview proxy came back
- HTTP health remained good
- the redirect/root path on `:3005` behaved normally after restart
- sidecar health still reported target `ws://127.0.0.1:18789`

So the project is not in a broken-preview state after the latest edits.

---

## Important correction made during verification
A subtle but important bug surfaced during real verification.

### What briefly happened
In `projects/mission-control/lib/adapters/orchestrator.ts`, preview `serverConnectConfigured` had become true whenever all of the following were true:
- sidecar configured
- `MISSION_CONTROL_GATEWAY_AUTH_TOKEN` present

That was too broad.

Why this was a problem:
- the descriptor could claim server-owned connect was active simply because the preview environment already had the existing gateway token
- that would make the first R3 transport slice half-enabled by accident
- the browser/client would start behaving as if the server-owned path existed, even though it had not yet been proven end-to-end in the running stack

### What was changed
Preview `serverConnectConfigured` is now gated behind an explicit environment opt-in:
- `MISSION_CONTROL_SERVER_CONNECT === "1"`

So the real condition is now:
- sidecar configured
- gateway session auth configured
- **and** `MISSION_CONTROL_SERVER_CONNECT=1`

### Durable conclusion
The first R3 transport slice is now **explicitly opt-in**, not implicitly on.

This is the correct safety posture for now.

---

## Current state of R1
R1 remains complete and active.

### Durable R1 truths
- `projects/mission-control/lib/runtime-bridge-lane.ts` resolves preview vs live lanes from host
- unknown non-local hosts still default to the safer `live` lane
- `projects/mission-control/lib/adapters/orchestrator.ts` uses lane-aware cache/promise storage
- live/dashboard hosts receive the secret-free `v3` runtime descriptor
- preview/local hosts keep the rollback-compatible `v2` descriptor
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/app/api/runtime-bridge/route.ts`
- `projects/mission-control/app/api/orchestrator/route.ts`
  all respect lane/host when constructing browser-visible runtime state

### Active runtime truth
- dashboard/live browsers do **not** receive `websocketBridgeToken`
- dashboard/live browsers do **not** receive `gatewaySessionToken`
- preview still does, by design, until a later preview transport migration replaces that path

---

## Current state of R2
R2 is now safe to treat as effectively landed.

### Server-side history/bootstrap truth
`projects/mission-control/lib/runtime-bridge-history.ts` now:
- prefers gateway-backed history first via `loadRuntimeBridgeSessionHistoryFromGateway(...)`
- only falls back to local JSONL reconstruction when gateway history is unavailable
- returns explicit `source: 'gateway' | 'jsonl' | 'unavailable'`

`projects/mission-control/lib/runtime-bridge-gateway.ts` now:
- loads history via `openclaw gateway call chat.history --json --params ...`
- uses bounded retry/backoff for retryable gateway-startup-style failures
- reconstructs Mission Control transcript history from gateway messages

`projects/mission-control/app/api/runtime-bridge/history/route.ts` now:
- returns the resolved history object
- includes header `X-Mission-Control-History-Source`

### Client/runtime/UI truth
`projects/mission-control/hooks/useRuntimeBridge.ts` now:
- tracks history state with `source`, `note`, `retryable`, `thinkingLevel`, `sessionId`
- surfaces retrying unavailable payloads instead of silently waiting
- retries transient transcript-bootstrap failures with bounded delays
- clears stale metadata on terminal hydration failure
- resets transcript-history placeholder when switching sessions

`projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx` now:
- dedupes transcript hydration using both entry identity and history metadata

`projects/mission-control/components/chat/MissionControlChatSurface.tsx` now:
- uses better fallback target labeling
- exposes transcript history source/status details
- no longer leans on the earlier misleading “No target session” fallback as aggressively

### Durable R2 conclusion
Transcript/bootstrap truth is substantially improved and no longer depends primarily on local disk JSONL.

The remaining unfinished runtime problem is transport/auth/session establishment, not history bootstrap.

---

## Current state of R3 groundwork
R3 is **not** done, but groundwork now exists.

### What exists in code
`projects/mission-control/hooks/useRuntimeBridge.ts` contains:
- client-side support for `serverConnectConfigured`
- a stable synthetic request id constant: `mc-server-connect`
- server-owned-connect challenge handling logic
- improved history-state behavior around temporary unavailability

`projects/mission-control/scripts/runtime-bridge-ws-sidecar.js` contains:
- groundwork to detect `connect.challenge`
- a `maybeSendServerConnect(...)` path that can send a server-owned `connect` request upstream using `MISSION_CONTROL_GATEWAY_AUTH_TOKEN`
- the same stable request id `mc-server-connect`

### What was learned from verification
Real probing showed that this path is **not yet proven end-to-end** in the active preview stack.

Important observations:
- direct websocket to `ws://127.0.0.1:18789` produces `connect.challenge` as expected
- local sidecar/proxy probing still showed early close behavior in current preview mode
- that was enough evidence to avoid advertising the new transport path as active-by-default

### Durable R3 conclusion
Treat current R3 code as **groundwork + guarded experiments**, not as completed transport migration.

---

## Important files for the next agent

### Core active files
- `projects/mission-control/lib/runtime-bridge-lane.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/app/api/runtime-bridge/route.ts`
- `projects/mission-control/app/api/orchestrator/route.ts`
- `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`
- `projects/mission-control/lib/runtime-bridge-gateway.ts`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/lib/chat/runtime-bridge-transcript.ts`
- `projects/mission-control/lib/chat/thread-model.ts`
- `projects/mission-control/scripts/preview-start.sh`
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

### Important docs
- `projects/_ops/mission-control-savepoint-for-tomorrow-2026-04-22.md`
- `projects/_ops/mission-control-chat-runtime-migration-spec-2026-04-22.md`
- `projects/_ops/mission-control-savepoint-before-r2-2026-04-22-night.md`
- this file: `projects/_ops/mission-control-savepoint-after-r2-verification-2026-04-23.md`

---

## What is safe to say now
A future agent can safely say all of the following:
- R1 lane-aware secret-free live descriptor work is active and verified
- R2 gateway-first history/bootstrap work is active and validated by lint/build
- preview still uses the legacy token-bearing preview runtime contract
- live/dashboard remains read-only/history-oriented rather than a fully migrated live transport path
- the first R3 transport slice is explicitly off by default unless `MISSION_CONTROL_SERVER_CONNECT=1` is deliberately introduced

A future agent should **not** say any of the following unless they do new proof work:
- server-owned connect is complete
- preview now uses server-owned connect by default
- the sidecar transport migration is fully working end-to-end
- browser-visible preview secrets are gone

---

## Recommended next steps
There are two reasonable paths from here.

### Path A: Continue R3 carefully
Do this only if the goal is explicitly transport migration.

Recommended order:
1. enable `MISSION_CONTROL_SERVER_CONNECT=1` only in a controlled test env
2. prove the full path with actual websocket evidence:
   - preview descriptor shows `serverConnectConfigured: true`
   - browser/client receives challenge
   - sidecar sends server-owned `connect`
   - client receives/handles `mc-server-connect` response
   - session becomes connected cleanly
   - send path works without duplicate browser-side connect behavior
3. only after proof, decide whether preview should actually adopt that mode by default

### Path B: Stop here and preserve the cleaner boundary
This is also valid.

Current repo state is coherent enough to pause because:
- R1 and R2 already created real user-facing improvement
- preview is not accidentally pretending to use unfinished transport logic
- the next transport move can happen later with less risk

If pausing, keep the rule simple:
- treat R3 transport code as dormant groundwork until explicit opt-in + proof

---

## Bottom line
After this verification pass, Mission Control is in a safer and more truthful state.

- live/dashboard is secret-free at the runtime descriptor level
- transcript history/bootstrap is materially improved and gateway-first
- preview still works on its legacy runtime model
- the new server-owned connect idea exists, but it is intentionally not being oversold or silently activated

That is the correct place to hand off from.
