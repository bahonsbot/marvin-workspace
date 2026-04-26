# Mission Control V1 Technical Integration Plan

Date: 2026-03-16
Status: technical planning draft
Depends on:
- `projects/_ops/mission-control-product-brief-2026-03-16.md`
- `projects/_ops/mission-control-v1-architecture-spec-2026-03-16.md`
- `projects/_ops/mission-control-v1-modules-implementation-plan-2026-03-16.md`
- `projects/_ops/mission-control-v1-data-contract-spec-2026-03-16.md`

## Purpose

Translate the Mission Control product direction into a realistic V1 technical integration plan for the current environment:
- Docker-based VPS
- SSH-managed
- 24/7 runtime
- local-first deployment
- OpenClaw already running and already providing a direct control/chat surface

## Recommended technical starting point

## Build as a workspace-local companion app with hybrid integration

Recommendation:
- create Mission Control as a separate app inside the workspace
- keep it local/self-hosted on the VPS
- integrate tightly with existing OpenClaw/runtime state
- treat the current orchestrator behavior as something to reuse/integrate rather than replace casually

## Why this is the best fit

### Better than directly stuffing everything into the current dashboard
- cleaner module separation
- easier to evolve Home/Tasks/Cron/Agents independently
- lower risk of destabilizing the existing direct control UI

### Better than a disconnected side app
- can still make Orchestrator first-class
- can share real state and operational context with OpenClaw
- avoids building a fake parallel product

## Recommended project location

Suggested location inside workspace:
- `projects/mission-control/`

Suggested top-level structure:
- `projects/mission-control/app/` or equivalent frontend/app shell
- `projects/mission-control/server/` or API routes if needed
- `projects/mission-control/lib/` for adapters/parsers
- `projects/mission-control/docs/` for project docs

The exact framework can be chosen later, but a web app shell that supports modular pages and local server routes is the likely best fit.

## V1 architectural layers

## Layer 1: UI shell
Responsibilities:
- navigation
- layout
- top status strip
- module routing
- shared design language

No business truth should live here.

## Layer 2: integration/adapters
Responsibilities:
- read OpenClaw cron/session/runtime state
- read workspace files
- parse selected artifacts
- normalize data for the UI

This is the most important V1 layer.
It should hide source weirdness from the UI without creating a new source of truth.

## Layer 3: actions
Responsibilities:
- safe, bounded write/control actions
- Run Now for cron
- refresh/sync triggers where justified
- orchestrator session interactions

This layer should stay intentionally small in V1.

# Source integration strategy by module

## 1) Home

### Integration approach
Build Home from aggregated adapter outputs, not direct raw-file rendering in the client.

### Suggested data providers
- `getHomeStatusSummary()`
- `getRecentActivity()`
- `getCronOverview()`
- `getSessionOverview()`

### Why
Home is inherently cross-cutting. A thin aggregation layer will simplify the UI without inventing fake state.

## 2) Orchestrator

### Integration approach
Do not reinvent the underlying chat semantics in V1.

Preferred order of options:
1. reuse/embed/integrate current OpenClaw direct-chat behavior if technically feasible
2. if not feasible, wrap the same underlying runtime/session interfaces with a clean orchestrator module
3. avoid building a brand-new custom chat protocol as a first move

### Key point
The Orchestrator is too important to become a speculative rewrite.

## 3) Cron

### Integration approach
Use real OpenClaw cron state as primary source.
Add a small derived layer for runner-backed classification and runner-log enrichment.

### Suggested adapters
- `listCronJobs()`
- `getCronRuns(jobId)`
- `classifyCronJobType(job)`
- `getRunnerLogSummary(taskName)`

### Notes
- runner-backed classification can be derived from payload shape or a registry map
- runner logs are supplemental, not the canonical job source

## 4) Tasks

### Integration approach
Use the existing generated board as primary display source.
Corroborate with planner files where needed.

