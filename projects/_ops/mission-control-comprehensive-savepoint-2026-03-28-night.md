# Mission Control Comprehensive Savepoint — 2026-03-28 Night

Date: 2026-03-28
Owner: Marvin + Philippe
Status: comprehensive working savepoint
Scope: Mission Control Chat redesign, runtime bridge, same-origin WS path, and end-of-night operational state

---

## 1. Executive summary

Mission Control Chat moved from a polished-but-mostly-static operating surface into a **real runtime-backed chat surface**.

By the end of this session:
- Mission Control preview remained auth-gated and externally reachable again
- the Chat page was redesigned around a more operator-native thread structure
- the page gained a custom runtime bridge layer
- the bridge progressed through:
  - metadata foundation
  - WS sidecar
  - live handshake/session state
  - same-origin WS reverse path
  - minimal live chat loop
- the worst reconnect storm (`CONNECT.CHALLENGE` loop) was resolved
- Philippe confirmed he could talk to Marvin from inside Mission Control Chat
- remaining work is now mostly **stability refinement + UI cleanup**, not “can this architecture work?”

This is the important change in truth:

**Mission Control Chat is no longer just a styled shell around runtime references. It now has a real runtime bridge and a minimally working direct-chat path.**

---

## 2. Source-of-truth inputs used this session

Primary continuity anchors:
- `docs/runbooks/mission-control-adaptation-runbook-2026-03-27.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md`

Additional inputs reviewed and used:
- `memory/2026-03-26.md`
- `memory/2026-03-27.md`
- `memory/2026-03-28.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`
- `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
- `docs/runbooks/mission-control-agents-page-design-handoff.md`
- multiple `_ops` Mission Control docs from Mar 16–27
- public `openclaw-nerve` repo, especially:
  - frontend chat architecture
  - websocket proxy pattern
  - diff/file rendering patterns

Philippe also supplied:
- the full verbatim OpenAI `frontend-skill` prompt
- screenshots and notes about Nerve chat behavior, charts, and diffs
- Mission Control preview browser origin
- gateway session auth token for Mission Control preview

---

## 3. Major strategic decisions made

### 3.1 GPT-5.4 guidance vs skill split
Decision:
- add only **compact front-end meta-rules** to `model-guidance/gpt-5.4.md`
- create a separate real `frontend-skill`

Result:
- `skills/frontend-skill/SKILL.md` created using the OpenAI prompt essentially verbatim
- `model-guidance/gpt-5.4.md` now points directly to that skill for front-end work
- `TOOLS.md` updated to index the new local skill

Related commits:
- `020f7b5` — Add GPT-5.4 frontend skill guidance
- `beda393` — Index local frontend skill in tools docs

---

### 3.2 Chat is no longer “good enough for now”
After Nerve audit + screenshot review, the prior Mar 27 calibration was updated:
- Chat is now a valid next primary Mission Control target again
- because the big value is in:
  - compressed process visibility
  - real controls
  - inline artifacts
  - operator-grade interaction model

Artifacts produced:
- `projects/_ops/mission-control-chat-implementation-brief-2026-03-28.md`
- `projects/_ops/mission-control-chat-phase1-execution-spec-2026-03-28.md`

Related commits:
- `ce70893` — Add Mission Control chat implementation brief
- `29d9aa5` — Add Mission Control chat phase 1 execution spec

---

## 4. UI / product work completed on Chat

## 4.1 Chat surface redesign
The old embed-first / conceptual chat surface was replaced with a more custom Mission Control chat structure.

Key changes landed across multiple passes:
- top chat chrome with session/model/effort/context
- recent sessions control moved out of a heavy right rail
- runtime handoff side clutter removed
- thread hierarchy became more chat-like
- process rails introduced for Thinking / Tools
- diff/file/chart artifact containers introduced
- artifacts made collapsible
- multiple visual passes explored:
  - darker chat well
  - lighter thread version
- final state at end of session favored the lighter thread with preserved runtime structure

Important stylistic/user feedback incorporated:
- top strip should stay lighter FLOATING
- chat section can diverge in feel from top chrome
- excess explanatory text removed
- session/model/effort values made quieter/smaller
- typography change toward smaller sans labels was attempted, but Philippe later clarified a preferred future direction:
  - all caps
  - softer grey
  - more letter spacing
  - closer to system-label typography
  - **not yet finalized**

Representative commits from the UI pass:
- `d51b8481` — Polish Mission Control chat surface layout
- `c6e26c4a` — Refine Mission Control chat chrome and rail density
- `87151f47` — Lighten chat thread and collapse artifacts
- `d61b4749` — Fix chat artifact contrast and page title sizing

---

## 5. Runtime bridge progression

This was the most important technical arc of the session.

## 5.1 Bridge foundation
Commit:
- `0417354c` — Add Mission Control runtime bridge foundation

What it added:
- runtime bridge endpoint surface
- bridge state hook/component foundation
- richer runtime contract exposure into Chat

State at that moment:
- still not live chat
- but no longer pure static placeholder logic

---

## 5.2 WS sidecar foundation
Commit:
- `e2c14f0d` — Add Mission Control WS bridge sidecar foundation

What it added:
- project-local WS sidecar process
- preview/runtime wiring
- sidecar metadata surfaced through bridge contracts

Important env additions:
- sidecar token
- sidecar host/port/path

State at that moment:
- real transport base existed
- browser reachability still loopback-only

---

## 5.3 Live handshake/session state
Commit:
- `9379496b` — Add live runtime bridge session handshake state

What it added:
- browser-side `connect.challenge` handling
- session state tracking (waiting/challenged/connecting/connected/etc.)
- richer handshake/transport state in the hook and UI

At this point the bridge became capable of a real gateway session handshake in principle, but still lacked a browser-reachable path and proper gateway session token wiring.

---

## 5.4 Same-origin WS reverse path
Commit:
- `8be48249` — Add same-origin runtime bridge proxy path

This was the decisive architecture step.

Preview was restructured into:
- internal Next app on `127.0.0.1:3007`
- public preview entry still on `:3005`
- preview-origin proxy handling:
  - normal HTTP forwarding to internal Next
  - websocket upgrade path on `/api/runtime-bridge/ws`
  - forwarding to the local WS sidecar

Important consequence:
- browser no longer had to talk directly to loopback `127.0.0.1:3006`
- same-origin transport path became possible under Mission Control preview origin

---

## 5.5 Minimal live bridge chat loop
Commit:
- `57cccc61` — Add minimal live bridge chat loop

What it added:
- live transcript section
- recent bridge events panel
- real composer form
- a minimal send path in code
- basic handling for early chat lifecycle events

State at that moment:
- still rough
- but no longer “bridge only” — first steps toward actual in-page chat behavior

---

## 5.6 Runtime fallback safety
Commit:
- `2bf5ae61` — Add chat runtime fallback boundary

Why needed:
- live bridge client-side code briefly caused browser-side application errors
- the page could white-screen with generic Next client exception output

Fix:
- added a client error boundary around the Mission Control chat runtime
- page now falls back to static/runtime-backed surface if live bridge crashes

Important operational effect:
- preview became much safer to iterate on without nuking the page

---

## 6. Critical bug/fix chain in bridge stabilization

## 6.1 Wrong client identity in connect payload
Symptom:
- repeated `CONNECT.CHALLENGE`
- session rejected
- error about invalid `client.id`

Root cause:
- Mission Control used its own invented client id/mode instead of the accepted control-ui identity contract

Fix commit:
- `8ecc6dbc` — Align bridge client identity with control UI

After this:
- challenge/reject loop narrowed to later-stage issues instead of immediate schema rejection

---

## 6.2 Upstream origin mismatch
Symptom:
- gateway continued rejecting websocket on origin policy even after allowlisting browser origin

Root cause:
- sidecar → gateway websocket hop did not send an explicit public origin

Fix commit:
- `306863aa` — Set explicit upstream origin for WS sidecar

New env added:
- `MISSION_CONTROL_WS_UPSTREAM_ORIGIN=https://preview.motiondisplay.cloud`

