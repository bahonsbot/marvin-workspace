# Mission Control Lab Handover — 2026-04-25

## Status

Physical lab lane is live and browser-smoked.

Philippe tested `https://lab.motiondisplay.cloud` in browser and sent the harmless message:

> Lab smoke test: please reply with “lab lane is working” and do nothing else.

The lab lane replied correctly. Philippe then returned to the live dashboard and reported everything felt smooth.

## Current topology

### Dashboard, canonical live

- Public host: `dashboard.motiondisplay.cloud`
- Host nginx upstream: `http://172.18.0.2:3005`
- Container project: `/data/.openclaw/workspace/projects/mission-control`
- Runtime dir: `.preview-runtime`
- Edge proxy: `3005`
- WS sidecar: `3006`
- Internal Next: `3007`
- Descriptor: v3
- Lane: `live`
- Transport: `http+ws-live`
- Browser token relay: false

### Lab, physical sandbox lane

- Public host: `lab.motiondisplay.cloud`
- Host nginx upstream: `http://172.18.0.2:3015`
- Container project: `/data/.openclaw/workspace/projects/mission-control-lab`
- Runtime dir: `.lab-runtime`
- Env file: `.lab-runtime/mission-control-lab.env`
- Edge proxy: `3015`
- WS sidecar: `3016`
- Internal Next: `3017`
- Descriptor: v3
- Lane: `lab`
- Transport: `http+ws-live`
- Browser token relay: false

### Preview, legacy rollback

- Public host: `preview.motiondisplay.cloud`
- Local preview lane smoke still passes from dashboard runtime.
- Public strict TLS currently has a cert mismatch for `preview.motiondisplay.cloud`. This is unrelated to the lab cutover and should be cleaned separately.

## Files and commits from this session

Mission Control repo commits:

- `c75baebd Add Mission Control lab lane checks`
- `09220718 Plan Mission Control physical lab split`
- `202cb425 Document lab host routing cutover`

Key dashboard repo files:

- `projects/mission-control/docs/lab-lane-operating-model.md`
- `projects/mission-control/docs/lab-physical-split-plan.md`
- `projects/mission-control/docs/lab-host-routing-cutover.md`
- `projects/mission-control/scripts/mission-control-lane-smoke.sh`

Key lab runtime files:

- `projects/mission-control-lab/.lab-runtime/mission-control-lab.env`
- `projects/mission-control-lab/scripts/lab-env.sh`
- `projects/mission-control-lab/scripts/lab-build.sh`
- `projects/mission-control-lab/scripts/lab-start.sh`
- `projects/mission-control-lab/scripts/lab-stop.sh`
- `projects/mission-control-lab/scripts/lab-restart.sh`
- `projects/mission-control-lab/scripts/lab-health.sh`
- `projects/mission-control-lab/scripts/lab-lane-smoke.sh`

Host-side files created by Philippe:

- `/etc/nginx/sites-enabled/lab.motiondisplay.cloud`
- Let’s Encrypt cert paths:
  - `/etc/letsencrypt/live/lab.motiondisplay.cloud/fullchain.pem`
  - `/etc/letsencrypt/live/lab.motiondisplay.cloud/privkey.pem`

## Verification commands

### Dashboard lane smoke

```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-lane-smoke.sh
```

Expected:

- dashboard: lane `live`, descriptor v3, `http+ws-live`, browser token relay false
- lab: lane `lab`, descriptor v3, `http+ws-live`, browser token relay false, when checked through the dashboard runtime host-header probe
- preview: lane `preview`, descriptor v2, `http-poll+ws-sidecar`, browser token relay true

### Lab health and smoke

```bash
cd /data/.openclaw/workspace/projects/mission-control-lab
./scripts/lab-health.sh
./scripts/lab-lane-smoke.sh
```

Expected:

- proxy pid alive
- Next pid alive
- WS sidecar pid alive
- app responds on `127.0.0.1:3015`
- sidecar responds on `127.0.0.1:3016`
- lab descriptor: lane `lab`, descriptor v3, `http+ws-live`, secret-free

### Public descriptor check

Use Basic Auth from the Mission Control env, but do not print secrets.

Expected public result:

- `https://lab.motiondisplay.cloud/api/runtime-bridge?fresh=1`: lane `lab`, descriptor v3, `http+ws-live`, no browser token relay
- `https://dashboard.motiondisplay.cloud/api/runtime-bridge?fresh=1`: lane `live`, descriptor v3, `http+ws-live`, no browser token relay

## Important caveats

### Lab is a runtime snapshot, not a clean git worktree

`projects/mission-control-lab` was created as a runtime snapshot of the current working dashboard checkout because the dashboard repo is broadly dirty and includes untracked runtime-transition files. A clean worktree from HEAD would have been stale relative to the actual working dashboard.

Future work should reconcile the dashboard Mission Control source state before relying on branch/worktree promotion.

### What is isolated

The physical lab split isolates:

- app files
- `.next` build output
- `node_modules`
- env/runtime dir
- pid/log files
- local ports
- process tree
- public host upstream

### What is not isolated

Lab still talks to the same OpenClaw backend and workspace unless a future feature adds lab-only guards.

That means features can still affect real sessions/tasks/files if they call real backend routes. For risky features, add feature flags, lab-only data paths, or explicit approval gates.

### Lab stop safety

The lab copy of `preview-stop.sh` was patched to remove broad process-name kill fallbacks because dashboard and lab use identical node command names. Lab stop should stay scoped to `.lab-runtime` pid files and lab-only ports.

Do not reintroduce broad `pgrep -f` kill behavior in the lab lane.

## Current known follow-ups

1. Reconcile and commit the broad dirty Mission Control source state.
2. Decide whether to convert `projects/mission-control-lab` into a true git worktree after source cleanup, or keep it as a runtime snapshot for now.
3. Track the host nginx lab vhost in an ops artifact if desired.
4. Fix `preview.motiondisplay.cloud` public certificate mismatch.
5. Add a stricter public lab smoke script if recurring checks are needed.
6. Review `npm audit` dependency findings in the lab snapshot: 4 vulnerabilities were reported after `npm ci`.
7. Apply the lab persistence patch with a safe container restart: `projects/mission-control/scripts/openclaw-container-command-with-mission-control.sh` now starts the optional lab supervisor (`projects/mission-control-lab/scripts/mission-control-service-run.sh`) after restart. Until the container restarts, the currently running wrapper process will not supervise lab.

## Recommended next session start

1. Read this handover.
2. Run:

```bash
cd /data/.openclaw/workspace/projects/mission-control-lab
./scripts/lab-health.sh
./scripts/lab-lane-smoke.sh
```

3. Run dashboard smoke:

```bash
cd /data/.openclaw/workspace/projects/mission-control
./scripts/mission-control-lane-smoke.sh
```

4. If both are green, begin feature work in lab, but avoid backend-destructive behavior unless explicitly approved.
