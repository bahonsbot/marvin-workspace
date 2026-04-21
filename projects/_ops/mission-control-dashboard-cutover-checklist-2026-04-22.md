# Mission Control Dashboard Cutover Checklist — 2026-04-22

## Purpose
Translate the rollout plan and auth/proxy design into a concrete execution checklist for moving Mission Control toward:
- `dashboard.motiondisplay.cloud` as the canonical live lane
- `lab.motiondisplay.cloud` as the future persistent sandbox lane
- optional `preview.motiondisplay.cloud` as a temporary preview / rollback lane

This checklist is ordered for execution, not just discussion.

Related docs:
- `projects/_ops/mission-control-dashboard-live-rollout-plan-2026-04-21.md`
- `projects/_ops/mission-control-auth-proxy-design-2026-04-22.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`

## Success criteria
A cutover is only considered successful when all of the following are true:
- `dashboard.motiondisplay.cloud` is served over valid HTTPS
- browser secure context is true on the live domain
- gateway auth/origin model is explicit and stable
- no browser-side Mission Control relay of gateway auth tokens is required in steady state
- Chat/session/history truth is aligned to gateway-native behavior, not preview-only bridge behavior
- rollback remains available during the transition period

## Phase A — Freeze and label the current preview posture

### A1. Mark preview-only runtime pieces clearly
- [ ] Treat these as intermediate infrastructure, not final live architecture:
  - [ ] `projects/mission-control/scripts/preview-origin-proxy.js`
  - [ ] `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
  - [ ] `projects/mission-control/middleware.ts` Basic Auth posture
  - [ ] `/api/runtime-bridge` browser bridge-token and gateway-token relay behavior
  - [ ] `lib/runtime-bridge-history.ts` filesystem transcript hydration path

### A2. Preserve rollback lane while migration begins
- [ ] Keep `preview.motiondisplay.cloud` available during migration unless it becomes operationally useless
- [ ] Treat `preview` as a temporary preview / rollback lane, not the future sandbox identity
- [ ] Reserve `lab.motiondisplay.cloud` for the future durable sandbox lane

## Phase B — Approve final hostname and lane model

### B1. Lock the lane naming
- [ ] `dashboard.motiondisplay.cloud` = canonical live lane
- [ ] `lab.motiondisplay.cloud` = durable experimental lane
- [ ] `preview.motiondisplay.cloud` = optional temporary preview/rollback lane

### B2. Record environment intent in docs/runbooks
- [ ] confirm all future rollout docs use `dashboard` and `lab`
- [ ] stop referring to `preview` as the eventual permanent sandbox lane

## Phase C — Decide the live auth/proxy model

### C1. Preferred choice: trusted-proxy
- [ ] Approve `gateway.auth.mode = "trusted-proxy"` as the target live auth model

### C2. Required OpenClaw config fields for trusted-proxy mode
- [ ] set `gateway.auth.mode`
- [ ] set `gateway.auth.trustedProxy.userHeader`
- [ ] optionally set `gateway.auth.trustedProxy.requiredHeaders`
- [ ] set `gateway.trustedProxies`
- [ ] review whether `gateway.allowRealIpFallback` should remain false unless specifically needed
- [ ] set `gateway.controlUi.allowedOrigins` explicitly

### C3. Security constraints to enforce
- [ ] do not keep token auth enabled together with trusted-proxy mode
- [ ] ensure direct gateway port access is not publicly reachable
- [ ] ensure only the real reverse proxy IPs/CIDRs appear in `gateway.trustedProxies`
- [ ] ensure the chosen trusted identity header can only come from the proxy

### C4. Fallback if trusted-proxy is not ready
- [ ] if trusted-proxy cannot be used yet, define a temporary token/password-based live model
- [ ] even in fallback mode, do **not** expose gateway session token through browser-visible Mission Control APIs in the target live state

## Phase D — Design the reverse proxy topology

### D1. Choose the actual edge system
- [ ] confirm which proxy terminates TLS and authenticates users
  - [ ] nginx
  - [ ] Caddy
  - [ ] Pomerium
  - [ ] other

### D2. Define proxy responsibilities
- [ ] HTTPS termination
- [ ] HTTP -> HTTPS redirect
- [ ] websocket upgrade forwarding
- [ ] trusted user header injection
- [ ] `X-Forwarded-For` forwarding
- [ ] `Host` preservation where needed
- [ ] separation of `dashboard` vs `lab` upstream routing

### D3. Define origin policy values
- [ ] add exact live origin:
  - [ ] `https://dashboard.motiondisplay.cloud`
- [ ] reserve future lab origin:
  - [ ] `https://lab.motiondisplay.cloud`
- [ ] avoid wildcard origins
- [ ] avoid depending on Host-header fallback in the steady-state live design

## Phase E — Remove preview/debug gateway posture from the target live lane

### E1. Review and remove dangerous flags from live design
- [ ] remove `gateway.controlUi.allowInsecureAuth` from live posture
- [ ] remove `gateway.controlUi.dangerouslyDisableDeviceAuth` from live posture
- [ ] remove `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback` from live posture unless there is a documented, unavoidable reason

### E2. Keep config explicit
- [ ] keep `gateway.controlUi.allowedOrigins` explicit and exact
- [ ] keep `gateway.trustedProxies` narrow and documented
- [ ] keep `gateway.auth.trustedProxy.userHeader` documented in the same rollout notes as the reverse proxy config

## Phase F — Stand up live HTTPS first

### F1. Bring up the domain
- [ ] provision TLS for `dashboard.motiondisplay.cloud`
- [ ] verify certificate validity in browser
- [ ] verify secure context in browser on the live domain

### F2. Validate browser-sensitive requirements
- [ ] confirm `window.isSecureContext === true`
- [ ] confirm microphone access is no longer blocked by insecure origin
- [ ] confirm STT endpoint still works under live domain routing

