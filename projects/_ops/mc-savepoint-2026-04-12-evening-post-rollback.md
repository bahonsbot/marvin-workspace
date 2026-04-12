# Mission Control savepoint — 2026-04-12 evening post-rollback

## Context
A VPS rollback was performed because instability kept compounding.

For this checkpoint, **current workspace state + live preview verification** are the source of truth.
Git history is currently useful only as a comparison surface, not as canonical truth.

## What was verified just now
- rebuilt Mission Control preview from current workspace state
- preview restart completed successfully
- route verification passed:
  - `http://127.0.0.1:3005/general/chat` → `200`
  - `http://127.0.0.1:3005/general/agents` → `200`
- user report: apart from a **minor UI/display issue on the Tasks page**, the rest of Mission Control now looks stable

## Current repo posture
### Workspace repo
- HEAD: `0cba20c`
- many modified files outside Mission Control exist, including memory/state/log artifacts
- do **not** treat broad workspace git dirt as evidence of current breakage by itself

### Mission Control repo
- HEAD: `9286715c`
- after excluding build/runtime artifact noise (`.next`, `.preview-runtime`), the meaningful tracked diffs are:
  - `projects/mission-control/data/autonomous-tasks.json`
  - `projects/mission-control/data/custom-news-briefings.json`
  - `projects/mission-control/data/skills-ui-state.json`
  - `projects/mission-control/hooks/useRuntimeBridge.ts`

## Interpretation
Right now, the most trustworthy order is:
1. live workspace files
2. successful local build + restart + route verification
3. Philippe’s visual/UI confirmation
4. git diff as a secondary comparison tool

That means:
- preview/runtime truth is currently usable
- git truth may still contain drift, stale commits, or rollback mismatches
- avoid broad repo cleanup or git normalization until the stable live baseline is preserved first

## Known stable baseline
At this checkpoint, the practical stable baseline is:
- Mission Control preview boots
- Chat route loads
- Agents route loads
- no reported broad instability outside the minor Tasks-page display issue

## Recommended next move
Stay narrow.

1. preserve this checkpoint as the rollback-safe resume point
2. inspect the minor Tasks page UI/display issue without broadening scope
3. only after that, compare the four meaningful Mission Control diffs against intended product truth and decide what should be kept, reverted, or re-committed cleanly

## Files to inspect first next session
- `projects/_ops/mc-savepoint-2026-04-12-evening-post-rollback.md`
- `memory/2026-04-12.md`
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`
- `projects/mission-control/data/autonomous-tasks.json`
- `projects/mission-control/hooks/useRuntimeBridge.ts`

## Resume rule
Do **not** assume git HEAD is correct just because it exists.
Resume from the verified live workspace baseline first, then reconcile git carefully.