# OpenClaw `v2026.4.12` Live Execution Checklist

Window: **2026-04-16, 13:00-13:40 Asia/Ho_Chi_Minh (GMT+7)**
Goal: upgrade the live OpenClaw runtime from `2026.3.8` to `v2026.4.12` with the smallest possible blast radius.
Scope: **runtime upgrade only**
Do not mix in:
- HTTPS / nginx repair
- Control UI auth cleanup
- Dreaming enablement
- Active Memory enablement
- Telegram ownership experiments
- unrelated Mission Control UI work

## Roles
- **Operator / host shell:** Philippe
- **Validation / note-taking / smoke checks:** Marvin

## Docker operator reality for this VPS
This live lane runs inside the Hostinger Docker container `openclaw-ktrt-openclaw-1`.

Default entry points from the VPS host:
- root shell in the live container: `docker exec -it openclaw-ktrt-openclaw-1 bash`
- node shell in the live container: `docker exec -it --user node openclaw-ktrt-openclaw-1 bash`

Rules for this checklist:
- use the `node` shell for normal `openclaw ...`, `curl`, log-capture, and validation commands
- use root in the live container only for the global `npm install -g openclaw@...` step
- restart through the host-side container path, not `openclaw gateway restart` from inside the container

Unless a step explicitly says otherwise, the raw command blocks below are meant to be run from a `node` shell inside the live container.

## Known live install shape
Observed before planning:
- binary: `/usr/local/bin/openclaw`
- package path: `/usr/local/lib/node_modules/openclaw/openclaw.mjs`
- ownership: `root:root`

Interpretation:
- live upgrade should use the same global npm install path
- live restart must happen from the **host/operator side**, not from inside this container session

## Hard success criteria
The window counts as successful only if all are true:
- `openclaw --version` reports `2026.4.12`
- live gateway is healthy
- Mission Control live preview works on `3005`
- runtime bridge history works
- `openclaw memory status --json` is healthy
- `openclaw memory search --query "Philippe" --max-results 3 --json` works
- cron inventory loads
- one bounded live chat send succeeds

## Hard rollback triggers
Rollback immediately if any of these happen and do not clear fast:
- gateway fails to come healthy after restart
- `openclaw --version` is not `2026.4.12`
- Mission Control preview returns non-200 on core pages
- runtime bridge history fails
- QMD `memory search` fails
- cron status/list is broken
- bounded live chat send fails

---

# Minute-by-minute plan

## 13:00-13:03 — Freeze the lane
**Goal:** stop casual changes and capture the exact starting state.

Operator:
- stop making unrelated preview/config edits
- keep chat traffic light during the window

Marvin validation commands:
```bash
mkdir -p /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300
cd /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300

openclaw --version | tee 01-version.txt
openclaw status --json > 02-status-pre.json
openclaw health --json > 03-health-pre.json
openclaw memory status --json > 04-memory-status-pre.json
openclaw memory search --query "Philippe" --max-results 3 --json > 05-memory-search-pre.json
openclaw cron status --json > 06-cron-status-pre.json
openclaw cron list --json > 07-cron-list-pre.json
openclaw sessions --all-agents --json > 08-sessions-pre.json
openclaw security audit --json > 09-security-audit-pre.json

curl -sS -I http://127.0.0.1:3005/general/home > 10-home-head-pre.txt
curl -sS -I http://127.0.0.1:3005/general/chat > 11-chat-head-pre.txt
curl -sS -I http://127.0.0.1:3005/general/agents > 12-agents-head-pre.txt
curl -sS -I http://127.0.0.1:3005/general/crons > 13-crons-head-pre.txt
curl -sS -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main" > 14-history-head-pre.txt
```

**Pass condition:** everything that was healthy before the window is still healthy at 13:03.
**Abort now if:** preview is already broken before the upgrade.

## 13:03-13:05 — Confirm install path and commit points
**Goal:** make sure we are upgrading the right thing and can explain rollback cleanly.

Operator / Marvin:
```bash
which openclaw | tee 15-which-openclaw.txt
readlink -f "$(which openclaw)" | tee 16-openclaw-realpath.txt
stat -c "%U:%G %a %n" /usr/local/bin/openclaw /usr/local/lib/node_modules/openclaw > 17-openclaw-stat.txt
```

Also note the current repo commits:
```bash
cd /data/.openclaw/workspace && git rev-parse --short HEAD | tee /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300/18-workspace-commit.txt
cd /data/.openclaw/workspace/projects/mission-control && git rev-parse --short HEAD | tee /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300/19-mission-control-commit.txt
```

**Pass condition:** install path still matches the expected root-owned global npm layout.

## 13:05-13:08 — Snapshot / operator checkpoint
**Goal:** last safe pause before mutation.

Operator:
- take the normal VPS / host snapshot if available
- confirm host-side restart authority is ready

**Decision at 13:08:**
- if snapshot or restart authority is not available, **defer**
- otherwise continue

## 13:08-13:14 — Host-side install to `v2026.4.12`
**Goal:** update the live package, nothing else.

**Host-side command, run by operator on the real install lane:**
```bash
docker exec -i openclaw-ktrt-openclaw-1 bash -lc 'npm install -g openclaw@2026.4.12'
```

