# Mission Control Runtime & Preview Runbook

Last updated: 2026-04-14
Owner: Marvin / Philippe
Scope: Mission Control app runtime, preview verification, and build-output recovery

## Purpose

This runbook exists to prevent a recurring Mission Control confusion pattern:
- some actions happen inside the OpenClaw container/workspace runtime
- some actions happen on the host
- preview routing depends on host nginx pointing at the container-side app
- stale `.next` build output can create misleading verification failures

Use this runbook before debugging Mission Control preview/build issues.

---

## 1. Boundary: host vs container

### Container-side truth
Mission Control app code lives in the OpenClaw workspace and runs from:

```bash
/data/.openclaw/workspace/projects/mission-control
```

Inside the OpenClaw assistant session, assume commands are running against the **container-visible workspace**.

Examples of container-side actions:
- `npm install`
- `npm run lint`
- `npm run build`
- `npm run start -- --hostname 0.0.0.0 --port 3005`
- checking `.next/` contents from the assistant session
- reading app files and adapter code

### Host-side truth
The public preview route is exposed by **host nginx**, not by Next.js directly.

Examples of host-side actions:
- checking nginx config
- reloading nginx
- verifying host-to-container proxy target
- inspecting whether the host is routing to the correct container-side IP/port

### Rule of thumb
- **App build/runtime problems** → start inside the container/workspace
- **Public preview reachability problems** → inspect host nginx + proxy target

---

## 2. Commands that should be run inside the container

Run these from the OpenClaw workspace/container environment unless you have a very specific reason not to.

### Go to the app
```bash
cd /data/.openclaw/workspace/projects/mission-control
```

### Install / refresh dependencies
```bash
npm install
```

### Lint
```bash
npm run lint
```

### Build
```bash
npm run build
```

### Standard preview helper scripts
Prefer these instead of ad-hoc shell commands:

```bash
./scripts/preview-build.sh
./scripts/preview-start.sh
./scripts/preview-stop.sh
./scripts/preview-restart.sh
```

Current hardening note:
- `preview-start.sh` now launches the WS sidecar, internal Next app, and preview-origin proxy in detached sessions (`setsid`) and waits for a real local health check before declaring success
- this protects against the failure mode where preview appears briefly alive after a build/restart and then collapses into `502 Bad Gateway` because the launcher shell exited and took the children with it

### Start production-style app server
```bash
npm run start -- --hostname 0.0.0.0 --port 3005
```

### Quick local runtime verification
```bash
curl -I http://127.0.0.1:3005
```

### Check the app process inside the container
```bash
ps -ef | grep "next start" | grep -v grep
pgrep -af "next-server|next start|preview-origin-proxy|runtime-bridge-ws-sidecar"
ss -ltnp | grep 3005
ss -ltnp | grep 3006
ss -ltnp | grep 3007
```

Do **not** assume that host-side deletion or inspection of app paths will affect the exact container-visible build output unless you have confirmed the path mapping.

---

## 3. Preview routing truth

### Durable rule
`preview.motiondisplay.cloud` works only when **host nginx** proxies to a **reachable container-side Mission Control app target**.

Do **not** assume the app is running on host loopback.

### Current known preview shape
- Mission Control preview now runs as a small three-layer stack inside the OpenClaw container runtime:
  1. internal Next app on `127.0.0.1:3007`
  2. preview-origin proxy on `:3005`
  3. WS sidecar on `127.0.0.1:3006`
- the browser-facing preview still enters through port `3005`
- the preview-origin proxy forwards normal HTTP to the internal Next app and websocket upgrades on `/api/runtime-bridge/ws` to the local WS sidecar
- host nginx must still proxy the public preview origin to the container-side reachable preview entry target
- a past working container target was:
  - container `openclaw-ktrt-openclaw-1`
  - `172.18.0.2:3005`
