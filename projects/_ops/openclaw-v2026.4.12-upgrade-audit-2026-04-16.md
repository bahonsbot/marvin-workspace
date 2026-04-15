# OpenClaw v2026.3.8 → v2026.4.12 Upgrade Audit

Date: 2026-04-16 00:xx GMT+7
Scope: audit only, no live upgrade
Target: `v2026.4.12`

## Executive summary

Recommendation: **upgrade in an isolated rehearsal lane, then promote only after verification**.

Do **not** cherry-pick Dreaming or QMD pieces onto the current March build, and do **not** combine the core OpenClaw upgrade with live HTTPS hardening in the same change window.

My call:
- **GO** for a rehearsal upgrade to `v2026.4.12`
- **NO** for a direct live upgrade from the current rolled-back runtime
- **NO** for turning on Dreaming or Active Memory during the first upgrade rehearsal

Why:
1. `v2026.4.12` brings meaningful wins for QMD, isolated-session correctness, cron auth consistency, Control UI behavior, and security hardening.
2. The current deployment already relies on three dangerous Control UI flags, so mixing security cleanup into the same window is the easiest way to break current access.
3. Dreaming and Active Memory are promising, but both widen the blast radius. They should be tested only after the base runtime is proven stable.

---

## Current verified baseline

Verified from the local runtime and safe config inspection:

- Installed OpenClaw version: **2026.3.8**
- Gateway bind: **loopback**
- Gateway auth mode: **token**
- `gateway.trustedProxies`: `127.0.0.1/32`
- Control UI currently depends on:
  - `gateway.controlUi.allowInsecureAuth=true`
  - `gateway.controlUi.dangerouslyDisableDeviceAuth=true`
  - `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=true`
- `gateway.controlUi.allowedOrigins` is explicitly configured
- Memory backend: **qmd**
- QMD scope: **life**
- `memory-core` plugin: **disabled**
- Dreaming: **disabled**
- `active-memory` plugin: **disabled**

Current security audit baseline:
- **1 critical**
- **4 warn**
- **1 info**

The critical finding is the existing Control UI device-auth disable flag. That is not theoretical risk, it is part of the current deployment posture.

Important implication: the current system already works partly because those dangerous flags are still in place. Any update plan that tries to “clean that up while we’re here” is needlessly risky.

---

## What changed upstream that matters most to us

This upgrade spans roughly a month of releases, from `v2026.3.8` to `v2026.4.12`.
The delta is large enough that this should be treated as a real upgrade program, not a casual bump.

### 1) Memory, QMD, Dreaming

#### Why this matters to us
Our runtime already uses **QMD** as the memory backend, so QMD reliability and scope behavior are directly relevant even if Dreaming remains off.

#### Notable upstream changes

**v2026.4.5**
- Dreaming lands as an **experimental, opt-in** memory consolidation system.
- Dreaming gets a `/dreaming` command, Dreams UI, weighted promotion, and a simplified `enabled + frequency` setup.
- QMD compatibility is improved: newer `qmd collection add --glob`, newer JSON hit metadata, docs/doctor guidance, and backward compatibility for older QMD releases.

**v2026.4.10**
- **Active Memory** is introduced as a separate optional plugin.
- It is a blocking memory sub-agent that runs before eligible interactive replies.
- It is opt-in and aimed at persistent conversational sessions, not background automation.
- Persistent `/dreaming on|off` changes are tightened to require `operator.admin`.

**v2026.4.12**
- QMD-backed short-term recall now defaults to **`search`** instead of the more brittle deeper query path.
- Channel sessions are stored in the **default QMD scope**, which matters for session-linked recall consistency.
- When launching the QMD server, OpenClaw now preserves the **current Node binary directory** and command path more carefully.
- Missing agent workspaces are bootstrapped more reliably during QMD-backed sync.
- Dreaming gets more stability work: phase-sweep state tracking, grounded backfill, better promotion gating, and protection against promoting Dreaming-generated diary/report narratives back into `MEMORY.md`.

#### Audit conclusion
For our setup, **QMD improvements are immediately relevant and low-risk**.
Dreaming and Active Memory are **interesting, but not first-cut upgrade goals**.

---

### 2) Mission Control-sensitive runtime surfaces

These changes matter because Mission Control is not a passive skin. It depends on real runtime/session behavior.

