# MC Autonomous Task Schema — 2026-03-30

Status: approved planning contract
Scope: Autonomous board v1 only
Purpose: define the structured task model, run model, and legacy-link shape for Mission Control Autonomous work

## 1. Design posture

This schema is the first structured workflow contract for the Mission Control **Autonomous** board.

It is intentionally shaped by two sources:
- Nerve’s proven kanban/run model
- Marvin/OpenClaw’s existing autonomy truth (`AUTONOMOUS.md`, queue state, tasks log)

It should be treated as the data contract for Autonomous Hybrid Board v1.

---

## 2. Core principles

1. **Autonomous only**
   - This schema does not apply to Personal or Projects in v1.

2. **Structured UI truth + linked legacy truth**
   - Mission Control gets a structured task model for workflow behavior.
   - Each task may also link to the current autonomy system.

3. **Approval is the meaningful completion moment**
   - worker completion moves task to Review
   - approval moves task to Done
   - linked legacy/autonomy completion happens on Approve

4. **Provenance must be explicit**
   - generated and manual tasks must coexist safely

---

## 3. Enums

### Task status
```ts
export type MCAutoTaskStatus =
  | 'backlog'
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'done';
```

### Priority
```ts
export type MCAutoTaskPriority = 'critical' | 'high' | 'normal' | 'low';
```

### Source type
```ts
export type MCAutoTaskSourceType = 'generated' | 'manual';
```

### Agent target
```ts
export type MCAutoTaskAgentTarget =
  | 'marvin'
  | 'builder'
  | 'reviewer'
  | 'content-creator';
```

### Run status
```ts
export type MCAutoRunStatus = 'running' | 'done' | 'error' | 'aborted';
```

### Feedback author
```ts
export type MCAutoFeedbackAuthor = 'operator' | `agent:${string}`;
```

---

## 4. Main task shape

```ts
export interface MCAutoTask {
  id: string;
  title: string;
  description?: string;

  status: MCAutoTaskStatus;
  priority: MCAutoTaskPriority;
  sourceType: MCAutoTaskSourceType;
  agentTarget: MCAutoTaskAgentTarget;

  createdAt: number;
  updatedAt: number;
  version: number;
  columnOrder: number;

  editable: boolean;
  chatAnnouncementSent: boolean;

  run?: MCAutoRun;
  feedback: MCAutoFeedback[];
  artifacts: MCAutoArtifact[];

  linkedAutonomyRef?: MCAutoLegacyLink;
  sourceMeta?: MCAutoSourceMeta;
}
```

---

## 5. Field semantics

### `id`
- stable unique task ID
- should be human-safe and UI-safe
- slug-style IDs are fine if collision-safe

### `title`
- required
- primary card label

### `description?`
- optional
- editable in drawer

### `status`
- one of the five Autonomous workflow stages

### `priority`
- chosen by operator or generator

### `sourceType`
- `manual` = created by Philippe/operator in Mission Control
- `generated` = imported/created from autonomous suggestion flow

### `agentTarget`
- selected in the task drawer or creation flow
- v1 options:
  - `marvin`
  - `builder`
  - `reviewer`
  - `content-creator`

### `editable`
- `true` in v1 for both manual and generated tasks
- generated tasks should still be editable before execution

### `chatAnnouncementSent`
- prevents duplicate completion announcements when task has already moved to Review and chat was updated

### `artifacts`
- structured references to result files/outputs when available
- empty array allowed

### `linkedAutonomyRef?`
- explicit link back into current autonomy truth
- this is the key anti-split-brain field

### `sourceMeta?`
- captures import/generator metadata without overloading the main task shape

---

## 6. Run shape

```ts
export interface MCAutoRun {
  sessionKey: string;
  childSessionKey?: string;
  sessionId?: string;
  runId?: string;

  startedAt: number;
  endedAt?: number;
  status: MCAutoRunStatus;

  summary?: string;
  result?: string;
  error?: string;
}
```

## Run semantics

### `sessionKey`
- primary run/session handle used by Mission Control

### `childSessionKey?`
- optional delegated-worker session when orchestration and worker differ

### `sessionId?` / `runId?`
- optional runtime-native identifiers for diagnostics and future drill-down

