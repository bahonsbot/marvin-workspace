# Mission Control Adaptation Runbook

Last updated: 2026-03-27
Owner: Marvin / Philippe
Status: active continuity + decision runbook
Scope: consolidates the Mission Control reset, Nerve repo findings, architecture decisions, product rules, and approved next direction from the Mar 27 adaptation session

---

## Purpose

This runbook exists so Mission Control does not lose the decisions made during the Mar 27 reset/research session.

It captures:
- the current Mission Control state after re-anchoring
- what was learned from the Nerve repo
- how that changes Mission Control direction
- what to borrow, reinterpret, or ignore
- what the next approved implementation target is

Use this file when resuming Mission Control work after context loss, model drift, or a long gap.

---

## 1. Resume fast path

If you are returning to Mission Control and need the fastest safe re-anchor, read in this order:
1. `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md`
2. this runbook
3. `projects/_ops/mission-control-phase1-core-operating-surface-build-brief-2026-03-27.md`
4. `docs/runbooks/mission-control-runtime-preview-runbook.md`
5. `docs/runbooks/mission-control-agents-page-design-handoff.md`

If there is a conflict between older assumptions and this runbook, prefer this runbook plus the latest Mar 27 savepoint/build brief.

---

## 2. Why this session happened

Philippe wanted to restart Mission Control work cleanly and asked for a focused read-through of:
- the Mission Control project folder
- Mission Control-related runbooks
- recent daily memory
- `_ops` Mission Control files
- the latest savepoint and design handoff, with the latest savepoint read last so it remained freshest

This was completed before new product decisions were made.

Important framing:
- the comprehensive savepoint from the night of Mar 27 is the primary continuity anchor
- Mission Control was already in a good general state visually
- the next question was not “what is Mission Control?” but “how should it evolve now?”

---

## 3. Current Mission Control baseline before adaptation changes

Before the new adaptation decisions:
- Home = shell/chrome truth
- Chat = good enough for now
- Tasks = good enough for now
- Crons = good enough for now
- Memory = good enough for now
- Files = good enough for now
- Agents = valuable, but a bit overloaded and likely needing editing/restraint rather than another rethink

General direction already established:
- FLOATING / Aura Concierge is the valid design lane
- Home shell truth overrides Stitch drift in other page exports
- truth over polish remains non-negotiable

---

## 4. Stitch and design-truth rules reaffirmed in this session

Philippe provided two live reminders that remain durable rules.

### 4.1 Shell truth comes from Home
Use the Home page MCP export and screenshot as shell truth for:
- left menu
- top bar
- bottom status bar baseline
- shell spacing rhythm

If later Stitch pages drift in shell/chrome, Home wins.

### 4.2 Page composition truth can come from page-specific Stitch
The Agents Stitch export is valid for:
- page composition
- section hierarchy
- card rhythm
- what the page is trying to emphasize

But not for:
- shell/nav drift
- changed menu bars
- inconsistent palette changes
- literal placeholder labels like `Systems & Agents`

### 4.3 Design system selection rule
If Stitch exports multiple systems, use only:
- **Aura Concierge / FLOATING**

Ignore all other systems.

---

## 5. Nerve repo investigation: what was actually learned

Philippe asked whether the repo `https://github.com/daggerhashimoto/openclaw-nerve` was visible and then requested a proper crawl after sharing the product patterns he found interesting.

The crawl confirmed that Nerve is not just a visual shell. It is a real product layer built in front of OpenClaw.

### 5.1 Core architecture
Nerve uses:
- a React/Vite frontend
- a Node/Hono backend
- a WebSocket proxy to the OpenClaw gateway
- custom REST endpoints for files, kanban, workspace, TTS/STT, session controls, and helper data

Meaning:
- Nerve is not embedding a stock OpenClaw UI
- Nerve is building its own client on top of OpenClaw runtime interfaces

