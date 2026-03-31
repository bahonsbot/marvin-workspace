# Mission Control — Comprehensive Savepoint
## 2026-03-31 Night

---

## 1. Executive Summary

Today was a major **validation + stabilization** session for Mission Control. The headline achievements:

- **Autonomous Tasks board** is now a real, functional five-lane workflow with proper execute/review/approve/reject mechanics
- **Execute is proven real**: three test tasks ran end-to-end, produced artefacts, and moved correctly through the workflow
- **Dual-source reconciliation bugs** (duplicate tasks, clone-on-edit, description-not-persisting, lane-state-drift) are diagnosed and fixed at the source
- **Review/result presentation** is cleaned up from raw JSON dumps to readable summaries + artefact links
- **Chat transcript overflow** regression introduced mid-session is diagnosed and fixed
- The General Domain architecture is confirmed: Chat, Tasks, Files, Home, and Crons pages are live and functional; Agents is in Phase 2

The Mission Control **General Domain is now good enough to use as Philippe's daily cockpit** for talking to Marvin. The remaining work is refinement, not fundamental stability.

---

## 2. What We Worked On Today

### Morning / Mid-day
- Restarted the Mission Control preview after a `502 Bad Gateway` (ws sidecar/proxy confusion)
- Patched the runtime bridge `useRuntimeBridge.ts` to add **bounded auto-reconnect** after unexpected websocket drops — the bridge now schedules exponential-backoff reconnect attempts instead of leaving the page in a dead state
- Reviewed the Nerve repo for reference architecture before the Tasks board work

### Afternoon / Evening
- Promoted the Autonomous board from the **temporary 3-column compatibility view to the real five-lane workflow** (Backlog / To Do / In Progress / Review / Done)
- Ran a **combined cleanup patch** with Philippe covering:
  - Autonomous-first board switcher ordering
  - Removed bulky top summary / "structured store is live" helper text
  - Icon-based action controls (↻ refresh, + new task)
  - Card title/content cleanup
  - Sync Integrity demoted to compact status pill with hover detail
  - Drawer redesign (better hierarchy, removed duplicate Close, added Remove)
  - Lane-tinted card backgrounds
  - 5-lane horizontal CSS grid layout
  - Real `DELETE /api/tasks/autonomous/[taskId]` backend route
- Ran a **second combined cleanup patch**:
  - Fixed **fake sync drift warning** (stopped comparing append-only `tasks-log.md` history against current Done-lane state)
  - Fixed **duplicate autonomous task bug** at the source: importer now reconciles by normalized task text instead of section-only, and deduplicates by keeping the newest entry
  - **Execute now moves linked `AUTONOMOUS.md` entry** into In Progress so board and legacy source stay aligned
  - Fixed **Remove no-op** by also removing duplicate siblings in the structured store
  - Forced Tasks board/sync/page routes **truly dynamic** (was still serving stale build snapshots)
  - Added **Created timestamp** to autonomous metadata
  - Made **autonomous inspector a floating centered modal** (then reverted to a wider/taller side panel after Philippe said it was too big)
  - Added **autonomous Edit** with a proper edit modal and `PATCH /api/tasks/autonomous/[taskId]` backend route
  - Cleaned the **generator phrasing** at the source: removed emoji prefixes from `daily-task-generator.py` task types
  - Added **lane-tinted card backgrounds** tied to the column's lane colour
- Ran a **third combined cleanup patch**:
  - Fixed the **edit clone bug**: PATCH now uses the pre-edit legacy link when rewriting `AUTONOMOUS.md`, preventing old+new fork
  - Restored the **inspector side panel** to a better proportion
  - Fixed **modal stacking above the inspector** (z-index + conditional hide)
  - Fixed **inspector height anchored to viewport** instead of collapsing with the board
  - Fixed **inspector bottom clearing the status strip** (adjusted height calc)
  - Made **inspector content-sized with viewport cap** (fixed dead bottom slab)
  - Fixed **description-not-persisting after navigation** by making the actual route file `app/general/tasks/page.tsx` dynamic (the `GeneralTasksPage.tsx` re-export was masking the flags)
  - Removed **duplicate backlog line** in `AUTONOMOUS.md` that was causing fake sync drift
