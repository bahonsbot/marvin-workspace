# Mission Control — Phase 1 Core Operating Surface Build Brief

Date: 2026-03-27
Status: approved build brief
Owner: Marvin
Execution mode: Agent Team implementation with Marvin orchestration, Builder implementation, Reviewer validation

---

## 1. Why this file exists

This brief converts today’s Mission Control restart, repo research, and product decisions into a build-safe implementation target.

It is the approved next move after the Mar 27 read-through and direction reset.

Primary anchors:
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md`
- `docs/runbooks/mission-control-agents-page-design-handoff.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`
- `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
- `docs/runbooks/mission-control-adaptation-runbook-2026-03-27.md`
- `projects/mission-control/docs/FLOATING-DESIGN-SYSTEM.md`
- `projects/mission-control/docs/FLOATING-HANDOFF.md`

If older Mission Control assumptions conflict with this brief, prefer this brief for the next implementation slice.

---

## 2. Core decision

Mission Control is now being built as:

**A calm orchestration shell with a real built-in workspace.**

That means:
- calm at rest
- deep on demand
- operationally real
- browser-native for both coordination and hands-on editing

This is not a Nerve clone.
This is Mission Control using Nerve as a technical interaction reference while keeping FLOATING as product and visual truth.

---

## 3. Architectural direction

### Chat direction
Do **not** try to embed the native OpenClaw chat UI.

Instead:
- use OpenClaw as the runtime engine
- build a custom Mission Control chat surface
- use the Nerve repo as a reference implementation for architecture and interaction patterns
- keep Mission Control’s own FLOATING layout, restraint, and visual hierarchy

### What Nerve is for
Use Nerve as reference for:
- custom browser chat over OpenClaw runtime interfaces
- WebSocket/event-driven rendering patterns
- collapsible Thinking/Tools blocks
- inline diff/chart artifact rendering
- executable kanban/task flow concepts
- browser workspace editing patterns

Do **not** use Nerve as reference for:
- dark styling
- high-density screen composition
- aggressive “show everything” behavior
- visually noisy cockpit posture

---

## 4. What Phase 1 is trying to achieve

Phase 1 should make Mission Control materially more useful day-to-day without reopening the whole product.

The goal is to upgrade the current shell into a stronger operating surface by improving:
1. chat cleanliness
2. inline artifact readability
3. browser-native workspace editing

This is the approved immediate target before executable Tasks and deeper Agents refinement.

---

## 5. Phase 1 approved scope

## 5.1 Chat cleanliness layer
Implement:
- collapsible **Thinking** blocks
- collapsible **Tools** blocks
- compact/slim system or completion strips
- clear visual dominance for final assistant replies

Rules:
- machinery should be hidden by default
- expanded state should remain available for debugging and inspection
- final answer should stay primary and easiest to scan
- no visual clutter explosion from tool-heavy runs

## 5.2 Inline chat artifacts
Implement:
- inline diff rendering for file/code changes inside chat

Strongly preferred behavior:
- before/after presentation
- clear but calm FLOATING styling
- artifact feels like part of the page family, not a bolted-on dev widget

Optional if it stays bounded:
- lightweight file/result preview cards

Do not yet turn Phase 1 into a full chart/artifact system.

## 5.3 Built-in workspace editing
Implement:
- direct browser-based file editing inside Files
- preserve current Files and Memory behavior
- integrate editing as a native part of the Mission Control workspace

Intent:
- routine work should not require jumping to Cursor
- the shell should support actual browser-native editing
- the result should feel integrated, not like a separate IDE pasted into the product

Guardrails:
- editing must remain usable and clean
- do not let Files visually dominate the whole product
- keep FLOATING restraint even while adding real editing power

---

## 6. Explicit non-goals for Phase 1

Do **not** include these in the first implementation pass unless Philippe explicitly expands scope:
- full chart system in chat
- chart rendering for every possible opportunity
- executable task board flow
- autonomous task suggestion system
- major Agents redesign or functionality rewrite
- Trading-specific product work
- full session model/effort controls
- broad backend architecture rewrite beyond what is needed for the bounded Phase 1 slice

