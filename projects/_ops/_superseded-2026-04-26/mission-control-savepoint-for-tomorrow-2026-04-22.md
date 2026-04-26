# Mission Control Savepoint for Tomorrow — 2026-04-22

## Purpose
This is the comprehensive continuation savepoint for the Mission Control live-rollout and late-evening Mission Control polish work.

If a future agent reads the linked docs plus this savepoint, Philippe should not need to re-explain what happened, what was decided, what was learned, what is still true, and what the next implementation steps are.

This savepoint is intentionally detailed.

---

## Executive summary
The day split into two major workstreams:

1. **Mission Control UI / preview operations work**
   - hardened the Mission Control preview stop logic
   - finished the requested Agents-page width/avatar polish
   - verified preview restart behavior properly instead of trusting stale PID files

2. **Mission Control live-rollout architecture work**
   - audited the real current Mission Control preview/runtime/auth shape
   - compared it against OpenClaw's gateway-native Dashboard / Control UI model
   - concluded that the current preview stack must **not** be promoted unchanged to `dashboard.motiondisplay.cloud`
   - created a planning doc chain for the real live migration
   - chose a firm edge recommendation: **Pomerium -> nginx -> upstreams**
   - produced a configuration-oriented cutover doc for that direction

The most important product/architecture conclusion from the day is:

> **Mission Control today is still a preview-specific app/runtime bridge, not a gateway-native live dashboard.**
> It can be moved behind HTTPS as an intermediate milestone, but it should not be described as the final live architecture until Chat/runtime/auth/session behavior is migrated away from preview-only assumptions.

---

## The most important final decisions

### 1. Live / lab / preview naming is now decided
- `dashboard.motiondisplay.cloud` = canonical live Mission Control
- `lab.motiondisplay.cloud` = durable experimental / sandbox lane
- `preview.motiondisplay.cloud` = temporary preview / rollback / release-candidate lane only if still useful

This naming question is settled unless Philippe explicitly reopens it.

### 2. Do not promote the current preview stack unchanged to live
This is not a maybe.
This is the central architectural decision.

Current preview shape is useful for private previewing, but not acceptable as the durable final live model.

### 3. Preferred long-term OpenClaw auth posture is trusted-proxy
Preferred direction:
- `gateway.auth.mode = "trusted-proxy"`
- explicit `gateway.controlUi.allowedOrigins`
- no browser-side Mission Control relay of gateway auth into the browser in the steady-state live model

### 4. Best practical deployment topology is now locked
The edge recommendation changed a few times during analysis, then stabilized.

Final recommendation:
- **Pomerium** as the identity/auth layer
- **nginx** retained as the routing spine during migration
- topology: **Pomerium -> nginx -> upstreams**

Why this won:
- current environment already operationally relies on host nginx
- Mission Control is still a dynamic Next.js app with websocket-sensitive behavior
- the migration window will need careful route/upstream/rollback control
- nginx is the safer routing stabilizer while Pomerium becomes the identity layer

Pomerium-direct is still a possible later simplification candidate, but it is **not** the recommended first cutover.

### 5. Browser mic/STT requirement remains a first-class constraint
Mission Control browser STT already exists, but microphone capture depends on `window.isSecureContext`.

Therefore:
- valid HTTPS on `dashboard.motiondisplay.cloud` is mandatory
- valid HTTPS on `lab.motiondisplay.cloud` is also expected if lab is meant to exercise browser-sensitive features

---

## What we now know that we did not know clearly before

These were important discoveries from today's audit and they materially changed the rollout design.

### A. OpenClaw trusted-proxy rejects loopback-source proxy requests
This was a major finding.

OpenClaw trusted-proxy auth explicitly rejects loopback-source proxy traffic (`trusted_proxy_loopback_source`).

Implications:
- do **not** design trusted-proxy around localhost or 127.0.0.1 header injection
- do **not** assume same-host proxy-to-loopback-gateway is valid for trusted-proxy mode
- trusted-proxy requires the gateway to see a real non-loopback proxy source address

This means the final live gateway path must be reachable via a **private non-loopback route**, while still remaining non-public.

