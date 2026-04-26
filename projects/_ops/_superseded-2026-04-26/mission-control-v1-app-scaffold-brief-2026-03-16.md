# Mission Control V1 App Scaffold Brief

Date: 2026-03-16
Status: implementation scaffold brief
Depends on:
- `projects/_ops/mission-control-product-brief-2026-03-16.md`
- `projects/_ops/mission-control-v1-architecture-spec-2026-03-16.md`
- `projects/_ops/mission-control-v1-modules-implementation-plan-2026-03-16.md`
- `projects/_ops/mission-control-v1-data-contract-spec-2026-03-16.md`
- `projects/_ops/orchestrator-integration-decision-memo-2026-03-16.md`

## Purpose

Define the first concrete code scaffold for Mission Control V1 so implementation can begin without ambiguity.

This brief is about:
- app skeleton
- route/module layout
- adapter stubs
- shell composition
- first implementation sequence

It is **not** yet a full visual design spec or a detailed component catalog.

## Recommended project location

Create the app under:
- `projects/mission-control/`

Rationale:
- keeps Mission Control as a companion app inside the workspace
- avoids entangling it prematurely with the current gateway UI code
- makes local-first deployment straightforward

## Scaffold philosophy

Build a thin, truthful shell first.

Meaning:
- app skeleton before deep visual polish
- adapter stubs before heavy module interactivity
- Home and Orchestrator first
- keep state ownership outside the UI wherever possible

## Initial app structure

Suggested directory structure:

```text
projects/mission-control/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home
│   ├── orchestrator/page.tsx
│   ├── cron/page.tsx
│   ├── tasks/page.tsx
│   ├── agents/page.tsx
│   ├── logs/page.tsx
│   ├── memory/page.tsx            # later phase
│   ├── files/page.tsx             # later phase
│   └── api/
│       ├── home/summary/route.ts
│       ├── sessions/route.ts
│       ├── cron/jobs/route.ts
│       ├── cron/runs/route.ts
│       ├── cron/run/route.ts
│       ├── tasks/board/route.ts
│       ├── tasks/sync-status/route.ts
│       └── activity/recent/route.ts
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopStatusBar.tsx
│   │   └── RightInspector.tsx
│   ├── home/
│   ├── orchestrator/
│   ├── cron/
│   ├── tasks/
│   ├── agents/
│   └── shared/
├── lib/
│   ├── adapters/
│   │   ├── home.ts
│   │   ├── sessions.ts
│   │   ├── cron.ts
│   │   ├── tasks.ts
│   │   ├── activity.ts
│   │   ├── memory.ts
│   │   └── files.ts
│   ├── parsers/
│   ├── contracts/
│   └── types/
├── docs/
└── package.json
```

This exact framework can be adjusted, but this is the right shape.

## First route set (V1 core)

## Must exist in the first scaffold
- `/` → Home
- `/orchestrator`
- `/cron`
- `/tasks`
- `/agents`
- `/logs`

## Can be scaffolded later, not required on day one
- `/memory`
- `/files`
- `/search`
- `/settings`

## First shell requirements

### AppShell
Should provide:
- left navigation
- top status strip
- main content area
- optional right-side contextual drawer placeholder

### Sidebar
Must include:
- Home
- Orchestrator
- Tasks
- Agents
- Cron
- Logs

Later:
- Memory
- Files
- Search
- Settings
- domain modules

### TopStatusBar
V1 fields can be placeholders backed by real adapters as soon as available:
- active sessions count
- due/running cron count
- current time
- gateway/runtime state indicator

### RightInspector
Can begin as a placeholder/empty state.
Do not overbuild it before the main modules are useful.

## Adapter scaffolding requirements

The first implementation pass should create adapter stubs for:
- `lib/adapters/home.ts`
- `lib/adapters/sessions.ts`
- `lib/adapters/cron.ts`
- `lib/adapters/tasks.ts`
- `lib/adapters/activity.ts`

