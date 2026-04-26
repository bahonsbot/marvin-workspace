# Mission Control V1 Architecture Spec

Date: 2026-03-16
Status: implementation planning spec
Depends on: `projects/_ops/mission-control-product-brief-2026-03-16.md`

## Objective

Define a buildable V1 architecture for Mission Control that fits the current operating environment:
- Docker-based VPS
- SSH-managed
- 24/7 runtime
- local-first preference
- optional remote exposure only if justified and secured properly

## Environment assumptions

### Current runtime reality
- OpenClaw is running in a Docker-based VPS environment
- Workspace lives under `/data/.openclaw/workspace`
- Operational management often happens over SSH
- Gateway/UI already exists and remains important, especially the direct gateway chat / control surface

### Deployment preference
- Prefer local/self-hosted deployment on the existing VPS
- Avoid unnecessary external services or new databases in V1
- Remote access should be optional and security-conscious, not the default architectural assumption

## Architecture recommendation

## Recommended V1: hybrid companion shell

Mission Control V1 should be built as a **hybrid companion shell** that reads from the real OpenClaw/workspace/runtime state and treats the current orchestrator/direct-chat experience as a first-class module.

This means:
- broader shell than the current gateway dashboard alone
- not a shadow platform with separate state ownership
- local-first deployment on the same VPS/host stack
- minimal new backend complexity

## Why this is the right starting point

### Better than adapting the current UI directly
- less risk of overstuffing the existing gateway interface
- cleaner module boundaries
- easier to give Home / Tasks / Cron / Agents distinct layouts

### Better than a fully separate platform
- keeps the orchestrator central
- avoids the "analytics dashboard with chat bolted on" problem
- preserves real OpenClaw/runtime truth as the source of state

## V1 module boundary map

## 1) Home

### Purpose
Mission Control landing page for orientation and system state.

### V1 mode
Mostly read-only, with quick navigation actions.

### Source of truth
- gateway/runtime health
- session summaries
- cron summaries
- recent runner activity (`memory/cron-run-log.jsonl`)
- selected recent task/activity artifacts

### Allowed interactions in V1
- jump to current orchestrator session
- open Cron / Tasks / Agents / Logs
- maybe trigger safe quick navigation actions only

## 2) Orchestrator

### Purpose
Primary chat/intervention surface.

### V1 mode
Interactive.

### Source of truth
- current OpenClaw session/runtime state
- direct gateway chat session

### Allowed interactions in V1
- send/receive chat
- attach files if already supported in the underlying UI/API
- view session metadata
- jump to relevant context panels

### Recommendation
Do not re-engineer chat semantics in V1.
Wrap, adapt, or integrate the existing proven direct-chat behavior where possible.

## 3) Tasks

### Purpose
Visual execution pipeline grounded in workspace truth.

### V1 mode
Mixed: mostly read, carefully limited writes.

### Source of truth
- `AUTONOMOUS.md`
- `memory/tasks-log.md`
- generated board state (`projects/autonomous-kanban/public/board.json`)

### Allowed interactions in V1
- view board
- inspect task detail
- maybe manual refresh/sync action

### Caution
Avoid adding free-form drag/drop writes in V1 unless state sync is fully trustworthy.
Truthfulness matters more than slick movement.

## 4) Agents

### Purpose
Session/agent visibility and light control.

### V1 mode
Mostly read-only, selective safe actions.

### Source of truth
- sessions list/history
- subagent/session status
- runtime metadata

### Allowed interactions in V1
- inspect sessions
- filter by type/model/activity
- later maybe open session or steer subagent if safely integrated

## 5) Cron

### Purpose
Schedule, run, inspect, and understand jobs.

### V1 mode
Interactive but bounded.

### Source of truth
- OpenClaw cron job state
- cron runs/history
- runner logs for migrated deterministic jobs

### Allowed interactions in V1
- list jobs
- inspect run history
- run now
- maybe enable/disable if clearly safe and authorized

### Important V1 distinction
The UI should show job type explicitly:
- runner-backed deterministic
- mixed
- intentionally model-backed

## 6) Memory

