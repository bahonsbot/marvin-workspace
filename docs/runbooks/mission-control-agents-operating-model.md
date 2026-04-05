# Mission Control Agents Operating Model

Last updated: 2026-04-05 (Phase 5 interventions)
Owner: Marvin / Philippe
Scope: `projects/mission-control` General -> Agents page

## Purpose

This runbook captures the truthful mixed model behind the Mission Control Agents page so future sessions can extend or rename it without reopening the core product decision.

The page is meant to answer:
- who is the control layer
- which operating units exist now
- which specialist seats are intentionally staged
- which runtime sessions are background-only

It is not:
- a fake multi-agent demo
- a raw session admin console

## Product model

The page now uses four sections:

1. `Control`
   - `Marvin`
   - distinct from every other roster unit
   - represents the canonical control seat

2. `Teams`
   - `Dev Team`
   - `Content / SEO Team`
   - teams should read as operating units, not single-agent cards

3. `Standalone Specialists`
   - `Sportsbet Advisor`
   - `Trading Advisor`
   - `Language Tutor`
   - these should read as dedicated seats

4. `Quiet / Internal`
   - cron/system/helper/background sessions
   - visibly secondary

## Naming model

Stable internal ids live in:
- `projects/mission-control/lib/agents/definitions.ts`

Visible labels are separate from ids by design.

Rules:
- `Marvin` stays Marvin
- every other visible label is a placeholder for now
- future renaming should happen by changing labels in the definitions layer, not by rewriting matching logic or UI structure

## Build model

The implementation is intentionally split into:

1. Definitions layer
   - file: `projects/mission-control/lib/agents/definitions.ts`
   - owns stable ids, labels, readiness state, team membership, and action mode

2. Adapter layer
   - file: `projects/mission-control/lib/adapters/agents.ts`
   - reads current runtime/session truth
   - matches sessions to definitions
   - shapes section payloads
   - emits health/evidence/action payloads for the page

3. Presentation layer
   - files under `projects/mission-control/components/agents/`
   - renders control/team/specialist cards plus the quiet/internal panel
   - should stay presentation-focused, not re-implement matching logic

4. Page composition
   - file: `projects/mission-control/components/pages/GeneralAgentsPage.tsx`
   - keeps the page restrained and section-led
   - Marvin is now the only visible oversight surface on the page
   - do not reintroduce a separate page-level oversight strip or a giant hero/stat block
   - Agents, Files, and Memory are intentionally headerless now; do not casually re-add a page title/underline block there

## Durable workspace scaffolding

Durable non-Marvin workspaces now live under:
- `agent-workspaces/<stable-role-slug>/`

Current seeded workspaces:
- `agent-workspaces/dev-team-lead/`
- `agent-workspaces/content-seo-team-lead/`
- `agent-workspaces/sportsbet-advisor/`
- `agent-workspaces/trading-advisor/`
- `agent-workspaces/language-tutor/`

Each seeded workspace currently includes:
- `SOUL.md`
- `MEMORY.md`
- `WORKSPACE.md`
- `memory/README.md`
- `artifacts/README.md`

Artifact convention:
- real durable outputs should land under `agent-workspaces/<slug>/artifacts/`
- placeholder files like `README.md`, `.gitkeep`, and `.keep` do **not** count as real artifacts

These slugs are role-based and should stay stable even if visible labels change later.

## Truth model

Current runtime truth is now mixed:
- runtime/session evidence
- workspace scaffold evidence for durable seeded seats

The page does not claim:
- direct per-specialist chat routing
- independent live health monitoring
- proof of healthy execution from a running flag alone

The page is allowed to show staged capability only when it is clearly marked as staged.

Workspace readiness now means:
- `ready`: workspace directory exists and all expected starter files are present
- `partial`: workspace directory exists but one or more expected starter files are missing
- `staged`: no seeded workspace exists yet

Chat readiness remains separate from workspace readiness.

### Current action policy

