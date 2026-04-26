# Mission Control Savepoint Before R2 — 2026-04-22 Night

## Purpose
This is the detailed continuation savepoint for the Mission Control live-chat/runtime migration after completion of the first lane-aware descriptor slice and before beginning R2.

It is meant to let a future agent resume the work without Philippe needing to restate:
- what changed tonight,
- what the real current runtime/deployment truth is,
- what we learned that we did not know before,
- what is intentionally unfinished,
- and exactly what the next implementation slice should do.

This savepoint is intentionally comprehensive.

---

## Executive summary
Tonight’s Mission Control work moved from architecture/spec investigation into a real first implementation slice.

The major result is:

> **Mission Control now exposes different runtime-bridge descriptors for preview vs live hosts, and live/dashboard hosts no longer receive browser-usable runtime secrets.**

This does **not** complete the live runtime migration.
It completes only the first security-oriented contract slice, called here **R1**.

What R1 achieved:
- preview/local hosts keep the legacy runtime bridge behavior needed for the current sidecar-based rollback path,
- dashboard/live hosts now receive a secret-free runtime descriptor,
- SSR and browser bootstrap for the main chat page are now host-aware,
- the live lane degrades honestly to a history/bootstrap-oriented shell rather than pretending live send/connect is ready.

What R1 did **not** achieve:
- history/bootstrap is still disk-backed,
- live websocket/send/abort/session transport is still not behind the trusted edge,
- preview-origin proxy and WS sidecar are still part of the active preview path,
- gateway private non-loopback reachability is still unresolved,
- `dashboard.motiondisplay.cloud` still points at the preview-shaped Mission Control app.

So the current truth is:

> **Live/dashboard is now safer than before, but it is still not the final live Chat/runtime architecture.**

---

## The most important state change from tonight

### 1. Runtime bridge exposure is now lane-aware
A new runtime-bridge lane helper exists:
- `projects/mission-control/lib/runtime-bridge-lane.ts`

Current logic:
- `preview.motiondisplay.cloud` -> `preview`
- `localhost` -> `preview`
- `127.0.0.1` -> `preview`
- `::1` -> `preview`
- everything else -> `live`

Important detail:
- lane resolution prefers `x-forwarded-host`, then falls back to `host`
- unknown non-local hosts intentionally default to `live`, not `preview`

That default is deliberate security posture.
It means an unrecognized host gets the safer secret-free descriptor rather than accidentally inheriting preview secrets.

### 2. The orchestrator summary is now lane-aware
`projects/mission-control/lib/adapters/orchestrator.ts` now uses:
- lane-specific cache entries
- lane-specific in-flight promise tracking
- lane-specific runtime-bridge derivation

Before tonight:
- there was effectively one shared runtime-bridge summary contract,
- preview-like token-bearing state could leak conceptually across consumers.

Now:
- `preview` and `live` can hold different cached runtime summaries,
- routes/pages can explicitly request the right lane,
- live/dashboard receives a different descriptor from preview.

### 3. There are now two descriptor postures

#### Preview lane
Preview continues to use the legacy browser-relay model:
- `descriptorVersion: 'v2'`
- `mode: 'polling-ws-sidecar' | 'polling-handoff'`
- `transport.kind: 'http-poll+ws-sidecar' | 'http-poll'`
- `auth.browserTokenRelay: true`
- sidecar token may still be exposed
- gateway session token may still be exposed
- `composerSend` stays enabled only when sidecar + gateway session auth are both configured

This is intentionally rollback-compatible, not the target live architecture.

#### Live lane
Live/dashboard now uses a secret-free shape:
- `descriptorVersion: 'v3'`
- `mode: 'server-proxy-bridge'`
- `transport.kind: 'http-poll'`
- `transport.websocket.configured: false`
- `auth.strategy: 'edge-auth'`
- `auth.browserTokenRelay: false`
- `auth.serverConnectConfigured: false`
- `capabilities.composerSend: false`
- no browser websocket token
- no browser gateway session token

The limitations text explicitly says this is a secret-free slice and that server-owned live runtime support is still pending.

This is the key durable implementation outcome of the evening.

---

## Why this implementation path was chosen
Two possible first moves were considered:

### Option A
Remove browser-visible secrets everywhere immediately.

Problem:
- this would have broken preview transport and its warmup/runtime assumptions before a replacement existed.

### Option B
Split preview vs live by host, keep preview operational, make live safe first.

This was chosen because it best matched the real constraints:
- Philippe wants browser-visible secrets removed from dashboard/live behavior,
- preview still matters as rollback,
- the real live transport rewrite is not done yet,
- the preview toolchain still depends on the legacy descriptor.

