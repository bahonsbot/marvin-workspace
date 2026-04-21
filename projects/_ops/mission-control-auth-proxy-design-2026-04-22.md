# Mission Control Auth and Proxy Design — 2026-04-22

## Purpose
Turn the live rollout plan into a concrete edge/auth design for:
- `dashboard.motiondisplay.cloud` as the canonical live Mission Control domain
- `lab.motiondisplay.cloud` as the future durable experimental lane
- optional `preview.motiondisplay.cloud` as a temporary preview, release-candidate, or rollback lane

This document focuses on:
- hostname roles
- reverse-proxy topology
- OpenClaw gateway auth mode
- Control UI origin policy
- Chat/WebSocket implications
- the safest intermediate path from the current preview stack

Related docs:
- `projects/_ops/mission-control-dashboard-live-rollout-plan-2026-04-21.md`
- `projects/_ops/mission-control-dashboard-cutover-checklist-2026-04-22.md`
- `projects/_ops/mission-control-live-readiness-plan-2026-04-11.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`

## Recommended hostname strategy

### Canonical roles
- `dashboard.motiondisplay.cloud` = live Mission Control
- `lab.motiondisplay.cloud` = persistent experimental / sandbox lane
- `preview.motiondisplay.cloud` = optional short-lived preview or rollback lane

### Why this naming is preferable
- `dashboard` clearly signals the operator-facing canonical surface
- `lab` communicates experimentation without implying near-release status
- `preview` is better reserved for temporary validation or cutover rehearsal, not the long-term sandbox identity

## Current-state reminder
Current Mission Control is still a separate Next.js app with:
- its own Basic Auth middleware
- a preview-origin HTTP proxy
- a WS sidecar
- browser bridge-token flow
- optional browser exposure of a gateway auth token
- filesystem-based session/transcript hydration

That stack is acceptable for a private preview lane, but it is not the right final live architecture for `dashboard.motiondisplay.cloud`.

## Design goals

### Goals
1. HTTPS on every browser-facing lane
2. one clear auth story per lane
3. no browser-side relay of gateway secrets through Mission Control app APIs
4. gateway remains the runtime authority for Chat/session truth
5. future lab lane is safe to operate without confusing it with canonical live
6. preserve rollback options during migration

### Non-goals
- final detailed nginx config in this doc
- Chat migration internals by component, those need their own spec
- broad UI/product changes

## Recommended lane model

## Lane 1: `dashboard.motiondisplay.cloud`
This should become the canonical operator surface.

### Intended posture
- public HTTPS
- stable auth boundary
- stable websocket behavior
- no preview-only bridge layers in the final state
- Chat aligned to gateway-native runtime truth

### Recommendation
Treat this lane as the only lane allowed to become canonical runtime truth.

## Lane 2: `lab.motiondisplay.cloud`
This should become the durable experimental lane.

### Intended posture
- public HTTPS
- clearly labeled non-canonical environment
- may temporarily tolerate more product churn
- should still use a safe auth model, not a sloppy one
- should not silently depend on dangerous gateway flags forever

### Recommendation
Use `lab` for feature work, integration tests, and high-change product experiments before promotion toward dashboard.

## Lane 3: `preview.motiondisplay.cloud`
This should not remain the permanent sandbox name.

### Preferred use
- short-lived release candidate
- rollback target during cutovers
- staging validation for a pending deployment
- temporary migration bridge while dashboard/lab settle

### Recommendation
Keep only if it provides operational value. Otherwise retire it once `dashboard` and `lab` are both established.

## Recommended edge topology

## Target shape
The safest long-term topology is:

```text
Browser
  -> HTTPS reverse proxy / identity-aware edge
    -> OpenClaw gateway (runtime authority)
    -> Mission Control app/services under the same trusted boundary
```

### Key principle
The reverse proxy should be the place that:
- terminates TLS
- authenticates the user
- forwards only trusted identity headers
- presents a consistent browser origin

The gateway should then trust only that proxy, not arbitrary clients.

## Strong recommendation for live auth mode

### Preferred live auth mode
Use:
- `gateway.auth.mode = "trusted-proxy"`

with:
- narrow `gateway.trustedProxies`
- configured `gateway.auth.trustedProxy.userHeader`
- optional `requiredHeaders`
- explicit `gateway.controlUi.allowedOrigins`

### Why
This is the cleanest path to a live browser-facing deployment because it avoids Mission Control inventing its own browser-side gateway auth workaround.

### Important OpenClaw constraints confirmed by audit
Trusted-proxy mode requires:
- `gateway.trustedProxies` to contain at least one real proxy IP/CIDR
- `gateway.auth.trustedProxy.userHeader` to be set
- token auth and trusted-proxy are mutually exclusive
- direct gateway port exposure should be blocked by firewall when using trusted-proxy mode

### Example header strategy
The exact header depends on the edge system, but likely candidates are:
- `x-forwarded-user`
- `x-remote-user`
- `x-pomerium-claim-email`

The edge must be the only source allowed to send those headers.

## Reverse proxy responsibilities
The browser-facing reverse proxy should be responsible for:
- TLS termination
- redirecting HTTP to HTTPS
- identity/auth challenge before upstream access
- forwarding `Host`, `X-Forwarded-For`, and any required trusted user header
- websocket upgrade support
- route separation for live vs lab
- ensuring direct gateway port access is not publicly exposed

