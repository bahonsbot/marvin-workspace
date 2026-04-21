# Mission Control Pomerium + nginx Cutover Config — 2026-04-22

## Purpose
Turn the rollout, auth/proxy, and topology decisions into a configuration-oriented cutover document for the recommended live edge:

- `dashboard.motiondisplay.cloud` = canonical live Mission Control
- `lab.motiondisplay.cloud` = durable experimental lane
- `preview.motiondisplay.cloud` = temporary preview / rollback lane only if still useful

This document is the bridge between planning and implementation.
It is intentionally closer to real config and network shape than the earlier strategy docs.

Related docs:
- `projects/_ops/mission-control-dashboard-live-rollout-plan-2026-04-21.md`
- `projects/_ops/mission-control-auth-proxy-design-2026-04-22.md`
- `projects/_ops/mission-control-dashboard-cutover-checklist-2026-04-22.md`
- `projects/_ops/mission-control-pomerium-cutover-spec-2026-04-22.md`
- `projects/_ops/mission-control-deployment-topology-spec-2026-04-22.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`

## Locked decisions
These are now the working assumptions unless Philippe explicitly changes them.

1. Do **not** promote the current preview stack unchanged and call it live.
2. Use **Pomerium -> nginx -> upstreams** as the recommended live topology.
3. Use `gateway.auth.mode = "trusted-proxy"` as the preferred long-term OpenClaw auth posture.
4. Use `x-pomerium-claim-email` as the preferred trusted user header unless infrastructure reality forces a different header.
5. Keep `dashboard.motiondisplay.cloud` as the canonical live lane.
6. Keep `lab.motiondisplay.cloud` as the durable experimental lane.
7. Keep `preview.motiondisplay.cloud` only as a temporary preview / rollback lane during migration.

## Critical facts discovered today
These are the details that materially change the deployment design.

### 1. OpenClaw trusted-proxy rejects loopback source addresses
OpenClaw's trusted-proxy authorization explicitly rejects loopback-source proxy requests.

Implication:
- do **not** design trusted-proxy around `127.0.0.1` or localhost header injection
- a same-host reverse proxy talking to a loopback-bound gateway will fail trusted-proxy auth if the gateway sees the proxy request as loopback
- the gateway must see a **real non-loopback proxy source address**

### 2. `gateway.controlUi.root` is not a host for the current Mission Control app
The current Mission Control app is a dynamic Next.js app with server routes and app APIs.
OpenClaw's `gateway.controlUi.root` serves static Control UI assets, not a generic SSR host.

Implication:
- do not try to "make Mission Control live" by pointing `gateway.controlUi.root` at the current Next app
- live rollout must treat Mission Control as its own application surface during migration

### 3. Current Mission Control preview is still preview-specific
Current audited preview shape:
- Next app: `127.0.0.1:3007`
- preview proxy: `:3005`
- WS sidecar: `127.0.0.1:3006`
- app auth: Mission Control Basic Auth
- browser runtime: bridge token plus possible gateway session token relay
- transcript bootstrap: filesystem/jsonl hydration

Implication:
- the current preview stack is acceptable as a private preview lane
- it is not the final live architecture for `dashboard`

### 4. Browser mic/STT requires secure context
Mission Control browser STT is already implemented, but microphone capture requires `window.isSecureContext === true`.

Implication:
- valid HTTPS on `dashboard` and `lab` is mandatory
- the fast live milestone still matters even before the deeper Chat/runtime migration finishes

## Recommended topology

```text
Browser
  -> Pomerium (identity and auth)
    -> nginx (routing spine)
      -> upstreams
         - Mission Control Next app
         - OpenClaw gateway / Control UI surface
         - optional preview rollback target
         - future lab target
```

## Role split

### Pomerium owns
- browser authentication
- identity challenge/session
- trusted identity header injection
- coarse route access policy
- public HTTPS-facing identity behavior

### nginx owns
- stable host/path routing during migration
- websocket upgrade forwarding
- upstream switching and rollback control
- coexistence between current Mission Control app paths and future gateway-native runtime paths

### OpenClaw gateway owns
- runtime truth
- trusted-proxy auth validation
- control-ui origin policy
- websocket/session/chat authority
- long-term live dashboard auth/runtime boundary

## Recommended network shape
The live topology should avoid loopback proxying into the gateway.

### Required rule
The gateway must be reachable from nginx/Pomerium over a **private non-loopback path**, while remaining **non-public**.

### Good shape
- Pomerium and nginx run on a private network path that can reach the gateway
- the gateway listens on a non-loopback private interface or private container/network address
- firewall rules prevent direct public access to the gateway port
- only the trusted proxy IPs/CIDRs appear in `gateway.trustedProxies`