## Phase G — Decide the first live deployment mode

### G1. Choose one of two launch styles
- [ ] **Option 1, temporary intermediate**: launch current Mission Control app behind HTTPS on `dashboard` while deeper migration continues
- [ ] **Option 2, cleaner but slower**: wait until the first Chat/runtime migration slice is ready before launching `dashboard`

### Recommendation
- [ ] if speed matters most, use Option 1 but document it as temporary only
- [ ] if correctness matters most, use Option 2 and avoid normalizing preview debt on the live hostname

## Phase H — Migrate Chat/runtime away from preview-only bridge assumptions
This is the most important implementation block.

### H1. Remove browser token relay behavior
- [ ] stop using Mission Control runtime descriptor as the long-term delivery path for gateway auth into the browser
- [ ] remove steady-state dependence on `runtimeBridge.endpoints.gatewaySessionToken`

### H2. Remove filesystem-first transcript hydration
- [ ] replace `lib/runtime-bridge-history.ts` disk-based hydration path with gateway-native session/history access for the live lane
- [ ] stop treating `/data/.openclaw/agents/.../sessions/*.jsonl` as the primary browser bootstrap source for live Chat

### H3. Remove permanent sidecar dependence
- [ ] stop treating `runtime-bridge-ws-sidecar.js` as permanent live runtime infrastructure
- [ ] stop treating `preview-origin-proxy.js` as permanent live websocket transport infrastructure

### H4. Align Chat to gateway-native truth
- [ ] session discovery should follow gateway-native session truth
- [ ] transcript/history should follow gateway-native history truth
- [ ] send/abort should follow gateway-native auth and transport
- [ ] reconnect behavior should follow gateway-native websocket/session assumptions

### H5. Verify live Chat acceptance criteria
- [ ] first paint no longer depends on JSONL filesystem hydration
- [ ] browser does not receive a relayed gateway session token from Mission Control in steady state
- [ ] send, abort, session switch, and reconnect work through the final live auth path

## Phase I — Consolidate Mission Control-specific APIs behind the final live boundary

### I1. Keep product APIs, but stop inventing a second runtime truth
- [ ] Home summaries
- [ ] Tasks data
- [ ] Agents data
- [ ] Files helpers
- [ ] search/memory helpers
- [ ] STT endpoints

### I2. Design rule
- [ ] runtime authority remains gateway-native
- [ ] Mission Control-specific APIs may aggregate or present product data
- [ ] Mission Control-specific APIs should not stay responsible for browser-side gateway auth workarounds

## Phase J — Prepare the future `lab.motiondisplay.cloud` lane

### J1. Lab lane requirements
- [ ] HTTPS
- [ ] same broad auth architecture shape as live
- [ ] explicit non-canonical labeling
- [ ] no assumption that lab can be sloppy just because it is experimental

### J2. Lab lane isolation questions
- [ ] decide whether lab is a separate Mission Control deployment
- [ ] decide whether lab talks to a separate gateway/runtime instance or a controlled alternative environment
- [ ] decide what promotion path moves changes from lab toward dashboard

## Phase K — Cutover and rollback

### K1. Pre-cutover checks
- [ ] dashboard HTTPS verified
- [ ] origin policy verified
- [ ] websocket forwarding verified
- [ ] live auth verified
- [ ] mic/STT verified
- [ ] Chat/session/history behavior verified
- [ ] rollback lane still healthy

### K2. Cutover sequence
- [ ] keep `preview.motiondisplay.cloud` available during the early cutover window
- [ ] route `dashboard.motiondisplay.cloud` to the approved live topology
- [ ] verify operator login/auth flow
- [ ] verify websocket session connect
- [ ] verify Chat send/abort/session switching
- [ ] verify restart/recovery behavior

### K3. Rollback sequence
- [ ] define the exact rollback trigger conditions before cutover
- [ ] keep preview lane deployable until dashboard stabilizes
- [ ] keep rollback instructions in the same runbook as the cutover sequence

## Phase L — Cleanup after dashboard stabilizes

### L1. Remove or downgrade preview-only dependencies
- [ ] remove permanent dependence on preview proxy + sidecar layers from live documentation
- [ ] remove preview-only auth assumptions from live design docs
- [ ] retire `preview.motiondisplay.cloud` if it no longer provides value

### L2. Keep lab as the long-term experimental lane
- [ ] use `lab.motiondisplay.cloud` as the durable sandbox identity
- [ ] treat dashboard as canonical
- [ ] document promotion flow from lab -> dashboard once that process exists

## Immediate concrete decisions Philippe should make next
1. [ ] Approve `lab.motiondisplay.cloud` as the long-term sandbox lane name
2. [ ] Approve `gateway.auth.mode = trusted-proxy` as the target live auth posture, or reject it explicitly
3. [ ] Choose the reverse proxy / identity system to front dashboard and future lab
   - recommended target: Pomerium-first trusted-proxy deployment with **Pomerium -> nginx** as the deployment topology
4. [ ] Decide whether `dashboard` launches first as a temporary HTTPS-wrapped intermediate or only after the first Chat/runtime migration slice

## Best next implementation artifact after this checklist
- [ ] a proxy-specific cutover spec, for example nginx/Caddy/Pomerium exact config shape
- [ ] a Chat/runtime migration spec by file and function
- [ ] a rollback runbook for dashboard cutover

## Bottom line
The order should be:
1. lock naming, `dashboard` + `lab`
2. choose trusted-proxy or explicit fallback auth model
3. stand up HTTPS on `dashboard`
4. migrate Chat/runtime away from preview bridge assumptions
5. cut over with rollback available
6. keep `lab` as the durable sandbox lane
