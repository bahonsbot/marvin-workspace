# Mission Control savepoint — R5 live WS seam — 2026-04-24

## Purpose
This savepoint is the overnight handoff after the late Apr 23 / early Apr 24 Mission Control session.

Its job is to preserve what was actually learned tonight, separate repo truth from planned-but-unlanded work, and make tomorrow’s continuation efficient instead of forcing another long rediscovery pass.

This file should be treated as the best resume point for the current Mission Control runtime/chat migration lane.

---

## Executive summary
Tonight did **not** finish the planned R5 live websocket cutover.

What it **did** accomplish was narrowing the exact seam with much better precision than before.

At session close, the durable truth is:
- the bounded R3 bridge proof is still complete
- the R4 HTTP live/dashboard baseline is still the real working fallback
- the next real step is still R5
- the current live/dashboard lane is **not** yet running a secret-free same-origin websocket path
- the preview websocket proxy path still assumes a tokenized `bridgeToken` upgrade model
- the client hook still has **no** `sessions.subscribe` / resubscribe flow, so even a successful connect would still leave the live lane short of Gateway-style permanence

In other words:

> tomorrow should not start by vaguely “trying live again.”
> it should start by landing a small, explicit, same-origin live websocket path plus subscribe/resubscribe wiring, while keeping the R4 HTTP bridge as fallback truth.

---

## Current phase truth at session close
- **R1:** done
- **R2:** effectively done
- **R3:** complete for the bounded server-owned bridge slice
- **R4:** HTTP live/dashboard baseline established already
- **R5:** next, and **not landed yet**
- **Later phase after R5:** deployment hardening, ingress/public-path cleanup, observability cleanup, and production-grade live parity polish

Most important truth:
- do **not** treat tonight as “R5 done”
- do **not** treat the live lane as websocket-capable yet
- do **not** assume the dashboard/browser can already connect to a secret-free live WS path

---

## What this session established that was not previously clear

### 1. The current live descriptor is still HTTP-only in practice
Current repo inspection of `projects/mission-control/lib/adapters/orchestrator.ts` shows `deriveLiveRuntimeBridge(...)` still returns a live lane shaped like this:
- `descriptorVersion: 'v3'`
- `transport.kind: 'http-poll'`
- `transport.wsProxySupported: false`
- `transport.websocket.configured: false`
- `transport.websocket.browserUrl: null`
- `auth.browserTokenRelay: false`
- `auth.serverConnectConfigured: false`
- `capabilities.composerSend: true`
- `capabilities.stop: true`
- `capabilities.eventStream: false`
- `endpoints.websocket: null`

That means the live lane is still the R4 HTTP bridge, not a websocket-capable live lane.

Durable consequence:
- live/dashboard currently supports same-origin HTTP bootstrap/send/stop/history
- live/dashboard does **not** yet expose a browser-usable live websocket path
- the planned R5 work is still ahead of us

### 2. The sidecar descriptor still only models one browser-facing WS URL plus token
Current repo inspection of `projects/mission-control/lib/runtime-bridge-sidecar.ts` shows:
- `RuntimeBridgeSidecarDescriptor` contains:
  - `configured`
  - `localUrl`
  - `localHealthUrl`
  - `browserUrl`
  - `browserReachability`
  - `token`
- `getRuntimeBridgeSidecarDescriptor(...)` requires `MISSION_CONTROL_WS_SIDECAR_TOKEN`
- if no token exists, sidecar is treated as unconfigured
- `browserUrl` resolves from:
  - `MISSION_CONTROL_WS_SIDECAR_PUBLIC_URL`, or else
  - `MISSION_CONTROL_WS_PUBLIC_PATH`, default `/api/runtime-bridge/ws`

What is **not** there yet:
- no separate `liveBrowserUrl`
- no separate live public path concept
- no dual-path preview/live descriptor model

Durable consequence:
- if we want a dedicated live same-origin websocket route tomorrow, we need to extend either:
  - the sidecar descriptor shape, or
  - the env/path handling around it
- we should not pretend that distinction already exists in code

