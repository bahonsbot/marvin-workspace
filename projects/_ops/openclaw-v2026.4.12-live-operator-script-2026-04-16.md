# OpenClaw `v2026.4.12` Live Operator Script

Window: **2026-04-16, 13:00-13:40 Asia/Ho_Chi_Minh (GMT+7)**
Purpose: short execution script for the real live upgrade.

This is the compressed companion to:
- `projects/_ops/openclaw-v2026.4.12-live-execution-checklist-2026-04-16.md`

## Ground rules
- Upgrade the live OpenClaw runtime only.
- Do **not** mix in HTTPS/nginx work, Control UI auth cleanup, Dreaming, or Active Memory.
- If `memory search` fails after the upgrade, default to **rollback**, not improvised repair.

## Roles
- **Philippe:** host-side Docker entry, install, and restart
- **Marvin:** validation, smoke checks, decision support

## Docker operator reality for this VPS
This live lane runs inside the Hostinger Docker container `openclaw-ktrt-openclaw-1`.

Default entry points from the VPS host:
- root shell in the live container: `docker exec -it openclaw-ktrt-openclaw-1 bash`
- node shell in the live container: `docker exec -it --user node openclaw-ktrt-openclaw-1 bash`

Rules for this runbook:
- use the `node` shell for normal `openclaw ...`, `curl`, log-capture, and validation commands
- use root in the live container only for the global `npm install -g openclaw@...` step
- restart through the host-side container path, not `openclaw gateway restart` from inside the container

Unless a step explicitly says otherwise, the raw command blocks below are meant to be run from a `node` shell inside the live container.

---

## 1. Freeze and capture baseline
Run:

```bash
LOGDIR=/data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300
mkdir -p "$LOGDIR"

openclaw --version | tee "$LOGDIR/01-version-pre.txt"
openclaw status --json > "$LOGDIR/02-status-pre.json"
openclaw health --json > "$LOGDIR/03-health-pre.json"
openclaw memory status --json > "$LOGDIR/04-memory-status-pre.json"
openclaw memory search --query "Philippe" --max-results 3 --json > "$LOGDIR/05-memory-search-pre.json"
openclaw cron status --json > "$LOGDIR/06-cron-status-pre.json"
openclaw cron list --json > "$LOGDIR/07-cron-list-pre.json"
openclaw sessions --all-agents --json > "$LOGDIR/08-sessions-pre.json"

curl -sS -I http://127.0.0.1:3005/general/home > "$LOGDIR/09-home-pre.txt"
curl -sS -I http://127.0.0.1:3005/general/chat > "$LOGDIR/10-chat-pre.txt"
curl -sS -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main" > "$LOGDIR/11-history-pre.txt"
```

If the live lane is already unhealthy here, **stop**.

---

## 2. Confirm install path
Run:

```bash
which openclaw | tee "$LOGDIR/12-which-openclaw.txt"
readlink -f "$(which openclaw)" | tee "$LOGDIR/13-openclaw-realpath.txt"
stat -c "%U:%G %a %n" /usr/local/bin/openclaw /usr/local/lib/node_modules/openclaw > "$LOGDIR/14-openclaw-stat.txt"
```

Expected shape:
- `/usr/local/bin/openclaw`
- `/usr/local/lib/node_modules/openclaw`
- root-owned global install

---

## 3. Snapshot checkpoint
Before mutation:
- take the normal VPS/operator snapshot if available
- confirm you are ready to do a host-side restart

If snapshot/restart authority is not available, **defer the window**.

---

## 4. Upgrade the live package
Run from the VPS host in the live container as root:

```bash
docker exec -i openclaw-ktrt-openclaw-1 bash -lc 'npm install -g openclaw@2026.4.12'
```

If you prefer an interactive root shell, enter `docker exec -it openclaw-ktrt-openclaw-1 bash` first, then run the same `npm install -g ...` command inside the container.

If the live container originally used a different global npm prefix than `/usr/local`, use that same path instead of forcing a new one.

If install fails, **stop and rollback only if the live install is left broken**.

---

## 5. Restart the live gateway
Run on the VPS host through the container path:

```bash
docker restart openclaw-ktrt-openclaw-1
```

If the deployment uses a different established host-side container/service wrapper, use that exact restart path instead.

Do **not** run `openclaw gateway restart` from inside the container.

---

## 6. Immediate health proof
Run:

```bash
openclaw --version | tee "$LOGDIR/20-version-post.txt"
openclaw status --json > "$LOGDIR/21-status-post.json"
openclaw health --json > "$LOGDIR/22-health-post.json"
```

Pass condition:
- version reads `2026.4.12`
- gateway is healthy

If not, **rollback immediately**.

---

## 7. QMD / memory gate
Run:

```bash
openclaw memory status --json > "$LOGDIR/23-memory-status-post.json"
openclaw memory search --query "Philippe" --max-results 3 --json > "$LOGDIR/24-memory-search-post.json"
```

Pass condition:
- both succeed

Important:
- `memory status` is not enough
- the real gate is **`memory search`**

If `memory search` fails, **rollback**.

---

## 8. Cron + sessions gate
Run:

```bash
openclaw cron status --json > "$LOGDIR/25-cron-status-post.json"
openclaw cron list --json > "$LOGDIR/26-cron-list-post.json"
openclaw sessions --all-agents --json > "$LOGDIR/27-sessions-post.json"
```

If these fail, **rollback**.

---

## 9. Mission Control HTTP gate
Run:

```bash
curl -sS -I http://127.0.0.1:3005/general/home > "$LOGDIR/28-home-post.txt"
curl -sS -I http://127.0.0.1:3005/general/chat > "$LOGDIR/29-chat-post.txt"
curl -sS -I http://127.0.0.1:3005/general/agents > "$LOGDIR/30-agents-post.txt"
curl -sS -I http://127.0.0.1:3005/general/crons > "$LOGDIR/31-crons-post.txt"
curl -sS -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main" > "$LOGDIR/32-history-post.txt"
```

If core pages or runtime-bridge history fail, **rollback**.

---

## 10. Bounded live chat proof
In Mission Control live Chat, send:

```text
Reply exactly with LIVE_UPGRADE_OK and nothing else.
```

Pass condition:
- reply arrives
- no obvious routing glitch
- no immediate preview breakage

If it fails, **rollback**.

---

## 11. Short observation window
Run:

```bash
openclaw status --json > "$LOGDIR/33-status-final.json"
openclaw health --json > "$LOGDIR/34-health-final.json"
```

If everything still looks sane, declare success.

Then stop. Do **not** open a second workstream in the same window.

---

## Rollback script
If rollback is triggered:

From the VPS host as root:

```bash
docker exec -i openclaw-ktrt-openclaw-1 bash -lc 'npm install -g openclaw@2026.3.8'
docker restart openclaw-ktrt-openclaw-1
```

Then from a `node` shell inside the live container, run:

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

If rollback succeeds, stop for the day.

---

## Marvin’s blunt decision rule
- **If gateway/version fail:** rollback.
- **If QMD memory search fails:** rollback.
- **If Mission Control core pages fail:** rollback.
- **If bounded live chat fails:** rollback.
- If all four pass, the window counts as a success.