- Ran **Execute validation tests**:
  - Confirmed Execute fires correctly
  - Confirmed task moves to In Progress
  - Confirmed runner spawns a real OpenClaw job
  - Confirmed task moves to Review after completion (after the runner patch)
  - Confirmed artefact is created on disk
  - Confirmed **description/edit not persisting** was a stale route snapshot issue (fixed)
- Ran a **presentation cleanup patch**:
  - Cleaner **Run Status block** with result summary + clickable artefact link
  - Added `resultSummary` and `artifactPath` to task metadata
  - Improved **proof rendering** with preview truncation and "Show full output" disclosure
  - Added worthwhile follow-ups to the Autonomous backlog
- Fixed **chat transcript overflow regression**: chat bubble width was not constrained, causing one long unbroken message to push the entire page sideways

---

## 3. What Changed — Commit Log

### Evening (2026-03-31)
| Commit | Description |
|--------|-------------|
| `20144ec` | fix(tasks): repair autonomous edit flow and inspector layering |
| `b5abfc2` | fix(tasks): prevent title-edit clones and lift inspector higher |
| `8e64215` | fix(tasks): remove duplicate autonomous backlog entry |
| `f52e528` | fix(tasks): make general tasks route truly dynamic |
| `8ba9475c` | style(tasks): make inspector content-sized with viewport cap |
| `3739f68b` | style(tasks): lift inspector and trim bottom slack |
| `693c43e5` | style(tasks): tighten autonomous inspector footer spacing |
| `ad2c653` | fix(tasks): keep inspector open during edit and anchor height to viewport |
| `de79f76` | refactor(tasks): promote autonomous inspector to floating modal |
| `053c8c9` | refactor(tasks): restore side inspector and add autonomous edit |
| `286415b` | refactor(tasks): tighten five-lane board and sync signal |
| `5ca8e2f` | feat(mission-control): promote autonomous tasks to five-lane board |
| `fc01e63` | fix(tasks): serve live board data instead of static snapshot |
| `9c420e4` | fix(tasks): reconcile autonomous duplicates and enrich task metadata |
| `9777edd` | docs: note mission control future sandbox lane plan |
| `814ac8b` | refactor(tasks): tighten autonomous board and drawer UX |
| `225748b` | fix(tasks): keep inspector clear of bottom status strip |
| `6f7e0a1` | fix(tasks): move completed autonomous runs into review lane |
| `8418d42` | feat(tasks): render reviewed run results with summary and artefact link |
| `1c70048` | feat(tasks): improve review result presentation |
| `41cf0309` | fix(chat): prevent transcript bubbles from causing horizontal overflow |
| `a66d74a` | fix(mission-control): auto-reconnect runtime bridge websocket |
| `053c8c9` | refactor(tasks): restore side inspector and add autonomous edit |
| `6f7e0a1` | fix(tasks): move completed autonomous runs into review lane |

### Key prior commits (from 2026-03-30/-31 lunch)
- `596ad35` — Chat file linkifier (initial)
- `1d4c3d2` — Runtime bridge session continuity fix
- `d417389` — Runtime bridge effect dependency fix
- `1c70048` — Tasks review result presentation

---

## 4. What We Proved / Validated

### Execute is real
Three test tasks ran end-to-end:
1. **Create Tasks polish checklist note** — ran, created artefact, moved to Review, approved → Done
2. **Create tasks-page current-state doc** — ran, created artefact (`docs/tasks-page-current-state.md`), moved to Review correctly
3. **Create execute smoke-test JSON artifact** — ran and completed (artefact confirmed on disk)

The full pipeline works:
- button → API → structured store update → legacy `AUTONOMOUS.md` sync → runner script → OpenClaw agent → artefact → Review lane → Approve → Done

### Dual-source reconciliation is the main architectural fragility
The entire class of bugs today (duplicates, cloning, drift, stale state) all traced back to the split between:
1. `data/autonomous-tasks.json` (structured store)
2. `AUTONOMOUS.md` (legacy markdown bridge)

Until one source becomes clearly dominant, this split will keep producing reconciliation edge cases. The current best practice: **treat the structured JSON as the authoritative source; treat `AUTONOMOUS.md` as a compatibility/audit layer that must be kept in sync**.