Each adapter should expose a stable function surface even if implementation is partial at first.

Example shape:

```ts
export async function getHomeSummary() {
  return {
    status: 'partial',
    sessions: null,
    cron: null,
    activity: [],
    refreshedAt: new Date().toISOString(),
  }
}
```

## API route scaffolding requirements

The first scaffold should include minimal read routes for the core modules.

### Minimum useful routes
- `GET /api/home/summary`
- `GET /api/sessions`
- `GET /api/cron/jobs`
- `GET /api/cron/runs`
- `POST /api/cron/run`
- `GET /api/tasks/board`
- `GET /api/tasks/sync-status`
- `GET /api/activity/recent`

### Route rules
- all routes should be local-first and private by default
- read routes first
- write/control routes only where already clearly justified
- route handlers should call adapters, not raw logic embedded in the route itself

## Module implementation sequence

## Phase 1 — shell + placeholder routes
Implement:
- app shell
- sidebar
- top status bar
- route placeholders
- adapter stubs
- basic API route skeletons

Success criteria:
- app boots
- navigation works
- pages render stable placeholder states
- route contract surfaces exist

## Phase 2 — Home + Orchestrator integration spike
Implement:
- Home using real summary adapters
- Orchestrator integration proof

Success criteria:
- Home shows real, trustworthy summary blocks
- Orchestrator route has a concrete integration strategy, not a mock that pretends to be done

## Phase 3 — Cron + Agents
Implement:
- real cron listing/history/run-now path
- real sessions/agents visibility

Success criteria:
- Cron page is genuinely useful
- Agents page shows real session truth

## Phase 4 — Tasks
Implement:
- board read path
- sync status indicator
- task detail panel

Success criteria:
- board is trustworthy enough to be useful
- stale/inconsistent states are visible, not hidden

## Orchestrator-specific scaffold rule

The first scaffold must **reserve** a clear orchestrator integration slot without forcing a bad early decision.

Practical requirement:
- `/orchestrator` route should exist in the scaffold
- the page should clearly indicate whether it is:
  - embedded current control/chat behavior
  - integrated wrapper around current runtime/session interfaces
  - or temporary placeholder pending the integration spike

Do not fake-complete this module in the first scaffold.

## Styling/system guidance for the scaffold

The first scaffold should already establish:
- dark theme baseline
- typography hierarchy
- card spacing rhythm
- shell layout proportions

But should **not** spend early effort on extreme polish before data truth flows are live.

Premium feel matters, but v1 scaffold value comes from correctness and structural clarity first.

## Environment/deployment assumptions for scaffold

The scaffold should assume:
- local-first deployment on the existing VPS
- private access first
- no new database required
- server-side access to local workspace/runtime state

Do not assume public internet exposure in the first implementation pass.

## Deliverables expected from the first implementation pass

At minimum:
- project directory scaffold exists
- shell exists
- core routes exist
- adapter stubs exist
- basic API routes exist
- Home/Cron/Tasks/Agents/Orchestrator pages exist as real scaffold pages, even if some are partial
- docs/README for local dev/run exists

## Main caution

The scaffold should not pretend to solve the hardest part by vibes alone.

Especially:
- do not fake a finished orchestrator
- do not invent a dashboard-owned truth layer
- do not build drag-and-drop Tasks before sync integrity is proven
- do not broaden write/control scope casually

## Recommended next step after this brief

Once this scaffold brief is accepted, the next execution move should be either:
1. spawn Builder/Reviewer for the initial scaffold implementation
or
2. write one last focused `Orchestrator integration spike brief` before coding if we want tighter implementation guardrails there first

## Recommendation

My recommendation is:
- treat this scaffold brief as sufficient for starting the shell + adapter scaffolding
- but keep the Orchestrator module explicitly provisional until the integration spike is resolved in code or via a narrow follow-up brief