If you prefer an interactive root shell, enter `docker exec -it openclaw-ktrt-openclaw-1 bash` first, then run the same `npm install -g ...` command inside the container.

If the live container uses a different global npm prefix than `/usr/local`, use the original install mechanism instead of forcing a new one.

**Pass condition by 13:14:** install command exits successfully.
**Rollback trigger:** install itself fails or lands in the wrong location.

## 13:14-13:17 — Host-side restart
**Goal:** bring the upgraded live gateway back.

Preferred host-side command family:
```bash
docker restart openclaw-ktrt-openclaw-1
```

If the live runtime is actually controlled by a different host-managed container/service wrapper, restart it through that normal host path instead.

**Important:** do not run `openclaw gateway restart` from inside the container.

## 13:17-13:20 — Immediate version + health proof
**Goal:** prove the upgraded runtime is alive before doing deeper checks.

Marvin validation commands:
```bash
cd /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300

openclaw --version | tee 20-version-post.txt
openclaw status --json > 21-status-post.json
openclaw health --json > 22-health-post.json
```

**Pass condition:**
- version is `2026.4.12`
- gateway health is good

**Rollback now if:** gateway is not healthy by 13:20.

## 13:20-13:24 — Memory / QMD proof
**Goal:** verify the one known migration risk directly.

Marvin validation commands:
```bash
cd /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300

openclaw memory status --json > 23-memory-status-post.json
openclaw memory search --query "Philippe" --max-results 3 --json > 24-memory-search-post.json
```

**Pass condition:** both commands succeed.

**Important note:** `memory status` alone is not enough. The real proof is the actual `memory search`.

**Default action if `memory search` fails:** rollback. Do **not** turn the live window into ad-hoc QMD surgery unless Philippe explicitly chooses to extend the window.

## 13:24-13:27 — Cron + sessions proof
**Goal:** make sure the scheduler surfaces still load cleanly.

Marvin validation commands:
```bash
cd /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300

openclaw cron status --json > 25-cron-status-post.json
openclaw cron list --json > 26-cron-list-post.json
openclaw sessions --all-agents --json > 27-sessions-post.json
```

**Pass condition:** cron and sessions inventory load without failure.

## 13:27-13:31 — Mission Control core HTTP proof
**Goal:** confirm the live preview and runtime bridge still behave.

Marvin validation commands:
```bash
cd /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300

curl -sS -I http://127.0.0.1:3005/general/home > 28-home-head-post.txt
curl -sS -I http://127.0.0.1:3005/general/chat > 29-chat-head-post.txt
curl -sS -I http://127.0.0.1:3005/general/agents > 30-agents-head-post.txt
curl -sS -I http://127.0.0.1:3005/general/crons > 31-crons-head-post.txt
curl -sS -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main" > 32-history-head-post.txt
```

**Pass condition:** all return healthy `200` / expected redirect behavior.

## 13:31-13:35 — Bounded live chat proof
**Goal:** prove normal interaction still works.

Operator:
- open Mission Control live preview
- go to Chat
- send one bounded message such as:
  - `Reply exactly with LIVE_UPGRADE_OK and nothing else.`

Marvin checks:
- reply arrives
- no obvious routing weirdness
- session remains on the expected live lane

**Pass condition:** clean response arrives.
**Rollback trigger:** bounded live chat proof fails.

## 13:35-13:37 — Short observation window
**Goal:** catch immediate flapping before declaring success.

Marvin quick checks:
```bash
openclaw status --json > /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300/33-status-final.json
openclaw health --json > /data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300/34-health-final.json
```

Operator:
- keep the preview open
- confirm nothing obviously disconnects, stalls, or flips unhealthy

## 13:37-13:40 — Close or rollback
If everything above passed:
- declare the live window successful
- do **not** start HTTPS/auth cleanup in the same window
- schedule the next track separately

If any hard rollback trigger fired:
- jump to the rollback lane below immediately

---

# Rollback lane

Use only if the live window fails.

## Rollback commands
**Host-side operator command:**
```bash
docker exec -i openclaw-ktrt-openclaw-1 bash -lc 'npm install -g openclaw@2026.3.8'
docker restart openclaw-ktrt-openclaw-1
```

If you use a different established host-side container wrapper, restart through that exact path instead.

## Rollback validation
From a `node` shell inside the live container:
```bash
openclaw --version
openclaw status --json
openclaw health --json
openclaw memory status --json
openclaw memory search --query "Philippe" --max-results 3 --json
curl -I http://127.0.0.1:3005/general/home
curl -I http://127.0.0.1:3005/general/chat
curl -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main"
```

If rollback succeeds, stop there. Do not attempt a second live upgrade in the same afternoon.

---

# Notes specific to this upgrade

## Known risk already seen in rehearsal
- QMD collection-name migration can make `memory status` look healthy while `memory search` still fails.
- Treat that as a real blocker, not cosmetic noise.

## Known non-blocker readout noise
- Mission Control may intermittently surface fallback-model chatter even when live runtime status still reports active model `gpt-5.4`.
- During the window, trust the runtime status over UI vibes unless the runtime itself confirms a real model drop.

## Explicitly out of scope for this window
- turning on Active Memory
- turning on Dreaming
- fixing remote preview HTTPS
- Control UI auth / device-auth hardening cleanup
- experimental Telegram routing tests
