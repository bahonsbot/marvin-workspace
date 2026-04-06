# Codex Prompt Guidance

Source:
- OpenAI Codex Prompting Guide
- https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide/
- Raw notebook source: `openai-cookbook/examples/gpt-5/codex_prompting_guide.ipynb`

## Model Overview

OpenClaw alias `codex` maps to `openai-codex/gpt-5.3-codex` and should be treated as the coding-specialist route.

Codex is strongest when it is allowed to:
- gather enough context up front
- act autonomously through implementation, testing, and refinement
- use tools aggressively but cleanly
- avoid excessive user-facing preambles and plan-only stops
- preserve prompt/tool patterns that resemble codex-cli

Recommended default reasoning posture from the guide:
- `medium` = strong all-around interactive coding default
- `high` or `xhigh` = harder, longer-running coding tasks

## Model Strengths

Codex is strongest in:
- implementation-heavy coding tasks
- long-running autonomous software work
- codebase exploration and root-cause debugging
- tool-driven editing with strong `apply_patch` / diff behavior
- multi-step execution that benefits from persistence instead of repeated re-planning
- frontend work, when given explicit quality expectations and visual constraints

## Where Explicit Prompting Helps Most

- coding harnesses that need stronger autonomy and persistence
- tool routing, especially preferring dedicated tools over raw shell usage
- batching file reads/searches in parallel before editing
- discouraging upfront-plan-only behavior or excessive progress chatter
- enforcing type-safety, behavior-safe edits, and thorough verification
- frontend tasks where generic layouts or safe-looking UI would be a regression

## Key Patterns

### Default Working Posture

```text
- Deliver working code, not just a plan.
- If details are missing, make reasonable assumptions and complete a working version when feasible.
- Persist until the task is handled end-to-end within the current turn unless explicitly paused or blocked.
- Do not stop at analysis if implementation and verification are still possible.
```

### Autonomy and Persistence

```text
- Once the user gives direction, proactively gather context, plan, implement, test, and refine.
- Bias to action: do not end on clarifications unless truly blocked.
- Avoid repetitive loops; if progress stalls, stop and report the blocker cleanly.
```

### Exploration and Reading

```text
- Think first: decide all likely files/resources before calling tools.
- Batch reads/searches together whenever possible.
- Prefer parallel file exploration when the next reads are already knowable.
- Only switch to sequential reads when the next file genuinely depends on a prior result.
```

### Tool Use

```text
- Prefer dedicated tools over raw terminal commands when a first-class tool exists.
- Prefer `rg` / `rg --files` for search when shell search is needed.
- Use `apply_patch`-style edits where it fits the harness.
- Use shell only when no better tool exists or when execution/verification requires it.
```

### Implementation Quality

```text
- Optimize for correctness, clarity, and reliability over speed.
- Follow repository conventions and reuse prior art before adding new helpers.
- Cover the root cause, not just the visible symptom.
- Preserve intended behavior unless an intentional change is required.
- Keep type safety intact; avoid sloppy casts and broad catch-all fallbacks.
- Batch coherent edits instead of thrashing through many tiny patches.
```

### Git / Worktree Safety

```text
- Assume the worktree may already be dirty.
- Never revert unrelated user changes.
- Do not amend commits unless explicitly asked.
- Never use destructive git commands without explicit approval.
- If unexpected changes appear in the same files being edited and intent is unclear, pause and ask.
```

### Planning

```text
- Skip formal planning for the simplest tasks.
- Do not make single-step plans.
- If you create a plan, update it as work advances.
- Do not end with only a plan unless the user explicitly asked for planning only.
```

### Frontend Tasks

For frontend work with Codex:
- avoid safe, generic "AI slop" layouts
- keep typography, color, spacing, motion, and atmosphere intentional
- preserve the existing design system when working inside an established product
- verify both desktop and mobile behavior
- finish to a genuinely testable state within scope

If the task is explicitly visual/brand-led, also use the dedicated frontend skill.

### User Updates / Preambles

For `gpt-5.3-codex`, user updates can be more communicative than earlier Codex variants, but they should still stay lightweight.

```text
- Keep updates short and human.
- Prefer real milestones over constant narration.
- Avoid loggy, repetitive status language.
- Do not let preambles replace implementation progress.
```

### Final Response Style

```text
- Be concise, direct, and teammate-like.
- Lead with what changed or what was found.
- Reference files/paths instead of dumping large file contents.
- Suggest next steps only when they are genuinely useful.
```

## OpenClaw-Specific Adaptation

For this workspace, when `codex` is used for dev-team execution:
- treat it as the builder/executor lane, not the Marvin orchestration lane
- prefer autonomous implementation with verification
- keep user-facing chatter low unless the task is ambiguous, risky, or blocked
- respect workspace policies in `AGENTS.md`, `TOOLS.md`, and local runbooks
- follow Mission Control truthfulness rules: do not present simulated delegation or fake runtime separation as real

## Usage in OpenClaw

When the model switches to `openai-codex/gpt-5.3-codex` (`codex`):
1. Read this file first
2. Apply it for the rest of the session
3. For coding-heavy delegated work, combine this guidance with the workspace operating policy and task-specific runbooks