---

## 7. Product rules to honor during implementation

### 7.1 Charts rule
Charts in chat are allowed only when:
- the visual explains something more clearly than text alone
- or Philippe explicitly requests one

Charts are a precision tool, not default decoration.

### 7.2 Shell truth rule
When Stitch drifts, use the Home page MCP export as shell truth for:
- left menu
- top bar
- bottom status bar baseline
- shell spacing rhythm

### 7.3 Design system rule
If Stitch exports multiple systems, use only:
- **Aura Concierge / FLOATING**

Ignore all others.

### 7.4 Restraint rule
Mission Control should stay lighter and calmer than Nerve.

That means:
- fewer visible controls at once
- more whitespace
- stronger hierarchy
- less “operator cockpit” clutter
- operational depth available on demand, not always shouting on-screen

---

## 8. Suggested implementation shape

### 8.1 Chat
Builder should study the current Mission Control chat implementation and compare it against the Nerve interaction pattern, then implement a Mission Control-specific version of:
- grouped/collapsible Thinking blocks
- grouped/collapsible Tools blocks
- compact completion/system strips
- inline diff rendering

Do not reproduce Nerve’s dark visuals or density.

### 8.2 Files
Builder should extend the Files page into a real browser-editable workspace.

The editing experience should:
- feel native to Mission Control
- preserve scannability
- not visually overwhelm the page
- support normal editing workflows cleanly

### 8.3 Shared shell fit
All new behavior must fit the existing FLOATING page family.

The implementation should feel like a natural evolution of current General pages, not like a sudden new mini-product dropped into the shell.

---

## 9. Agent Team execution plan

### Marvin
Responsibilities:
- define scope boundaries
- keep shell/design truth intact
- prevent overreach
- review implementation against product intent
- run preview validation from the main session when needed

### Builder
Responsibilities:
- implement the bounded Phase 1 slice
- prefer real working behavior over mock structure
- keep edits scoped to chat/artifact/workspace needs
- avoid unapproved redesign spillover into unrelated pages

### Reviewer
Responsibilities:
- validate that the result is calmer than Nerve while gaining useful capability
- check hierarchy, restraint, and FLOATING consistency
- look specifically for over-widgetization, density creep, and shell mismatch

---

## 10. Preview and verification requirement

Every meaningful implementation pass must end with:
- build verification
- Mission Control preview run
- preview review against the approved design rules

Use the established Mission Control preview scripts/runbook path.

Important operational reminder:
- Builder sandbox may not be reliable for final preview/runtime verification
- final preview verification may need to happen from the main Marvin session
- preserve external preview compatibility and do not casually change bind host behavior

Reference:
- `docs/runbooks/mission-control-runtime-preview-runbook.md`

---

## 11. Acceptance criteria

Phase 1 is successful if all of the following are true:

### Chat
- tool-heavy runs are materially cleaner to read
- final answers remain visually primary
- Thinking and Tools can be expanded when needed
- system/completion notices no longer spam the main chat flow

### Artifacts
- code/file changes are inspectable through inline diffs
- diff styling feels Mission Control-native

### Files / Workspace
- Philippe can edit files directly from the browser within Mission Control
- normal editing does not require leaving to Cursor for routine work
- the Files page still feels integrated and calm

### Overall product fit
- FLOATING identity is preserved
- Mission Control still feels lighter and calmer than Nerve
- no fake state or decorative pseudo-functionality is introduced

---

## 12. One-paragraph handoff summary

The next approved Mission Control build target is a bounded Phase 1 operating-surface upgrade: implement collapsible Thinking/Tools/system strips in Chat, add inline diff rendering for code/file changes, and add real browser-native file editing inside Files. Use Nerve as a technical reference for interaction architecture, not as a visual template. Keep Home-shell truth, FLOATING design truth, and Mission Control’s calmer editorial product posture intact while making the product substantially more useful for daily work.
