# Mission Control Deployment Topology Spec — 2026-04-22

## Decision
Use **Pomerium -> nginx -> upstreams** as the recommended deployment topology for Mission Control live rollout.

This is the firm recommendation for the current situation.

## Why this wins
If we were starting from zero, **Pomerium direct** would be worth serious consideration.
But for the stack you actually have today, **Pomerium in front of nginx** is the better operational choice.

Reason:
- you already have host nginx in the picture for Mission Control preview routing
- Mission Control is still a dynamic Next.js app with websocket-sensitive behavior
- rollout will likely involve temporary coexistence between:
  - current Mission Control app routing
  - future gateway-native chat/runtime flows
  - optional preview rollback lane
  - future lab lane
- nginx is a good place to keep that route composition stable while Pomerium becomes the identity layer

So the answer is:
- **best architectural identity layer**: Pomerium
- **best practical topology for this deployment**: **Pomerium -> nginx**

## Why not plain nginx only
nginx alone is the best simple fallback, but not the best final answer.

It is weaker for this specific goal because:
- OpenClaw trusted-proxy mode is designed for an identity-aware proxy model
- you want a durable live lane plus a future lab lane
- you want to retire browser token hacks and preview-only auth workarounds
- this is moving toward a real operator dashboard, not a private dev site

So nginx-only is acceptable as an intermediate shortcut, but not my recommended target.

## Why not Pomerium direct right now
Pomerium direct is cleaner on paper, but I would not make it the first recommendation here.

Main reasons:
- you already rely on host nginx routing for preview reachability
- current Mission Control and future dashboard cutover will likely need route-by-host and possibly route-by-path flexibility during migration
- nginx gives you a familiar and explicit place to manage:
  - upstream selection
  - websocket forwarding behavior
  - temporary coexistence between Mission Control app routes and future gateway-native surfaces
  - rollback switching
- using nginx as the stable routing layer reduces how much you need to change at once

My view:
- **Pomerium direct** is the cleaner future simplification candidate
- **Pomerium -> nginx** is the safer deployment topology now

## Topology

### Recommended live path
Browser
-> Pomerium
-> nginx
-> upstream service

### Initial likely upstreams
During the migration period nginx should be able to route to at least these classes of upstream:
- Mission Control Next app / preview-style app surface
- future gateway-native dashboard/control-ui path
- optional preview rollback target
- future lab target

## Trust boundary design

### Pomerium role
Pomerium is the authentication and identity authority.
It should:
- terminate or sit behind TLS according to your final edge shape
- challenge the user
- inject the trusted identity header
- pass only authenticated traffic to nginx

### nginx role
nginx is the stable routing layer.
It should:
- forward websocket upgrades correctly
- preserve the required forwarded headers
- route by hostname and later by path if needed
- keep rollback and migration routing understandable

### OpenClaw role
OpenClaw gateway remains the runtime authority.
It should:
- use `gateway.auth.mode = "trusted-proxy"` in the live target posture
- trust only the real proxy IPs/CIDRs
- enforce explicit `gateway.controlUi.allowedOrigins`
- stop relying on dangerous preview/debug auth toggles

## Critical OpenClaw constraint
OpenClaw trusted-proxy mode rejects loopback-source trusted-proxy requests.

That matters a lot.

It means the final live request path into the gateway cannot be a fake localhost header trick.
The gateway must see a real trusted proxy source address, not loopback.

## Implication for your current containerized setup
Current audited posture shows:
- Mission Control preview is reachable through host nginx to container-side port `3005`
- gateway is still configured with `gateway.bind = loopback`

That means:
- the host can currently reach Mission Control preview
- the host cannot use trusted-proxy mode against the gateway until the gateway becomes reachable on a non-loopback path appropriate for the proxy topology

So part of the live cutover work is:
- changing the gateway exposure model away from container-local loopback-only behavior for the live route
- while still keeping direct public access blocked

## Practical gateway reachability rule
For the live trusted-proxy design:
- the gateway must be reachable from nginx/Pomerium over a non-loopback network path
- but it must **not** be directly public

That usually means one of these:
- gateway listens on a container/network-reachable interface, while firewall and proxy policy keep it private
- or gateway is moved behind an internal-only network path that nginx can reach

## Recommended trusted-proxy header
Use:
- `x-pomerium-claim-email`

Fallbacks only if required by infrastructure reality:
- `x-forwarded-user`
- `x-remote-user`

