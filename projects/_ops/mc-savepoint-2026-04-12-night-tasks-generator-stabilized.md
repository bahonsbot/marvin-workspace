# Mission Control savepoint — 2026-04-12 night tasks generator stabilized

## Context
After the evening rollback-safe baseline was re-established, the active Mission Control lane moved into a narrow Tasks-page stabilization pass.

The focus stayed deliberately scoped:
1. fix autonomous task title/brief presentation regressions
2. fix generator quality so new backlog tasks reflect the current `AUTONOMOUS.md` goals
3. keep category in the pill lane instead of the title text
4. keep validation strict: build, preview restart, route/API verification

## What was fixed

### 1. Stored/backlog autonomous task copy was healed
Problem:
- some backlog tasks were carrying legacy multiline task text inside `title`
- `**Brief:**` content was effectively living in raw markdown/title text
- new backlog items looked messy while older completed tasks still looked fine

Fix:
- normalized embedded legacy task text back into:
  - clean `title`
  - proper `description` / brief
- healed bad existing backlog records at rest in `projects/mission-control/data/autonomous-tasks.json`

Key files:
- `projects/mission-control/lib/autonomous.ts`
- `projects/mission-control/data/autonomous-tasks.json`

### 2. Category tag removed from visible title lane
Problem:
- generated/stored titles still carried bracketed tags like `[Trading]`
- UI already had a category pill lane, so the title was doing duplicate work

Fix:
- stripped bracketed category tags from stored/generated visible task titles
- kept category available to the Tasks UI by deriving it from `linkedAutonomyRef.taskText`
- board/drawer summary still exposes category to the pill lane without reintroducing it into the title text

Key files:
- `scripts/daily-task-generator.py`
- `projects/mission-control/lib/autonomous.ts`
- `projects/mission-control/lib/adapters/tasks.ts`
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`

### 3. Generator now follows current goals instead of stale heuristic drift
Problem:
- the generator was reading the current `AUTONOMOUS.md` goals, but older keyword heuristics still warped some newer goals into stale-style tasks
- example failure mode: creative-tool automation goals could collapse into generic Blender/AE/Unreal practice tasks
- the result felt like it was still targeting old goals even when the goal file had changed

Fix:
- tightened `read_autonomous_file()` so it cleanly reads only the live `## Goals` section
- added higher-priority classifiers for current goal families, including:
  - creative-tool automation scripts
  - Actionable Alpha dashboard work
  - real-time trading API ingestion
  - SEC filings / quarterly reports / sensitivity pipeline
  - signal evidence verification
  - OpenClaw loop-pattern analysis
  - proactive operations guardrails
- switched goal selection away from random sampling toward deterministic category interleaving
- replaced weak fallback phrasing with more specific title/brief synthesis

Key file:
- `scripts/daily-task-generator.py`

### 4. Tasks-page brief presentation was made scan-friendly
Problem:
- even after improving brief quality, the cards still displayed too much text inline
- Philippe explicitly asked for a shorter default card view plus expand/collapse behavior

Fix:
- Tasks cards now show a compact brief preview by default
- preview uses the first sentence when available, otherwise the first semicolon clause for current generator-style briefs
- cards now offer `Show more` / `Show less`
- full brief remains available in the drawer
- brief normalization now capitalizes the leading character at both source and display layers

Key files:
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`
- `projects/mission-control/lib/autonomous.ts`
- `scripts/daily-task-generator.py`

## Fresh verified backlog outcome
After clearing the stale backlog and regenerating against the live `AUTONOMOUS.md` goals, the visible autonomous backlog became:
- `Draft: Creative-tool automation script plan`
- `Analyze: OpenClaw loop-pattern audit`
- `Draft: Actionable Alpha dashboard slice`
- `Draft: Proactive operations guardrails`
- `Research: Real-time trading API shortlist`

This is the current good baseline for autonomous backlog quality after the rollback-sensitive cleanup.

## Verification performed
- `python3 -m py_compile scripts/daily-task-generator.py`
- `npm run build` in `projects/mission-control`
- `bash scripts/preview-restart.sh`
- route/API checks:
  - `/general/tasks` -> 200
  - `/api/tasks/board` -> 200
- board API verified capitalized brief text

## Important durable truths from this pass
1. current workspace/runtime truth still beats git truth after rollback-sensitive recovery
2. autonomous category belongs in the pill/metadata lane, not the visible title
3. autonomous cards need a preview-length brief by default; full copy belongs behind expansion or inside the drawer
4. generation quality must be checked against the actual current goal file, not inferred from whether tasks merely exist

## Relevant commits
### Mission Control repo
- `d3907be1` — Normalize embedded autonomous task briefs
- `89fac11d` — Heal generated autonomous task titles and briefs
- `17b1072a` — Strip autonomous task category tags from titles
- `b8e5f766` — Stop truncating autonomous task copy
- `5064edaa` — Clamp task briefs to expandable preview

### Workspace repo
- `336f6ce` — Improve daily task generator title and brief output
- `4b43be6` — Regenerate backlog with cleaner task titles
- `337fcdd` — Regenerate backlog from current autonomous goals
- `a04e352` — Capitalize generated autonomous briefs

## Recommended next move
Do not broaden scope immediately.

Best next step:
- light visual sanity check on `/general/tasks`
- if stable, pause Mission Control Tasks work here and only reopen it for:
  - finer brief tone polish
  - task-generation semantic quality tuning
  - broader event-model/runtime work from the roadmap

## Resume order next time
1. read this savepoint
2. read `memory/2026-04-12.md`
3. verify the current backlog still matches the live goal file
4. only then decide whether to keep polishing Tasks or move back to the next roadmap lane