---

## 6.3 Proxy/sidecar self-crashes from invalid websocket close handling
Symptoms:
- repeated `502 Bad Gateway`
- preview-origin proxy and WS sidecar crashing
- stack falling over during websocket close propagation

Initial hardening:
- `aabed575` — Harden WS proxy close handling

Follow-up, more correct fix:
- `109571a1` — Reject reserved WS close codes in proxies

Key lesson:
- not all `1000–4999` codes are valid to pass to `ws.close(...)`
- reserved codes like `1005/1006` must never be re-emitted

---

## 6.4 Reconnect storm caused by polling refresh
Symptom seen by Philippe:
- `CONNECT.CHALLENGE` repeating every ~15 seconds
- brief WS open, then closed/reconnect loop
- recurring `presence/health` bursts tied to re-init

Root cause:
- websocket effect in `useRuntimeBridge` depended on the entire `summary` object
- each HTTP bridge snapshot refresh caused the websocket effect to tear down and reconnect

Fix commit:
- `946c7b7f` — Stop reconnecting WS bridge on polling refresh

Effect:
- `CONNECT.CHALLENGE` storm stopped
- bridge became materially calmer

This was a major stabilization turning point.

---

## 6.5 502 after gateway restart due to preview stack split-brain
Symptom:
- after control-plane config patch/restart, preview sometimes returned `502 Bad Gateway`

Root cause:
- preview-origin proxy and/or WS sidecar remained up
- but internal Next process on `127.0.0.1:3007` was down
- proxy had nothing to forward to

Operational handling:
- restart full Mission Control preview stack when this occurs
- do not assume gateway restart preserves internal Next availability

This is still an operational fragility to keep in mind.