Allowed live actions:
- open main chat
- open current control UI when the runtime exposes a real browser path
- inspect real internal support lanes through the existing control surface
- open a seeded workspace in Files
- open a seeded workspace `MEMORY.md` in Files preview
- open the latest verified artifact when one exists

Allowed staged/unavailable actions:
- direct specialist seat activation
- direct team routing that does not exist yet

Not allowed:
- buttons that imply unsupported routing is live
- fake control surfaces
- fake workspace launch flows

## Health and evidence philosophy

The contract is prepared for stronger health checks later.

Each visible roster unit carries:
- health status
- health label
- evidence entries
- workspace readiness
- chat readiness

Current evidence is lightweight but now includes first-pass artifact verification:
- matched runtime session label
- model when visible
- last-seen timestamp
- workspace existence
- expected starter-file presence / missing-file detail
- latest verified artifact path/time when one exists
- missing-output warning when recent non-running activity exists without a real artifact
- staged/readiness notes when no session exists

Current missing-output heuristic:
- if a durable seat has a recent non-running session signal inside the recency window and no real artifact in its `artifacts/` folder, show an attention-state missing-output signal
- if there is no real artifact and also no recent activity, show a calmer `awaiting first verified output` signal instead
- a currently running session does not automatically count as missing output yet

Durable rule:
- a running-looking state by itself is not sufficient proof of healthy capability
- later monitoring can extend the same contract with stronger evidence without changing the page model

## Phase 5 oversight and intervention model

Marvin is now the sole visible oversight surface on the Agents page.

Layout rule:
- Marvin remains a broad full-width card
- Marvin uses an integrated split/asymmetric layout
- left side = Marvin identity, health, readiness, core actions, signals
- right side = oversight summary and live issues / all-clear state
- do not add a second oversight strip elsewhere on the page
- do not keep a duplicate stacked `Oversight` block inside Marvin once the right-side oversight panel exists

Current oversight summary on Marvin:
- active issue count
- seat count needing attention
- roster count currently active or ready
- quiet/internal session count

When issues exist:
- Marvin shows the current live issues in the right-side panel
- each issue should present a lightweight next step using already-live actions only

When no issues exist:
- Marvin still shows a calm all-clear state in that same right-side panel
- avoid empty warning shells or decorative placeholder incident UI

## Current alert triggers

Current alerts are derived centrally in:
- `projects/mission-control/lib/adapters/agents.ts`

The adapter currently raises actionable alerts for:
- `Workspace partial`
  - triggered when a seeded workspace exists but one or more expected starter files are missing
  - typical actions: `Open workspace`, `Open MEMORY.md`
- `Missing output after recent activity`
  - triggered when recent non-running activity exists for a durable seat but no real artifact exists in its `artifacts/` directory
  - placeholder files like `README.md`, `.gitkeep`, and `.keep` do not count
  - typical actions: `Open workspace`, `Open MEMORY.md`, route back through Marvin/main chat when human follow-through is next
- `Runtime signal needs verification`
  - triggered when a matched session reports an `unknown` state
  - typical actions: open main chat / Control UI / relevant workspace context depending on the seat

Severity is intentionally simple:
- `attention` for missing-output conditions
- `warning` for weaker but real issues like partial workspace state or unknown runtime signal

What does **not** currently trigger an alert:
- calm `awaiting first verified output` states
- staged-but-honest capability states by themselves
- simple quietness without contradictory evidence
- a currently running session by itself

This keeps the page truthful: visible issues should mean there is something concrete to inspect or act on.

### Intervention presentation rule

Intervention should stay lightweight:
- use real actions that already exist
- show a clear first next step when an issue card has actions
- keep secondary actions available, but do not pretend there is a full incident-management workflow
- optional acknowledgement state is intentionally skipped for now because there is no truthful persistent incident state yet

Current real intervention paths:
- `Open workspace`
- `Open MEMORY.md`
- `Open latest artifact`
- `Use via Marvin` / `Open main chat`
- `Inspect in Control UI` only when the runtime exposes a real browser path

## First seat-specific expectation model

