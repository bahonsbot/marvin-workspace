# OpenClaw `v2026.4.12` Rehearsal Execution Plan

Date: 2026-04-16
Status: planning only
Related audit: `projects/_ops/openclaw-v2026.4.12-upgrade-audit-2026-04-16.md`

## Core decision

Run the rehearsal in a **separate source/instance lane** and keep the current March runtime untouched.

My recommended topology:
- **Separate OpenClaw checkout or isolated runtime** pinned to `v2026.4.12`
- **Separate OpenClaw profile** such as `rehearsal-412`
- **Separate gateway port** such as `19001`
- **Separate Mission Control preview env** pointed at the rehearsal gateway
- **Telegram disabled by default** in the rehearsal until the base smoke tests pass

What stays **off** in the first rehearsal:
- Dreaming
- Active Memory
- HTTPS/proxy hardening changes
- Control UI security cleanup
- provider/path refactors not required for startup

Reason: the first rehearsal should answer one question only:

> Can `v2026.4.12` run our current setup cleanly enough that Mission Control, QMD, cron/session behavior, and the gateway still behave like adults?

---

## Why this topology is the right one

Current install reality:
- the live OpenClaw is a **package install**, not a disposable repo checkout
- Mission Control preview is currently healthy against the rolled-back workspace baseline
- the current deployment still relies on dangerous Control UI compatibility flags
- remote HTTPS is still a separate unresolved track for secure-context features like STT

So the wrong move would be to use `openclaw update` directly against the live package install just to “see what happens.”

The right move is:
1. pin `v2026.4.12` in isolation
2. point Mission Control preview at that isolated gateway
3. prove the read surfaces and bounded write surfaces
4. only then decide whether a real update window is justified

---

## Rehearsal boundaries

### In scope
- gateway startup and health
- Mission Control core pages against the rehearsal runtime
- runtime bridge descriptor/history behavior
- bounded chat send through the sidecar path
- QMD memory health
- cron and session read surfaces
- one disposable isolated cron execution test
- Telegram probe, then optional routing test in a controlled lane

### Explicitly out of scope for the first pass
- STT / microphone validation on remote HTTP
- device-auth cleanup
- HTTPS proxy remediation
- enabling Dreaming
- enabling Active Memory
- changing bot/channel ownership models
- live control-plane mutation on the current production runtime

---

## Rehearsal topology and config shape

### A. Rehearsal OpenClaw runtime
Use a dedicated profile so nothing shares the live state tree.

Suggested values:
- profile: `rehearsal-412`
- gateway URL: `ws://127.0.0.1:19001`
- state root: isolated under the profile path
- auth/config: copied from current live config, then trimmed only where needed for safety

Hard rule:
- do **not** point the rehearsal at the live profile/state/store

### B. Rehearsal Mission Control preview
Use a dedicated preview env file or temporary override values.

Important envs:
- `MISSION_CONTROL_WS_TARGET=ws://127.0.0.1:19001`
- `MISSION_CONTROL_GATEWAY_AUTH_TOKEN=<rehearsal gateway token>`
- `MISSION_CONTROL_WS_UPSTREAM_ORIGIN=<rehearsal browser origin>`

Why these matter:
- the WS sidecar can infer a gateway target from `openclaw status --json`, but for rehearsal it is cleaner to point it explicitly
- Mission Control can only do a real bounded composer send if `MISSION_CONTROL_GATEWAY_AUTH_TOKEN` is configured
- without that token, the runtime bridge remains mostly transport-only and the chat send test is not meaningful

### C. Telegram posture during rehearsal
Default posture:
- keep Telegram **disabled** in the rehearsal config during base smoke tests

Why:
- the live runtime already owns the current bot/channel lane
- running two gateways against the same Telegram bot in polling/webhook lanes is begging for weirdness

Preferred options for Telegram routing validation:
1. **best**: use a secondary test bot in the rehearsal
2. **acceptable**: use the real bot only during a short exclusive rehearsal window, with the live consumer intentionally out of the way
3. **not acceptable**: leave both runtimes competing for the same Telegram lane and pretend the result means anything

---

## Execution phases

## Phase 0 — Baseline capture

Capture the current known-good March baseline before the rehearsal starts.

Evidence to save:
- `openclaw --version`
- `openclaw update status --json`
- `openclaw status --json`
- `openclaw health --json`
- `openclaw memory status --json`
- `openclaw cron status --json`
- `openclaw cron list --json`
- `openclaw sessions --all-agents --json`
- local Mission Control route checks for:
  - `/general/home`
  - `/general/chat`
  - `/general/tasks`
  - `/general/agents`
  - `/general/crons`
  - `/general/memory`
  - `/general/files`
  - `/api/runtime-bridge`
  - `/api/runtime-bridge/history?sessionKey=agent:main:main`