- Mission Control now has Next.js middleware auth for non-local requests
  - env vars required on the app runtime: `MISSION_CONTROL_BASIC_AUTH_USER`, `MISSION_CONTROL_BASIC_AUTH_PASS`
  - localhost/container checks still bypass auth for local verification
  - if the env vars are missing, non-local requests return `503 Mission Control auth is not configured`
- Mission Control runtime bridge also depends on preview env values such as:
  - `MISSION_CONTROL_GATEWAY_AUTH_TOKEN`
  - `MISSION_CONTROL_WS_UPSTREAM_ORIGIN`

Treat the **rule** as durable, not the exact IP.
Container IPs may change.

### What to verify on the host
- nginx upstream/proxy target points to the current reachable container-side app target
- target answers on port `3005`
- nginx reload succeeded after config changes

### Quick host-side checks
```bash
curl -I http://preview.motiondisplay.cloud
curl -I http://<container-ip>:3005
sudo nginx -t
```

Only use the direct container-IP curl if you already know the current target.

---

## 4. Recovering stale `.next` / build-output issues

### Typical symptom
`npm run build` fails with permission errors or stale artifact errors involving files under:

```bash
.next/
.next/server/
.next/server/app-paths-manifest.json
```

### Important lesson
A host-side delete may not clear the exact stale subtree seen by the assistant session if the path boundary or runtime view is mismatched.
A partial delete may also just move the failure to a different stale file under `.next` (`server/*`, then `types/*`, etc.). When in doubt, remove the whole `.next` tree and rebuild cleanly.

### Safe recovery order

#### Step A: inspect from the same environment that is building
Inside the container/workspace:
```bash
cd /data/.openclaw/workspace/projects/mission-control
ls -ld .next .next/server 2>/dev/null || true
stat -c '%U:%G %a %n' .next .next/server .next/server/app-paths-manifest.json 2>/dev/null || true
```

#### Step B: if stale build output is clearly local to the container-visible app path
Inside the same environment if permissions allow:
```bash
rm -rf .next
```

Then rebuild:
```bash
npm run build
```

#### Step C: if assistant/container session cannot clear root-owned output
This is a boundary/permissions issue, not automatically an app-code issue.
At that point:
- confirm the exact stale subtree from the container-visible path
- perform cleanup from the environment that actually owns that subtree
- prefer deleting stale build output over partial surgery when safe

### Verification after recovery
```bash
./scripts/preview-build.sh
./scripts/preview-start.sh
curl -I http://127.0.0.1:3005
```

If the old preview is still being served after a rebuild, check for a lingering `next-server` process. In our recovery case, the stale server survived under a generic `next-server` process name and was not matched by a narrower `pkill -f 'next start --hostname 0.0.0.0 --port 3005'` pattern.

---

## 5. How to verify the app process serving `preview.motiondisplay.cloud`

There are two layers to verify.

### Layer 1: preview stack exists and is serving inside container
Inside the container/workspace:
```bash
cd /data/.openclaw/workspace/projects/mission-control
pgrep -af "next-server|next start|preview-origin-proxy|runtime-bridge-ws-sidecar"
ss -ltnp | grep 3005
ss -ltnp | grep 3006
ss -ltnp | grep 3007
curl -I http://127.0.0.1:3005/general/chat
```

Success means the preview-origin proxy, internal Next app, and WS sidecar are all alive enough for browser entry.

### Layer 2: host nginx is actually routing preview traffic to that app
On the host:
```bash
curl -I http://preview.motiondisplay.cloud
sudo nginx -t
```

If preview is broken but layer 1 is healthy, the likely issue is host proxy/routing, not the app server.

---

## 6. Practical troubleshooting matrix

### Case: `npm run lint` passes, `npm run build` fails on `.next`
Interpretation:
- likely stale build-output / permissions issue
- not immediate evidence that the page code itself is broken

Action:
- recover `.next` from the environment that actually owns it
- rebuild

### Case: `npm run build` passes, first preview request works briefly, then later requests become `502 Bad Gateway`
Interpretation:
- the preview launcher likely did not keep the stack detached/alive after the invoking shell ended, or one of the three preview processes died after startup

