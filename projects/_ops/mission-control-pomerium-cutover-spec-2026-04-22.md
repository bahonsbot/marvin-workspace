# Mission Control Pomerium Cutover Spec — 2026-04-22

## Purpose
Define the recommended proxy/auth implementation for promoting Mission Control toward:
- `dashboard.motiondisplay.cloud` as the canonical live lane
- `lab.motiondisplay.cloud` as the future durable experimental lane
- optional `preview.motiondisplay.cloud` as a temporary preview / rollback lane

This spec assumes the recommended long-term direction:
- identity-aware reverse proxy
- OpenClaw `gateway.auth.mode = "trusted-proxy"`
- explicit `gateway.controlUi.allowedOrigins`
- no browser-side relay of gateway secrets through Mission Control

Related docs:
- `projects/_ops/mission-control-dashboard-live-rollout-plan-2026-04-21.md`
- `projects/_ops/mission-control-auth-proxy-design-2026-04-22.md`
- `projects/_ops/mission-control-dashboard-cutover-checklist-2026-04-22.md`

## Recommendation
Use a **Pomerium-first** design for the live edge.

### Why Pomerium is the best fit here
Mission Control is evolving into a real operator dashboard, not just a private preview site.
OpenClaw already supports `trusted-proxy` auth and its config/types explicitly fit identity-bearing headers such as:
- `x-forwarded-user`
- `x-remote-user`
- `x-pomerium-claim-email`

That makes an identity-aware reverse proxy the cleanest long-term fit.

### Why not plain nginx as the primary recommendation
nginx is perfectly usable for TLS termination and routing, but by itself it is not the strongest answer to:
- durable browser identity
- live dashboard auth posture
- trusted-proxy user assertions
- future split between `dashboard` and `lab`

So nginx is a good transport/router, but not the strongest identity authority by itself.

## Recommended stack

### Preferred stack
- **Pomerium** = authentication and user identity layer
- **nginx** = optional HTTP/WebSocket routing layer if needed for upstream organization
- **OpenClaw gateway** = runtime authority
- **Mission Control app** = product surface during migration

### Practical variants

#### Variant A — Pomerium direct to upstreams
Browser -> Pomerium -> upstream service

Use this if Pomerium alone can cleanly route the required dashboard/lab traffic and websocket behavior.

#### Variant B — Pomerium in front of nginx
Browser -> Pomerium -> nginx -> upstream services

Use this if you want nginx to remain the routing/control point for:
- multiple upstreams
- path routing
- websocket specifics
- operational familiarity

### Recommendation between A and B
If there is no strong existing nginx requirement, start by evaluating **Pomerium direct**.
If you already rely on nginx operationally or want cleaner route composition, use **Pomerium -> nginx**.

## Important OpenClaw constraint
OpenClaw's trusted-proxy authorization rejects loopback-source requests as trusted-proxy identity sources.

That means:
- do **not** fake trusted-proxy auth with a localhost-only header injection trick
- do **not** rely on a pretend local proxy hop that still appears as loopback to the gateway
- configure a real proxy layer with explicit trusted proxy IPs/CIDRs

This is important enough to treat as a design rule.

## Target hostname model
- `dashboard.motiondisplay.cloud` = canonical live lane
- `lab.motiondisplay.cloud` = future persistent sandbox lane
- `preview.motiondisplay.cloud` = optional temporary preview / rollback lane

## Authentication model

### OpenClaw target auth mode
Use:
- `gateway.auth.mode = "trusted-proxy"`

with:
- `gateway.auth.trustedProxy.userHeader`
- optional `gateway.auth.trustedProxy.requiredHeaders`
- `gateway.trustedProxies`
- explicit `gateway.controlUi.allowedOrigins`

### Recommended trusted user header
Preferred candidate:
- `x-pomerium-claim-email`

Fallback candidates if needed:
- `x-forwarded-user`
- `x-remote-user`

### Why `x-pomerium-claim-email` is attractive
- it matches the identity-aware proxy model naturally
- it is easy to reason about operationally
- it gives a clean operator identity primitive for allowlists later if needed

## Recommended OpenClaw config shape
This is conceptual, not copy-paste final config.

```json
{
  "gateway": {
    "auth": {
      "mode": "trusted-proxy",
      "trustedProxy": {
        "userHeader": "x-pomerium-claim-email",
        "requiredHeaders": [
          "x-forwarded-proto",
          "x-forwarded-host"
        ]
      }
    },
    "trustedProxies": [
      "<pomerium-proxy-ip-or-cidr>"
    ],
    "controlUi": {
      "allowedOrigins": [
        "https://dashboard.motiondisplay.cloud",
        "https://lab.motiondisplay.cloud"
      ]
    }
  }
}
```

## Live hardening rules
For the live target posture:
- remove `gateway.controlUi.allowInsecureAuth`
- remove `gateway.controlUi.dangerouslyDisableDeviceAuth`
- remove `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback` unless there is a very specific documented reason
- do not leave token auth configured in parallel with trusted-proxy mode
- firewall direct gateway port access so only the trusted edge can reach it