This single fact is one of the most important durable findings of the day.

### B. `gateway.controlUi.root` cannot host the current Mission Control app
OpenClaw's Control UI serving expects static assets, not a dynamic SSR Next app with server route handlers.

Implication:
- current Mission Control cannot become gateway-native by simply pointing `gateway.controlUi.root` at it
- Mission Control must be treated as its own app surface during migration unless/until deeper refactoring happens

### C. Mission Control Chat is still a Mission Control-specific bridge
Current Chat/runtime behavior is not stock gateway-native Dashboard behavior.

Audited behavior includes:
- SSR seeding via `readOrchestratorIntegrationSummary()` and `loadRuntimeBridgeSessionHistory()`
- filesystem/jsonl transcript hydration from `/data/.openclaw/agents/.../sessions/...jsonl`
- same-origin runtime websocket bridge path `/api/runtime-bridge/ws?bridgeToken=...`
- browser-side `connect` after gateway `connect.challenge`
- send via `chat.send`
- abort via `chat.abort`
- Mission Control runtime descriptor currently capable of giving the browser both a bridge token and a gateway session token

Implication:
- the browser currently receives gateway auth material through the Mission Control app layer
- this is acceptable only for private preview, not steady-state live

### D. Current gateway config posture is preview/debug shaped, not live shaped
Current audited `openclaw.json` posture included:
- `gateway.mode = local`
- `gateway.bind = loopback`
- `gateway.auth.mode = token`
- `gateway.controlUi.allowedOrigins` including preview origins
- dangerous flags still enabled:
  - `allowInsecureAuth: true`
  - `dangerouslyDisableDeviceAuth: true`
  - `dangerouslyAllowHostHeaderOriginFallback: true`

Implication:
- this posture should be treated as temporary preview posture
- it must not be mistaken for the target public live posture

### E. Pomerium definitely supports the kinds of features we need
External documentation checks confirmed useful supporting facts:
- websocket / long-lived route support exists
- identity/claim headers are configurable
- claim headers such as `X-Pomerium-Claim-*` can be forwarded to upstreams

We treated external web docs as untrusted, but they were sufficient as supportive evidence, not as the sole source of truth.

---

## Current Mission Control preview/runtime shape
This is the current audited state that future work must assume until explicitly changed.

### Preview stack
Mission Control preview currently runs as three processes:
- Next.js app on `127.0.0.1:3007`
- preview-origin proxy on `:3005`
- websocket sidecar on `127.0.0.1:3006`

### Related scripts
- `projects/mission-control/scripts/preview-build.sh`
- `projects/mission-control/scripts/preview-start.sh`
- `projects/mission-control/scripts/preview-stop.sh`
- `projects/mission-control/scripts/preview-restart.sh`
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

### Current preview auth/runtime behavior
- app-level Basic Auth in `projects/mission-control/middleware.ts`
- preview-origin proxy runtime WS auth based on bridge token / local / valid Basic Auth / same-origin conditions
- preview-origin proxy forwarding to internal Next
- sidecar forwarding browser websocket traffic toward gateway websocket target
- optional upstream Origin override on sidecar->gateway hop

### Current health truth
Today the preview health path was repeatedly checked and considered healthy when:
- `http://127.0.0.1:3005/general/chat` returned `200 OK`

---

## Documents created / updated today
This is the document chain that now exists and should be treated as the canonical planning trail.

### Core rollout architecture docs
1. `projects/_ops/mission-control-dashboard-live-rollout-plan-2026-04-21.md`
   - core live rollout strategy
   - explains why current preview must not be promoted unchanged
   - compares Mission Control preview to OpenClaw gateway-native Dashboard

2. `projects/_ops/mission-control-auth-proxy-design-2026-04-22.md`
   - hostname roles
   - auth/proxy direction
   - trusted-proxy posture
   - live vs lab vs preview lane model

3. `projects/_ops/mission-control-dashboard-cutover-checklist-2026-04-22.md`
   - ordered execution checklist
   - the practical migration task list

