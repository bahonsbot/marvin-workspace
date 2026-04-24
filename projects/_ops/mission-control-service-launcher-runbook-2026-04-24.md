# Mission Control service launcher runbook — 2026-04-24

## Purpose
Turn the current preview-shaped Mission Control runtime into a durable service-style deployment path for:
- `dashboard.motiondisplay.cloud` as canonical live lane
- `lab.motiondisplay.cloud` as durable sandbox lane
- `preview.motiondisplay.cloud` as rollback lane

This runbook does **not** change the auth model yet.
It makes startup, restart, health, and rollback concrete before the gateway auth cutover.

## Current operational truth

### Current process topology
Mission Control already runs as a clean three-process bundle:

1. WS sidecar
   - command: `node ./scripts/runtime-bridge-ws-sidecar.js`
   - current pid source: `.preview-runtime/ws-sidecar.pid`
   - current port: `127.0.0.1:3006`

2. Next production app
   - command: `npm run start -- --hostname 127.0.0.1 --port 3007`
   - current pid source: `.preview-runtime/next.pid`
   - current port: `127.0.0.1:3007`

3. Mission Control edge proxy
   - command: `node ./scripts/preview-origin-proxy.js`
   - current pid source: `.preview-runtime/latest.pid`
   - current port: `0.0.0.0:3005`

### Current helper scripts
Build/start/stop/restart is currently managed by:
- `scripts/preview-build.sh`
- `scripts/preview-start.sh`
- `scripts/preview-stop.sh`
- `scripts/preview-restart.sh`

### Current env source
- runtime dir: `projects/mission-control/.preview-runtime`
- env file: `.preview-runtime/mission-control-preview.env`

### Current health behavior
The startup script currently treats the service as healthy when:
- all three processes are alive
- `http://127.0.0.1:3005/general/agents` responds successfully
- runtime bridge warmup succeeds or is at least attempted

## Recommended service model

### Phase 1 — durable wrapper around current topology
Do not redesign the internal process layout yet.
Use the existing three-process topology as the first durable service.

#### Service contract
A single Mission Control service should be defined as:
- build artifact created by `./scripts/preview-build.sh`
- service start by `./scripts/preview-start.sh`
- service stop by `./scripts/preview-stop.sh`
- service restart by `./scripts/preview-restart.sh`

This is honest and minimizes risk.

### Preferred supervision approach
Use **one supervisor for the bundle**, not three independently managed host services.

Confirmed best choice for this environment:
1. container entrypoint or foreground supervisor wrapper
2. systemd user/service wrapper only if the deployment model changes later
3. systemd root service wrapper only if container ownership goes away

### Why this is the right fit here
This environment is currently container-owned:
- PID 1 is `docker-init`
- entrypoint is `/entrypoint.sh node server.mjs`
- OpenClaw runs under that container process tree
- Mission Control currently runs as extra node processes directly under PID 1

So a container-level bundle supervisor is the honest next integration point.

### Why bundle supervision is better first
- current scripts already own pid/log/env orchestration
- avoids reimplementing process ordering immediately
- preserves the warm-runtime-bridge boot behavior
- makes rollback easier because the service entrypoint remains simple

## Recommended lane/service posture

### Dashboard lane
- canonical live lane
- should point at the supervised Mission Control service on `172.18.0.2:3005`
- should be the default operational hostname

### Lab lane
- same service shape as dashboard at first
- may initially point to the same upstream while product/runtime differences are still minimal
- should remain labeled non-canonical
- later can split to its own upstream or deployment if needed

### Preview lane
- keep as rollback lane
- may keep using the same service bundle temporarily
- should remain explicitly preview/rollback in docs and operations

## Environment separation roadmap
This should be kept on the todo list explicitly.

### Goal
Avoid one mixed auth surface.
Keep a fallback/admin path available even after live Mission Control eventually moves off token auth.

### Recommended target shape
#### Environment A — live Mission Control
- `dashboard.motiondisplay.cloud`
- eventual `trusted-proxy` posture
- hardened live operator experience

#### Environment B — fallback/admin Control UI path
- token-auth based access remains available
- used for break-glass recovery and admin repair if Mission Control breaks
- may be exposed through a different hostname, private route, or limited admin-only path

### Important rule
Do **not** implement this as one gateway instance trying to run both token auth and trusted-proxy semantics simultaneously on the same public surface.
Keep separation explicit at the environment or access-path level.

## Immediate next implementation patch

### Patch 1 — make the current bundle into a named service path
Status: complete for phase 1 wrapper layer.

Dedicated launcher wrappers now exist:
- `scripts/mission-control-service-start.sh`
- `scripts/mission-control-service-stop.sh`
- `scripts/mission-control-service-restart.sh`

Current implementation:
- they delegate to the existing preview scripts internally
- this gives operations an honest stable interface without forcing a risky internal rewrite first

### Patch 2 — add explicit health checks
Status: complete for phase 1 health wrapper.

Health wrapper now exists:
- `scripts/mission-control-service-health.sh`

Current checks performed:
- proxy pid file + process alive
- next pid file + process alive
- ws-sidecar pid file + process alive
- HTTP app health: `http://127.0.0.1:3005/general/agents`
- runtime descriptor health: `http://127.0.0.1:3005/api/runtime-bridge`
- sidecar health: local sidecar health endpoint when configured

### Patch 3 — add rollback commands
Rollback should be documented as:
1. stop the service bundle
2. restore previous env/config if needed
3. restart previous known-good bundle
4. verify `preview.motiondisplay.cloud` and `dashboard.motiondisplay.cloud`

### Patch 4 — add a foreground supervisor entrypoint
Status: complete for phase 1 container-supervisor draft.

Foreground supervisor wrapper now exists:
- `scripts/mission-control-service-run.sh`

Current behavior:
- starts the current Mission Control bundle
- validates health before entering steady state
- runs a foreground loop with repeated health checks
- restarts the bundle if health fails
- stops the bundle on exit/signals

## Operational commands for the current phase

### Build
```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/preview-build.sh
```

### Start
```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-start.sh
```

### Stop
```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-stop.sh
```

### Restart
```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-restart.sh
```

### Health
```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-health.sh
```

### Foreground supervisor
```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-run.sh
```

### Transitional implementation detail
The service wrappers currently call:
- `./scripts/preview-start.sh`
- `./scripts/preview-stop.sh`
- `./scripts/preview-restart.sh`
- `./scripts/mission-control-service-run.sh` supervises those wrappers rather than replacing the underlying runtime shape

## Health checklist after restart

1. Verify edge host responds:
   - `curl -k -I https://dashboard.motiondisplay.cloud`
   - expected now: `401 Unauthorized` behind Basic Auth

2. Verify local app health:
   - `curl -fsS http://127.0.0.1:3005/general/agents >/dev/null`

3. Verify runtime descriptor:
   - `curl -fsS http://127.0.0.1:3005/api/runtime-bridge`

4. Verify current process set:
   - proxy process alive
   - next process alive
   - ws-sidecar alive

## Recommended next auth sequence after persistence
Only after this service path is stable:

1. keep token auth temporarily
2. keep dashboard/lab/preview host model explicit
3. preserve fallback/admin environment separation on the roadmap
4. prepare non-loopback trusted-proxy path
5. switch live Mission Control lane to trusted-proxy later
6. remove dangerous preview/debug flags during that final cutover

## Bottom line
The next implementation move should not be auth surgery.
It should be converting the already-working three-process Mission Control runtime into a named, durable service path with explicit health and rollback.
That makes every later R5 step safer.