### Purpose
Inspect durable and daily memory.

### V1 mode
Read-first, minimal editing.

### Source of truth
- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- `.learnings/`
- later `life/`

### Allowed interactions in V1
- browse
- search
- quick open
- maybe careful text edit for known-safe files later

## 7) Files

### Purpose
Workspace browsing.

### V1 mode
Read-first.

### Source of truth
- workspace filesystem

### Allowed interactions in V1
- browse
- preview
- maybe open-in-editor later

## 8) Logs / Activity

### Purpose
Operational pulse and recent event visibility.

### V1 mode
Read-only.

### Source of truth
- `memory/cron-run-log.jsonl`
- cron run history
- selected task/detail logs
- session/runtime activity sources if accessible cleanly

## Data-access model

## Principle
V1 should prefer direct reads from existing truth sources rather than introducing a new DB.

### Good V1 data sources
- filesystem state in workspace
- OpenClaw cron/session APIs or CLI-backed routes
- runner JSONL logs
- selected existing JSON artifacts

### Avoid in V1
- introducing a new persistent dashboard database as the system of record
- duplicating task/memory/session state into a separate backend store

### Acceptable V1 caching
- short-lived in-memory caching for UI responsiveness
- explicit "last refreshed" indicators if data is not live

## Deployment model

## Recommended V1 deployment
- run Mission Control locally on the same VPS or within the same Docker-hosted environment boundary
- keep it private by default
- access via SSH tunnel, local reverse proxy, VPN, or other controlled path first

### Default posture
- local-first
- authenticated
- minimal exposure

### Remote exposure
May be considered later if needed, but only with:
- authentication
- rate limiting
- HTTPS
- careful host/reverse-proxy config
- clear boundary around which actions are exposed

## Security posture

### V1 security principles
- private by default
- no unnecessary public exposure
- no raw secret dumping into UI
- no broad unsafe terminal capability in V1
- distinguish clearly between read actions and write/control actions

### V1 safe interactions
- read state
- run bounded safe actions
- manual cron triggers
- open current session

### V1 risky interactions to delay
- broad config editing
- arbitrary command terminal
- secret/key management UI
- anything that materially changes gateway auth/routing/security posture without strong safeguards

## UX system guidance

### Visual direction
- dark, calm, premium
- polished enough to feel intentional and high-end
- not at the cost of clarity

### Allowed ambient elements
- date/time widget
- weather widget
- possibly quote-of-the-day

These belong on Home only if they support orientation and atmosphere without clutter.

### Structural shell
- left nav
- top status strip
- central content area
- optional right-side inspector

## V1 technical posture

### Preferred
A local web app shell that:
- reads real workspace/runtime state
- calls existing OpenClaw functionality where appropriate
- avoids creating a second system of truth

### Practical implication
The easiest credible start is likely:
- separate companion UI codebase or dashboard app within the workspace
- lightweight server/routes for reading local files and selected runtime info
- explicit integration with existing orchestrator/chat behavior rather than rebuilding everything from scratch immediately

## Read-only vs interactive boundary summary

### Read-only first
- Home
- Agents
- Memory
- Files
- Logs / Activity

### Selective interaction allowed in V1
- Orchestrator chat
- Cron run-now / history inspection
- carefully bounded task refresh/sync actions

### Defer heavier write flows
- rich task editing
- config mutation
- auth/provider editing
- dangerous host operations

## Main open architectural decision after this spec

Not whether to build the dashboard.
That is already directionally chosen.

The next real technical decision is:

### How tightly should V1 integrate with the current OpenClaw dashboard/chat implementation?

Options for that next decision:
1. reuse/embed/extend the current orchestrator experience where possible
2. recreate a cleaner orchestrator module on top of existing runtime/session interfaces
3. hybrid of both

### Recommendation
Favor reuse/integration first if it avoids unnecessary reimplementation. The orchestrator is too important to treat casually.

## Recommended next spec

After this architecture spec, the best next document is:
- module-by-module implementation plan
- especially for Home, Orchestrator, Cron, Tasks, and Agents
- with explicit source-of-truth fields, required APIs/files, and V1 UI actions