### Proxy/topology docs
4. `projects/_ops/mission-control-pomerium-cutover-spec-2026-04-22.md`
   - Pomerium-first cutover direction
   - now updated to explicitly recommend **Pomerium -> nginx** for this deployment

5. `projects/_ops/mission-control-deployment-topology-spec-2026-04-22.md`
   - the final topology choice doc
   - explains why **Pomerium -> nginx** is the practical winner over Pomerium-direct and nginx-only

6. `projects/_ops/mission-control-pomerium-nginx-cutover-config-2026-04-22.md`
   - the new configuration-oriented cutover doc
   - closest thing so far to implementation guidance
   - captures config shape, route responsibilities, network constraints, and rollout order

### This savepoint
7. `projects/_ops/mission-control-savepoint-for-tomorrow-2026-04-22.md`
   - this file

---

## Commits that matter from today's work
These are the commits future work should remember and be able to refer back to.

### Preview/runtime hardening and UI polish
- `4e6de3c` — `Harden Mission Control preview stop script`
- `aa97322` — `Fix Mission Control agent card sizing and avatars`

### Planning and rollout docs
- `7df5ec9` — `Add Mission Control dashboard rollout planning docs`
- `c95fd39` — `Add Mission Control Pomerium cutover spec`
- `5a18cb6` — `Add Mission Control deployment topology spec`

### Agents page refinement commits that led up to the final accepted pass
- `4f20c16` — `Refine Mission Control agents page styling`
- `48aba09` — `Polish Mission Control agents proportions`
- `e59fb40` — `Finalize Mission Control agents layout`
- `2460fe4` — `Tighten Mission Control agents spacing`
- `b9ed721` — `Refine Mission Control agent card polish`
- `aa97322` — `Fix Mission Control agent card sizing and avatars`

---

## Important UI / product lessons from today
These were not just implementation details. They changed how to work.

### 1. Screenshot truth beats inferred success
This came up hard during Agents-page polish.

What happened:
- code edits and builds suggested a width/polish fix had landed
- Philippe's screenshot proved it had not really landed as claimed

Lesson:
- for subtle UI polish, do not trust code neatness, build success, or HTTP health alone
- trust the rendered result and screenshot proof

### 2. Fix the real requested dimension, not a proxy metric
Also from the Agents-page pass.

What happened:
- a change affected height/whitespace rather than the actual requested width
- that was not acceptable

Lesson:
- if the user asks for width, fix width
- if they ask to remove avatar tiles, remove the avatar tile chrome itself
- do not solve a precision visual issue with a perceptual workaround and then describe it as equivalent

### 3. Preview restart must be verified against real live processes, not only PID files
This became very clear while debugging Mission Control preview restarts.

What happened:
- stale PID files fooled the wrapper stop/start flow
- preview kept serving the old process tree
- the restart looked successful until verified properly

Lesson:
- the preview stop script had to be hardened against stale PID-file drift
- real stop/restart must be verified by actual live processes and bound ports, not just wrapper success

---

## Files and code areas that were especially important today
These are the real code surfaces the future agent should remember.

### Mission Control preview/runtime operations
- `projects/mission-control/scripts/preview-stop.sh`
- `projects/mission-control/scripts/preview-start.sh`
- `projects/mission-control/scripts/preview-build.sh`
- `projects/mission-control/scripts/preview-restart.sh`
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`

### Mission Control chat/runtime architecture
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`
- `projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/app/api/runtime-bridge/route.ts`
- `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/runtime-bridge-history.ts`

### Mission Control browser STT surfaces
- `projects/mission-control/components/chat/useSpeechToText.ts`
- `projects/mission-control/app/api/transcribe/route.ts`
- `projects/mission-control/lib/transcribe.ts`
- `projects/mission-control/docs/local-whisper-stt-notes.md`

### Mission Control Agents page polish files
- `projects/mission-control/components/agents/AgentSection.tsx`
- `projects/mission-control/components/agents/AgentSeatCard.tsx`
- `projects/mission-control/components/agents/AgentActionButton.tsx`

---

## What is still unfinished
This is the actual remaining work, not the hand-wavy version.

