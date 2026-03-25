# Mission Control Execution Spec — 2026-03-25

Status: active implementation contract
Owner: Marvin + Philippe
Purpose: convert the Mission Control blueprint into a build-safe execution spec so future implementation work stays aligned across models, savepoints, and redesign passes.

---

## 1. How to use this file

This is the implementation contract for the current Mission Control phase.

Use it to answer:
- what Mission Control is now
- what the route/domain structure is
- what each page is for
- what should be reused vs rebuilt
- what the next implementation slice is
- what must not drift during redesign

If this file conflicts with older Mission Control assumptions, prefer this file plus the latest comprehensive savepoint.

Read alongside:
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-25.md`
- `projects/mission-control/docs/FLOATING-DESIGN-SYSTEM.md`
- `projects/mission-control/docs/FLOATING-HANDOFF.md`
- `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
- `MEMORY.md` (Mission Control Direction)

---

## 2. Product model

Mission Control is:
- one shared shell
- one active domain
- one domain-scoped left rail
- one main workspace
- shared truthful infrastructure underneath

Top tabs are not shortcuts. They are real domain switches.

Switching domain changes:
- the left-rail page set
- the workspace personality
- the density and pacing of the page composition

Switching domain does **not** change:
- the underlying truth model
- the adapter-first posture
- the no-fake-state rule

---

## 3. Durable product rules

1. truth over polish
2. useful before beautiful, then beautiful once useful
3. no fake state, no fake realtime, no fake embedded chat success
4. General and Trading share one design system, but not the same density or pacing
5. Trading stays research-first, not broker-terminal cosplay
6. Search is a capability, not a top-level page
7. Logs is not a current top-level destination
8. Home may be more editorial/composed than other pages, but still grounded in real truth where possible
9. Chat must remain honest about the real chat/control path and integration boundary

---

## 4. Current target information architecture

### 4.1 Domains

Current active domains:
- `General`
- `Trading`

Deferred possible future domains:
- `Creative`
- `Learning`

### 4.2 General domain pages

1. Home
2. Chat
3. Tasks
4. Agents
5. Crons
6. Memory
7. Files

### 4.3 Trading domain pages

1. Overview
2. Market Intel
3. Signals
4. Watchlist
5. Bot / Dispatch
6. Reports

### 4.4 Explicitly removed from top-level IA for now

- Logs
- standalone Search

---

## 5. Route map

### 5.1 Root/default
- `/` → `/general/home`

### 5.2 General
- `/general/home`
- `/general/chat`
- `/general/tasks`
- `/general/agents`
- `/general/crons`
- `/general/memory`
- `/general/files`

### 5.3 Trading
- `/trading`
- `/trading/market-intel`
- `/trading/signals`
- `/trading/watchlist`
- `/trading/bot`
- `/trading/reports`

### 5.4 Legacy redirects to preserve for now
- `/orchestrator` → `/general/chat`
- `/chat` → `/general/chat`
- `/cron` → `/general/crons`
- `/tasks` → `/general/tasks`
- `/agents` → `/general/agents`
- `/memory` → `/general/memory`
- `/files` → `/general/files`
- `/market-intel` → `/trading/market-intel`
- `/logs` → `/general/home`
- `/search` → `/general/home`

Rule:
- preserve clean redirects during migration
- do not let old route names define new page semantics

---

## 6. Shared shell responsibilities

### AppShell owns
- active domain detection
- top tab bar
- domain-scoped sidebar items
- shared page container spacing rules
- bottom system strip

### AppShell does not own
- page-specific fake summaries
- fake global state narration
- page-specific widgets pretending to be shell truth
- replacement logic for runtime behavior that belongs in adapters/pages

### Shell behavior rule
The shell should feel stable and premium, but quiet.
It should frame the work, not compete with the page.

---

## 7. Domain personality rules

### 7.1 General domain
General should feel:
- warm
- editorial
- spacious
- calm
- personal
- softly productive

General layout bias:
- larger cards
- more whitespace
- slower section rhythm
- more narrative support copy
- more compositional freedom

### 7.2 Trading domain
Trading should feel:
- denser
- sharper
- more analytical
- more operational
- still premium and warm, but less airy