### 3. The preview proxy still hard-requires `bridgeToken`
Current repo inspection of `projects/mission-control/scripts/preview-origin-proxy.js` shows:
- one `publicWsPath`, default `/api/runtime-bridge/ws`
- `isSameOriginUpgrade(...)` is path-bound to that single `publicWsPath`
- upgrade handling computes:
  - `tokenMatches`
  - `localRequest`
  - `basicAuthValid`
  - `sameOrigin`
- but **first** it requires `tokenMatches`
- only after that does it enforce `local/basicAuth/sameOrigin`

So today’s effective policy is:
- no valid `bridgeToken` → `401 Unauthorized`
- valid `bridgeToken` but not local/basicAuth/same-origin → `403 Forbidden`

Durable consequence:
- the current proxy does **not** allow a secret-free same-origin live websocket branch
- simply exposing a live websocket URL in the descriptor tomorrow will not be enough
- the proxy contract must change if live websocket is going to work without browser token relay

### 4. The sidecar already knows how to do server-owned connect
Current repo inspection of `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js` shows:
- sidecar still requires `bridgeToken` on its own upgrade path
- sidecar reads `MISSION_CONTROL_GATEWAY_AUTH_TOKEN`
- on first upstream `connect.challenge`, it can auto-send:
  - request id `mc-server-connect`
  - method `connect`
  - operator scopes
  - auth token from server env

This is important because it narrows the missing seam.

Durable consequence:
- server-owned connect semantics are already implemented at the sidecar layer
- the missing R5 pieces are now more about:
  - safe browser path exposure
  - subscribe/resubscribe wiring
  - live event handling/gap recovery
than about inventing connect behavior from scratch

### 5. The client hook still has no subscription model
Targeted inspection/search inside `projects/mission-control/hooks/useRuntimeBridge.ts` showed:
- no `subscribe`
- no `sessions.changed`
- no `session.message`
- no existing explicit websocket subscribe helper

Current connect success behavior is still:
- set session state to connected
- call `load(true)`
- call `hydrateHistory(..., { force: true })`

What it does **not** do:
- send `sessions.subscribe`
- resubscribe on session switch
- react to session freshness/session message events through a deliberate Gateway-native subscription model

Durable consequence:
- even if a secret-free live websocket path were exposed tomorrow morning, the current client would still risk a “connected but mostly deaf” state
- subscription wiring is a real required part of R5, not optional cleanup

### 6. The current hook already contains much more HTTP fallback machinery than we first feared
Current repo inspection also confirmed that `useRuntimeBridge.ts` already contains substantial R4 fallback mechanics, including:
- explicit history status state:
  - `source`
  - `note`
  - `retryable`
  - `thinkingLevel`
  - `sessionId`
- connection timing state:
  - connect start
  - socket open
  - challenge receipt
  - connect ack
  - last close info
- `runtimeBridgeHttpActionMode`
- `isInteractiveSessionReady`
- `hydrateHistoryAndReturn(...)`
- bounded retry on history bootstrap
- `pollForHttpRunCompletion(...)`
- terminal run inference from hydrated transcript history
- HTTP send/abort behavior already wired through same-origin endpoints

Durable consequence:
- R5 does **not** need to replace the HTTP bridge
- the right move is to keep the HTTP bridge as fallback truth while adding the missing permanent live WS pieces

### 7. Descriptor lane resolution already exists in the route layer
Current repo inspection of `projects/mission-control/app/api/runtime-bridge/route.ts` and `projects/mission-control/lib/runtime-bridge-lane.ts` confirmed:
- descriptor route now reads lane from request headers
- lane resolution uses host / x-forwarded-host
- preview hostnames currently recognized are:
  - `preview.motiondisplay.cloud`
  - `localhost`
  - `127.0.0.1`
  - `::1`
- everything else is treated as live

Durable consequence:
- lane-specific descriptor behavior already exists as infrastructure
- tomorrow’s live WS work should build on that rather than inventing a new lane split

### 8. History route is still simpler than the descriptor route
Current repo inspection of `projects/mission-control/app/api/runtime-bridge/history/route.ts` confirmed:
- it loads history by `sessionKey`
- it now exposes `X-Mission-Control-History-Source`
- it does **not** currently do lane resolution

Durable consequence:
- the history path is already good enough for the R4 fallback and R5 recovery loops
- but it is not a lane-aware control surface in the same way the descriptor route is