**v2026.4.10**
- New `commands.list` RPC lets clients discover runtime-native, text, skill, and plugin commands.
- Gateway startup is refactored so WebSocket RPC can remain available while slower sidecars start.
- `chat.history` is intentionally withheld until startup sidecars finish.
- Gateway thread routing is tightened so subagent, cron, and restart messages land back in the right thread/topic/session.
- Isolated cron jobs resolve auth profiles more consistently.

**v2026.4.11**
- Webchat/Control UI gets better structured reply/media handling.
- TTS audio replies are preserved in webchat history instead of being dropped or detached.

**v2026.4.12**
- Isolated-session image generations persist the source user message text more reliably.
- Plugin-owned slash commands are registered in the command catalog.
- Plugin subagent spawning and session cleanup get more robust.

#### Audit conclusion
These changes are more **net-positive than dangerous**, but they do create one real compatibility check for Mission Control:

> Mission Control must tolerate startup windows where the gateway is partially alive but `chat.history` is not ready yet.

That is a **test requirement**, not a blocker.

---

### 3) Security tightening and hardening

This is the section to watch carefully.

#### The good news
A lot of the security work between `v2026.3.8` and `v2026.4.12` is desirable:
- browser SSRF defenses get tighter
- host exec and environment handling harden further
- token/API-key leakage is reduced in approval prompts
- device/pairing scope handling tightens
- Telegram auth checks tighten
- plugin and gateway route boundaries harden

#### The catch
Our current setup is not a pristine default deployment. It relies on convenience/debug posture in the Control UI layer.
That means security hardening is not just “good news”, it is also a place where our assumptions can get exposed.

#### Most relevant security changes

**v2026.4.5**
- fail-closed behavior on certain hook/tool security paths
- stricter owner requirements for allowlist mutation
- additional browser SSRF hardening
- paired-device and gateway/plugin route scope tightening

**v2026.4.10**
- major browser/security tightening across SSRF, navigation, redirects, subframes, CDP, session reuse, and sandbox behavior
- tool/exec hardening: env denylisting, host-media read restrictions, profile mutation authorization, oversized WS handling, and more
- `browser` private-network access becomes more explicitly allowlist-driven
- Telegram sender validation gets stricter
- `/dreaming on|off` persistent config changes now require admin privilege

**v2026.4.11**
- exec approval prompts redact bearer tokens/API keys more aggressively
- Codex OAuth handling is repaired and tightened

**v2026.4.12**
- the gateway tool can no longer newly enable dangerous flags like:
  - `gateway.controlUi.allowInsecureAuth`
  - `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback`
  - `gateway.controlUi.dangerouslyDisableDeviceAuth`
  - `browser.ssrfPolicy.dangerouslyAllowPrivateNetwork`
- startup now fails if certain providers still use obvious placeholder credentials

#### Audit conclusion
Security hardening is a **reason to upgrade**, but also the main reason **not** to do the upgrade carelessly.

---

## Specific risk matrix for our deployment

| Area | Risk | Why it matters here | Mitigation |
|---|---:|---|---|
| Control UI auth/origin/proxy behavior | High | Current setup depends on 3 dangerous Control UI flags. Tightening or “cleaning up” at the same time could break access. | Freeze current auth/origin behavior during the rehearsal upgrade. Do not harden this in the same window. |
| Reverse proxy / live HTTPS alignment | High | Current preview already proved app health and showed separate host HTTPS misrouting. Upgrade work should not be mixed with live TLS/proxy work. | Keep upgrade rehearsal local/preview-scoped. Defer live HTTPS routing fixes to their own window. |
| Browser/private-network restrictions | Medium | Newer SSRF/private-network restrictions could affect browser tooling against local/private hosts. | Explicitly test browser flows that hit local or private addresses before live cutover. |
| Mission Control startup assumptions | Medium | `chat.history` can be intentionally unavailable during startup while the gateway is otherwise alive. | Test Mission Control after cold restart and ensure the runtime bridge tolerates startup lag. |
| Codex/provider path changes | Medium | `v2026.4.10` adds a bundled Codex provider path. If we change provider references at the same time, debugging gets muddy. | Keep current explicit provider/model references first. Do not switch to new Codex path in the same rehearsal. |
| Dreaming / Active Memory enablement | Medium | Both add memory-time behavior and more background/hidden context decisions. Great later, noisy now. | Leave both off during the base runtime upgrade. Enable only after the base cut is proven. |
| Placeholder credential fail-start | Low-Medium | `v2026.4.12` refuses startup for obvious placeholder provider credentials. | Run preflight config scan and startup rehearsal before touching the live runtime. |
| Legacy config alias removal pressure | Low | Some legacy aliases are being phased out, but load-time compatibility still exists and doctor can help migrate. | Run doctor/schema validation in rehearsal. |

