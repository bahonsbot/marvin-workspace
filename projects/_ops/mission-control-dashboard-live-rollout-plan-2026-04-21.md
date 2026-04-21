# Mission Control Dashboard Live Rollout Plan — 2026-04-21

## Purpose
Update the older live-readiness plan with an audit of the current Mission Control stack, then define the implementation path to promote Mission Control from `preview.motiondisplay.cloud` to an always-live `dashboard.motiondisplay.cloud` in a way that matches OpenClaw's default live Gateway Dashboard model as closely as possible.

This plan supersedes the runtime assumptions in:
- `projects/_ops/mission-control-live-readiness-plan-2026-04-11.md`

## Executive Summary
Do **not** promote the current preview stack unchanged and call it live.

Today, Mission Control Chat is still a separate Next.js app with its own:
- HTTP proxy layer
- WebSocket sidecar
- browser bridge token
- gateway token injection into the browser
- filesystem-based transcript hydration path
- separate Basic Auth boundary

That is useful for previewing, but it is not the same shape as OpenClaw's default live Dashboard.

### Recommended direction
Use a **two-stage migration**:

1. **Short-term live HTTPS milestone**
   - get `dashboard.motiondisplay.cloud` onto valid HTTPS quickly
   - keep Mission Control reachable and microphone-capable
   - but treat this as an intermediate deployment, not the final architecture

2. **Real live-dashboard alignment**
   - move Chat/runtime/auth/session transport toward the **gateway-native** Control UI model
   - remove preview-only bridge layers
   - stop exposing gateway auth through Mission Control's app layer
   - collapse to one primary auth/origin/runtime truth boundary

## Current Audited State (2026-04-21)

## 1. Current Mission Control runtime shape
Mission Control preview is currently a **three-process stack**:

1. **Next.js app**
   - internal host/port: `127.0.0.1:3007`
2. **Preview origin proxy**
   - public/container-facing port: `3005`
   - script: `projects/mission-control/scripts/preview-origin-proxy.js`
3. **WS sidecar**
   - loopback port: `127.0.0.1:3006`
   - script: `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

Related scripts:
- `scripts/preview-build.sh`
- `scripts/preview-start.sh`
- `scripts/preview-stop.sh`
- `scripts/preview-restart.sh`

Health check today:
- `http://127.0.0.1:3005/general/chat` returns `200 OK`
- runtime processes are currently alive on the expected preview stack

## 2. Current Chat/runtime architecture
Current Chat is implemented as a Mission Control-specific bridge, not as the stock OpenClaw Dashboard transport.

