# Mission Control savepoint — 2026-04-12 chat + seat bridge handoff

## What this savepoint is
This is the end-of-night handoff after the Apr 12 Mission Control session that moved through three linked lanes:
1. **rollback-safe Tasks stabilization was already in place**
2. **Chat transcript-load regression was investigated and fixed**
3. **a real Marvin → seat bridge was built for Sudo, Vantage, and the specialist seats**

This file is meant to let tomorrow’s agent continue without Philippe having to re-explain the day.

Read this together with:
- `memory/2026-04-12.md`
- `projects/_ops/mc-savepoint-2026-04-12-late-night.md`
- `projects/_ops/mc-savepoint-2026-04-12-night-tasks-generator-stabilized.md`
- `projects/_ops/mission-control-post-rollback-baseline-2026-04-12.md`
- `projects/_ops/tasks-truth-flow-map-2026-04-12.md`
- `projects/mission-control/docs/agent-seat-bridge.md`

---

## Executive summary
By the end of tonight, three things became true:

### 1. Chat transcript loading is no longer blocked by the heavy runtime summary path
The old hard-refresh / return-to-chat pain point was real. Transcript hydration was waiting on the expensive `/api/runtime-bridge` summary path instead of using a lightweight history path.

That is now fixed.

### 2. The remaining Chat slowness is now narrowed to the server-side page summary fetch
`/general/chat` still responds slower than it should on hard refresh because the page still waits on the heavy summary fetch. That is a **known, isolated next-step**, not an unknown regression anymore.

### 3. Marvin now has a truthful seat bridge
Marvin can now trigger:
- **Sudo** through the real Mission Control orchestration path
- **Vantage** through a persistent lead session
- **Japin / Johan / Milou / Link** through persistent specialist-flavored seat sessions

Important truth discovered tonight:
- those specialist seats are **not** currently registered as separate OpenClaw agent ids in this setup
- `openclaw agents list` shows only `main`
- so the truthful bridge is **seat-session based under the main runtime**, not `openclaw agent --agent <specialist>`

That was the biggest architecture clarification of the night.

---

## 1. Starting state before the Chat/bridge work
The safe baseline before tonight’s later work was:
- rollback-safe Mission Control runtime baseline already re-established
- Tasks stabilization already landed
- autonomous backlog titles/briefs were cleaned up
- category belonged in the pill lane, not the title
- fresh backlog reflected the current `AUTONOMOUS.md` goals

Verified backlog baseline at that point:
- `Draft: Creative-tool automation script plan`
- `Analyze: OpenClaw loop-pattern audit`
- `Draft: Actionable Alpha dashboard slice`
- `Draft: Proactive operations guardrails`
- `Research: Real-time trading API shortlist`

That state is documented in:
- `projects/_ops/mc-savepoint-2026-04-12-night-tasks-generator-stabilized.md`

The next live issue Philippe raised after that was Chat.

---

## 2. Chat transcript-load regression

## 2.1 Symptom Philippe reported
After a hard refresh of `/general/chat`, or sometimes after returning to Chat from another Mission Control page, transcript history took about **8 seconds** to appear.

The concern was that an earlier steady fix had probably been rolled back during the day’s resets.

Philippe also asked to check `/tmp/openclaw-nerve` because parts of current Mission Control architecture were inspired by that repo.

## 2.2 What was investigated
Investigation covered:
- Mission Control Chat runtime path
- transcript hydration behavior in `useRuntimeBridge.ts`
- page/server summary fetch behavior
- `/api/runtime-bridge` route behavior
- `readOrchestratorIntegrationSummary()` cost
- Nerve’s history-loading patterns