### 9. Preview startup behavior is slightly more helpful than remembered
Current repo inspection of `projects/mission-control/scripts/preview-start.sh` confirmed:
- it sources `.preview-runtime/mission-control-preview.env`
- it does so with `set -a`, which means env values are exported cleanly
- after health checks, it warms the runtime bridge by:
  - fetching `/api/runtime-bridge`
  - extracting `runtimeBridge.endpoints.websocketBridgeToken`
  - opening the preview WS path once with that token

Durable consequence:
- custom preview env values are already more export-friendly than we feared
- but preview warmup is still explicitly built around the tokenized preview path, not a future secret-free live path

### 10. The repo is currently noisy enough to make careless patching risky
Current `git status --short` in `projects/mission-control` showed many unrelated modified/untracked files across app, components, data, hooks, lib, scripts, docs, and shell surfaces.

Mission Control runtime-bridge-relevant dirty/untracked paths currently include:
- `app/api/runtime-bridge/history/route.ts`
- `app/api/runtime-bridge/route.ts`
- `hooks/useRuntimeBridge.ts`
- `components/chat/MissionControlChatSurface.tsx`
- `lib/adapters/orchestrator.ts`
- `scripts/preview-origin-proxy.js`
- `scripts/preview-start.sh`
- `scripts/runtime-bridge-ws-sidecar.js`
- `lib/runtime-bridge-lane.ts` (untracked)
- `app/api/runtime-bridge/send/` (untracked)
- `app/api/runtime-bridge/session/` (untracked)
- `app/api/runtime-bridge/stop/` (untracked)
- `mission-control-preview.log` (untracked)

There are also many unrelated dirty files outside the immediate bridge slice.

Durable consequence:
- tomorrow should start with careful isolation of the Mission Control runtime-bridge slice
- do not casually commit from the repo root without re-auditing the working tree

---

## What was already true before tonight, but still matters tomorrow
These are not tonight’s discoveries, but they remain essential context and should stay in the active frame:

### R3 proof remains complete for the bounded slice
Still retained from earlier validated work:
- preview-visible guarded connect proof exists
- server-owned `session` / `send` / `stop` HTTP bridge proof exists
- `chat.history` proof exists for the bounded slice
- preview raw TCP tunnel bug was already fixed in `3f8f904`

### R4 HTTP live baseline remains the working fallback
Still retained from earlier work:
- live/dashboard already supports useful same-origin HTTP interaction
- send/stop/history fallback is real
- live is no longer artificially read-only
- this HTTP baseline should be preserved as the fallback path while R5 is built

### Gateway parity target is still the right target
Still retained from earlier comparison work:
- Gateway UI uses a persistent websocket RPC/event lane
- bootstrap/recovery still relies on `chat.history`
- durable liveliness comes from connect + subscribe + pushed chat/session events

---

## File-by-file resume truth

### `projects/mission-control/lib/adapters/orchestrator.ts`
Current important truth:
- preview lane is websocket-aware and tokenized
- live lane is still secret-free but HTTP-only
- lane-aware summary caching exists
- descriptor route already supports preview/live split by host

Tomorrow’s likely change:
- expose a live websocket descriptor path in the live lane without leaking `bridgeToken` or gateway auth token
- revisit `transport.kind`, `wsProxySupported`, and `auth.serverConnectConfigured`
- keep the R4 HTTP capabilities intact as fallback

### `projects/mission-control/lib/runtime-bridge-sidecar.ts`
Current important truth:
- sidecar descriptor only models one browser URL plus token
- token absence means “not configured”
- no live/preview public-path split exists yet

Tomorrow’s likely change:
- extend this descriptor or its env interpretation so preview and live websocket paths can be represented cleanly

### `projects/mission-control/scripts/preview-origin-proxy.js`
Current important truth:
- one public WS path
- token mandatory before any trust/origin logic
- same-origin helper assumes that one path

Tomorrow’s likely change:
- either add a second live public path or deliberately branch behavior by trusted request conditions
- preserve preview token behavior
- do not silently weaken preview auth guarantees

### `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
Current important truth:
- server-owned connect is already auto-triggered on `connect.challenge`
- first-frame logging is still present
- sidecar upgrade itself remains token-protected

