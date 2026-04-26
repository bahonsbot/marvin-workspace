# Mission Control Autonomous Hybrid Board v1 — Implementation Spec

Date: 2026-03-30
Status: approved planning spec
Scope: `projects/mission-control` → Tasks page, Autonomous board only

## 1. Purpose

Define the first implementation of a Nerve-inspired execution workflow for the **Autonomous** board inside Mission Control, while preserving the existing lightweight/manual behavior of the **Personal** and **Projects** boards.

This spec exists to lock:
- product scope
- truth model
- execution/review workflow
- sync expectations with the current autonomy system
- v1 boundaries

It is intentionally short and implementation-facing.

---

## 2. Product Goal

Turn the Autonomous board from a passive suggestion board into a **hybrid executable work board** that supports:
- generated suggestions
- manual task creation
- direct execution
- live run tracking
- review
- approve / reject
- chat announcement on completion

The board should borrow Nerve’s proven workflow mechanics where useful, while adapting to Marvin/OpenClaw’s existing autonomy system.

---

## 3. Scope

## 3.1 In scope

Autonomous board only:
- five-stage board workflow
- manual add
- editable tasks
- priority + agent target selection
- direct execute action
- run status tracking
- review state
- approve / reject actions
- completion announcement in Mission Control Chat
- linked sync into existing autonomy files

## 3.2 Out of scope

Not in v1:
- execution workflow for Personal board
- execution workflow for Projects board
- future named-agent roster / persona-heavy routing
- automatic rerun after reject
- replacing the existing autonomy system entirely
- deep scheduler/queue intelligence beyond explicit v1 rules

---

## 4. Board Model

## 4.1 Boards

Mission Control Tasks remains a multi-board workspace:
- Autonomous
- Personal
- Projects

Only **Autonomous** gets the Nerve-style workflow upgrade in v1.

## 4.2 Autonomous columns

Autonomous uses the full five-stage model:
- Backlog
- To Do
- In Progress
- Review
- Done

Manual tasks default to **To Do**.

Generated tasks may land in Backlog or To Do depending on generator posture.

---

## 5. Core Product Decisions

## 5.1 Truth model

Use a **hybrid truth model**:
- Mission Control gets a structured Autonomous task model/store for workflow state
- tasks also write/sync into existing autonomy files immediately

This avoids two bad outcomes:
1. UI-only tasks that the autonomy system cannot see
2. forcing the entire UI to treat markdown/backlog files as the only live workflow model

## 5.2 Generated vs manual provenance

Each Autonomous task must carry explicit provenance:
- `generated`
- `manual`

Generated and manual tasks must coexist cleanly on the same board.

## 5.3 Board-limit posture

The previous overall Autonomous-board cap should be removed.

New rule:
- manual tasks are allowed
- automated suggestions remain **bounded**
- generator spam must still be prevented

Do not silently reintroduce a hard whole-board cap unless future behavior proves it necessary.

---

## 6. Task Data Model (v1)

Each Autonomous task should minimally support:

- `id`
- `title`
- `description?`
- `status`
- `priority`
- `sourceType` (`generated | manual`)
- `agentTarget`
- `createdAt`
- `updatedAt`
- `feedback[]`
- `run?`
- `linkedAutonomyRef?`
- `chatAnnouncementSent?`

### Suggested `agentTarget` enum for v1
- `marvin`
- `builder`
- `reviewer`
- `content-creator`

Notes:
- keep it operational, not identity-heavy
- `content-creator` is a placeholder lane for future Sloane-style work

### Feedback shape
Each feedback item should support:
- `at`
- `by`
- `note`

### Run shape
Each run should support:
- `sessionKey`
- `childSessionKey?`
- `runId?`
- `startedAt`
- `endedAt?`
- `status` (`running | done | error | aborted`)
- `summary?`
- `result?`
- `error?`

This should borrow heavily from Nerve’s run model.

---

## 7. Execution Workflow

## 7.1 Execute

When operator clicks **Execute**:
1. validate task is in `backlog` or `todo`
2. move task to `in-progress`
3. spawn worker directly (not via queue indirection)
4. attach run metadata to task
5. surface live run state in task detail

### v1 execution routing posture
Use direct manual spawn.

Do **not** require queue indirection for manually triggered task execution in v1.