This baseline becomes the comparison set.

## Phase 1 — Rehearsal runtime bring-up

Objective:
- start `v2026.4.12` in isolation without touching the live package install or live profile

Preflight checks:
- config validates
- no placeholder credentials block startup
- rehearsal gateway port is free
- rehearsal profile does not point at live state
- Dreaming and Active Memory are both still disabled

## Phase 2 — Mission Control repoint

Objective:
- aim the current Mission Control preview at the rehearsal gateway, not the live one

Required before meaningful runtime-bridge testing:
- rehearsal gateway reachable
- `MISSION_CONTROL_WS_TARGET` points at the rehearsal gateway
- `MISSION_CONTROL_GATEWAY_AUTH_TOKEN` is valid for the rehearsal gateway
- Mission Control preview restarts cleanly

## Phase 3 — P0 smoke tests

P0 means: if any of these fail, stop the rehearsal and fix or abandon before doing deeper checks.

P0 areas:
- gateway startup
- Mission Control Home + Chat + Crons + Agents
- runtime bridge descriptor
- runtime bridge history for `agent:main:main`
- QMD memory backend health
- cron list/status visibility
- session registry visibility

## Phase 4 — P1 smoke tests

P1 means: still important, but failure does not necessarily mean the whole upgrade is dead.

P1 areas:
- Tasks / Memory / Files pages
- alternate session history hydration
- bounded composer send through Mission Control
- memory search results
- disposable isolated cron run
- Telegram probe

## Phase 5 — Controlled Telegram routing test

Only do this if all P0 tests pass.

Preferred sequence:
1. secondary test bot, or exclusive bot ownership window
2. send one DM test message
3. send one reply back out
4. confirm the rehearsal session store recorded the exchange
5. restore the normal live ownership immediately after the test

---

## Smoke-test matrix

## P0 — must pass

| ID | Area | Action / command | Pass criteria | Evidence to save | Severity if failed |
|---|---|---|---|---|---|
| G-01 | Gateway config | `openclaw --profile rehearsal-412 config validate --json` | valid config, no schema errors | JSON output | Stop |
| G-02 | Gateway readiness | `openclaw --profile rehearsal-412 doctor --non-interactive` | no fatal repair blockers | command output | Stop if fatal |
| G-03 | Gateway status | `openclaw --profile rehearsal-412 status --json` | returns healthy gateway metadata and session summary | JSON output | Stop |
| G-04 | Gateway health | `openclaw --profile rehearsal-412 health --json` | `ok: true` | JSON output | Stop |
| MC-01 | Core page | `curl -I http://127.0.0.1:3005/general/home` | HTTP `200` | headers | Stop |
| MC-02 | Core page | `curl -I http://127.0.0.1:3005/general/chat` | HTTP `200` | headers | Stop |
| MC-03 | Core page | `curl -I http://127.0.0.1:3005/general/agents` | HTTP `200` | headers | Stop |
| MC-04 | Core page | `curl -I http://127.0.0.1:3005/general/crons` | HTTP `200` | headers | Stop |
| RB-01 | Runtime bridge descriptor | `curl http://127.0.0.1:3005/api/runtime-bridge` | HTTP `200`, valid JSON, bridge descriptor present | response body | Stop |
| RB-02 | Main-session history | `curl "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=agent:main:main"` | HTTP `200`, non-empty JSON payload | response body | Stop |
| MEM-01 | Memory backend | `openclaw --profile rehearsal-412 memory status --json` | backend is QMD, vector available, no scan issues | JSON output | Stop |
| CR-01 | Cron scheduler | `openclaw --profile rehearsal-412 cron status --json` | scheduler responds without error | JSON output | Stop |
| CR-02 | Cron inventory | `openclaw --profile rehearsal-412 cron list --json` | job list loads with expected named jobs present | JSON output | Stop |
| SES-01 | Session registry | `openclaw --profile rehearsal-412 sessions --all-agents --json` | non-empty session list, `agent:main:main` visible | JSON output | Stop |

## P1 — should pass before promoting the rehearsal