So tonight’s implementation deliberately prioritized:
1. **live safety**,
2. **preview continuity**,
3. **minimal coherent change set**,
4. **honest degradation instead of fake readiness**.

---

## Files changed in the R1 slice
These are the concrete implementation files a future agent should inspect first.

### New file
- `projects/mission-control/lib/runtime-bridge-lane.ts`

### Modified core files
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/app/api/runtime-bridge/route.ts`
- `projects/mission-control/app/api/orchestrator/route.ts`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/chat/thread-model.ts`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

### Important unchanged-but-still-central files
These remain part of the next slice even though they were not fundamentally migrated tonight:
- `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`
- `projects/mission-control/lib/chat/runtime-bridge-transcript.ts`
- `projects/mission-control/scripts/preview-start.sh`
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
- `projects/mission-control/lib/runtime-bridge-sidecar.ts`

---

## Validation result after R1
The slice was validated, not just edited.

### Passed
- `npm run lint`
- `npm run build`

### Build warnings that remained
These were observed but are not caused by the new lane-aware slice:
- Next.js middleware/proxy deprecation warning
- dynamic module resolution warning involving `run-autonomous-task.mjs`
- NFT/tracing warning involving `next.config.js` and `lib/adapters/files.ts`

Durable conclusion:
- the lane-aware descriptor work is syntactically/build-valid,
- there was no TypeScript or production-build failure from this slice,
- remaining warnings are older non-blocking Mission Control issues.

---

## What we learned tonight that we did not know clearly enough before

These findings materially affect how R2 should be implemented.

### 1. Gateway-backed history is real and already exists in OpenClaw
This was a major discovery.

By inspecting bundled OpenClaw dist, we confirmed:
- there is a real `chat.history` method,
- there is a real HTTP session-history path,
- Control UI already uses it,
- this is the native runtime truth source to converge toward.

Most important shape discovered:
- `GET /sessions/:sessionKey/history`
- query params include `limit` and `cursor`
- SSE mode exists when `Accept: text/event-stream` is used
- auth is header-based, not query-param based
- authorization is tied to `chat.history`

This means R2 does **not** need to invent a new history source.
It should move Mission Control toward the existing gateway history surface.

### 2. Gateway HTTP auth is compatible with a server-owned same-origin facade
OpenClaw HTTP auth inspection showed:
- `Authorization: Bearer <token>` works,
- `X-OpenClaw-Token` also works,
- trusted scopes may be carried separately,
- query-param auth is not the pattern for the HTTP history endpoint.

Implication:
- Mission Control can implement a same-origin server-owned history route without exposing tokens to the browser,
- which makes R2 substantially more practical than it looked earlier.

### 3. Control UI already models the right behavioral shape for history loading
By reading bundled Control UI code, we learned useful behavioral details:
- Control UI loads transcript history via `chat.history`,
- it retries transient startup `UNAVAILABLE` conditions with bounded backoff,
- it filters `NO_REPLY`,
- it filters the synthetic “missing tool result in session history” repair message.

Implication:
- Mission Control should probably borrow these behavioral rules rather than improvising a different history bootstrap contract.

### 4. Mission Control preview still genuinely depends on the old secret-bearing descriptor path
This is important because it explains why R1 could not simply delete the old fields.

`projects/mission-control/scripts/preview-start.sh` still:
- fetches `/api/runtime-bridge`,
- extracts `runtimeBridge.endpoints.websocketBridgeToken`,
- opens `ws://127.0.0.1:<preview-port>/api/runtime-bridge/ws?bridgeToken=...` to warm the bridge.

`projects/mission-control/lib/runtime-bridge-sidecar.ts` still:
- exposes the sidecar token when configured.

Implication:
- preview still depends on the legacy contract,
- so any future preview migration must explicitly replace this warmup/transport path rather than assuming it disappeared when the live lane was cleaned up.

### 5. History/bootstrap in Mission Control is still fully disk-backed
This is now the cleanest next boundary.

`projects/mission-control/lib/runtime-bridge-history.ts` still:
- reads `/data/.openclaw/agents/<agent>/sessions/sessions.json`,
- resolves `sessionId`,
- reads `<sessionId>.jsonl`,
- reconstructs transcript history from local session files.

`projects/mission-control/app/api/runtime-bridge/history/route.ts` still just returns that result.

`projects/mission-control/app/general/chat/page.tsx` still SSR-loads transcript history through that same disk-backed path.

So the live lane is now secret-free, but it is **not** yet gateway-native in transcript truth.

---

## What the current runtime/deployment truth is right now
This section is blunt on purpose.

### 1. `dashboard` is safer than before, but still not the final live product architecture
It now avoids browser-visible runtime secret relay in the descriptor path.

But it still:
- points to a preview-shaped Mission Control deployment,
- does not have live send/connect/abort behind a real trusted-edge runtime path,
- still relies on disk-backed history bootstrap.