## OpenClaw gateway responsibilities
The gateway should be responsible for:
- websocket/session/chat/runtime truth
- Control UI origin enforcement
- device/auth policy enforcement
- trusted proxy verification
- runtime API correctness

## Control UI origin policy

### Live dashboard
For `dashboard.motiondisplay.cloud`, configure:
- explicit `gateway.controlUi.allowedOrigins`
- full origins only, for example `https://dashboard.motiondisplay.cloud`

### Future lab lane
When `lab.motiondisplay.cloud` is ready, add it explicitly as well.

### Recommendation
Use exact origins, not wildcards.
Do not rely on `dangerouslyAllowHostHeaderOriginFallback` in the steady-state live design.

## Dangerous flags posture
The following current preview/debug settings should be treated as temporary and removed from live posture:
- `gateway.controlUi.allowInsecureAuth`
- `gateway.controlUi.dangerouslyDisableDeviceAuth`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback`

### Why
Audit output makes clear these are break-glass settings, not the correct permanent live setup.

## Browser secure-context requirements
Both `dashboard` and `lab` should be HTTPS if they are expected to support:
- microphone capture
- STT
- future browser-sensitive features

This is especially important because Mission Control already has working browser STT plumbing, and `useSpeechToText` explicitly depends on secure context.

## Recommended deployment patterns

## Option A — Best long-term: trusted-proxy live model

### Shape
- `dashboard.motiondisplay.cloud` and `lab.motiondisplay.cloud` both fronted by the same hardened reverse proxy pattern
- gateway uses `trusted-proxy` mode
- explicit allowed origins per browser lane
- Mission Control Chat migrates toward gateway-native transport/auth behavior

### Pros
- closest to OpenClaw's intended live browser model
- avoids browser token injection through Mission Control
- cleanest long-term security posture
- simplest story for future operator identity

### Cons
- requires deliberate proxy/auth setup
- requires Chat/runtime migration work, not just DNS/TLS swap

### Recommendation
This is the target state.

## Option B — Intermediate live milestone: current app behind HTTPS, but temporary

### Shape
- move current Mission Control app to `dashboard.motiondisplay.cloud`
- keep preview-style proxy layers temporarily
- use this only as a short-lived milestone while Chat/runtime migration continues

### Pros
- fastest path to HTTPS and secure browser context
- can unblock mic/STT quickly
- lowers product friction while deeper migration proceeds

### Cons
- still carries preview auth/runtime debt
- still keeps multiple auth layers and bridge assumptions alive
- risks normalizing the wrong architecture if left in place too long

### Recommendation
Acceptable only as an explicitly temporary intermediate phase.

## Option C — Token-auth live model without trusted-proxy

### Shape
- gateway remains token/password based
- Mission Control stops relaying gateway auth tokens through browser-visible APIs
- browser uses the normal Control UI auth/settings flow instead

### Pros
- less proxy/auth redesign than trusted-proxy
- safer than current preview bridge-token plus gateway-token layering

### Cons
- less elegant long-term than trusted-proxy for a polished live operator surface
- may still leave a less unified browser auth experience

### Recommendation
Only use if trusted-proxy is not yet feasible.

## Recommended lane-specific behavior

## `dashboard.motiondisplay.cloud`
- canonical live lane
- strictest auth and runtime correctness
- no experimental break-glass defaults
- used for operator truth

## `lab.motiondisplay.cloud`
- durable sandbox lane
- can host unfinished product behavior
- should still be HTTPS and use the same general auth architecture
- may point to a separate Mission Control deployment or separate app/runtime boundary
- should never be described as canonical truth

## `preview.motiondisplay.cloud`
- optional short-lived validation lane only
- keep during migration if helpful
- do not anchor long-term environment design around it

## Operational recommendation for lab
Even though `lab` is experimental, do not make it sloppy.
Use the same basic auth/proxy model shape as live, with environment-specific isolation.
That way feature testing happens under realistic browser, proxy, websocket, and secure-context conditions.

## Immediate decisions needed

### Decision 1
Approve the hostname model:
- `dashboard.motiondisplay.cloud`
- `lab.motiondisplay.cloud`
- optional `preview.motiondisplay.cloud`

### Decision 2
Choose the target auth direction:
- preferred: trusted-proxy
- fallback: token/password without browser token relay

### Decision 3
Decide whether `dashboard.motiondisplay.cloud` should first launch as:
- a temporary intermediate HTTPS deployment of the current app, or
- only after the first Chat/runtime migration slice is ready

## Recommended next work item after this doc
Create a concrete implementation checklist covering:
- reverse proxy provider / topology
- exact trusted proxy CIDRs
- exact trusted user header name
- exact `gateway.controlUi.allowedOrigins` values for dashboard and future lab
- firewall rule expectations
- websocket forwarding expectations
- rollout and rollback sequence

## Bottom line
Use:
- `dashboard.motiondisplay.cloud` for live
- `lab.motiondisplay.cloud` for the future sandbox lane
- `preview.motiondisplay.cloud` only if it still earns its keep as a temporary preview or rollback lane

And for the actual live auth architecture, prefer:
- HTTPS at the edge
- reverse-proxy authentication
- `gateway.auth.mode = trusted-proxy`
- explicit `gateway.controlUi.allowedOrigins`
- no browser-side relay of gateway secrets through Mission Control
