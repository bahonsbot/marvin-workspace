# Mission Control persistence and auth recommendation — 2026-04-24

## Current truth

### Runtime startup today
Mission Control is still started through preview-oriented helper scripts:
- `projects/mission-control/scripts/preview-build.sh`
- `projects/mission-control/scripts/preview-start.sh`
- `projects/mission-control/scripts/preview-stop.sh`
- `projects/mission-control/scripts/preview-restart.sh`

Current startup shape from `preview-start.sh`:
- starts WS sidecar on local port `3006`
- starts Next production app on internal port `3007`
- starts preview-origin proxy on public port `3005`
- reads env from `.preview-runtime/mission-control-preview.env`
- warms the runtime bridge after health succeeds

This is functional, but it is still preview-shaped and manual.

### Gateway auth truth today
Current gateway posture remains:
- `gateway.auth.mode = token`
- Mission Control/browser edge still sits behind Basic Auth
- preview/debug flags are still enabled

This is acceptable as a temporary posture, but it is not the intended steady-state live design.

## Answer on "hybrid" auth

### Short answer
A true hybrid of `token` auth and `trusted-proxy` at the same time is **not** the recommended path.

### Why
The existing rollout/design docs consistently treat them as mutually exclusive in the final posture:
- do not keep token auth enabled together with trusted-proxy mode
- do not rely on localhost/loopback proxy injection for trusted-proxy
- trusted-proxy requires the gateway to see a real non-loopback proxy source

So the safe model is not "both at once in one final live lane".

### Better alternative
Use a **phased migration**, not a true auth hybrid:

1. **Current / temporary phase**
   - keep `gateway.auth.mode = token`
   - keep Mission Control behind edge auth
   - remove browser-visible gateway token relay over time
   - keep preview as rollback

2. **Final live phase**
   - switch gateway to `trusted-proxy`
   - make reverse proxy the only identity source
   - remove preview/debug flags
   - keep exact allowed origins only

### If default Gateway UI login must remain available
That should be treated as one of two deliberate options:

#### Option A, preferred
- keep token auth only until trusted-proxy cutover is truly ready
- then switch the live environment cleanly to trusted-proxy
- do not run both auth models in parallel in the same live posture

#### Option B, fallback environment split
- keep one environment/lane on token auth for fallback or admin access
- move the live Mission Control lane to trusted-proxy
- keep the separation explicit at the environment level, not mixed in one auth surface

This is much safer than trying to make one gateway instance behave as both models simultaneously.

## Recommended persistence/autostart plan

### Goal
Make Mission Control come up durably with runtime, without depending on manual preview rebuild/restart commands.

### Recommended service model
Create a dedicated Mission Control service wrapper around the existing preview-oriented runtime shape first, then rename/generalize later.

#### Phase 1, pragmatic persistence
Keep the current process topology but supervise it properly:
- `next start --hostname 127.0.0.1 --port 3007`
- `node scripts/runtime-bridge-ws-sidecar.js`
- `node scripts/preview-origin-proxy.js`

Supervise these through one stable launcher, with:
- env file loading
- pid/log management
- restart on failure
- health check gate

This can be done with:
- systemd user service, or
- container entrypoint/supervisor wrapper, if that is how the runtime is actually managed

### Phase 2, naming cleanup
Once stable, split naming clearly:
- `dashboard` = canonical live lane
- `lab` = sandbox lane
- `preview` = rollback lane

Then convert preview-specific filenames and env names into more honest runtime names.

## First persistence artifact I recommend

### Add a dedicated runbook/spec first
Before mutating service management, add one small operational artifact that defines:
- exact process topology
- env file path
- expected ports
- health endpoint
- restart command
- rollback command
- which hostnames point at this service

### Then add one supervised launcher
Best first concrete implementation:
- create a single wrapper script for durable Mission Control startup
- keep current internal topology unchanged for now
- stop using ad hoc manual restart as the primary operational path

## Recommended near-term sequence

1. keep current token posture temporarily
2. make Mission Control startup durable
3. keep preview as rollback lane
4. make dashboard canonical and lab explicit at deploy level
5. only then cut gateway from token mode to trusted-proxy
6. remove dangerous preview/debug flags during that cutover, not before

## Specific recommendation for now

### Keep for now
- `gateway.auth.mode = token`
- `bind = 0.0.0.0` if needed for the current container/runtime path
- current dangerous flags only as temporary migration posture

### Do not keep long-term
- `allowInsecureAuth = true`
- `dangerouslyDisableDeviceAuth = true`
- `dangerouslyAllowHostHeaderOriginFallback = true`
- preview-origin proxy and WS sidecar as permanent live architecture

## Next implementation step after this doc
Create a concrete Mission Control service runbook and launcher plan that turns the current preview scripts into a durable dashboard/lab startup path.