Action:
- inspect all three local preview processes: `next-server`, `preview-origin-proxy`, `runtime-bridge-ws-sidecar`
- inspect `.preview-runtime/latest.log`, `.preview-runtime/next.log`, `.preview-runtime/ws-sidecar.log`
- rerun `./scripts/preview-start.sh` and require it to pass its built-in health check before trusting the restart

### Case: `npm run build` passes, `curl 127.0.0.1:3005` fails
Interpretation:
- app process did not start or crashed immediately

Action:
- inspect process + startup output inside container
- check `/tmp/mission-control-preview.log`
- verify the start command used npm-script argument forwarding correctly: `npm run start -- --hostname 0.0.0.0 --port 3005`

### Case: local app on `127.0.0.1:3005` works, but `preview.motiondisplay.cloud` fails
Interpretation:
- host nginx / proxy target issue

Action:
- inspect host-side routing target and nginx config

### Case: host path cleanup appears successful, but assistant still sees stale files
Interpretation:
- host-side path and container-visible path are not being treated as the same runtime truth

Action:
- inspect and clean from the same environment that is failing the build

---

## 7. Recommended operational habit

When debugging Mission Control:
1. identify whether the issue is **app runtime** or **host preview routing**
2. verify from the same environment that is actually failing
3. avoid assuming host-side path operations solved a container-visible build issue
4. treat `.next` failures as operational until proven to be product-code failures
5. prefer the dedicated preview helper scripts over hand-typed restart commands
6. if preview still looks old after rebuild, compare local `127.0.0.1:3005` and public `preview.motiondisplay.cloud` output before guessing about browser cache

---

## Stable Dashboard / Experimental Lab promotion gate

Dashboard is the stable operator surface. Lab is the experimental validation surface. Do not let Lab rebuild/restart work mutate or destabilize Dashboard.

For Mission Control UI/runtime changes, use this order:

1. Patch source in `projects/mission-control`.
2. Run source validation: `npm run lint` and `npm run build`.
3. Copy/deploy only the focused change to Lab when needed.
4. Build/restart Lab and require:
   - `projects/mission-control-lab/scripts/lab-health.sh`
   - `projects/mission-control-lab/scripts/lab-lane-smoke.sh`
5. Only after Lab is green, touch Dashboard.
6. Before starting Dashboard, verify production build artifacts exist after build:
   - `.next/build-manifest.json`
   - `.next/prerender-manifest.json`
   - `.next/routes-manifest.json`
   - `.next/server/pages-manifest.json`
   - `.next/server/app-paths-manifest.json`
7. Start Dashboard and require both:
   - `projects/mission-control/scripts/mission-control-service-health.sh`
   - `projects/mission-control/scripts/mission-control-lane-smoke.sh`

Important: `preview-origin-proxy` alive on port `3005` is not proof that Dashboard is healthy. The proxy can remain up while internal Next on `3007` is dead. If Dashboard shows `Mission Control preview proxy could not reach the Next.js server`, inspect `.preview-runtime/next.log` and verify internal Next plus `.next` artifacts before claiming recovery.

Recovery when Dashboard `.next` is incomplete:

```bash
cd /data/.openclaw/workspace/projects/mission-control
bash scripts/mission-control-service-stop.sh || true
rm -rf .next
npm run build
for f in build-manifest.json prerender-manifest.json routes-manifest.json server/pages-manifest.json server/app-paths-manifest.json; do
  test -s ".next/$f" || exit 1
done
bash scripts/mission-control-service-start.sh
bash scripts/mission-control-service-health.sh
bash scripts/mission-control-lane-smoke.sh
```

Do not report Dashboard fixed until the service health and public lane smoke have passed.

## 8. Related references

- `projects/_ops/mission-control-broad-savepoint-2026-03-18.md`
- `projects/_ops/mission-control-next-implementation-brief-2026-03-17.md`
- `projects/mission-control/README.md`
- `projects/mission-control/docs/scaffold-notes.md`