---

## Where the real upside is

If we do this properly, the practical upside is strong:

1. **QMD gets safer and more reliable**
   - better server-launch behavior
   - better fallback behavior for short-term recall
   - better default scope behavior for channel sessions

2. **Isolated sessions and cron correctness improve**
   - auth-profile consistency for isolated cron jobs
   - better session/thread routing
   - better transcript persistence behavior

3. **Control UI and runtime surfaces get cleaner**
   - better structured chat rendering
   - better TTS/media persistence in webchat
   - cleaner command catalog support

4. **Security gets materially better**
   - stronger SSRF posture
   - tighter tool/env boundaries
   - fewer opportunities for silent auth/proxy weirdness

---

## What I do **not** recommend

### Do not do piecemeal feature cherry-picks
Especially not for:
- Dreaming
- Active Memory
- QMD internals
- Codex/provider changes
- gateway/auth/proxy hardening

The April work contains follow-up fixes on top of earlier additions. Pulling only the “interesting” feature commits is the shortest path to unstable behavior.

### Do not mix these into one window
Do **not** combine:
- OpenClaw core upgrade
- live HTTPS/proxy cutover
- security hardening cleanup
- Dreaming enablement
- Active Memory enablement

That is too many moving parts at once.

---

## Recommended upgrade sequence

### Phase 1: audit and freeze assumptions
Already in progress with this document.

Lock these assumptions for the first rehearsal:
- current workspace truth is canonical
- current Control UI auth/origin behavior is preserved during rehearsal
- Dreaming stays off
- Active Memory stays off
- Codex provider path stays as currently configured

### Phase 2: isolated rehearsal on `v2026.4.12`
Use a separate lane from the current live/rolled-back runtime.

Rehearsal checklist:
1. install or pin `v2026.4.12`
2. reuse the current config, do not opportunistically refactor it
3. run config/schema/doctor validation
4. run `openclaw status --json`
5. run `openclaw security audit --json`
6. run memory checks, especially QMD-backed paths
7. cold-restart test the gateway and Mission Control preview

### Phase 3: prove baseline runtime compatibility
Verify these before touching live:
- gateway starts cleanly
- direct webchat works
- Mission Control chat loads and sends
- runtime bridge survives cold start
- session history and current session switching still work
- cron listing and cron run history still work
- Telegram DM/group routing still works
- memory search still works
- QMD-backed memory status is healthy

### Phase 4: only then test new memory features
After the base upgrade is stable:

#### Active Memory
- enable only in rehearsal
- target only `main`
- limit to direct chats first
- start with `queryMode: "recent"`
- keep logging on while tuning

#### Dreaming
- enable only in rehearsal
- keep default or conservative cadence
- review `DREAMS.md` and any promotion behavior before letting it run freely
- do not treat Dreaming as “set and forget” on day one

### Phase 5: live update window
Only after:
- rehearsal is clean
- Mission Control baseline is verified
- preview/local route is healthy
- HTTPS/live proxy work is ready as a separate track or intentionally deferred

---

## Bottom line

`v2026.4.12` looks like a **good target**.

It appears far enough along to pick up the April improvements that are actually useful to us, especially around:
- QMD
- memory/runtime correctness
- isolated session behavior
- webchat/control surfaces
- security hardening

But the correct posture is:

> **upgrade the core first, prove it, then decide whether Dreaming and Active Memory deserve to come along.**

That is the path that gives us the upside without casually blowing up the current steady state.

---

## Suggested next action

Build a rehearsal plan for `v2026.4.12` with a concrete smoke-test matrix covering:
- gateway startup
- Mission Control core paths
- QMD memory health
- Telegram routing
- cron/session behavior
- Control UI auth/origin behavior as currently deployed

---

## Sources used for this audit

Primary upstream sources:
- `/tmp/openclaw-upstream-audit/CHANGELOG.md`
- `/tmp/openclaw-upstream-audit/docs/concepts/active-memory.md`
- `/tmp/openclaw-upstream-audit/docs/concepts/dreaming.md`
- `/tmp/openclaw-upstream-audit/docs/gateway/security/index.md`

Local/runtime sources:
- `openclaw --version`
- `openclaw status --json`
- `openclaw security audit --json`
- safe-field inspection of `/data/.openclaw/openclaw.json`