Trading layout bias:
- tighter grids
- more compact cards
- stronger metric hierarchy
- less decorative whitespace
- more workstation energy, less lifestyle-dashboard energy

Important rule:
- same design system
- different density and pacing

---

## 8. Page contracts

## 8.1 General — Home

### Role
Personal operating dashboard.

### Desired posture
This is the most FLOATING page in the app.
It should stay close to the Stitch concept.

### Content model
- greeting / persona block
- city + weather widget
- elegant supporting copy
- Daily Pulse
- Growth Path
- Active Projects
- possibly one lighter “continue where you left off” / “what needs attention” area

### Rules
- more editorial than technical
- more composed than dense
- still truth-backed where possible
- not a system overview page

### Current implementation status
Partial / acceptable hybrid.
Not perfect, but good enough to leave temporarily while higher-risk foundation issues are fixed elsewhere.

---

## 8.2 General — Chat

### Role
Primary working conversation surface.

### Real product posture
This is not a fake standalone chat client.
This is a concierge workspace around the real chat/control path.

### Keep
- real chat principle
- no invented session model
- no fake transport
- no fake embedded success claims

### Target composition
- editorial greeting/header zone
- one or two contextual action/continuation chips
- primary chat panel area
- optional support context only if it helps the real model
- dock-style composer area only if it maps truthfully to the real interaction path
- quiet ambient telemetry strip

### Integration rule
The eventual embedded/reused chat panel is central to the page architecture, not a later garnish.

### Current implementation status
Structurally wrong foundation despite stronger visual similarity to Stitch.
Needs a redo focused on product truth and future embed-aware structure.

### Immediate priority
Highest among current page-level redesign needs.

---

## 8.3 General — Tasks

### Role
Active work queue and execution planning.

### Keep
- kanban/task orientation
- current file-backed truth
- practical scannability

### Redesign rule
- softer FLOATING treatment
- less hard-edged PM board energy
- still highly usable

### Current status
Functional and acceptable for now, but visually still closer to warmed-over old Mission Control than true FLOATING page composition.

---

## 8.4 General — Agents

### Role
Understand who/what is active.

### Keep
- squad logic
- role-based identity
- named agents first, quiet system agents second

### Redesign rule
- less system-monitor energy
- more elegant squad/workspace presentation
- readability first

### Current status
Usable but still transitional.

---

## 8.5 General — Crons

### Role
Scheduled work and automation awareness.

### Keep
- real cron truth
- runs/history awareness

### Redesign rule
- calmer framing
- less infra-debug energy
- should support trust/awareness, not scheduler archaeology

### Current status
Usable but transitional.

---

## 8.6 General — Memory

### Role
Continuity and reflection.

### Keep
- durable / daily / learnings split
- read-first posture

### Redesign rule
- quiet library feel
- strong reading comfort
- beautiful whitespace
- premium knowledge-journal feeling

### Current status
Likely one of the easier FLOATING wins. Needs consistency review, not conceptual rebuild.

---

## 8.7 General — Files

### Role
Workspace browsing and preview.

### Keep
- non-memory boundary
- read-first behavior
- reliable utility posture

### Redesign rule
- cleaner and softer
- less utility-pane aesthetic
- behavior remains boring/reliable

### Current status
Likely fine for now with light consistency follow-up later.

---

## 8.8 Trading — Overview

### Role
Trading domain landing page.

### Likely content
- market context snapshot
- current posture / daily summary
- names worth attention
- watchlist status
- bot/dispatch pulse
- quick links into deeper pages

### Rule
This is a domain orientation page, not a Bloomberg wall.

### Current status
Exists and is directionally correct, but still part of a transitional trading layer.

---

## 8.9 Trading — Market Intel

### Role
Research-first intelligence workspace.

### Keep
- Research Radar
- Manual Watch linkage
- Market Context
- signal/research relationship

### Rule
research-first, not terminal theater

### Current status
Meaningful real groundwork already exists. Future work should improve section hierarchy and usefulness, not invent fake sophistication.

---

## 8.10 Trading — Signals

### Role
Signal operations surface.

### Likely content
- execution candidates
- tracked signals
- review state
- evidence coverage
- accuracy cues