Role-specific output expectations now live lightly in the definitions layer:
- file: `projects/mission-control/lib/agents/definitions.ts`
- field: `expectedOutputs`

Current expectation wording:
- `Dev Team`: implementation note / QA handoff / build artifact
- `Content / SEO Team`: brief / draft / report artifact
- `Trading Advisor`: research note / signal pack / market summary
- `Sportsbet Advisor`: angle note / matchup brief / betting research artifact
- `Language Tutor`: lesson note / exercise / session artifact

How the page uses this today:
- artifact verification copy is less generic
- missing-output alerts say what kind of delivery is expected
- signal/evidence blocks can show the current expected output shape for that seat

This is intentionally not a rules engine. It is lightweight wording + verification context only.

## Matching model

Session matching is keyword/hint based for now and intentionally centralized in the adapter.

Important behavior:
- Marvin matches the canonical main seat
- Builder/Reviewer are represented inside `Dev Team`
- content/editorial seats are grouped inside `Content / SEO Team`
- unmatched cron/system/helper sessions fall into `Quiet / Internal`

Future changes should prefer:
- editing match hints in the definitions layer
- expanding adapter evidence carefully

Future changes should avoid:
- scattering ad hoc matching logic into UI components

## Visual direction refinements (Apr 5 follow-up)

After the first rebuild, Philippe approved a more restrained visual direction.

Durable visual rules:
- remove the introductory roster explainer block from the top of the page
- do not show a separate `Control` section title/subtext above Marvin if Marvin is already visually distinct
- prefer avatar-led identity over descriptive subtext blurbs
- team cards should include a team-avatar / grouped-mark treatment rather than explanatory paragraph copy
- standalone specialists should include dedicated avatar space, even if the current art is placeholder-only
- keep the page hierarchy fixed as:
  1. Marvin
  2. Teams
  3. Standalone Specialists
- teams and specialists should scale through horizontal rails, not through a growing grid that weakens hierarchy
- additional teams/specialists should appear to the right with a visible side-scroll cue / slight right-edge peek
- `Quiet / Internal` should remain available for runtime truth, but as a collapsed/footer-style utility strip rather than a full equal-weight content section

Copy restraint rules:
- avoid descriptive blurbs like `Reserved for...` and `Internal build lane for...` in the visible card body once avatar-led identity exists
- keep visible text to: name, role, health/readiness, compact signals, and truthful actions
- if a card starts reading like a product explainer, trim it back

## Rollout logic

This page is intentionally a restrained intermediate step.

What is live now:
- Marvin as the distinct control layer
- team/grouped representation
- specialist seats visible from day one
- quiet/internal runtime context
- truthful action gating
- seeded durable workspaces for Dev Team, Content / SEO Team, Sportsbet Advisor, Trading Advisor, and Language Tutor
- live Files-page workspace open actions for seeded seats
- live `Open MEMORY.md` actions for seeded seats
- live `Open latest artifact` actions when a real artifact exists
- first-pass artifact-aware health / missing-output signaling
- Marvin as the sole visible oversight hub
- integrated right-side Marvin oversight panel with current actionable issues or all-clear state
- expectation-aware intervention copy for durable seats

What is staged:
- dedicated specialist routing
- evidence-aware active health beyond session presence
- any direct specialist/team chat path beyond Marvin or current internal control behavior

When new real capabilities land:

1. update the definition for the relevant unit
2. upgrade the adapter action/readiness output
3. keep the visual section structure unless the product model changes

## Verification philosophy

For future changes to this page:

1. verify labels and ids remain separated
2. verify staged actions are still visibly staged
3. verify quiet/internal remains visually secondary
4. verify real runtime matching still works for Marvin and Dev Team
5. run `npm run build` in `projects/mission-control`

If build or type validation fails after page work, check generated build output first before assuming the page refactor is wrong. This repo has previously produced misleading failures from stale `.next` state.

## Page model summary

The correct reading order is:

1. control first
2. teams second
3. specialist seats third
4. quiet/internal last

The correct tone is:
- readable first
- character second
- truthful always