### `summary?`
- concise operator-facing summary of what the run produced

### `result?`
- richer text result if available
- minimum completion contract is text

### `error?`
- set on failure or reconciliation path

---

## 7. Feedback shape

```ts
export interface MCAutoFeedback {
  at: number;
  by: MCAutoFeedbackAuthor;
  note: string;
}
```

## Feedback semantics

Used for:
- rejection notes
- operator review comments
- future agent notes if needed

Reject should append feedback and move task back to `todo`.

---

## 8. Artifact shape

```ts
export interface MCAutoArtifact {
  path: string;
  label?: string;
  kind?: 'file' | 'dir' | 'url' | 'log';
}
```

## Artifact semantics

- optional but preferred when real files are created
- should store workspace-relative paths where possible
- used in task drawer review context

---

## 9. Legacy-link shape

```ts
export interface MCAutoLegacyLink {
  kind: 'autonomous-md';

  sourceFile: string;
  section: 'open-backlog' | 'in-progress' | 'needs-input' | 'done' | 'done-today';

  taskText: string;
  taskTextNormalized: string;

  queueLinked?: boolean;
  queueLabel?: string;

  completedInTasksLog?: boolean;
  completedOutputPath?: string;
}
```

## Legacy-link semantics

This is the explicit bridge to the current autonomy system.

### Required minimum
At minimum, linked tasks should carry:
- `sourceFile`
- `section`
- `taskText`
- `taskTextNormalized`

### Purpose
This enables:
- import from `AUTONOMOUS.md`
- write-through for manual tasks
- approval-time completion sync
- deduplication against existing backlog entries

### Why text-based linkage is acceptable in v1
Because the legacy autonomy system is still markdown-driven.
There is no stable structured ID there yet.

That means v1 linkage can reasonably be based on normalized task text plus section/source context.

---

## 10. Source metadata shape

```ts
export interface MCAutoSourceMeta {
  generator?: {
    createdBy: 'daily-task-generator';
    createdAt?: number;
    suggestionBatchId?: string;
  };

  manual?: {
    createdBy: 'operator';
    sourceSessionKey?: string;
  };
}
```

## Source metadata semantics

This is optional, but useful for:
- debugging provenance
- future generator deduplication
- import/export clarity

---

## 11. Transition rules

### Allowed transitions in v1
- `backlog` → `todo`
- `backlog` → `in-progress` (Execute)
- `todo` → `in-progress` (Execute)
- `in-progress` → `review` (successful completion)
- `in-progress` → `todo` (failure/abort)
- `review` → `done` (Approve)
- `review` → `todo` (Reject)

### Notable rule
Run completion alone does **not** move task to Done.
It moves task to Review.

---

## 12. Minimal persistence envelope

```ts
export interface MCAutoTaskStore {
  tasks: MCAutoTask[];
  meta: {
    schemaVersion: 1;
    updatedAt: number;
  };
}
```

## Notes
- keep v1 store small
- no premature giant config layer
- board-specific config can come later if needed

---

## 13. Import and sync expectations

### Generated task import
When importing generated tasks from the current autonomy system:
- create/update `MCAutoTask`
- set `sourceType = 'generated'`
- attach `linkedAutonomyRef`
- do not duplicate existing linked tasks

### Manual task create
When creating manual Autonomous tasks in Mission Control:
- create `MCAutoTask`
- set `sourceType = 'manual'`
- immediately write linked entry into existing autonomy source
- attach `linkedAutonomyRef`

### Approve sync
On Approve:
- move task to `done`
- mark linked autonomy item complete
- preserve run/result/artifact history

---

## 14. v1 non-goals for schema

This schema intentionally does **not** include yet:
- scheduler metadata
- retry policies
- approval roles beyond operator/agent note
- advanced agent personas
- queue-first execution contracts
- cross-board generic abstraction for Personal/Projects

Those can be added later if real usage demands them.

---

## 15. Recommended implementation note

When implementation starts, mirror Nerve where it is already strong:
- task status model
- run model
- review semantics

Adapt only where Mission Control must bridge into:
- `AUTONOMOUS.md`
- `memory/executor-subagent-queue.json`
- `memory/tasks-log.md`

That is the correct v1 balance between reuse and local reality.