Key files:
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`
- `projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/app/api/runtime-bridge/route.ts`
- `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`

### What it does today
- SSR seeds chat with:
  - `readOrchestratorIntegrationSummary()`
  - `loadRuntimeBridgeSessionHistory()`
- transcript hydration is pulled from session files under `/data/.openclaw/agents/.../sessions/...jsonl`
- the browser then opens a WebSocket to Mission Control's same-origin bridge path:
  - `/api/runtime-bridge/ws?bridgeToken=...`
- after `connect.challenge`, the browser sends a real gateway `connect` request
- browser-side live send uses `chat.send`
- browser-side abort uses `chat.abort`

### Important current limitation
Mission Control's runtime descriptor currently includes both:
- a **WS bridge token**
- a **gateway session token**

That means the browser receives gateway auth material through the Mission Control app layer.

That is acceptable for a private preview experiment, but it is the wrong security posture for a durable always-live dashboard.

## 3. Current auth/origin model
Mission Control preview currently has **multiple auth layers**:

### Mission Control app auth
- Next middleware enforces Basic Auth for non-local requests
- file: `projects/mission-control/middleware.ts`

### Preview proxy runtime WS auth
- `preview-origin-proxy.js` checks:
  - bridge token
  - local request, or
  - valid Basic Auth, or
  - same-origin upgrade

### Gateway auth underneath
Current OpenClaw gateway config is still:
- `gateway.mode: local`
- `gateway.bind: loopback`
- `gateway.auth.mode: token`
- gateway URL is local loopback

Current `gateway.controlUi` posture in `openclaw.json` includes:
- explicit `allowedOrigins` for preview origins
- `allowInsecureAuth: true`
- `dangerouslyDisableDeviceAuth: true`
- `dangerouslyAllowHostHeaderOriginFallback: true`

That is a preview/debug posture, not the target live posture.

## 4. Current STT / secure-context posture
Speech input currently depends on browser secure context.

Relevant files:
- `projects/mission-control/components/chat/useSpeechToText.ts`
- `projects/mission-control/app/api/transcribe/route.ts`
- `projects/mission-control/lib/transcribe.ts`
- `projects/mission-control/docs/local-whisper-stt-notes.md`

Important current truth:
- browser mic capture is blocked unless `window.isSecureContext` is true
- therefore `dashboard.motiondisplay.cloud` must be valid HTTPS
- STT itself is already implemented server-side via:
  - local Whisper, or
  - OpenAI transcription

So HTTPS is not optional if live browser mic is part of the product.

## 5. Current OpenClaw default Dashboard shape
OpenClaw's default Dashboard is materially different:

- it is **gateway-native**
- the Control UI is served directly by the gateway
- browser auth/origin/device checks are handled by the gateway
- chat/history/session operations are gateway-native
- WebSocket connect rules are enforced by the gateway itself
- non-loopback deployments require explicit `gateway.controlUi.allowedOrigins` unless dangerous fallback is enabled
- Control UI device identity expects HTTPS or localhost unless dangerous overrides are enabled

Important audit note:
`gateway.controlUi.root` is only a root for Control UI assets.
It is **not** a drop-in replacement for a dynamic Next.js app with server routes.

So Mission Control cannot become gateway-native simply by pointing `gateway.controlUi.root` at the current Next app.

## Gap Analysis: Mission Control Preview vs OpenClaw Live Dashboard

| Area | Current Mission Control preview | Default OpenClaw live Dashboard | Gap |
|---|---|---|---|
| UI serving model | Next.js app behind preview proxy | gateway-served Control UI | High |
| Chat transport | preview proxy + WS sidecar | direct gateway WS model | High |
| Auth boundary | Basic Auth + bridge token + gateway token | gateway-native auth/origin/device model | High |
| Session hydration | filesystem/jsonl hydration first | gateway-native chat/session APIs | High |
| Gateway token handling | token exposed through Mission Control descriptor | should stay within gateway auth flow or trusted proxy flow | Critical |
| Secure context | only works once app is HTTPS | same requirement, but better aligned in gateway-native model | Medium |
| Runtime truth | mixed CLI/filesystem/bridge | gateway is source of truth | High |
| Operational shape | preview scripts/processes | always-live gateway dashboard pattern | High |

## Critical Live Blockers

## Blocker 1: browser receives gateway auth via Mission Control
Before live cutover, remove the pattern where Mission Control injects gateway auth into the browser runtime descriptor.

## Blocker 2: chat bootstrap depends on filesystem transcript hydration
Current first-load history comes from direct session registry/jsonl reads.
For a truly live dashboard, chat/session truth should come from gateway-native session/chat APIs, not direct disk hydration.

## Blocker 3: preview-only process topology
`preview-origin-proxy.js` and `runtime-bridge-ws-sidecar.js` are preview bridge layers.
They are not the target architecture for a durable always-live dashboard.

## Blocker 4: dangerous control-ui flags still enabled
Current preview posture depends on dangerous toggles that should not survive unchanged into public live use.

## Blocker 5: separate Mission Control auth boundary
Mission Control Basic Auth is separate from gateway auth/device/origin logic.
That duplication creates operational drift and debugging ambiguity.

## Environment naming direction

Recommended durable lane names:
- `dashboard.motiondisplay.cloud` = canonical live Mission Control
- `lab.motiondisplay.cloud` = future persistent sandbox / experimental lane
- `preview.motiondisplay.cloud` = optional temporary preview, release-candidate, or rollback lane

Naming rationale:
- `dashboard` clearly marks the canonical operator surface
- `lab` communicates experimentation better than `preview` once a real live lane exists
- `preview` should stay temporary if it remains at all

## Recommended Target Architecture

## Target state
`dashboard.motiondisplay.cloud` should become a **single canonical live dashboard domain** with:

- HTTPS at the edge
- one clear auth story
- one clear websocket story
- one runtime truth boundary
- gateway-native chat/session semantics
- same-origin browser APIs for Mission Control-specific features

### Recommended end-state topology
1. **Public HTTPS reverse proxy**
   - terminates TLS for `dashboard.motiondisplay.cloud`
2. **OpenClaw gateway as canonical runtime authority**
   - Dashboard/WebSocket/auth/origin policy anchored here
3. **Mission Control UI as the product surface**
   - but Chat/runtime behavior aligned to gateway-native flows
4. **Mission Control-specific APIs**
   - either moved into gateway/plugin-backed HTTP endpoints
   - or kept behind the same dashboard origin without a second auth model

## Strong recommendation
Do **not** make the final live architecture depend on:
- browser-side gateway token injection from Mission Control
- filesystem-first transcript hydration
- permanent preview proxy + WS sidecar layers
- dangerous device-auth bypass flags
- the older iframe-embed patch as a production strategy

## Implementation Strategy

## Phase 0 — Freeze the current preview assumptions
Goal: document exactly what is preview-only so it does not leak into live design.

Deliverables:
- mark `preview-origin-proxy.js` and `runtime-bridge-ws-sidecar.js` as intermediate-only
- mark current Basic Auth middleware as intermediate-only
- mark current gateway token injection path as temporary and slated for removal
- keep the current preview path working during migration

## Phase 1 — Establish the live HTTPS edge
Goal: make `dashboard.motiondisplay.cloud` a real secure browser origin.

Work:
- provision TLS for `dashboard.motiondisplay.cloud`
- route the new hostname through the intended reverse proxy layer
- decide whether the first live target is:
  - **intermediate Mission Control app**, or
  - **gateway-native cutover candidate**
- preserve `preview.motiondisplay.cloud` as rollback/staging lane during migration

Acceptance criteria:
- `dashboard.motiondisplay.cloud` is HTTPS
- browser secure context is true
- mic eligibility is no longer blocked by origin security

## Phase 2 — Replace the auth model with a live-safe one
Goal: align auth with OpenClaw's live Dashboard posture.

### Recommended auth direction
Prefer one of these:

#### Option A, best long-term
- `gateway.auth.mode = trusted-proxy`
- edge proxy handles authentication
- `gateway.trustedProxies` restricted to real proxy IPs
- explicit `gateway.controlUi.allowedOrigins`

#### Option B, acceptable if trusted-proxy is not ready
- keep gateway token auth
- but do **not** relay the token through Mission Control APIs to the browser
- use the normal Control UI auth/settings flow instead

In either case:
- remove `dangerouslyDisableDeviceAuth` from the live posture
- remove `dangerouslyAllowHostHeaderOriginFallback` unless absolutely required
- keep `allowedOrigins` explicit and exact

Acceptance criteria:
- one primary auth story for the live dashboard
- no Mission Control-only browser auth workaround needed
- no dangerous device-auth bypass in steady state

## Phase 3 — Rebuild Chat around gateway-native runtime truth
Goal: make Chat the first area that truly matches the OpenClaw live Dashboard model.

This is the most important phase.

### Remove these preview-specific assumptions
- no browser-side gateway token injection via `/api/runtime-bridge`
- no filesystem-first transcript hydration via `lib/runtime-bridge-history.ts`
- no permanent dependency on `preview-origin-proxy.js`
- no permanent dependency on `runtime-bridge-ws-sidecar.js`

### Replace with
- gateway-native session discovery
- gateway-native transcript/history fetch
- gateway-native live event stream / chat transport
- gateway-native send/abort/auth flow

### Practical implication
Mission Control Chat should stop acting like a custom bridge to the real runtime.
It should become a first-class client of the real runtime.

Acceptance criteria:
- first paint for Chat no longer depends on direct session JSONL reads
- live connect does not require Mission Control to hand browser a gateway token
- session switching, chat history, send, and abort all flow through the canonical gateway model

## Phase 4 — Consolidate Mission Control APIs behind the same live boundary
Goal: keep Mission Control features, but stop letting them create a second runtime universe.

Keep and migrate as same-origin dashboard features:
- Home summaries
- Tasks board data
- Agents data
- Files browsing/edit helpers
- search/memory convenience endpoints
- STT/TTS endpoints

Direction:
- move runtime-sensitive endpoints toward gateway/plugin-backed implementations where practical
- reserve app-side helpers for product-specific aggregation, not auth or runtime truth invention

Acceptance criteria:
- Mission Control-specific pages still work
- but Chat/runtime/session truth is no longer special-cased outside the gateway model

## Phase 5 — Promote from preview to always-live dashboard
Goal: cut over without breaking operator continuity.

Cutover sequence:
1. keep `preview.motiondisplay.cloud` as the known-good fallback lane
2. deploy `dashboard.motiondisplay.cloud` with HTTPS and final proxy rules
3. validate live auth/origin/websocket behavior
4. validate mic/STT on the live domain
5. validate chat reconnect/session switching/history correctness
6. validate restart behavior
7. only then declare dashboard canonical

Acceptance criteria:
- live dashboard survives restart/reconnect cleanly
- operator chat continuity remains truthful
- microphone/STT works on the live domain
- no preview-only runtime bridge is required for steady-state operation

## Phase 6 — Decommission preview-only bridge layers
Goal: remove the parts that existed only to make the preview possible.

Retire or repurpose:
- `preview-origin-proxy.js`
- `runtime-bridge-ws-sidecar.js`
- preview-only Basic Auth middleware assumptions
- token-bridging descriptor behavior
- any iframe/embed patch dependency for core chat behavior

## Recommended Priority Order

### P0, decision and guardrails
1. Approve that the current preview stack will **not** be promoted unchanged
2. Approve target auth model for the live dashboard
3. Approve that Chat/runtime migration is the primary live-readiness workstream

### P1, edge and security
4. Stand up HTTPS on `dashboard.motiondisplay.cloud`
5. define final reverse-proxy topology
6. remove dangerous live auth assumptions from the target design

### P2, chat/runtime migration
7. replace browser token injection pattern
8. replace filesystem transcript hydration path
9. move Chat to gateway-native runtime/session transport

### P3, same-origin product completion
10. migrate Mission Control-specific APIs behind the final live boundary
11. verify STT/TTS on the live domain
12. harden restart/recovery/session continuity

### P4, cutover and cleanup
13. cut over to `dashboard.motiondisplay.cloud`
14. keep preview as rollback lane briefly
15. remove preview-only bridge layers once confidence is high

## What should happen next, concretely

## Immediate next implementation doc / work items
The next implementation pass should produce:

1. **Auth and proxy design doc**
   - exact edge topology
   - exact gateway auth mode
   - exact allowed origins
   - exact trusted proxy CIDRs
   - status: created in `projects/_ops/mission-control-auth-proxy-design-2026-04-22.md`

2. **Chat/runtime migration spec**
   - replacement for `useRuntimeBridge` preview-specific assumptions
   - removal plan for gateway token injection
   - replacement for `lib/runtime-bridge-history.ts`
   - status: still needed

3. **Cutover checklist**
   - DNS
   - TLS
   - proxy
   - auth
   - websocket
   - mic/STT
   - rollback
   - status: created in `projects/_ops/mission-control-dashboard-cutover-checklist-2026-04-22.md`

## Recommended implementation stance
If only one area moves first, move **Chat/runtime/auth** first.
That is the part most out of alignment with OpenClaw's default live Dashboard behavior, and it is the part that will otherwise keep forcing preview-only compromises into production.

## Explicit non-goals for this rollout
Do not spend this phase on:
- broad visual cleanup
- agents-page polish
- unrelated Tasks UI polish
- speculative sandbox work
- another iframe-embed experiment as the main live architecture

## Bottom line
Mission Control can absolutely become `dashboard.motiondisplay.cloud`, but the current preview stack is still an intermediate bridge architecture.

The correct rollout is:
- **HTTPS first**
- **auth/origin cleanup second**
- **Chat/runtime migration to gateway-native truth third**
- **cutover last**

That gives the browser secure context needed for mic/STT, while also getting Mission Control much closer to the way OpenClaw's live Dashboard is actually meant to work.