### Review presentation needs work
The drawer now shows a result summary and artefact link, but long proof/output content still needs better collapse/expand handling. This is the next presentation target.

---

## 5. Current State of Each Page / Feature

### Chat (`/general/chat`)
**Status: Good enough to use daily.**
- Shell: FLOATING design system, fixed workspace layout, chat workspace feel
- Transcript: hydrates from persisted OpenClaw session logs on reload, merges with live state, strips transport wrappers
- Runtime bridge: auto-reconnect with exponential backoff after unexpected WS drops
- Model/Effort controls: wired, with confirmation gates to prevent auto-refresh from overwriting pending state
- File linkifier: workspace-file-aware linking with strict matcher
- Copy button: works with clipboard API + legacy fallback
- **Known issue**: none actively open
- **Last regression fixed**: horizontal overflow from unconstrained chat bubble text (2026-03-31 night)

### Tasks (`/general/tasks`)
**Status: Functional and improving. Major structural bugs resolved. Polish remains.**
- Autonomous board: real five-lane workflow (Backlog / To Do / In Progress / Review / Done)
- Execute: proven real with artefacts on disk
- Review/approve/reject: wired end-to-end
- Edit: works for autonomous tasks, updates both structured store and `AUTONOMOUS.md`
- Remove: works, removes from both sources and deduplicates siblings
- Lane tinting: active, lane-colour-tinted card backgrounds
- Inspector: content-sized floating panel, clear of status strip
- Sync drift: real drift detection (not comparing historical log against current Done)
- **Still transitional**: Personal/Projects boards are demo-quality, not fully operator-grade
- **Still needs work**:
  - Live task transitions (polling while running)
  - Completion toast / sound
  - Better proof/output collapse for long results
  - Artefact click → Files page deep-link
  - Escape-to-close for modals/inspector
  - Personal/Projects real operator workflow
  - Dual-source truth eventual cleanup

### Files (`/general/files`)
**Status: Functional for browsing and basic operations.**
- No major open issues
- `selectedPath` state wired for deep-linking from Tasks artefacts
- Future: search integration, more file operations

### Home (`/general/home`)
**Status: Shell/chrome truth. Calm editorial FLOATING surface.**
- No major open issues
- Could receive another refinement pass later

### Agents (`/general/agents`)
**Status: Phase 2 — live trio hierarchy, avatar medallions, planned names.**
- Feels "valuable but a bit overloaded"
- Next pass should be editing/restraint/hierarchy-tightening, not fundamental rethink

### Crons (`/general/crons`)
**Status: Good enough after FLOATING harmonization.**
- Should not be reopened casually

### Memory / Files
**Status: Good enough after FLOATING harmonization pass.**

---

## 6. Known Limitations

From today's session, ranked by priority:

### High priority
1. **Dual-source truth is still the main architectural fragility**
   - Autonomous tasks are mirrored between structured JSON and legacy `AUTONOMOUS.md`
   - This split causes reconciliation edge cases (duplicates, cloning, drift)
   - Until one source becomes clearly dominant, this will keep producing bugs
   - **Best current practice**: treat structured JSON as authoritative; keep `AUTONOMOUS.md` in sync as a compatibility layer

2. **Personal / Projects boards are still demo/transitional**
   - Work but don't feel operator-grade
   - Not urgent but good context for future work

3. **Tasks page / execute result rendering still needs polish**
   - Long proof/output blocks need better collapse/expand
   - Artefact-first rendering not yet fully implemented
   - "Show full output" disclosure works but could be cleaner

### Medium priority
4. **No live task transitions yet**
   - Task does not flip to Review automatically on the page without refresh
   - Would need light polling while any task is `running`
   - Not urgent but would make the workflow feel much more alive

5. **Autonomous create/edit modal still has dual-source complexity**
   - Create modal does not fully round-trip through `AUTONOMOUS.md`
   - Edit modal is better but still carries some dual-source assumptions

6. **`/tasks` is still basically legacy/stub**
   - The real page is `/general/tasks`
   - Worth documenting so future agents don't try to improve the wrong route

