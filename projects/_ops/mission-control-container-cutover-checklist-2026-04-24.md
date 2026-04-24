# Mission Control container cutover checklist — 2026-04-24

## Purpose
Use this checklist during the actual maintenance window when switching the live container boot command so Mission Control starts automatically with OpenClaw.

This checklist assumes the cutover follows the proposal in:
- `projects/_ops/mission-control-container-boot-integration-2026-04-24.md`

## Scope of this cutover
Change only the container command.

Do **not** during this window:
- patch `/entrypoint.sh`
- change gateway auth mode
- remove dangerous flags yet
- switch trusted-proxy live auth
- combine this with unrelated Mission Control code changes

## Exact target change

### From
```bash
node server.mjs
```

### To
```bash
bash -lc '/data/.openclaw/workspace/projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh node /hostinger/server.mjs'
```

## Before the window

### 1. Confirm operator readiness
- identify the exact host file or control surface that currently defines the container command
- confirm you have permission and access to revert quickly
- confirm you know how to restart only the affected container
- confirm you have shell access after restart

### 2. Confirm rollback is ready
Record the current command exactly:

```bash
node server.mjs
```

Prepare the rollback action in advance so it can be applied without rethinking under pressure.

### 3. Confirm Mission Control assets exist in mounted workspace
Inside the container or mounted workspace, verify these files exist and are executable:

```bash
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-start.sh
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-stop.sh
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-restart.sh
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-health.sh
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-run.sh
/data/.openclaw/workspace/projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh
```

### 4. Confirm pre-cutover health
Run before touching container startup:

```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-health.sh
```

If shell location is uncertain, use the absolute path instead:

```bash
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-health.sh
```

Expected:
- proxy pid alive
- next pid alive
- ws-sidecar pid alive
- app health ok
- runtime bridge ok
- sidecar health ok

### 5. Confirm edge baseline
Verify current front-door behavior still matches expectation:

```bash
curl -k -I https://dashboard.motiondisplay.cloud
curl -k -I https://lab.motiondisplay.cloud
```

Expected right now:
- `401 Unauthorized`
- front-door auth still in place

### 6. Capture current process baseline
Optional but recommended:

```bash
ps -eo pid,ppid,comm,args | grep -E 'server\.mjs|preview-origin-proxy|runtime-bridge-ws-sidecar|next start' | grep -v grep
```

## During the window

### 7. Apply only the command change
Update the container runtime definition so the command becomes:

```bash
bash -lc '/data/.openclaw/workspace/projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh node /hostinger/server.mjs'
```

### 8. Restart only the affected container
Do not restart unrelated services if avoidable.

### 9. Watch startup closely
Immediately inspect container logs and process state.

Expected shape after boot:
- wrapper process present
- `node /hostinger/server.mjs` present
- Mission Control sidecar present
- Mission Control next server present
- Mission Control edge proxy present

Important known failure signature from the first live attempt:
- `Error: spawn openclaw ENOENT`
- this means the primary Hostinger/OpenClaw app booted under a PATH that could not find the `openclaw` CLI
- if seen, roll back or fix the wrapper PATH before continuing

### 10. Run immediate local health validation
Inside container/workspace:

```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-health.sh
```

If your shell is not already in the workspace root, use:

```bash
/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-health.sh
```

If this fails, stop and evaluate rollback immediately.

## After the restart

### 11. Verify OpenClaw base process still behaves normally
Check that the primary app still came up and did not get replaced by only the Mission Control bundle.

### 12. Verify Mission Control local endpoints
Run:

```bash
curl -fsS http://127.0.0.1:3005/general/agents >/dev/null
curl -fsS http://127.0.0.1:3005/api/runtime-bridge >/dev/null
curl -fsS http://127.0.0.1:3006/healthz
```

### 13. Verify external surface
Check:

```bash
curl -k -I https://dashboard.motiondisplay.cloud
curl -k -I https://lab.motiondisplay.cloud
```

Expected right after cutover:
- still `401 Unauthorized`
- no unexpected 502/504 persistence

### 14. Quick functional smoke test
Confirm at least:
- dashboard front door responds
- Mission Control app redirects/loads as expected behind auth
- runtime descriptor route still answers locally

### 15. Failure-isolation rehearsal if safe
In rehearsal or if operationally safe, confirm the wrapper behavior is still sane:
- if the primary process dies, the wrapper should shut down Mission Control side processes
- container should then restart per normal restart policy

## Rollback triggers
Rollback immediately if any of the following occur and do not self-resolve quickly:
- primary OpenClaw process does not come up
- Mission Control health script fails after restart
- container enters restart loop
- persistent 502/504 at dashboard front door
- wrapper process is running but `node /hostinger/server.mjs` is missing
- wrapper causes duplicate or runaway Mission Control process trees
- startup logs show `spawn openclaw ENOENT`

## Rollback steps

### 16. Revert command
Restore the old container command:

```bash
node server.mjs
```

### 17. Restart container
Restart only the affected container.

### 18. Clean up leftover Mission Control bundle if needed
Inside container/workspace:

```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-service-stop.sh || true
```

### 19. Re-verify baseline
Check:
- primary OpenClaw process healthy
- dashboard front door returns expected auth response
- no unexpected Mission Control orphan processes remain

## Success criteria
The cutover is successful only if all of these are true:
- container boots with the new wrapper command
- `node /hostinger/server.mjs` is still the primary OpenClaw process
- Mission Control bundle auto-starts
- health wrapper passes after restart
- dashboard and lab front doors still answer normally
- no restart loop
- rollback path remains clear and tested on paper

## Explicitly deferred after this window
Do later, not in this cutover:
- trusted-proxy auth cutover
- removal of dangerous gateway flags
- final environment separation for fallback/admin path
- dashboard/live auth hardening changes
- lab-specific deployment split

## Bottom line
This maintenance window should be a narrow boot-command cutover only.
If anything looks uncertain, roll back fast and keep the rest of R5 separate.
