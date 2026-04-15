# OpenClaw `v2026.4.12` Live Upgrade Window Plan

Date: 2026-04-16
Status: recommended after successful isolated rehearsal + disposable cron verification
Related files:
- `projects/_ops/openclaw-v2026.4.12-upgrade-audit-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-rehearsal-execution-plan-2026-04-16.md`

## Recommendation

Proceed with a **single-purpose live upgrade window** for the core OpenClaw runtime only.

Do **not** mix these into the same window:
- HTTPS / nginx preview remediation
- Control UI auth hardening cleanup
- Dreaming enablement
- Active Memory enablement
- Telegram ownership experiments
- Mission Control UI refactors unrelated to the upgrade

The rehearsal now proves the base runtime can survive our setup well enough to justify a controlled live attempt.

## What the rehearsal proved

Verified in isolated `v2026.4.12` lane:
- gateway healthy on a separate port
- Mission Control preview healthy against the rehearsal gateway
- runtime bridge history healthy
- cron status/list healthy
- sessions registry healthy
- QMD backend healthy once local PATH matched the live toolchain
- disposable isolated cron run succeeded with:
  - `status: ok`
  - summary `OK`
  - no delivery
  - fresh cron session record

Important wrinkle discovered during rehearsal:
- legacy QMD collection naming can block `memory search` after upgrade if the state still carries the old `memory` collection while `v2026.4.12` expects `memory-dir-main`
- treat this as a **known migration check**, not a surprise during the live window

## Go / no-go criteria

## Go only if all are true before the window starts
- live Mission Control preview on `3005` is healthy
- live gateway health is healthy
- no urgent active user conversation depends on a stable live Chat during the next hour
- no in-flight workspace refactor or preview restart work is happening
- host-side operator is available to perform restart / rollback if needed
- current workspace and Mission Control repos are committed at known points

## No-go if any are true
- preview is already unstable before the window
- host-side restart authority is not available
- a critical cron job is due in the next few minutes and cannot be safely skipped/delayed
- Telegram routing is actively being depended on during the window

## Recommended window

### Preferred
- **Weekend, 11:00-12:00 Asia/Ho_Chi_Minh**

Why:
- avoids the dense overnight review block
- avoids weekday market-signal timing pressure
- gives room for rollback without clipping the next scheduled OpenClaw cron wave

### Weekday fallback
- **13:00-13:40 Asia/Ho_Chi_Minh**

Why:
- after the 10:15 queue wakeup has settled
- before the 14:15 queue wakeup
- outside the overnight review block

Avoid windows that overlap:
- `:45` weekday market-signal-generator runs
- `03:00-04:00` overnight review jobs
- `07:30-10:15` morning improvement/task windows
- `20:00-22:00` market brief / report / review windows

## Exact pre-window checklist

Capture these before touching the live install:

```bash
openclaw --version
openclaw status --json
openclaw health --json
openclaw memory status --json
openclaw cron status --json
openclaw cron list --json
openclaw sessions --all-agents --json
openclaw security audit --json
curl -I http://127.0.0.1:3005/general/home
curl -I http://127.0.0.1:3005/general/chat
curl -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main"
```

Also confirm the current install path and ownership:

```bash
which openclaw
readlink -f "$(which openclaw)"
stat -c "%U:%G %a %n" /usr/local/bin/openclaw /usr/local/lib/node_modules/openclaw
```

Current observed live install shape:
- binary: `/usr/local/bin/openclaw`
- package path: `/usr/local/lib/node_modules/openclaw/openclaw.mjs`
- ownership: `root:root`

Interpretation:
- the live runtime looks like a **root-owned global npm install**
- the live update should therefore use the **same host-side global npm mechanism**, not a random alternate installer

## Live upgrade sequence

## Phase 1 — Freeze and snapshot
1. Confirm both workspace repos are committed.
2. Save the baseline command outputs above.
3. Take the normal VPS/operator snapshot path if available.
4. Optionally save a quick local state bundle of the most critical OpenClaw state if the operator wants belt-and-suspenders rollback.

## Phase 2 — Host-side install
Because this environment should not restart the gateway from inside the container session, do the install/restart from the host/operator side.

Expected install style, based on the current live path:

```bash
sudo npm install -g openclaw@2026.4.12
```

If the host used a different global npm prefix originally, use that same mechanism instead of forcing a new one.

## Phase 3 — Host-side restart
Restart the live gateway from the host side only.

Use the host/operator path, not this container session.
Expected command family:

```bash
openclaw gateway restart
```

If the deployment wraps OpenClaw in a host-managed container/service layer, restart it through that normal host service path instead.

## Phase 4 — Immediate post-upgrade checks
Must pass within the first few minutes:

```bash
openclaw --version
openclaw status --json
openclaw health --json
openclaw memory status --json
openclaw memory search --query "Philippe" --max-results 3 --json
openclaw cron status --json
openclaw cron list --json
openclaw sessions --all-agents --json
curl -I http://127.0.0.1:3005/general/home
curl -I http://127.0.0.1:3005/general/chat
curl -I http://127.0.0.1:3005/general/agents
curl -I http://127.0.0.1:3005/general/crons
curl -I "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main"
```

## Phase 5 — Bounded live proof
Only if the checks above pass:
1. open Mission Control live preview
2. verify Chat loads cleanly
3. do one bounded message send
4. confirm reply arrives
5. run a Telegram probe only if needed, not a full routing experiment unless explicitly desired

## Known migration watchpoints

## 1. QMD collection naming
Rehearsal showed a real risk:
- old state can contain collection `memory`
- new code can expect `memory-dir-main`

Live watch command:

```bash
openclaw memory search --query "Philippe" --max-results 3 --json
```

If `memory status` is healthy but `memory search` fails with collection-not-found behavior, inspect the managed QMD collection config before declaring the full upgrade healthy.

## 2. Preview/process isolation
This is already fixed in workspace source:
- `projects/mission-control/scripts/preview-stop.sh` now kills only the selected runtime-dir processes

That fix should remain in place before any later parallel preview work.

## 3. Fallback-model UI noise
During rehearsal, the UI intermittently appeared to surface fallback-model state even when live session status still reported active model `gpt-5.4`.
Treat this as a **secondary readout issue** unless the runtime itself confirms a real active-model drop.

## Rollback triggers
Rollback immediately if any of these happen and do not clear quickly:
- gateway does not come healthy
- `openclaw --version` is not `2026.4.12` after restart
- Mission Control live preview stops loading
- runtime bridge history fails
- `memory status` or `memory search` is broken in a way that blocks normal recall
- cron status/list is broken
- bounded live chat send fails

## Rollback path
Use the same install mechanism in reverse:

```bash
sudo npm install -g openclaw@2026.3.8
```

Then perform the same host-side gateway/service restart path and rerun the baseline checks.

## Success definition
The live upgrade window counts as successful when all are true:
- live runtime reports `OpenClaw 2026.4.12`
- Mission Control preview works on the live lane
- runtime bridge/history works
- QMD memory search works, not just memory status
- cron inventory loads
- one bounded live chat send succeeds
- no immediate rollback trigger appears in the first observation window

## Final recommendation

The smart move now is:
1. stop expanding the rehearsal scope
2. treat the rehearsal as passed
3. schedule a narrow live runtime upgrade window
4. keep HTTPS/device-auth cleanup as the next separate track after the live runtime is stable
