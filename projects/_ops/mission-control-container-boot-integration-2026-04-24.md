# Mission Control container boot integration — 2026-04-24

## Purpose
Document the exact live integration change for launching Mission Control automatically with the current OpenClaw container boot path, plus verification and rollback.

This is a **deployment patch proposal**, not an in-chat live cutover.

## Confirmed current boot chain
Observed in the running environment:

- PID 1: `docker-init`
- entrypoint: `/entrypoint.sh`
- effective command passed into entrypoint: `node server.mjs`
- entrypoint behavior:
  - `chown -R node:node /data`
  - delete stale lock files under `/data/.openclaw/agents`
  - `cd /hostinger`
  - `exec runuser -u node -- "$@"`

So the real integration seam is the **container command**, not `/entrypoint.sh` itself.

## Why command replacement is the right seam
Do not patch `/entrypoint.sh` yet.

Reasons:
- it is image-owned runtime bootstrap logic
- it already handles permissions and user-switching correctly
- command replacement is easier to audit and roll back
- compose / docker-run command override is the cleanest reversible integration point

## Exact proposed replacement for the current Hostinger-style container

### Current effective command
```bash
node server.mjs
```

### Proposed effective command
```bash
bash -lc '/data/.openclaw/workspace/projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh node /hostinger/server.mjs'
```

Because `/entrypoint.sh` already executes `runuser -u node -- "$@"`, this means the wrapper and both child processes run as the `node` user.

## What the wrapper does
`projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh`

It will:
1. start `mission-control-service-run.sh`
2. start the primary OpenClaw process (`node /hostinger/server.mjs`)
3. if either side exits, terminate the other side and exit with child status

## Compose-style override example
If the live deployment is controlled by Docker Compose or a compose-compatible layer, the command override should look like this:

```yaml
services:
  openclaw-hostinger:
    command:
      - bash
      - -lc
      - /data/.openclaw/workspace/projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh node /hostinger/server.mjs
```

## Upstream OpenClaw compose variant
If a future deployment uses the upstream OpenClaw gateway image shape instead of the current Hostinger-style app boot, the same pattern applies, but the wrapped primary command changes.

Example:

```yaml
services:
  openclaw-gateway:
    command:
      - bash
      - -lc
      - >-
        /data/.openclaw/workspace/projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh
        node dist/index.js gateway --bind ${OPENCLAW_GATEWAY_BIND:-lan} --port 18789
```

That variant is **not** the current live environment. It is only included so the seam stays clear across deployment shapes.

## Verification checklist after cutover

### Process checks
Inside the container, expect to see:
- the wrapper command process
- `node /hostinger/server.mjs`
- Mission Control sidecar
- Mission Control next server
- Mission Control edge proxy

### Mission Control health
Run:

```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-health.sh
```

Expected:
- proxy pid alive
- next pid alive
- ws-sidecar pid alive
- app health ok
- runtime bridge ok
- sidecar health ok

### External behavior
Verify:
- `dashboard.motiondisplay.cloud` still answers behind current front-door auth
- `lab.motiondisplay.cloud` still answers behind current front-door auth
- Mission Control runtime behavior still works locally

### Failure behavior
Kill one side intentionally in a rehearsal environment and confirm:
- wrapper tears down the other side
- container restarts cleanly under its normal restart policy

## Rollback
If the cutover fails:

1. revert the container command to:
   ```bash
   node server.mjs
   ```
2. restart the container
3. verify OpenClaw base service is healthy again
4. if necessary, stop any leftover Mission Control bundle:
   ```bash
   cd /data/.openclaw/workspace/projects/mission-control
   ./scripts/mission-control-service-stop.sh || true
   ```

## Preconditions before applying the live cutover
- current Mission Control scripts exist in the mounted workspace
- `mission-control-service-health.sh` passes manually
- dashboard remains functional after a normal `mission-control-service-restart.sh`
- operator knows where the real compose/runtime command is managed on the host
- rollback path to the previous command is ready

## Recommendation
The next live change should be:
- apply the command override at the container-management layer
- do not patch `/entrypoint.sh`
- do the first cutover in a controlled maintenance window
- keep the fallback/admin token-based path on the roadmap before final auth cutover

## Bottom line
The exact next live boot integration patch is now clear and small:
replace the current container command with the Mission Control wrapper command, leave `/entrypoint.sh` alone, and verify health plus rollback immediately after restart.