## Recommended OpenClaw live config direction
Conceptual only:

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
      "<real-proxy-ip-or-cidr>"
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

## Live hardening requirements
The live target posture should remove:
- `gateway.controlUi.allowInsecureAuth`
- `gateway.controlUi.dangerouslyDisableDeviceAuth`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback` unless absolutely required and documented

And should enforce:
- no shared token auth in parallel with trusted-proxy mode
- direct gateway port not public
- explicit `allowedOrigins`
- narrow `trustedProxies`

## Hostname routing model

### `dashboard.motiondisplay.cloud`
Canonical live lane.

Recommended early use:
- authenticated through Pomerium
- routed by nginx to the approved live upstream
- initially may still point to the current Mission Control app while Chat/runtime migration is in progress

### `lab.motiondisplay.cloud`
Durable experimental lane.

Recommended shape:
- same auth architecture as live
- same secure-context expectations as live
- clearly non-canonical product lane

### `preview.motiondisplay.cloud`
Temporary preview / rollback lane only.

Keep during migration if useful.
Do not treat it as the future permanent sandbox name.

## Phase-by-phase topology intent

### Phase 1 — Edge stabilization
Goal:
- put `dashboard.motiondisplay.cloud` behind Pomerium and nginx
- get valid HTTPS and browser secure context
- keep current app reachable in a controlled way

Traffic shape:
Browser -> Pomerium -> nginx -> Mission Control app

### Phase 2 — Live auth posture
Goal:
- switch OpenClaw to trusted-proxy target posture
- make gateway reachable through private proxy path, not public exposure
- stop relying on preview/debug auth flags

Traffic shape:
Browser -> Pomerium -> nginx -> private gateway/app paths

### Phase 3 — Chat/runtime migration
Goal:
- stop depending on preview-only bridge assumptions
- reduce or eliminate browser-side gateway token relay
- move toward gateway-native runtime truth

At this phase nginx becomes especially useful as the controlled routing layer while traffic patterns change.

### Phase 4 — Steady-state live topology
Goal:
- dashboard and lab both sit behind the same identity-aware proxy pattern
- preview becomes optional or retired
- gateway-native truth wins for runtime-sensitive flows

## WebSocket requirements
The recommended topology must correctly handle websocket upgrades for:
- current Mission Control app behavior during migration
- future gateway-native dashboard/control-ui behavior

Why nginx stays useful here:
- nginx is a very predictable websocket router
- it gives you explicit control during the messy migration window
- it reduces the odds of turning Pomerium routing changes into an all-at-once debugging session

## Browser secure-context requirement
Both `dashboard` and `lab` must be valid HTTPS origins.

Why:
- browser mic capture depends on secure context
- Mission Control already has STT support waiting on browser eligibility
- live operator UX should not depend on localhost exceptions

## Practical recommendation on nginx's role
Keep nginx in the path for now.

Not because nginx is the better identity solution.
Because it is the better **migration stabilizer**.

It should own:
- upstream routing
- websocket forwarding details
- migration-time path/host split logic
- rollback switching

Pomerium should own:
- access control
- identity
- user assertion header
- login/session challenge behavior

## When to simplify later
After the live topology is stable and Chat/runtime migration is further along, reassess whether nginx is still earning its place.

Possible later simplification:
- move from `Pomerium -> nginx -> upstreams`
- to `Pomerium -> upstreams`

But do that later, not during the current cutover.

## Exact recommendation
Use:
- **Pomerium in front of nginx**
- **OpenClaw trusted-proxy mode**
- **`x-pomerium-claim-email`** as the preferred trusted user header
- **`dashboard.motiondisplay.cloud`** as the live lane
- **`lab.motiondisplay.cloud`** as the durable experimental lane
- **`preview.motiondisplay.cloud`** as temporary rollback/preview only

## Immediate next implementation doc after this
This next artifact is now created:
- `projects/_ops/mission-control-pomerium-nginx-cutover-config-2026-04-22.md`

It should be used as the configuration-oriented bridge doc covering:
- exact Pomerium route intent
- exact nginx vhost/upstream structure guidance
- exact OpenClaw config mutation intent for trusted-proxy mode
- firewall/network expectations
- rollout and rollback sequence guidance

## Bottom line
If you want the short version:
- **Pomerium** is the right auth brain
- **nginx** should stay as the routing spine for this migration
- **Pomerium -> nginx** is the best practical topology for your current stack
