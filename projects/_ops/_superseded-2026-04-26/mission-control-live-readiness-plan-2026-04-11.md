# Mission Control Live-Readiness Plan — 2026-04-11

## Purpose
Capture the current agreed implementation direction for Mission Control after Philippe’s audit feedback, so the plan survives session resets and can be executed in a controlled order.

## Current Product Direction
Mission Control is close enough visually and structurally.
The next phase should prioritize:
1. maintainability
2. runtime reliability
3. responsiveness
4. live-lane readiness
5. future dual-lane support without destabilizing the live lane

This means avoiding a broad UI cleanup spree.
The focus is structural and runtime hardening.

## Audit Calibration

### Keep as-is for now
Do not prioritize changes to:
- Skills header posture
- Home-only bottom strip
- legacy stub route cleanup
- Tasks toolbar FLOATING-control cleanup
- local-storage disclaimer for Personal/Projects boards
- Home empty-state redesign
- Agents-page actionability expansion

### Approved
- Break up the big Chat and Tasks files
- Better stale-state protection for async flows
- More granular memoization on expensive components
- Better optimistic UI discipline
- Richer execution-stage visibility
- Better recovery/merge behavior for live histories
- Stronger server-push mindset, not just refresh mindset

### Deferred
- Keep the Chat mic icon for now because STT/TTS is still intended once Mission Control is live over HTTPS

### Adjusted posture
- Tighten page-to-page rhythm narrowly while touching relevant files, not as a standalone redesign effort

## Strategic Direction: Live Lane First
Mission Control should move toward a live primary lane.
A separate dev/sandbox lane should exist later as a parallel environment, not as a replacement.

Reference baseline:
- `projects/_ops/mission-control-dev-sandbox-lane-plan-2026-03-31.md`

### Live lane
- canonical operator environment
- production-style runtime truth
- auth/proxy/session continuity must stay trustworthy

### Sandbox lane
- later parallel environment for risky or unfinished work
- promotion-based, not truth-replacing

## Recommended Implementation Sequence

### Phase 1 — Structural cleanup for safe continued growth
#### 1. Split the Chat surface
Target:
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

Goal:
- break the monolith into smaller, focused modules without redesigning behavior

Suggested extractions:
- transcript rendering
- message/tool group rendering
- composer
- session rail
- file-link helpers
- rich-text helpers
- shared UI helper functions

Why first:
- reduces fragility
- makes memoization and runtime-state hardening easier
- lowers risk for future live-lane changes

#### 2. Split the Tasks surface
Target:
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`

Goal:
- separate autonomous board logic, manual boards, drawers, DnD helpers, and view helpers

Suggested extractions:
- autonomous board shell
- manual boards
- task drawer
- task cards
- toolbar/actions
- DnD helpers
- formatting/view-model helpers

Why second:
- same maintainability benefit as Chat
- creates clean boundaries for optimistic updates and execution-state improvements

### Phase 2 — Runtime hardening inspired by Nerve
#### 3. Add stale-state protection for async flows
Apply a lightweight generation/version guard pattern to:
- chat session switching and hydration
- autonomous task execution refresh paths
- live progress merge paths
- any drawer/detail async reloads where late results can overwrite newer state

Goal:
- discard stale async completions instead of letting old state overwrite new truth

#### 4. Add granular memoization to expensive UI surfaces
Prioritize:
- chat message rows
- tool groups
- task cards
- task drawer sections
- session rail items
- activity/event lists

Goal:
- reduce wasteful rerenders
- improve perceived speed without changing product behavior

#### 5. Tighten optimistic UI discipline
Apply consistently to:
- send message
- create/update task
- approve/reject flows
- task status transitions
- notes/comments/artifacts where relevant

Standard:
- functional state updates
- explicit rollback on failure
- no ambiguous half-updated UI states

### Phase 3 — Make runtime state more transparent
#### 6. Add richer execution-stage visibility
Introduce a clearer execution state model, for example:
- queued
- preparing
- thinking
- using tools
- waiting
- writing output
- blocked / needs input
- completed
- failed

Where it matters:
- autonomous tasks
- future specialist runs
- Sudo/dev-team style execution lanes
- chat/tool transparency

Goal:
- Mission Control should feel like a real operator surface, not a black box with only `running` and `done`

#### 7. Harden recovery/merge behavior for live histories
Improve:
- transcript recovery merges
- task activity/event timeline merges
- reconnect/reload behavior
- duplicate prevention after recovery

Goal:
- late-arriving recovered state should merge cleanly instead of duplicating or overwriting current truth

### Phase 4 — Push toward a truly live Mission Control
#### 8. Introduce a stronger server-push/event mindset
Target live updates for:
- autonomous task state changes
- task completion / blocked events
- chat/session lifecycle notices
- cron run updates
- useful memory/file update notices
- future agent-state updates

Goal:
- make Mission Control feel current and alive rather than periodically catching up

Note:
- start simple; do not overbuild the infrastructure on day one

### Phase 5 — Live lane hardening + future sandbox boundary prep
#### 9. Audit and tighten runtime assumptions for live posture
Focus on:
- auth behavior
- proxy/origin assumptions
- websocket/event transport truth
- session continuity
- sidecar/runtime dependencies
- restart/recovery expectations

Goal:
- remove preview-only assumptions before calling Mission Control truly live

#### 10. Prepare environment and lane boundaries
Start separating concerns now so live and sandbox can coexist later:
- clearer env loading boundaries
- lane-specific labeling
- fewer hard-coded single-lane assumptions
- startup/restart scripts that can later split cleanly into built vs sandbox

Goal:
- prepare for the dual-lane future without implementing the whole sandbox now

### Phase 6 — Later sandbox rollout
#### 11. Implement the actual sandbox lane
Only after live lane is strong enough.

#### 12. Add promotion/runbook flow
Workflow should become:
1. risky/new work in sandbox
2. verify runtime-sensitive behavior against live-style lane
3. promote only proven work into the canonical lane

## Recommended Priority Order

### P1
1. Split Chat file
2. Split Tasks file

### P2
3. Add stale-state guards
4. Add granular memoization
5. Tighten optimistic UI flows

### P3
6. Add richer execution-stage visibility
7. Harden recovery/merge behavior

### P4
8. Introduce stronger server-push/event model
9. Audit live-lane runtime assumptions
10. Prepare built-vs-sandbox boundaries

### P5
11. Implement sandbox lane
12. Add promotion workflow and runbook updates

## What Not to Focus on Next
Per current direction, do not spend the next phase on:
- Skills header changes
- Home bottom strip
- legacy route cleanup
- Tasks toolbar visual restyling
- local-storage disclaimer
- Home empty-state redesign
- Agents page actionability rewrite
- command palette
- removing the mic button right now

## Practical Recommendation
The best next move is a focused implementation track:

### Track 1 — Mission Control live-readiness foundation
Includes:
- Chat split
- Tasks split
- stale-state guards
- memoization
- optimistic UI tightening
- execution-stage model
- recovery/merge hardening

This gives:
- better maintainability
- better responsiveness
- fewer live-state bugs
- stronger base for a truly live Mission Control

### Track 2 — Live lane + future sandbox boundary prep
Includes:
- transport/push improvements
- runtime boundary cleanup
- env/lane separation prep
- eventual sandbox rollout

This should follow after Track 1 is in good shape.