---

## 7. Gateway / control-plane changes made

This session crossed into control-plane work with explicit approval.

### 7.1 Allowed origins patch
Patched field:
- `gateway.controlUi.allowedOrigins`

Added origins:
- `http://preview.motiondisplay.cloud`
- `https://preview.motiondisplay.cloud`

These were necessary because gateway websocket origin checks were rejecting the Mission Control preview/browser origin.

Important note:
- origin matching is exact, including scheme
- adding only `http://...` was insufficient once the browser was actually using `https://...`

---

## 8. Actual end-of-session behavior

By the end of the session:
- preview was serving again
- same-origin WS path was active
- gateway origin allowlist included the Mission Control preview origin
- sidecar sent explicit upstream origin
- reconnect storm caused by polling dependency was fixed
- Philippe reported:
  - no more visible `CONNECT.CHALLENGE` loop
  - ongoing `PRESENCE` / `HEALTH` events every few seconds
  - ability to talk to Marvin from Mission Control Chat directly

Working interpretation:
- transport and session path are no longer fantasy
- keepalive / runtime telemetry events remain visible and noisy
- Chat is usable enough to count as a real working bridge milestone
- next work shifts from “can this work?” to “stabilize and refine behavior/UI”

---

## 9. Preview/runtime operational shape at end of session

Preview shape now includes three live layers:
1. internal Next server
2. preview-origin HTTP/WS proxy
3. WS sidecar

Important ports/paths:
- public preview entry: `:3005`
- internal Next: `127.0.0.1:3007`
- WS sidecar: `127.0.0.1:3006`
- same-origin browser WS path: `/api/runtime-bridge/ws`

Important runtime env values now in use:
- Mission Control Basic Auth creds in preview env
- gateway session auth token in preview env
- explicit upstream origin for sidecar → gateway hop

---

## 10. Files / artifacts created this session

Strategic docs:
- `projects/_ops/mission-control-chat-implementation-brief-2026-03-28.md`
- `projects/_ops/mission-control-chat-phase1-execution-spec-2026-03-28.md`
- this savepoint file

Skill/model guidance:
- `skills/frontend-skill/SKILL.md`
- `model-guidance/gpt-5.4.md`

Mission Control bridge/runtime work (representative):
- `app/api/runtime-bridge/route.ts`
- `hooks/useRuntimeBridge.ts`
- `components/chat/MissionControlChatRuntime.tsx`
- `components/chat/MissionControlChatSurface.tsx`
- `scripts/runtime-bridge-ws-sidecar.js`
- `scripts/preview-origin-proxy.js`
- `scripts/preview-start.sh`
- `scripts/preview-stop.sh`
- `lib/runtime-bridge-sidecar.ts`
- `lib/adapters/orchestrator.ts`
- `lib/types/contracts.ts`
- `.preview-runtime/mission-control-preview.env.example`

---

## 11. Outstanding work for tomorrow

### 11.1 Functional follow-up
- explicitly verify the send/receive loop from the browser path again
- confirm whether ongoing `PRESENCE` / `HEALTH` cadence is acceptable normal telemetry or still hides instability
- inspect whether the minimal live transcript rendering is sufficient or still too shallow

### 11.2 UI cleanup
Philippe explicitly deferred this to tomorrow:
- reduce bridge/event UI noise
- calmer presentation of runtime posture blocks
- better typography for page titles:
  - all caps
  - softer grey
  - more letter spacing
  - system-label feel rather than headline feel
- more polish for chat transcript / live sections

### 11.3 Minor oddity worth revisiting if it matters
- direct API probe through the preview auth/proxy stack occasionally returned HTML when a JSON parse was expected
- this did not block actual user-facing progress, but may still be worth cleaning up if debug tooling depends on it

---

## 12. What tomorrow-Marvin should assume immediately

1. **Mission Control Chat runtime bridge is real now.** Do not revert to thinking of it as static shell-only work.
2. **Same-origin WS path exists** and is the correct architecture lane.
3. **Gateway origin allowlisting has already been patched** for the public preview origin.
4. **The reconnect storm was a client dependency bug**, not proof the architecture was wrong.
5. **Proxy/sidecar 502s were largely self-inflicted websocket close-code bugs**, and those have now been patched.
6. **Preview stack can still split** after certain restarts, leaving proxy alive and internal Next down; check all three layers before diagnosing “mystery 502.”
7. **UI is intentionally left imperfect tonight.** Do not confuse “needs polish” with “bridge failed.”
8. Philippe already signaled that tomorrow’s work can focus more on UI clarity, event noise reduction, and refinement rather than existential transport debugging.

---

## 13. End-of-night judgment

This was a heavy but successful Mission Control day.

The meaningful outcome is not cosmetic.
It is architectural and operational:

**Mission Control Chat now has a working, same-origin, runtime-backed bridge path and is no longer just a beautifully staged companion shell.**

That is the durable truth to carry forward.