### Bad shape
- Pomerium or nginx forwarding to a loopback-bound gateway in a way that leaves `remoteAddress` as loopback
- public direct access to the gateway port
- host-header fallback or insecure auth left enabled as steady-state live behavior

## Preferred deployment pattern
For the current environment, the recommended practical pattern is:

- Pomerium and nginx remain separate logical layers
- nginx stays in the path because it is already operationally relevant and is the safer migration stabilizer
- the gateway is made reachable to nginx/Pomerium over a non-loopback private path
- `dashboard` initially points to the current Mission Control app through the new auth edge
- later phases migrate Chat/runtime away from preview-only bridge assumptions

## Domain-to-upstream model

### `dashboard.motiondisplay.cloud`
Initial target:
- current Mission Control app behind the new Pomerium -> nginx edge

Later target:
- Mission Control surface with Chat/runtime aligned to gateway-native truth

### `lab.motiondisplay.cloud`
Initial target:
- no public launch required yet
- reserve hostname and config posture now so the lane is planned correctly

Later target:
- lab-specific Mission Control deployment or controlled experimental upstream
- same broad HTTPS/auth shape as live

### `preview.motiondisplay.cloud`
During migration:
- keep as rollback / rehearsal lane if it remains useful
- current preview stack may continue to live here temporarily

End state:
- optional or retired
- not the permanent sandbox identity

## OpenClaw target config shape
This is conceptual and still needs deployment-specific values.

```json
{
  "gateway": {
    "bind": "<non-loopback-private-bind-mode-or-host>",
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
      "<real-pomerium-or-nginx-proxy-ip-or-cidr>"
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

## OpenClaw config changes required from current posture
Current audited posture is preview/debug shaped.
Live cutover needs these changes.

### Must change
- move away from loopback-only gateway reachability for trusted-proxy traffic
- switch `gateway.auth.mode` to `trusted-proxy`
- set `gateway.auth.trustedProxy.userHeader`
- set narrow `gateway.trustedProxies`
- keep `gateway.controlUi.allowedOrigins` explicit and exact

### Must remove from steady-state live posture
- `gateway.controlUi.allowInsecureAuth`
- `gateway.controlUi.dangerouslyDisableDeviceAuth`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback` unless there is a documented unavoidable reason
- any browser-facing Mission Control relay of gateway session tokens

### Must not do
- do not run token auth in parallel with trusted-proxy mode
- do not rely on localhost proxy hops for trusted-proxy auth
- do not expose the direct gateway port publicly

## Pomerium configuration intent
This section is illustrative and should become the basis for the real Pomerium config.

### Required route behavior
For `dashboard.motiondisplay.cloud`:
- authenticate the user
- forward to nginx internal upstream
- pass identity headers to the upstream chain
- ensure websocket upgrades work through the route

For `lab.motiondisplay.cloud`:
- same auth shape as `dashboard`
- separate route and policy so lab stays clearly distinct

### Preferred identity header exposure
Use Pomerium identity forwarding so the upstream chain can provide:
- `X-Pomerium-Claim-Email`

If claim-header mapping is required explicitly, map the authenticated email claim to the preferred trusted header.

### Pomerium route expectations
Each browser-facing lane should define:
- external `from` URL
- internal `to` URL pointing at nginx
- authenticated access policy
- pass-identity behavior
- websocket-safe routing

## nginx configuration intent
This is the routing spine, not the primary auth authority.

### nginx should do all of the following
- preserve `Host`
- preserve `X-Forwarded-For`
- preserve `X-Forwarded-Proto`
- preserve `X-Forwarded-Host`
- preserve Pomerium's trusted identity header to the downstream that needs it
- forward websocket upgrades cleanly
- route by hostname and later by path as migration requires

### nginx upstream classes to plan for
At minimum, define upstream blocks or equivalent routing targets for:
- current Mission Control app
- future lab Mission Control app
- gateway / Control UI target if needed during transition
- optional preview rollback target

### nginx websocket essentials
The live nginx config should include the standard websocket upgrade path handling for any routes that carry Chat/runtime traffic.

That means preserving:
- `Upgrade`
- `Connection`
- host/proto forwarding

## Recommended phased route shape

### Phase 1 — secure live shell
Traffic:
- Browser -> Pomerium -> nginx -> current Mission Control app

Goal:
- get `dashboard` onto real HTTPS
- get secure browser context
- get user auth and routing onto the new edge
- keep current preview working separately

### Phase 2 — gateway trusted-proxy posture
Traffic:
- Browser -> Pomerium -> nginx -> gateway / app over private non-loopback path

Goal:
- switch gateway to trusted-proxy posture
- remove preview-only auth assumptions from the live lane
- prove origin and trusted-proxy behavior under real browser traffic