## Routing model

## `dashboard.motiondisplay.cloud`
This should point to the live Mission Control experience under the trusted identity edge.

### During intermediate phase
It may still reach the current Mission Control app while deeper Chat/runtime migration is underway.

### Final direction
Chat/session/runtime behavior should align with gateway-native truth instead of depending on preview-only bridge architecture.

## `lab.motiondisplay.cloud`
This should use the same broad auth/proxy shape as live, even if the app/runtime behind it is more experimental.

### Design rule
Do not make `lab` a sloppy exception lane.
It should be experimental in product behavior, not broken in auth or browser posture.

## `preview.motiondisplay.cloud`
Keep only as a temporary preview or rollback lane if it still provides value during migration.

## WebSocket expectations
The chosen edge must correctly support websocket upgrades for:
- Control UI websocket behavior
- Mission Control Chat/runtime behavior during any intermediate phase
- future live dashboard behavior after Chat migration

### Required proxy behavior
- preserve websocket upgrades
- preserve the intended browser origin behavior
- preserve the trusted user headers on the HTTP surface where OpenClaw expects them
- avoid any design that depends on browser-visible gateway secrets

## TLS and secure-context requirements
Both `dashboard` and `lab` must be valid HTTPS origins.

Why:
- browser microphone capture depends on secure context
- Mission Control already has browser STT support
- live operator flows should not depend on localhost exceptions

## Recommended implementation sequence

## Step 1 — Build the edge around `dashboard`
- provision `dashboard.motiondisplay.cloud` in Pomerium
- define upstream route to the current Mission Control live candidate
- confirm browser auth challenge and successful authenticated access
- confirm websocket upgrade support

## Step 2 — Configure OpenClaw for trusted-proxy mode
- set `gateway.auth.mode = "trusted-proxy"`
- set `gateway.auth.trustedProxy.userHeader = "x-pomerium-claim-email"`
- set `gateway.auth.trustedProxy.requiredHeaders`
- set `gateway.trustedProxies` to the real proxy IP/CIDR only
- set explicit `gateway.controlUi.allowedOrigins`
- remove dangerous preview-only control-ui auth toggles from the live design

## Step 3 — Validate browser/runtime behavior
- verify `dashboard.motiondisplay.cloud` is HTTPS
- verify `window.isSecureContext === true`
- verify authenticated access succeeds through the proxy
- verify websocket behavior survives through the edge
- verify mic/STT is no longer blocked by origin insecurity

## Step 4 — Keep preview as rollback while migration continues
- keep `preview.motiondisplay.cloud` available during the transition period
- do not describe preview as the permanent sandbox
- reserve `lab.motiondisplay.cloud` for the durable sandbox lane

## Step 5 — Introduce `lab.motiondisplay.cloud`
- add `lab` to the same auth/proxy pattern
- add `https://lab.motiondisplay.cloud` to `gateway.controlUi.allowedOrigins` when needed
- keep it explicitly non-canonical

## Step 6 — Migrate Chat/runtime off preview bridge assumptions
- remove browser token relay behavior
- remove filesystem-first transcript hydration for live
- remove permanent dependence on preview proxy + sidecar in the live lane
- converge on gateway-native chat/session/runtime truth

## Cutover acceptance criteria
A Pomerium-based cutover is only accepted when:
- `dashboard.motiondisplay.cloud` is HTTPS and browser-secure
- OpenClaw is running with the approved trusted-proxy posture
- only real trusted proxy IPs are allowlisted in `gateway.trustedProxies`
- direct gateway port access is not public
- browser does not need Mission Control to relay gateway auth tokens
- Chat/session behavior works under the intended live auth boundary
- rollback to preview remains possible until confidence is high

## nginx-only fallback
If Pomerium cannot be adopted yet, nginx-only is the practical fallback.

### In that case
- nginx terminates TLS
- nginx handles websocket forwarding
- nginx protects the app with a temporary auth model
- but this should be treated as an intermediate deployment, not the best final answer

### Recommendation if forced into nginx-only first
- still keep the planning centered on eventual trusted-proxy alignment
- do not turn nginx-only browser auth workarounds into permanent architecture
- do not keep browser-side gateway token relay in the long-term live design

## Immediate next decisions
1. Approve **Pomerium-first** as the target edge/auth stack
2. Confirm whether nginx remains in the picture for routing convenience or not
3. Approve `x-pomerium-claim-email` as the preferred trusted user header unless infrastructure constraints suggest another header
4. Decide whether `dashboard.motiondisplay.cloud` launches first as a temporary intermediate over the current app, or waits for the first Chat/runtime migration slice

## Bottom line
My recommendation is:
- **Pomerium-first for identity and auth**
- **nginx only as a routing helper if needed**
- **OpenClaw trusted-proxy mode as the live target**
- **`dashboard.motiondisplay.cloud` as canonical**
- **`lab.motiondisplay.cloud` as the durable sandbox lane**

That gives the cleanest long-term security story and the best alignment with where Mission Control is clearly heading.