## 7.2 Completion

On successful completion:
1. attach text summary/result to task
2. attach artifact/file references when available
3. move task to `review`
4. announce in Mission Control Chat:
   - `Autonomous task finished and moved to Review: [title]`

On failed completion:
1. mark run errored
2. move task back to `todo`
3. preserve error context

### Completion contract
Minimum contract:
- text summary/result

Preferred when available:
- text summary + linked artifacts/files

---

## 8. Review Workflow

## 8.1 Approve

When operator clicks **Approve**:
- move task `review` → `done`
- mark linked existing-autonomy task complete if linked
- preserve run/result history

Approval is the meaningful completion moment, not merely worker completion.

## 8.2 Reject

When operator clicks **Reject**:
- move task `review` → `todo`
- append rejection feedback note
- do **not** auto-rerun
- require explicit re-execute

Reject should clear or close previous run state enough to allow a clean new execution cycle.

---

## 9. Existing Autonomy Sync Rules

## 9.1 Manual tasks

When a manual Autonomous task is created:
1. create it in the structured Autonomous board model
2. also write it into the existing autonomy system immediately

Reason:
If operator does not execute it immediately, it should still be eligible for later autonomous execution by the current system.

## 9.2 Generated tasks

Generated tasks shown in Mission Control should preserve provenance and link back to the current autonomy source.

## 9.3 Approval sync

If a task is linked to the existing autonomy layer, **Approve** should also mark that linked autonomy task complete.

This keeps Review meaningful and prevents a split-brain completion model.

---

## 10. UI Requirements

## 10.1 Autonomous board

The Autonomous board should support:
- five visible columns
- mixed manual/generated tasks
- clear provenance
- state-aware actions

## 10.2 Task detail drawer

Borrow Nerve’s semantics closely.

The drawer should support:
- editable title
- editable description
- editable priority
- editable agent target
- run status block
- elapsed time
- session/run identifiers
- result block
- feedback history
- Execute / Abort / Approve / Reject controls depending on task state

## 10.3 Personal and Projects

Do not upgrade these boards into executable workflow boards in v1.
Keep them lightweight/manual.

---

## 11. Generator / Suggestion Rules

Because the old global board cap is removed, suggestion control must stay explicit.

### Rules
- automated suggestions remain limited
- duplicate suggestions should be prevented
- generator should not flood the board
- generated task intake should stay bounded independently of manual adds

Implementation can reuse or adapt current generator safeguards, but v1 must not regress into uncontrolled task accumulation.

---

## 12. Recommended Implementation Phases

## Phase 0 — truth audit
Before coding implementation behavior:
- identify current Autonomous board truth source(s)
- identify existing cap logic
- identify generator write path
- identify executor/completion path assumptions
- document where manual-task sync should write

Deliverable:
- one short architecture/truth note

## Phase 1 — structured Autonomous model
Implement:
- task schema
- run schema
- feedback schema
- provenance model
- linked autonomy reference
- agent target enum

## Phase 2 — UI conversion
Implement on Autonomous only:
- five columns
- manual add
- task drawer
- editable fields
- state-aware action buttons

## Phase 3 — execution path
Implement:
- direct Execute flow
- run attachment
- in-progress state
- completion capture
- review transition
- failure return to To Do

## Phase 4 — review + chat integration
Implement:
- Approve
- Reject
- chat completion announcement
- linked-autonomy completion on Approve

## Phase 5 — sync hardening
Implement/verify:
- bounded generated suggestions
- no duplicate task creation across UI + autonomy layer
- stable linkage between board task and existing autonomy task

---

## 13. Definition of Done (v1)

Autonomous Hybrid Board v1 is done when operator can:
- manually add an Autonomous task
- set priority and agent target
- see it on the Autonomous board
- execute it directly
- inspect its live run state
- receive a chat completion announcement
- see it move to Review
- approve or reject it
- and have linked autonomy state remain coherent

---

## 14. Immediate Next Step

Next implementation step is **not** broad coding yet.

Next step:
- perform the short Phase 0 truth audit
- confirm current generator/cap/executor linkage points
- then start implementation from the structured Autonomous model outward

This keeps the Nerve-inspired workflow grounded in Marvin/OpenClaw reality instead of building a second autonomous system by accident.