### 2. `preview` and `dashboard` still front the same preview app stack
Current practical deployment truth remains:
- `preview.motiondisplay.cloud` -> current Mission Control preview app
- `dashboard.motiondisplay.cloud` -> same app via host nginx/HTTPS shell

This matters because hostnames are now logically separated, but infrastructure is not yet fully separated.

### 3. `lab` is still only partially set up
Durable current truth:
- DNS/HTTPS work had partial progress,
- but plain HTTP still served the default nginx page,
- no finished lab lane routing story exists yet.

### 4. Pomerium is still planned, not deployed
The architectural direction remains:
- `Pomerium -> nginx -> upstreams`

But Pomerium is not yet the active identity/auth layer.

### 5. Final direct live transport is still blocked by gateway reachability
This remains unresolved and must stay explicit:
- config may show `gateway.bind = "0.0.0.0"`,
- observed runtime still behaved as loopback-bound,
- the final private non-loopback gateway path for trusted-proxy live transport is still not in place.

That blocks the final version of R3/R4, even though R1 and likely R2 can proceed.

---

## The current code-level shape after R1
This section is meant to save the next agent time.

### `projects/mission-control/lib/runtime-bridge-lane.ts`
Current behavior:
- parses host from `x-forwarded-host` or `host`,
- normalizes using `new URL('http://...').hostname` when possible,
- falls back to stripping `:port`,
- maps preview/local hosts to `preview`, otherwise `live`.

This helper is now the canonical host/lane decision point.

### `projects/mission-control/lib/adapters/orchestrator.ts`
Important current shape:
- lane-aware cache maps,
- `derivePreviewRuntimeBridge(...)`,
- `deriveLiveRuntimeBridge(...)`,
- `deriveRuntimeBridge(lane, ...)`,
- `createDeferredOrchestratorIntegrationSummary(lane)`,
- `createUnavailableOrchestratorIntegrationSummary(lane)`,
- `buildOrchestratorIntegrationSummary(lane)`.

Key live-lane behavior:
- returns a `v3` secret-free descriptor,
- keeps `history` endpoint visible,
- withholds websocket/token relay.

Key preview-lane behavior:
- continues to expose the old sidecar/gateway token-bearing descriptor when configured.

### `projects/mission-control/app/general/chat/page.tsx`
Now:
- awaits `headers()` from Next,
- resolves runtime lane from request headers,
- primes the matching lane summary,
- reads the matching lane summary,
- still loads transcript history with `loadRuntimeBridgeSessionHistory(initialSessionKey)`.

Important:
- SSR summary is now lane-aware,
- SSR transcript history is still not lane-aware because it is still disk-backed.

### `projects/mission-control/app/api/runtime-bridge/route.ts`
Now returns the lane-aware summary based on request headers.

### `projects/mission-control/app/api/orchestrator/route.ts`
Now also returns lane-aware summary based on request headers.

### `projects/mission-control/hooks/useRuntimeBridge.ts`
Important current behavior after R1:
- still reads websocket config/token/base URL fields if present,
- now also checks `descriptorVersion` and `auth.browserTokenRelay`,
- if descriptor is secret-free/live, it shows intentional-unavailability messaging instead of treating missing secrets as an accidental preview failure.

This means:
- the hook still contains preview-era transport assumptions,
- but it now fails gracefully on live/dashboard instead of hard-breaking.

### `projects/mission-control/lib/types/contracts.ts`
Now supports:
- `descriptorVersion: 'v2' | 'v3'`
- broader `mode`
- broader `transport.kind`
- `auth.browserTokenRelay`
- optional token-bearing fields

This is the contract layer that made the preview/live split possible without rewriting everything into a hard union immediately.

### `projects/mission-control/lib/chat/thread-model.ts`
Now distinguishes labels for:
- `http-poll+ws-sidecar`
- `http+ws-live`
- otherwise `HTTP polling only`

This is small but important: UI copy no longer lies by assuming everything is the WS sidecar.

### `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
Received wording cleanup to generalize runtime socket copy away from strict sidecar language.

---

## What is intentionally unfinished
This is the real remaining work, not the softened version.

### 1. R2 is still completely open implementation-wise
R2 should replace:
- disk-backed session history loading,
- disk-backed SSR bootstrap,
- local JSONL transcript truth.

It is not done yet.

### 2. The live lane still has no browser live transport
This is intentional for now.
The live descriptor is honest about it.

### 3. Preview still depends on old token-bearing bridge behavior
That is acceptable temporarily, but it is still debt.

### 4. The deployment-specific cutover doc is now partially stale in tone
`projects/_ops/mission-control-deployment-specific-cutover-2026-04-22.md` says:
- “ready for execution”