### Low priority / Nice-to-have
7. **Escape-to-close not wired for modals/inspector**
8. **Optional completion sound cue** for finished autonomous runs
9. **Keyboard shortcuts** for power-user efficiency
10. **Drag-and-drop feedback polish** for manual boards
11. **Hover-state polish** across the board

---

## 7. Tomorrow's Priorities

### Immediate execute/verify tasks (already in Autonomous backlog)
1. **Add Mission Control Tasks completion toast / chat-style notice** for finished autonomous runs
2. **Add clickable artefact-first rendering** for reviewed autonomous task results

### Next meaningful slices
3. **Live task transitions with light polling**
   - poll board state every ~5s while any task is `running`
   - stop polling when nothing is running
4. **Better proof/output collapse** for long autonomous run results
5. **Triage the generated Tasks docs** into a smaller curated follow-up list
   - keep useful items as backlog tasks
   - discard obsolete ones

### Nice-to-have if momentum allows
6. **Escape-to-close** for inspector and modals
7. **Optional tiny completion sound**
8. Personal/Projects real operator workflow

---

## 8. Long-Term Objectives

### Two-lane Mission Control setup
Philippe wants a later split:
- `preview.motiondisplay.cloud` → stable built Mission Control (current)
- separate dev/sandbox lane → experimental work (later)

**When**: after General Domain is "finished enough"
**Plan**: `projects/_ops/mission-control-dev-sandbox-lane-plan-2026-03-31.md`
**Key rule**: built lane stays production-style and truthful; sandbox is for experimentation

### General Domain completion
- All major pages now live and functional
- Remaining work is refinement, not fundamental stability
- No timeline pressure — use as daily driver and let real usage surface the next priorities

### Mission Control Trading design
**Explicitly deferred** until General Domain is finished enough.

---

## 9. Key Learnings and Gotchas from Today

### Lesson 1: Never treat a component re-export as a route directive
`components/pages/GeneralTasksPage.tsx` had `export const dynamic = 'force-dynamic'` but `app/general/tasks/page.tsx` only re-exported the component without the route-level flags. The page was effectively static regardless. Route-level `dynamic` directives must live in the actual route file, not the component it exports.

### Lesson 2: Dual-source reconciliation needs a clear authority
When a task exists in both `data/autonomous-tasks.json` AND `AUTONOMOUS.md`, edits and state transitions must update BOTH sources AND use the pre-edit state as the removal key. Using the already-mutated state as the removal key causes the old entry to survive and get re-imported as a duplicate.

### Lesson 3: Force-dynamic at the route level, not just the component
`export const revalidate = 0` in a client component file does not make a Next.js route dynamic. It must be in the route file (`app/.../page.tsx`). This caused persistent stale state issues that looked like bugs in the data layer but were actually caching issues.

### Lesson 4: The inspector should be content-sized, not viewport-height-slaved
Early iterations tried to force the inspector to match the viewport height with fixed `height: calc(100vh - Npx)`. This caused it to either collapse with the board or drag a dead white slab behind the status strip. The correct pattern is `maxHeight`-capped content sizing.

### Lesson 5: Long unbroken text in chat bubbles causes horizontal overflow
When `MissionControlChatSurface` renders message content without `overflowWrap: anywhere`, `wordBreak: break-word`, and a constrained parent, one long unbroken string (a UUID, path, or code fragment) expands the bubble and the entire page horizontally. Apply these constraints directly to the bubble div, not just the parent container.

### Lesson 6: The generator phrasing cleanup works at the source
Removing emoji prefixes and verbose formatting from `daily-task-generator.py` task types means newly generated tasks start with cleaner titles. Old tasks already in the store are unaffected; this only helps future generation.

### Lesson 7: `AUTONOMOUS.md` and `tasks-log.md` are different things
`tasks-log.md` is an append-only historical completion log. It is NOT a current-state lane. Any comparison of `tasks-log.md` entry counts against the current Done-lane count is a category error and will produce false drift warnings.

### Lesson 8: Execute runner is a standalone script, not a library
`run-autonomous-task.mjs` runs independently of the Next.js app. It must carry its own helpers for markdown manipulation. Adding `rewriteLinkedLegacyTaskText` to this script was the correct call rather than trying to import from the Next.js app's library modules.

---

## 10. Workspace State