Tomorrow’s likely change:
- probably minimal, unless live-path exposure needs sidecar-aware path/query behavior changes

### `projects/mission-control/hooks/useRuntimeBridge.ts`
Current important truth:
- strong R4 HTTP fallback exists
- no subscribe/resubscribe model exists
- connect success currently only resyncs via summary + history load

Tomorrow’s likely change:
- add a small websocket request helper
- send `sessions.subscribe` after connect success
- resubscribe on session switch
- probably add bounded refresh after subscribe ack or timeout
- possibly react to `session.message` / `sessions.changed` with targeted hydrate/load without creating loops

### `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
Current important truth:
- HTTP-interactive fallback is already partially represented
- status/composer are less rigidly websocket-locked than before
- some chrome/copy is still transport-flavored

Tomorrow’s likely change:
- maybe only small cleanup if R5 websocket support changes status wording again
- this is secondary to the runtime bridge patch itself

### `projects/mission-control/app/api/runtime-bridge/route.ts`
Current important truth:
- lane-aware descriptor serving already exists

Tomorrow’s likely change:
- maybe none, unless live websocket descriptor fields change

### `projects/mission-control/app/api/runtime-bridge/history/route.ts`
Current important truth:
- returns source header
- currently simple and useful for recovery/fallback

Tomorrow’s likely change:
- maybe none for the first R5 pass

### `projects/mission-control/lib/runtime-bridge-lane.ts`
Current important truth:
- lane detection is already host-aware
- preview host detection is explicit and simple

Tomorrow’s likely change:
- maybe none, unless new live path/public host rules demand it

### `projects/mission-control/scripts/preview-start.sh`
Current important truth:
- preview env export path is okay
- warmup is preview-token-path specific

Tomorrow’s likely change:
- likely avoid touching it unless a dedicated live public path truly requires explicit env export or warm behavior changes

---

## What did NOT happen tonight
This matters because tomorrow should not assume completed work that never landed.

Tonight did **not** produce:
- a committed secret-free live websocket descriptor
- a committed live same-origin proxy branch/path
- a committed `sessions.subscribe` / resubscribe client flow
- a clean local validation pass for an R5 live WS slice
- a remote browser proof on `dashboard.motiondisplay.cloud`
- a remote browser proof on `lab.motiondisplay.cloud`
- a clean Mission Control code checkpoint commit for the R5 live WS slice

This session was primarily:
- deep repo inspection
- narrowing of the exact seam
- identification of the smallest honest next patch
- separating current repo truth from assumptions and stale mental models

---

## Recommended next session sequence

### Step 1. Isolate the Mission Control bridge slice before editing
Start with:
- fresh `git status`
- identify which dirty files are part of the runtime-bridge lane vs unrelated work
- avoid accidental multi-topic commits

### Step 2. Land the smallest honest R5 patch
Recommended shape:
1. **Descriptor layer**
   - expose a secret-free live websocket endpoint/path in the live lane
   - do not expose `websocketBridgeToken`
   - do not expose `gatewaySessionToken`
   - keep HTTP send/stop/history capabilities intact
2. **Proxy layer**
   - preserve preview tokenized websocket behavior
   - add a trusted same-origin live websocket branch or dedicated live public path
   - do not silently weaken preview security just to make live work
3. **Client layer**
   - add websocket request helper
   - subscribe after connect success
   - resubscribe on session switch
   - force a bounded refresh/hydrate after subscribe ack or timeout
4. **Recovery behavior**
   - keep HTTP history fallback alive
   - use it for gap recovery rather than pretending websocket parity is already perfect

### Step 3. Validate locally before touching remote environments
Recommended local validation order:
- `npm run lint`
- `npm run build`
- preview restart
- local websocket probe through the intended live path
- confirm:
  - connect challenge appears
  - `mc-server-connect` succeeds
  - subscribe succeeds
  - chat events arrive or recovery path fills gaps correctly

### Step 4. Only then do meaningful browser tests
After local proof, test:
- `dashboard.motiondisplay.cloud`
- `lab.motiondisplay.cloud`

Only interrupt Philippe for remote testing if:
- there is a concrete browser path worth trying
- the change is actually landed and locally validated

