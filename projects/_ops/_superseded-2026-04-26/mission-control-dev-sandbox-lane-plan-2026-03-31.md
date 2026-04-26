# Mission Control Dev / Sandbox Lane Plan — 2026-03-31

## Status
Deferred by decision.

Do **not** implement this before the General Domain is finished enough.
Current rule:
- `preview.motiondisplay.cloud` remains the canonical **built/stable Mission Control**
- separate dev/sandbox lane is a later operational upgrade, not the current priority

## Why this exists
Philippe wants future work to eventually split into two lanes:
1. **Built lane** — stable daily-driver Mission Control for real use
2. **Dev/sandbox lane** — faster, messier environment for in-development pages/modules before promotion into built

This note exists so future Marvin sessions do not have to reconstruct that plan from chat history.

## Recommended target shape
### Built lane
- URL: `preview.motiondisplay.cloud`
- Purpose: reliable operator cockpit / daily use
- Runtime posture: production-style preview stack
  - internal Next app
  - preview-origin proxy
  - runtime-bridge WS sidecar
- Verification standard: auth, websocket path, proxy behavior, runtime continuity, and real session behavior must stay truthful here

### Dev / sandbox lane
- URL: something separate, for example `sandbox.motiondisplay.cloud`
- Purpose: experimental Mission Control work
- Allowed posture:
  - hot-reloading dev server **or** a parallel preview-style stack, depending on what is being tested
- Main use cases:
  - page composition work
  - UI iteration
  - risky runtime experiments
  - unfinished modules/pages that should not destabilize the built lane

## Decision rule
Do **not** replace the built lane with a dev server.
Instead:
- keep the built lane as the canonical truth environment
- add the sandbox lane separately when it becomes worth the overhead

## Why not switch the main preview to dev mode
- Mission Control now depends on auth, proxying, same-origin websocket routing, runtime continuity, and sidecar behavior
- dev mode can be faster for UI work, but it can also hide or distort production-like runtime issues
- the built lane needs to stay trustworthy because Philippe already uses it as the real place to talk to Marvin

## Preconditions before implementation
Only start this project once these are true:
1. General Domain is "finished enough" and no longer in frequent structural churn
2. Mission Control is stable enough that protecting the built lane is more valuable than keeping one shared workbench
3. there is enough ongoing Mission Control development to justify the extra maintenance overhead

## Phase plan
### Phase 1 — planning + boundary decisions
- choose sandbox hostname
- decide whether sandbox should run:
  - `next dev`, or
  - a second preview-style stack, or
  - both depending on task type
- define clear operator rule for which lane is authoritative
- define env-file split so sandbox secrets/tokens do not accidentally drift into built assumptions

### Phase 2 — routing + runtime split
- add separate host/nginx routing for sandbox hostname
- add dedicated runtime env file for sandbox
- make startup/restart scripts explicit so built and sandbox cannot be confused
- ensure WS sidecar path/origin assumptions are correct for sandbox

### Phase 3 — workflow rule
- build new/risky pages/modules in sandbox first
- verify runtime-sensitive work in built before calling it done
- promote only proven work into built

### Phase 4 — documentation
- update Mission Control preview/runtime runbook
- add exact commands for:
  - sandbox build/start/stop
  - sandbox dev mode if used
  - promotion / verification checklist

## Risks to avoid
- unclear truth hierarchy between built and sandbox
- auth/env drift
- browser confusion from identical tabs/origins without strong labeling
- fixing bugs in sandbox that never get verified in the built lane
- using hot reload as proof for runtime-sensitive behavior

## Recommendation for future Marvin
When this gets reopened, recommend a **dual-lane setup**:
- built lane stays production-style and truthful
- sandbox lane exists for experimentation
- no replacement of the built lane with hot reload as the main operator environment

## Where this decision came from
Conversation with Philippe on 2026-03-31 after Mission Control Chat/runtime stabilization and preview recovery.
Immediate priority explicitly chosen by Philippe:
- finish the General Domain neatly first
- defer the sandbox-lane project until after that