### Active projects
- `projects/mission-control/` — Mission Control Next.js app (main workspace)
- `projects/autonomous-trading-bot/` — Equity bot (paper trading, webhook receiver)
- `projects/futures-bot/` — Futures bot (phase 1 complete, implementation progressing)
- `projects/market-intel/` — Market Intel (RSS/Reddit ingestion, signal generation)

### Mission Control structure
```
mission-control/
├── app/
│   ├── general/chat/          # Chat page
│   ├── general/tasks/         # Tasks page
│   ├── general/files/          # Files page
│   ├── general/home/          # Home page
│   ├── general/agents/        # Agents page
│   ├── api/runtime-bridge/     # WS bridge route
│   └── api/tasks/             # Tasks API routes
├── components/
│   ├── chat/                  # Chat components
│   ├── pages/                 # Page-level components
│   └── shared/                # Shared components
├── hooks/useRuntimeBridge.ts   # Runtime bridge hook
├── lib/
│   ├── adapters/tasks.ts      # Tasks board adapter
│   ├── autonomous.ts          # Autonomous store + legacy bridge
│   └── types/contracts.ts      # Shared types
├── data/autonomous-tasks.json # Structured autonomous task store
└── scripts/
    ├── run-autonomous-task.mjs # Execute runner
    ├── preview-start.sh       # Preview launcher
    └── preview-origin-proxy.js # WS proxy
```

### Key files outside mission-control/
- `/data/.openclaw/workspace/AUTONOMOUS.md` — Legacy markdown task source (dual-source partner)
- `/data/.openclaw/workspace/memory/2026-03-31.md` — Today's daily memory
- `/data/.openclaw/workspace/.learnings/` — Corrections, errors, requests
- `/data/.openclaw/workspace/projects/_ops/mission-control-dev-sandbox-lane-plan-2026-03-31.md` — Future sandbox plan

---

## 11. Next Agent Handoff Notes

### If you are continuing Mission Control work tomorrow:

**Start here**: read this savepoint, then `memory/2026-03-31.md`, then `TOOLS.md`.

**The most important thing to know**: the Autonomous Tasks board is real now. Execute works. The remaining bugs are presentation and workflow polish, not fundamental architecture.

**Do not**:
- Don't try to "fix" the dual-source split by removing `AUTONOMOUS.md`. It is a compatibility layer that several other systems depend on.
- Don't make the Tasks page static again by removing the `dynamic` / `revalidate = 0` flags from the route file.
- Don't change the preview server bind from `0.0.0.0` — it breaks external access.
- Don't route preview operations through Codex exec — run them from the main session.

**Do**:
- Check `memory/2026-03-31.md` for today's exact decisions before proposing changes.
- Verify any change that affects task state against both `data/autonomous-tasks.json` AND `AUTONOMOUS.md`.
- If something on the Tasks board looks wrong, check the live board API first: `curl http://127.0.0.1:3005/api/tasks/board | jq`.
- If the preview is down, use `./scripts/preview-restart.sh` from inside `projects/mission-control/`.

**The two most impactful improvements to make next**:
1. Live task transitions with light polling (makes the workflow feel alive)
2. Completion toast / sound (makes execution feel real)

---

## 12. Reference: Today's Decisions and Rationale

| Decision | Rationale |
|----------|-----------|
| Five-lane board over three-lane | Matches the real workflow state that already existed in the backend; folding review into in-progress was a temporary compromise |
| Autonomous first in board switcher | Philippe uses Autonomous most; it should be the default, not buried |
| Keep built preview as canonical, not dev server | Mission Control depends on auth, proxying, WS handshake — dev mode hides these; a separate sandbox lane is the right future path |
| Edit rewrites `AUTONOMOUS.md` using pre-edit link | Using the already-mutated state as removal key causes old entry to survive and clone |
| `tasks-log.md` is not compared against Done count | It is an append-only history log, not a current-state lane; comparing them produces false drift |
| Inspector is content-sized, not fixed viewport | Fixed viewport-height caused dead bottom slab or board-collapse coupling |
| Force-dynamic at route level, not component | Component-level `export const dynamic` does not make a Next.js route dynamic |
| Completion presentation improvements before sound/toast | Proved Execute is mechanically sound; next win is making review readable |