### Step 5. Then cut a clean checkpoint
After proof:
- write a new savepoint
- update daily memory
- commit only the intended R5 slice

---

## Recommended exact patch direction for tomorrow
This is guidance, not a claim that it already exists.

### Preferred approach
A dedicated live public websocket path is still the cleaner approach.

Why:
- preview currently relies on `bridgeToken`
- weakening the preview path itself is easy to get subtly wrong
- a dedicated live path makes it easier to keep:
  - preview = tokenized proof lane
  - live = secret-free same-origin operator lane

### Client priority
The first client-side live WS improvement should be:
- subscribe after connect success
- resubscribe on session switch

Without that, a websocket descriptor alone risks producing:
- “connected but silent”
- stale current-session behavior
- confusing cross-session bleed

### Security posture to keep
Tomorrow’s patch should preserve these truths:
- live descriptor remains secret-free
- browser does not get gateway auth token
- browser does not get sidecar bridge token in live lane
- preview tokenized path remains intact unless a deliberate decision is made otherwise

---

## Likely failure modes tomorrow
These are the concrete regressions to watch for.

### 1. Live WS still never opens
Cause:
- proxy still effectively requires `bridgeToken`
- descriptor exposes a path the proxy does not actually honor for live

### 2. Live WS opens but session never stabilizes
Cause:
- `mc-server-connect` never arrives back as a clean response
- live descriptor/path and sidecar expectations are mismatched

### 3. Live WS connects but transcript still feels stale
Cause:
- no `sessions.subscribe`
- no resubscribe on session switch
- no event-driven refresh for target-session updates

### 4. Preview security is accidentally weakened
Cause:
- a “quick fix” relaxes token behavior on the preview path itself instead of creating a clear live-safe branch/path

### 5. Dirty working tree causes a bad checkpoint
Cause:
- unrelated modified/untracked files get swept into the Mission Control commit

---

## Safe statements for the next agent
A future agent can safely say:
- R3 is complete for the bounded bridge slice
- R4 HTTP live/dashboard fallback exists and remains useful
- the current live descriptor is still HTTP-only, not websocket-capable
- preview proxy still hard-requires `bridgeToken`
- sidecar already implements server-owned `mc-server-connect`
- `useRuntimeBridge.ts` still lacks `sessions.subscribe` and resubscribe behavior
- app/api runtime-bridge descriptor serving is already lane-aware by host
- preview-start already exports env via `set -a` and warms the tokenized preview path
- tonight’s work mainly narrowed the R5 seam; it did not finish R5

A future agent should **not** say without new proof:
- live/dashboard already has secret-free websocket parity
- preview proxy already supports a tokenless live websocket branch
- subscription wiring already exists in the Mission Control hook
- tonight landed a clean R5 code checkpoint
- dashboard/lab remote browser proof was completed

---

## Best files to open first tomorrow
1. `projects/_ops/mission-control-savepoint-r5-live-ws-seam-2026-04-24.md` (this file)
2. `projects/_ops/mission-control-savepoint-r4-http-live-lane-2026-04-23.md`
3. `projects/_ops/mission-control-savepoint-r3-http-bridge-pivot-2026-04-23.md`
4. `projects/mission-control/lib/adapters/orchestrator.ts`
5. `projects/mission-control/lib/runtime-bridge-sidecar.ts`
6. `projects/mission-control/scripts/preview-origin-proxy.js`
7. `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
8. `projects/mission-control/hooks/useRuntimeBridge.ts`
9. `projects/mission-control/app/api/runtime-bridge/route.ts`
10. `projects/mission-control/lib/runtime-bridge-lane.ts`
11. `projects/mission-control/scripts/preview-start.sh`
12. `memory/2026-04-24.md`

---

## Bottom line
Tonight’s value was not “we shipped R5.”

Tonight’s value was that we finally pinned the live WS problem to a very specific set of missing pieces:
- live descriptor still HTTP-only
- proxy still token-gated
- sidecar connect already exists
- client subscription model still missing
- route/lane infrastructure already exists
- preview warmup is still preview-token-path specific

That is a much better place to resume from.

The next session should now be able to move directly into a small, deliberate R5 patch instead of spending another long cycle rediscovering what is and is not already true.