### Suggested adapters
- `getKanbanBoard()`
- `getKanbanSyncStatus()`
- `getTaskDetail(taskId)`

### Notes
- avoid building a second Kanban backend
- read-first design is safer in V1

## 5) Agents

### Integration approach
Use session/runtime listings and derive a useful agent/session view from them.

### Suggested adapters
- `listSessions()`
- `getSessionSummary(sessionKey)`
- `groupSessionsByType()`

### Notes
- this module is more about operational visibility than anthropomorphic "agent squad" theatrics

# Proposed adapter layer structure

Suggested internal layout:

- `lib/adapters/cron.ts`
- `lib/adapters/sessions.ts`
- `lib/adapters/tasks.ts`
- `lib/adapters/memory.ts`
- `lib/adapters/files.ts`
- `lib/adapters/activity.ts`
- `lib/adapters/home.ts`

Suggested utility layer:
- `lib/parsers/`
- `lib/contracts/`
- `lib/types/`

## Adapter design rule
Each adapter should:
- read from real sources
- normalize output into stable shapes for the UI
- expose freshness/error information when useful
- avoid hidden writes

# Runtime integration choices

## Option A — use local server/API routes in the companion app

This is the most practical V1 option.

Benefits:
- keeps file reads server-side
- avoids exposing raw workspace paths to the client
- can normalize and redact as needed
- fits local-first deployment well

## Option B — direct client reads via existing APIs only

Too limiting for V1 because several desired modules depend on workspace files/artifacts, not just runtime endpoints.

## Recommendation
Use local app server/API routes for Mission Control.
The browser should talk to the companion app, and the companion app should read local state safely.

# Interaction design boundaries

## Read-first routes
Examples:
- `/api/home/summary`
- `/api/cron/jobs`
- `/api/cron/runs?id=...`
- `/api/sessions`
- `/api/tasks/board`
- `/api/activity/recent`

## Bounded write/control routes
Examples:
- `/api/cron/run`
- later maybe `/api/tasks/refresh`
- orchestrator send route only if not directly reused from existing OpenClaw UI behavior

## Delay these in V1
- broad config mutation routes
- arbitrary file editing routes
- raw shell terminal routes
- secret management routes

# Deployment integration plan

## V1 preferred deployment
- run the Mission Control app on the same VPS/host environment
- keep it behind local/private access first
- access through SSH tunnel, VPN, or carefully controlled reverse proxy

## Reverse-proxy posture
If remote access is added:
- HTTPS required
- auth required
- rate limiting required
- no unauthenticated sensitive routes

## Docker/VPS note
Because the environment already runs 24/7 in Docker on a VPS, the companion app should be designed as a stable local service, not as a dev-only dashboard that assumes constant manual babysitting.

# Suggested implementation phases

## Phase 1 — scaffold technical foundation
- create companion app structure
- define adapter contracts/types
- stand up shell + placeholder routes

## Phase 2 — integrate Home + Orchestrator
- Home summary adapters
- orchestrator integration proof
- top status strip

## Phase 3 — integrate Cron + Agents
- cron list/runs/classification
- session/agent views
- safe Run Now action

## Phase 4 — integrate Tasks
- board adapter
- sync status logic
- detail panel

## Phase 5 — add Memory / Files / Logs
- deepen environment visibility after core ops loop is proven

# Main unresolved technical question

The biggest unresolved V1 question is:

## How exactly should the Orchestrator be integrated?

This is the one area where implementation should not guess.

The next focused design step should compare:
1. embedded/reused current direct-chat UI behavior
2. wrapped runtime/session interfaces with custom presentation
3. a hybrid of those two

## My recommendation
Do not decide this by taste alone.
Treat it as a focused technical spike before implementation begins.

# Recommended next step

Write a focused **Orchestrator integration decision memo** plus a **V1 app scaffold brief**.
Those two documents would make implementation delegation much cleaner.