| ID | Area | Action / command | Pass criteria | Evidence to save | Severity if failed |
|---|---|---|---|---|---|
| MC-05 | Supporting page | `curl -I http://127.0.0.1:3005/general/tasks` | HTTP `200` | headers | Important |
| MC-06 | Supporting page | `curl -I http://127.0.0.1:3005/general/memory` | HTTP `200` | headers | Important |
| MC-07 | Supporting page | `curl -I http://127.0.0.1:3005/general/files` | HTTP `200` | headers | Important |
| RB-03 | Alternate history | `curl "http://127.0.0.1:3005/api/runtime-bridge/history?sessionKey=<known-cron-or-other-session>"` | HTTP `200`, non-empty or well-formed empty JSON according to session reality | response body | Important |
| RB-04 | Bounded chat send | In Mission Control Chat, send `rehearsal bridge ping` into the rehearsal runtime | assistant reply appears, session updates, no bridge auth error | screenshot + session evidence | Important |
| MEM-02 | Memory search | `openclaw --profile rehearsal-412 memory search --query "Mission Control" --max-results 5 --json` | non-empty result set | JSON output | Important |
| CR-03 | Cron run history | `openclaw --profile rehearsal-412 cron runs --id nightly-security-review --limit 3` | returns readable run history without shape errors | command output | Important |
| CR-04 | Disposable isolated cron | Create one isolated one-shot job with `--no-deliver`, then run it and inspect history | job reaches `ok` and leaves a run record | add/run/runs outputs | Important |
| SES-02 | Recent session growth | repeat `openclaw --profile rehearsal-412 sessions --all-agents --json` after RB-04 or CR-04 | new or updated session timestamps appear | JSON diff | Important |
| TG-01 | Telegram probe | `openclaw --profile rehearsal-412 channels status --probe` | bot probe succeeds without auth/config breakage | output | Important |
| TG-02 | Telegram routing (controlled lane only) | send one DM in, one DM out, then inspect rehearsal sessions | inbound and outbound both work during exclusive test window | message IDs + session evidence | Important / gated |

---

## Recommended disposable cron test

Use a cron job with no external delivery and no side effects.

Suggested shape:
- session target: `isolated`
- one-shot job: `--at +10m --keep-after-run`
- delivery: `--no-deliver`
- model: keep current default or set a known cheap stable model
- message: something inert, for example: `Reply exactly with NO_REPLY.`

Example command shape:

```bash
openclaw --profile rehearsal-412 cron add \
  --name rehearsal-echo \
  --session isolated \
  --at +10m \
  --keep-after-run \
  --no-deliver \
  --model minimax/MiniMax-M2.7 \
  --timeout-seconds 60 \
  --message "Reply exactly with NO_REPLY." \
  --json
```

Then:

```bash
openclaw --profile rehearsal-412 cron run <job-id>
openclaw --profile rehearsal-412 cron runs --id <job-id> --limit 5
```

Pass condition:
- the job runs cleanly
- run history is recorded
- session state updates cleanly
- nothing external is delivered

---

## Mission Control-specific notes for the rehearsal

### 1. Treat `/api/runtime-bridge` and `/api/runtime-bridge/history` as first-class proof
If those two routes are broken, the UI may still render a shell, but the runtime truth is not trustworthy.

### 2. Composer send is not a free default
Mission Control can only perform a real bounded chat send if:
- the WS sidecar is healthy
- `MISSION_CONTROL_WS_TARGET` points to the rehearsal gateway
- `MISSION_CONTROL_GATEWAY_AUTH_TOKEN` is valid

Without those, the chat surface may look alive while actually sitting in a polite waiting room.

### 3. History hydration must be tested after a cold restart
The relevant risk is not only “page loads once.”
It is whether:
- history rehydrates correctly after preview restart
- the current session still loads
- recent sessions still switch cleanly
- no duplicate or empty-history regression appears

---

## Exit gates

## Rehearsal is a GO for deeper testing only if:
- all P0 checks pass
- no schema/startup blockers appear
- Mission Control runtime bridge works against the rehearsal gateway
- QMD memory health is normal
- cron and sessions surfaces are intact

## Rehearsal is a GO for live-window planning only if:
- P0 passes cleanly
- P1 is materially clean
- Telegram probe is clean
- disposable isolated cron test is clean
- no adapter-shape break shows up in Mission Control

## Rehearsal is a NO-GO if any of these happen:
- gateway does not start cleanly
- Mission Control core pages lose data truth against the rehearsal runtime
- runtime bridge descriptor/history breaks
- QMD backend is unhealthy or unreadable
- cron/session surfaces regress materially
- Telegram can only work by stepping on the live runtime unexpectedly

---

## Rollback posture

Because this is a rehearsal lane, rollback should be boring.

Rollback order:
1. stop the rehearsal gateway
2. point Mission Control preview back to the current live gateway env
3. restore the previous preview env file
4. archive rehearsal evidence
5. delete or keep the rehearsal checkout depending on what was learned

Hard rule:
- do **not** mutate the live package install, live profile, or live HTTPS proxy just to rescue a bad rehearsal

---

## My recommendation for the next actual move

Do the rehearsal in this order:
1. prepare the isolated `v2026.4.12` runtime
2. repoint Mission Control preview to it
3. run all **P0** tests
4. run **RB-04**, **MEM-02**, and **CR-04**
5. only then decide whether Telegram routing deserves a short controlled handoff window

That gives us the maximum amount of useful truth before we touch the live HTTPS or live update tracks.