### 1. Deployment-specific config draft is still needed
We now have the config-oriented cutover doc, but it is still environment-shaped rather than host-specific.

What still needs to happen:
- inspect the actual host nginx layout
- inspect the actual container/network shape where Pomerium would live
- determine the exact non-loopback private address/path the gateway will expose to trusted proxies
- produce a deployment-specific config draft with real addresses, real vhost layout, and real rollback commands

### 2. Chat/runtime migration spec still needs to be written
This is probably the most important next technical doc.

It should cover, by file and function:
- removal of browser-side gateway token relay
- replacement of filesystem/jsonl transcript bootstrap with gateway-native history/session truth for live
- removal of permanent live dependence on preview-origin proxy and WS sidecar
- final live websocket/session/send/abort/reconnect behavior

### 3. Rollback runbook for dashboard cutover still needs to be written
We have a checklist and config-oriented cutover doc, but not yet the explicit operational rollback runbook for the future `dashboard` cutover.

### 4. Trusted-proxy environment validation still needs real deployment checks
Planning is now grounded, but the actual environment still needs to answer:
- where Pomerium runs
- what IP/CIDR the gateway will see as the trusted proxy source
- what non-loopback private path nginx/Pomerium will use for gateway access
- how to keep the direct gateway port private while still making the proxy path work

---

## Recommended next work item
This should be the next concrete thing done after this savepoint.

### Best next artifact
Write a **deployment-specific config draft** with actual environment values.

That doc should include:
- actual current nginx role and routing
- actual proposed Pomerium placement
- actual private gateway reachability model
- actual OpenClaw config delta
- actual firewall/network expectations
- exact rollback commands and rollback criteria

### Immediately after that
Write the **Chat/runtime migration spec** by file and function.

That is the real product/architecture migration workstream after the edge topology is settled.

---

## If a future agent is about to resume this work, read these first
In order:

1. `projects/_ops/mission-control-savepoint-for-tomorrow-2026-04-22.md`
2. `projects/_ops/mission-control-dashboard-live-rollout-plan-2026-04-21.md`
3. `projects/_ops/mission-control-auth-proxy-design-2026-04-22.md`
4. `projects/_ops/mission-control-dashboard-cutover-checklist-2026-04-22.md`
5. `projects/_ops/mission-control-pomerium-cutover-spec-2026-04-22.md`
6. `projects/_ops/mission-control-deployment-topology-spec-2026-04-22.md`
7. `projects/_ops/mission-control-pomerium-nginx-cutover-config-2026-04-22.md`
8. `docs/runbooks/mission-control-runtime-preview-runbook.md`

Then inspect:
- current `openclaw.json` live posture
- current host nginx situation
- current preview health/process state

---

## What must not be forgotten
This is the blunt version.

- The current preview stack is **not** the final live architecture.
- The browser currently receiving gateway auth via Mission Control is **not acceptable** for steady-state live.
- Filesystem/jsonl transcript hydration is **not acceptable** as the long-term live Chat bootstrap truth.
- OpenClaw trusted-proxy **rejects loopback-source proxy requests**.
- `gateway.controlUi.root` is **not** a host for the current Mission Control Next app.
- HTTPS is mandatory for browser mic/STT on `dashboard` and `lab`.
- The topology choice is now **Pomerium -> nginx -> upstreams**.
- `dashboard` = live, `lab` = durable sandbox, `preview` = temporary rollback lane.
- Screenshot proof beats inferred UI success.
- Fix the real requested dimension/chrome, not a proxy metric.
- Preview process control must be verified against real processes/ports, not just PID files.

---

## Bottom line for tomorrow-me
You are not starting from scratch.

You already know:
- the naming
- the auth direction
- the topology direction
- the key OpenClaw trusted-proxy constraint
- why the current preview architecture is insufficient
- which docs now carry the planning chain
- which commits mark the durable work already done

So tomorrow's job is not more abstract architecture debate.
Tomorrow's job is to turn the chosen direction into:
1. real deployment-specific config,
2. real Chat/runtime migration specs,
3. and then later real implementation.