That wording is now too strong.
After tonight’s findings, that document should be treated as:
- useful deployment exploration,
- useful environment notes,
- but **not** proof that live runtime architecture is execution-ready.

### 5. Agents/general secondary consumers were not fully reworked
Possible follow-up surfaces remain:
- `components/pages/GeneralChatPage.tsx`
- `lib/adapters/agents.ts`
- other pages that may still default to `live` summary behavior

Current judgment was that this was acceptable for R1 because the main chat/API path was the critical surface.
Still, a future agent should re-check whether any secondary browser-facing path deserves lane-awareness too.

---

## Recommended next implementation slice (R2)
This is the next best actual technical move.

### Goal
Move transcript bootstrap/history truth from local JSONL/session files to a server-owned gateway-backed path.

### Best practical direction
Create a new server-side gateway history adapter.

Likely shape:
- a helper module dedicated to calling gateway history using server-side auth,
- no browser tokens,
- same-origin Mission Control route remains the browser-facing surface,
- gateway response is translated into `RuntimeBridgeTranscriptHistory`.

### Why this should be next
Because it solves the next largest mismatch after secret relay:
- today the browser no longer gets secrets in the live lane,
- but the live lane still bootstraps from local disk,
- which is the next biggest architectural lie.

### Likely file targets for R2
Primary:
- `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`
- probably a new helper such as `projects/mission-control/lib/runtime-bridge-gateway.ts` or similar
- `projects/mission-control/app/general/chat/page.tsx`

Secondary:
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/chat/runtime-bridge-transcript.ts`

### Suggested R2 sub-steps
1. Implement server-owned gateway history fetch helper.
2. Confirm auth header strategy in Mission Control server runtime.
3. Map gateway history payload into Mission Control transcript structures.
4. Update `/api/runtime-bridge/history` to prefer gateway history.
5. Update SSR bootstrap in `app/general/chat/page.tsx` to use the new path.
6. Decide whether to keep a bounded JSONL fallback and how to label it honestly.
7. Consider adopting Control UI-like retry behavior for startup `UNAVAILABLE` conditions.

---

## Recommended behavioral rules for R2
These are not yet implemented, but the evidence now points strongly toward them.

### 1. Prefer gateway truth over disk truth
Local disk should become fallback, not primary.

### 2. Keep fallback explicit if it exists
If a JSONL fallback is temporarily retained, the route/helper should make that provenance clear rather than pretending it is gateway truth.

### 3. Copy the good parts of Control UI behavior
Especially:
- bounded retry on startup `UNAVAILABLE`
- filtering obvious transcript noise like `NO_REPLY`
- avoiding synthetic repair artifacts as user-visible chat content

### 4. Do not reintroduce browser token relay just to make R2 easier
If R2 needs a shortcut, it should be server-side.
Do not undo the live-lane safety gain from R1.

---

## Important documents to read before resuming
In order:

1. `projects/_ops/mission-control-savepoint-before-r2-2026-04-22-night.md` (this file)
2. `projects/_ops/mission-control-chat-runtime-migration-spec-2026-04-22.md`
3. `projects/_ops/mission-control-savepoint-for-tomorrow-2026-04-22.md`
4. `projects/_ops/mission-control-pomerium-nginx-cutover-config-2026-04-22.md`
5. `projects/_ops/mission-control-deployment-specific-cutover-2026-04-22.md`
6. `memory/2026-04-22.md`

Then inspect these code files:
- `projects/mission-control/lib/runtime-bridge-lane.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`
- `projects/mission-control/lib/chat/runtime-bridge-transcript.ts`
- `projects/mission-control/scripts/preview-start.sh`

---

## What must not be forgotten
This is the blunt list.

- The live/dashboard descriptor is now safer than before.
- The live/dashboard runtime architecture is still not finished.
- Preview still depends on the old token-bearing sidecar path.
- Dashboard/live must not regress to browser-visible secret relay.
- Disk/jsonl transcript bootstrap is still live technical debt.
- Gateway-backed history already exists and should be reused.
- Server-side auth headers make a same-origin history facade practical.
- The final live transport still depends on private non-loopback gateway reachability.
- Pomerium is still planned, not deployed.
- `dashboard` is still serving a preview-shaped app stack.
- The deployment-specific cutover doc should no longer be read as “done, just execute.”

---

## Bottom line for the next agent
You are not resuming from a vague architecture discussion anymore.

R1 is real and landed.
The next job is clear:

1. keep the live lane secret-free,
2. replace disk-backed history/bootstrap with a server-owned gateway-backed path,
3. preserve preview as rollback while the live runtime path catches up,
4. do not confuse the current safer dashboard shell with a completed live runtime architecture.

If you do only one thing next, do R2 properly.