### Rule
This split keeps Market Intel from becoming overcrowded.

---

## 8.11 Trading — Watchlist

### Role
Human + system watch intake and follow-up.

### Likely content
- manual watch candidates
- promoted names
- thesis/status/tags
- later lightweight follow-up workflows

### Rule
“Keep an eye on this” should be first-class, not hidden in private UI state.

---

## 8.12 Trading — Bot / Dispatch

### Role
Operational trading system status.

### Likely content
- bot state
- dispatch state
- warnings
- market hours
- readiness/guardrail cues

### Rule
practical and bounded, not fake brokerage UI

---

## 8.13 Trading — Reports

### Role
Review and recap.

### Likely content
- daily report
- recent outcomes
- signal review rollups
- accuracy summaries

### Rule
reflection surface, not dumping ground

---

## 9. Reuse vs rebuild rules

### Reuse directly
- adapters in `lib/adapters/*`
- underlying contracts where still valid
- file/data integrations
- route-level truth posture
- preview/build scripts
- shared shell where already aligned

### Rebuild or reshape
- page framing/layout
- domain-aware composition
- chat foundation
- route naming semantics where legacy wording still leaks old product assumptions
- component styling where pages still feel like “old Mission Control in cream”

### Drop or park
- Logs page as active top-level destination
- standalone Search page
- old dark operator aesthetic as General’s baseline language

---

## 10. Search plan

Search is not a page.

### In General
- Memory search lives inside Memory
- file search lives inside Files

### In Trading
Later, local search/filtering may live inside:
- Market Intel
- Signals
- Watchlist

Rule:
- search should appear as local capability scoped to the user’s intent, not as a detached universal destination

---

## 11. Current implementation-gap assessment

### Already aligned enough
- root/domain route model
- domain-scoped sidebar behavior
- General/Trading split as product truth
- research-first direction in Trading
- removal of top-level Logs/Search

### Acceptable temporary state
- Home as hybrid approximation
- Tasks / Agents / Crons as warmed transitional pages
- Memory / Files with lighter consistency cleanup later

### Structurally wrong / should not be normalized
- current Chat page foundation if it implies a reconstructed native chat product instead of truthful hybrid integration

---

## 12. Immediate next implementation slice

### Next slice
Redo **General Chat** structurally before broader page polish continues.

### Goal
Build the correct foundation, not the final-perfect art pass.

### What the Chat redo must achieve
- align with FLOATING composition
- preserve truthful runtime posture
- introduce an embed-aware main chat panel slot
- avoid fake composer/input behavior if not truly wired
- support future embedded/reused chat path cleanly
- feel like Home’s focused working sibling, not a separate app

### What the Chat redo must not do
- imitate a fully native chat app that does not exist yet
- hide auth/runtime boundaries
- drift into fake assistant-product theater
- become a decorative mock page detached from real infrastructure

---

## 13. Recommended build order from here

### Phase 1 — spec-anchored correction
1. lock this execution spec
2. audit current Chat implementation against it
3. redo Chat foundation

### Phase 2 — General refinement
1. Home small refinement only if needed
2. Memory
3. Files
4. Tasks
5. Agents
6. Crons

### Phase 3 — Trading shape refinement
1. Overview
2. Market Intel
3. Signals
4. Watchlist
5. Bot / Dispatch
6. Reports

### Phase 4 — later polish
- embedded search
- legacy redirect cleanup
- shared component refinement
- future domains only if genuinely useful

---

## 14. Model workflow rule

Use Stitch as the visual source of truth for:
- Home
- shared shell patterns
- future page concepts

Use Codex for:
- shell-safe implementation
- route restructuring
- component extraction
- page conversion
- bounded redesign based on explicit page purpose

Practical rule:
Do not ask implementation models to improvise the product structure.
Give them:
- the IA
- route map
- page role
- reuse vs rebuild notes
- design source

---

## 15. Canonical current summary

### General
- Home
- Chat
- Tasks
- Agents
- Crons
- Memory
- Files

### Trading
- Overview
- Market Intel
- Signals
- Watchlist
- Bot / Dispatch
- Reports

### Removed from top-level
- Logs
- standalone Search

### Highest-priority next build step
- Redo **General Chat** on the correct product foundation