### 5.2 Confirmed useful patterns
The repo clearly implements:
- collapsible Thinking bubbles
- grouped/collapsible Tools output
- compact system/completion strips
- inline diff rendering in chat
- inline chart rendering in chat
- browser-native file editing
- executable kanban task flow via `sessions_spawn`
- review/approve/reject task loop
- session-level model and effort controls
- context meter
- voice/STT/TTS plumbing

### 5.3 Important clarifications from the crawl
Some assumptions were directionally right but needed correction.

#### Charts
Charts are not primarily rendered through some magical RSC/MDX stack.
They are driven through parsed chart markers and React chart components.

#### Editor
The file editor is real, but it is CodeMirror-based, not Monaco/Cursor under the hood.

#### Agent workspaces
Top-level agent workspace separation is real, but not every child/subagent gets a fully separate isolated workspace by default.

---

## 6. The key architectural conclusion for Mission Control chat

A major unresolved question before this session was whether Mission Control should try to embed the current OpenClaw chat UI.

The Nerve investigation clarified the right answer.

### Decision
Mission Control should **not** try to embed the stock OpenClaw chat surface.

Instead it should:
- use OpenClaw as the runtime engine
- build its own Mission Control chat surface
- use Nerve as a reference implementation for architecture and interaction patterns
- preserve FLOATING styling and Mission Control product posture

### Why this is the right path
Because a custom chat surface lets Mission Control control:
- how messages render
- what collapses by default
- how tools and diffs appear
- how tasks connect into chat
- how artifacts appear inline
- how session controls fit the shell
- how the entire experience stays coherent with FLOATING

If Mission Control tried to “embed the existing chat,” it would inherit a surface it does not fully control.

---

## 7. Product direction after the Nerve research

### Core updated thesis
Mission Control should become:

**A calm orchestration shell with a real built-in workspace.**

That means:
- calm at rest
- deep on demand
- operationally real
- browser-native for both coordination and editing

This updated the earlier posture of “orchestration shell first, editor second.”

The revised understanding is:
- browser editing is not a side capability
- it is an important core secondary capability of the shell
- Philippe should not need to jump to Cursor for routine work if Mission Control can handle it cleanly

---

## 8. What to borrow, reinterpret, and ignore

## 8.1 Borrow directly
These are the strongest patterns to take from Nerve.

### Chat cleanliness
- collapsible Thinking blocks
- collapsible Tools blocks
- slim system/completion strips

### Chat artifacts
- inline diff rendering
- inline chart rendering later, where appropriate
- structured artifact rendering instead of ugly raw output

### Runtime/task patterns
- executable task runs
- run tracking
- review/approve/reject loop
- session metadata visibility

### Workspace patterns
- real browser-based file editing
- stronger workspace/session linkage

### Architecture pattern
- custom browser client over OpenClaw runtime interfaces

## 8.2 Reinterpret for Mission Control
These should be translated, not copied literally.

- overall density
- control presentation
- file editor placement and visual weight
- chart usage policy
- proposal/suggestion handling
- session metadata presentation

Mission Control must remain lighter, more editorial, and more selective than Nerve.

## 8.3 Ignore
Ignore these Nerve qualities for Mission Control.

- dark, dense visual language
- constant high-information posture
- theme-heavy product energy
- “show everything at once” behavior
- visual busyness as a default state

---

## 9. Specific product rules that came out of this session

## 9.1 Charts rule
Charts should appear in chat only when:
- the visual explains something more clearly than text alone
- or Philippe explicitly requests one

Charts are a precision tool, not an excuse to over-widgetize every message.

## 9.2 Task board rule
The kanban board should be **hybrid**.

### Primary lane
Operator-first:
- Philippe adds a task
- Mission Control executes it through a subagent
- the task moves through run → review → done

### Secondary lane
Light autonomous suggestions:
- the system may suggest a small number of useful tasks based on goals/context
- suggestions should be limited and high-signal
- suggestions should be clearly marked and not mixed invisibly with Philippe-created tasks