### Phase 3 — Chat/runtime convergence
Traffic:
- Browser -> Pomerium -> nginx -> final live runtime surfaces

Goal:
- stop relaying gateway auth into the browser through Mission Control
- stop using filesystem-first transcript bootstrap for live
- remove permanent dependency on preview-origin proxy and WS sidecar in the live lane

## Implementation sequence

### Step 0 — Back up current live-adjacent config
Before touching the live route:
- back up current host nginx config relevant to preview
- back up the current `openclaw.json`
- capture the currently working preview process state and health behavior
- preserve rollback instructions alongside the new live config work

### Step 1 — Stand up Pomerium in front of nginx
- define `dashboard.motiondisplay.cloud` in Pomerium
- point it at nginx internal upstream
- ensure nginx can already route to the current Mission Control app
- verify authenticated browser access works

### Step 2 — Verify secure browser context
- verify valid HTTPS certificate on `dashboard`
- verify browser secure context is true
- verify microphone is no longer blocked by insecure origin

### Step 3 — Prepare gateway private reachability
- determine the real non-loopback private address/path nginx or Pomerium will use to reach the gateway
- ensure the gateway is not publicly exposed directly
- ensure firewall rules restrict access to the trusted proxy path

### Step 4 — Apply gateway trusted-proxy config
- set `gateway.auth.mode = "trusted-proxy"`
- set `gateway.auth.trustedProxy.userHeader = "x-pomerium-claim-email"`
- set any required headers
- set exact `gateway.trustedProxies`
- set exact `gateway.controlUi.allowedOrigins`
- remove dangerous preview-only control-ui auth toggles from the live posture

### Step 5 — Validate live auth/origin behavior
- verify browser auth works through Pomerium
- verify the gateway accepts trusted-proxy requests from the real proxy address
- verify no loopback-source rejection remains in the live path
- verify websocket upgrades still work

### Step 6 — Launch `dashboard` as the live shell
- point `dashboard` at the approved live upstream chain
- keep `preview` available as rollback during the early window
- document the exact rollback trigger conditions before public cutover

### Step 7 — Migrate Chat/runtime off preview-only behavior
- stop browser-side gateway token relay
- replace filesystem/jsonl transcript hydration with gateway-native history/session truth for live
- reduce or remove permanent live dependence on preview-origin proxy + WS sidecar

### Step 8 — Add `lab` on the same auth model
- create lab route through the same Pomerium -> nginx pattern
- keep lab HTTPS and secure-context valid
- keep lab explicitly non-canonical

## Validation checklist
A configuration cutover is not accepted until all of these are true.

### Edge and browser
- `dashboard.motiondisplay.cloud` serves valid HTTPS
- browser secure context is true
- browser auth challenge succeeds through Pomerium
- authenticated route reaches nginx and the intended upstream

### Gateway auth
- gateway runs in trusted-proxy mode
- trusted proxy user header is present and correct
- `gateway.trustedProxies` only includes the real proxy source addresses
- no loopback proxy path is relied on for trusted-proxy identity
- no direct public gateway port access exists

### Runtime behavior
- websocket upgrade survives through Pomerium and nginx
- live dashboard Chat does not require Mission Control to relay gateway session tokens into the browser in steady state
- session/history behavior aligns to the intended migration phase

### Rollback safety
- `preview.motiondisplay.cloud` still works or an equivalent rollback lane exists
- rollback trigger conditions are documented before the cutover window

## Exact deployment-specific questions to answer before implementation
These still need real environment inspection.

1. Where will Pomerium run?
   - host service
   - separate container
   - same Docker network as nginx and the gateway/app

2. What exact non-loopback source address will the gateway see for trusted-proxy traffic?

3. What exact private address will nginx use for the gateway once loopback-only exposure is removed?

4. Will `dashboard` first point to the current Mission Control app as a temporary shell, or wait for the first Chat/runtime migration slice?

5. Will `lab` be a separate Mission Control deployment, or the same app pointed at a different runtime/environment?

## What should happen next after this doc
The next implementation-oriented step should be environment-specific, not more abstract planning.

Recommended next artifact:
- a **deployment-specific config draft** with the actual current host nginx layout, actual container/network addresses, actual Pomerium deployment mode, actual OpenClaw config delta, and actual rollback commands

After that:
- a **Chat/runtime migration spec** by file and function so the live dashboard stops depending on preview-only browser token relay and JSONL hydration

## Bottom line
This is the practical config posture to aim for:

- **Pomerium** handles identity and authenticated edge access
- **nginx** stays in the path as the routing spine during migration
- **OpenClaw trusted-proxy** becomes the live auth model
- **dashboard** becomes the live lane
- **lab** becomes the durable experimental lane
- **preview** remains temporary rollback only
- the gateway must be reachable on a **private non-loopback path**, not a localhost trick