Important files inspected:
- `projects/mission-control/components/pages/GeneralChatPage.tsx`
- `projects/mission-control/app/general/chat/page.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/app/api/runtime-bridge/route.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `/tmp/openclaw-nerve/src/features/chat/operations/loadHistory.ts`

## 2.3 Root cause
The transcript itself was **not** slow.
The transcript was being forced to wait on the **heavy runtime summary path**.

Exact chain:
1. `/general/chat` waited on `getOrchestratorIntegrationSummary()` server-side
2. client `useRuntimeBridge.load()` fetched `/api/runtime-bridge`
3. transcript hydration happened only after that response returned
4. `/api/runtime-bridge` loaded transcript history only after `readOrchestratorIntegrationSummary()`
5. that summary builder shells out to multiple expensive OpenClaw JSON commands:
   - `openclaw status --json`
   - `openclaw health --json`
   - `openclaw sessions --all-agents --active 180 --json`
   - `openclaw sessions --all-agents --json`

Measured timings during investigation:
- `/api/runtime-bridge?sessionKey=agent%3Amain%3Amain` → about **10.3s**
- `/general/chat` → about **9.2s**
- the four OpenClaw summary commands in parallel → about **10.5s** wall time
- actual session index/log read from `/data/.openclaw/agents/main/sessions` → only **milliseconds**

That confirmed the exact bottleneck.

## 2.4 Nerve clue that mattered
Nerve’s chat history path is split into a lightweight history loader instead of waiting on broad runtime summary data.

That reinforced the right direction:
- transcript hydration should be its own fast lane
- summary metadata can refresh separately

## 2.5 The fix that landed
The transcript path was decoupled from the heavy summary path.

Implemented changes:
- extracted history reading/sanitization into:
  - `projects/mission-control/lib/runtime-bridge-history.ts`
- added lightweight transcript endpoint:
  - `projects/mission-control/app/api/runtime-bridge/history/route.ts`
- trimmed `projects/mission-control/app/api/runtime-bridge/route.ts` back to the heavier summary payload role
- seeded transcript history server-side on Chat page load via:
  - `projects/mission-control/app/general/chat/page.tsx`
  - `projects/mission-control/components/pages/GeneralChatPage.tsx`
- updated Chat runtime/provider/hook contracts so hydration can happen independently from the slow summary refresh:
  - `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`
  - `projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx`
  - `projects/mission-control/hooks/useRuntimeBridge.ts`
  - `projects/mission-control/lib/types/contracts.ts`

## 2.6 Result after fix
Verified after rebuild + preview restart:
- `/general/chat` still about **10.7s** server response
- `/api/runtime-bridge` still about **9.4s**
- new `/api/runtime-bridge/history?sessionKey=agent%3Amain%3Amain` about **0.11s**

Interpretation:
- the heavy summary route is still slow
- transcript history is now decoupled into the fast path
- transcript can be seeded on Chat page load instead of waiting for the slow bridge summary

## 2.7 Remaining known issue
This is still intentionally open for tomorrow if Chat is reopened:
- `/general/chat` server-side response is still slower than it should be because the page itself still waits on the heavy summary fetch

Philippe explicitly chose to leave that for tomorrow rather than keep digging tonight.

## 2.8 Related incident: preview 502
During this work, Philippe hit a `502 Bad Gateway` from Mission Control preview.

Immediate truth:
- preview stack had fallen over
- nothing was listening behind the proxy
- the proxy therefore had nothing to forward to

Recovery:
- elevated `bash scripts/preview-restart.sh`
- clean build
- preview back healthy

## 2.9 Relevant commit
Mission Control repo:
- `29ee9e7a` — `Decouple chat transcript hydration`

---

## 3. Marvin → seat bridge request

## 3.1 What Philippe asked for
Philippe asked for a **proper bridge** between Marvin and the other Mission Control agents/seats.

The key requirement was not “spawn a helper subagent.”
The real requirement was:

### Marvin should be able to trigger Sudo, Vantage, and the specialist seats the same way Philippe conceptually can
Meaning:
- use the real seat workflow
- preserve truthful runtime behavior
- let Sudo do actual Sudo orchestration when appropriate
- do not collapse everything back into generic subagent theater

## 3.2 What already existed before building
Before the bridge work:
- **Sudo** already had a real orchestration path in Mission Control
  - bounded decision layer
  - FE / BE / QA delegated lanes
  - synthesis / oversight model
- **Vantage** existed as a truthful lead seat conceptually, but not with a matching dedicated orchestration backend like Sudo
- **specialist seats** had seat/workspace scaffolding and continuity files, but tonight clarified that their runtime transport truth was not what older notes implied

## 3.3 First wrong assumption discovered during implementation
The first implementation assumption was:
- specialist seats such as `job-advisor` or `language-tutor` could be invoked directly as standalone registered OpenClaw agents via `openclaw agent --agent <id>`

This turned out to be false **in this current environment**.

Evidence:
- `openclaw agents list` returned only `main`
- `openclaw agent --agent job-advisor ...` failed with `Unknown agent id "job-advisor"`
- `sessions_send` was also not a valid bridge path from here because visibility is restricted without broader cross-agent access

This was the big architecture correction of the night.

## 3.4 Truthful bridge architecture after correction
Final truthful architecture:

### A. Sudo
Bridge transport:
- use the real Mission Control Sudo orchestration path

Meaning:
- write orchestration record into `projects/mission-control/data/sudo-delegations.json`
- start `projects/mission-control/scripts/run-sudo-orchestration.mjs`
- preserve real FE / BE / QA delegated child-run behavior

### B. Vantage
Bridge transport:
- persistent lead session under main runtime

Canonical session:
- `agent:main:content-seo-team-lead`

Meaning:
- Vantage is still truthful as a lead seat
- no fake dedicated backend claimed
- bridge injects explicit Vantage activation and continuity-file review instructions

### C. Japin / Johan / Milou / Link
Bridge transport:
- persistent specialist-flavored **seat sessions under the main runtime**

Canonical session keys:
- `agent:language-tutor:main`
- `agent:sportsbet-advisor:main`
- `agent:trading-advisor:main`
- `agent:job-advisor:main`

Important truth:
- these are **seat session keys**, not proof of separately registered OpenClaw agent ids in the current config
- bridge behavior works by creating/reusing those sessions under the main runtime and injecting seat-specific starter instructions + continuity references

This is still a real bridge and is materially better than spawned subagents, because:
- seat continuity is preserved
- seat-specific operating instructions are explicit
- Marvin can route work into the correct Mission Control seat lane directly
- Sudo remains on the real orchestration backend

## 3.5 Bridge implementation that landed
Core files added/updated:

### New CLI bridge
- `projects/mission-control/scripts/seat-bridge.mjs`

Capabilities:
- `--list`
- `--seat <slug>`
- `--prompt <text>`
- `--source-session-key ...`
- `--timeout ...`
- `--dry-run`

Seat mappings implemented there:
- `sudo` / `dev-team`
- `vantage` / `content-seo-team`
- `japin`
- `johan`
- `milou`
- `link`

### New local HTTP bridge
- `projects/mission-control/app/api/agents/seat-bridge/route.ts`

Endpoints:
- `GET /api/agents/seat-bridge`
- `POST /api/agents/seat-bridge`

### New session helper
- `projects/mission-control/scripts/lib/openclaw-session-model.mjs`

Added helper:
- `ensureSessionTarget(...)`

Purpose:
- create/reuse persistent Mission Control seat sessions safely before model-prep/model-verification flow runs

### New documentation
- `projects/mission-control/docs/agent-seat-bridge.md`

## 3.6 Specialist continuity behavior now encoded
The bridge does not just send a raw prompt.
For Vantage and specialist seats, it explicitly includes:
- seat activation prompt
- source session context (`routed by Marvin from ...`)
- continuity files to review first
- runtime-truth instruction not to invent hidden dedicated backends

That is the mechanism that makes the seat sessions useful rather than generic.

## 3.7 Important bug discovered and fixed during bridge work
### Dry-run mutation bug
Initial Sudo bridge dry-run behavior still wrote an orchestration record into `data/sudo-delegations.json`.

That was wrong.

Fix:
- dry-run now constructs the payload without mutating the store or spawning the runner
- temporary test artifact was removed

## 3.8 Verification performed
Bridge verification done tonight:

### Seat list / dry-run verification
- `node scripts/seat-bridge.mjs --list` returned all supported seats
- dry-run resolution worked for:
  - Sudo
  - Vantage
  - Link

### Vantage live smoke test
- Vantage bridge invocation succeeded
- session used: `agent:main:content-seo-team-lead`
- runtime verification confirmed `codex5.4`

### Link live smoke test
- first attempt failed for the right reason: false standalone-agent assumption
- after pivot to seat-session transport, Link live smoke test succeeded
- session used: `agent:job-advisor:main`
- runtime verification confirmed `codex5.4`

### Sudo live smoke test
- bridge accepted a real Sudo orchestration run
- runner progressed to `waiting`
- decision mode became `ask_question`
- this proved the bridge hit the **real orchestration path**, not a fake wrapper

### Preview/API verification
- `GET /api/agents/seat-bridge` → working on preview
- `POST /api/agents/seat-bridge` dry-run → working on preview

### Build / preview verification
- `npm run build` passed
- elevated `bash scripts/preview-restart.sh` passed
- preview remained healthy after landing the bridge

## 3.9 Relevant commit
Mission Control repo:
- `74a3e70d` — `Add Mission Control seat bridge`

---

## 4. Core truths that tomorrow’s agent must not lose

### 4.1 Rollback-safe runtime baseline still beats speculative git reasoning
This remained the right posture all night.
Do not casually reopen broad Mission Control work as if rollback never happened.

### 4.2 Chat transcript issue is now understood, not mysterious
The transcript-load regression was a coupling problem:
- transcript history waited on heavy runtime summary work
- fast history path now exists
- remaining page slowness is a separate summary-fetch issue

### 4.3 Do not assume specialist seats are real registered OpenClaw agent ids
This was the biggest new fact of the night.
Current environment truth:
- `openclaw agents list` shows only `main`
- specialist Mission Control seats currently bridge via seat sessions under main runtime
- session keys like `agent:job-advisor:main` are part of the Mission Control seat transport model, not proof of registered standalone agent ids

### 4.4 Sudo is still special
Sudo is the only seat in this cluster that currently has a real dedicated Mission Control orchestration backend.
Do not flatten Sudo into the same transport model as everyone else.

### 4.5 Vantage is a lead seat, not a fake direct-runtime specialist
This remained true tonight.
The bridge uses a lead-session pattern for Vantage, which is the correct truthful posture for now.

### 4.6 Specialist quality depends on continuity injection
For Japin / Johan / Milou / Link, the useful part of the bridge is not just session reuse.
It is the combination of:
- persistent seat session key
- explicit seat activation prompt
- explicit continuity-file review instruction
- truthful runtime instruction

If that context is removed later, the bridge will degrade back into generic seat theater.

---

## 5. What is intentionally still open
These are the right next moves, in order, if Mission Control is reopened tomorrow.

## 5.1 First next move: real bridge usage test with Philippe
Best next test:
- let Philippe give Marvin a real handoff for Sudo, Vantage, or one specialist seat
- route it through the bridge
- verify the outcome feels like the correct seat, not generic Marvin tone

This is the highest-value next step because the architecture now exists and needs a human-validity check.

## 5.2 If Chat is reopened after that
Only then consider the remaining page-level Chat slowness:
- `/general/chat` still waits on heavy summary fetch server-side
- transcript path is fixed; page-summary path is not yet optimized

Do **not** blur these two issues together again.

## 5.3 Future optional follow-up, not tonight
Potential future improvement:
- wire broader Mission Control Chat UI seat submission flows into the new seat bridge more generally

Important truth:
- tonight’s bridge is a **backend / runtime bridge for Marvin and local API usage**
- it is not a full broad Chat UI redesign pass

That boundary was intentional.

---

## 6. Resume order next time
1. read `memory/2026-04-12.md`
2. read this savepoint
3. if Chat work matters, remember transcript path is fixed and page summary path is the remaining slow lane
4. if seat work matters, use the bridge rather than subagents:
   - `projects/mission-control/scripts/seat-bridge.mjs`
   - `/api/agents/seat-bridge`
5. first real proof step should be a live Philippe handoff into:
   - Sudo, or
   - Vantage, or
   - one specialist seat
6. only reopen broader Chat optimization after the bridge has been tried for real or Philippe explicitly prefers Chat first

---

## 7. Relevant commits and artifacts
### Mission Control repo
- `29ee9e7a` — `Decouple chat transcript hydration`
- `74a3e70d` — `Add Mission Control seat bridge`

### Workspace repo
- `c4e6907` — `Wrap chat fixes, seat bridge, and handoff docs`

### Key docs / artifacts
- `projects/mission-control/docs/agent-seat-bridge.md`
- `projects/_ops/mc-savepoint-2026-04-12-night-tasks-generator-stabilized.md`
- `projects/_ops/mc-savepoint-2026-04-12-late-night.md`
- `projects/_ops/mission-control-post-rollback-baseline-2026-04-12.md`
- `projects/_ops/tasks-truth-flow-map-2026-04-12.md`

If tomorrow’s agent reads the docs in this order, Philippe should not need to reconstruct the day by hand.