### Summary
The board should be:
- Philippe’s execution surface first
- a suggestion surface second

## 9.3 Workspace rule
Mission Control should include a real built-in workspace.

Implications:
- Files should support direct editing in browser
- Memory remains editable
- normal work should not require bouncing out to Cursor unnecessarily
- the workspace must feel integrated into the shell, not pasted in from another product

---

## 10. Approved phased roadmap

## Phase 1 — Core operating surface upgrade
This became the approved immediate next target.

Implement:
- collapsible Thinking in Chat
- collapsible Tools in Chat
- slim system/completion strips in Chat
- inline diff rendering in Chat
- direct browser file editing inside Files

Goal:
- make Mission Control materially more useful every day without reopening the whole product

## Phase 2 — Hybrid executable task board
Implement:
- operator-created tasks
- execute via subagent
- run status / elapsed time / linked session / result
- review state
- approve / reject
- light autonomous suggestions, clearly labeled and limited

## Phase 3 — Agents operational refinement
Once the runtime/task/workspace backbone is stronger, refine Agents again around real operating truth.

## Phase 4 — Advanced session controls and selective rich artifacts
Implement later:
- model/effort controls
- better session metadata
- selective richer artifact rendering

## Phase 5 — Trading-specific rich surfaces
Keep deferred until General is strong enough.

---

## 11. Immediate next action approved by Philippe

After the adaptation brief was finalized, Philippe approved moving directly to:

**Phase 1 — Core operating surface upgrade**

In practical terms:
1. add direct browser file editing cleanly into Files
2. add collapsible Thinking / Tools / system strips to Chat
3. add inline diff rendering to Chat
4. preview-build and verify the result

This is the current approved build target.

Reference build brief:
- `projects/_ops/mission-control-phase1-core-operating-surface-build-brief-2026-03-27.md`

---

## 12. Agent Team instruction for implementation

Philippe explicitly reminded Marvin to use the Agent Team properly for actual build work.

Implementation posture:
- Marvin = orchestrator
- Builder = implementation
- Reviewer = validation

Marvin’s responsibilities in this flow:
- define the exact scope
- keep the shell/design truth hierarchy intact
- make Builder work from the approved brief, not from loose vibes
- prevent overreach
- handle preview validation from the main session if sandbox/runtime limitations appear

---

## 13. Preview/build reminder

When implementation begins, use the established Mission Control preview path.
Do not improvise if the existing scripts/runbook already cover it.

Operational reminder from prior Mission Control lessons:
- preview validation may need to run from the main session
- preserve external preview compatibility
- do not casually change bind host behavior in a way that breaks public preview routing

Reference:
- `docs/runbooks/mission-control-runtime-preview-runbook.md`

---

## 14. Durable one-paragraph summary

On Mar 27, Mission Control was re-anchored from the latest savepoint and supporting docs, then materially redirected through a focused comparison against the Nerve repo. The key decision is that Mission Control should not try to embed the stock OpenClaw chat UI, but should instead evolve into a custom FLOATING shell over OpenClaw runtime interfaces, borrowing Nerve’s strongest interaction patterns while rejecting its dark, dense product posture. The approved next step is a bounded Phase 1 operating-surface upgrade: cleaner chat via collapsible Thinking/Tools/system strips, inline diffs, and real browser-native file editing inside Files.

---

## 15. Related references

- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md`
- `projects/_ops/mission-control-phase1-core-operating-surface-build-brief-2026-03-27.md`
- `projects/_ops/mission-control-agents-build-brief-2026-03-26.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`
- `docs/runbooks/mission-control-agents-page-design-handoff.md`
- `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
- `projects/mission-control/docs/FLOATING-DESIGN-SYSTEM.md`
- `projects/mission-control/docs/FLOATING-HANDOFF.md`
- `memory/2026-03-26.md`
- `memory/2026-03-27.md`
