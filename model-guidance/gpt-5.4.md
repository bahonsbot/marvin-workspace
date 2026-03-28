# GPT-5.4 Prompt Guidance

Source: OpenAI Developer Documentation (developers.openai.com/api/docs/guides/prompt-guidance/)

## Model Strengths

GPT-5.4 is strongest in:
- Strong personality and tone adherence, with less drift over long answers
- Agentic workflow robustness — sticks with multi-step work, retries, completes loops end-to-end
- Evidence-rich synthesis in long-context or multi-tool workflows
- Instruction adherence in modular, skill-based, block-structured prompts
- Long-context analysis across large/messy/multi-document inputs
- Batched or parallel tool calling while maintaining accuracy
- Spreadsheet, finance, Excel workflows with self-verification

## Where Explicit Prompting Still Helps

- Low-context tool routing early in session
- Dependency-aware workflows with explicit prerequisite checks
- Research tasks requiring disciplined source collection + citations
- Irreversible or high-impact actions needing verification before execution
- Terminal/coding-agent environments where tool boundaries must stay clear

## Key Patterns

### Output Contract
```
- Return exactly the sections requested, in the requested order.
- If the prompt defines a preamble, analysis block, or working section, do not treat it as extra output.
- Apply length limits only to the section they are intended for.
- If a format is required (JSON, Markdown, SQL, XML), output only that format.
```

### Verbosity Controls
```
- Prefer concise, information-dense writing.
- Avoid repeating the user's request.
- Keep progress updates brief.
- Do not shorten the answer so aggressively that required evidence, reasoning, or completion checks are omitted.
```

### Default Follow-Through Policy
```
- If the user's intent is clear and the next step is reversible and low-risk, proceed without asking.
- Ask permission only if the next step is:
  (a) irreversible,
  (b) has external side effects (sending, purchasing, deleting, writing to production), or
  (c) requires missing sensitive information or a choice that would materially change the outcome.
- If proceeding, briefly state what you did and what remains optional.
```

### Instruction Priority
```
- User instructions override default style, tone, formatting, and initiative preferences.
- Safety, honesty, privacy, and permission constraints do not yield.
- If a newer user instruction conflicts with an earlier one, follow the newer instruction.
- Preserve earlier instructions that do not conflict.
```

### Tool Persistence Rules
```
- Use tools whenever they materially improve correctness, completeness, or grounding.
- Do not stop early when another tool call is likely to materially improve correctness or completeness.
- Keep calling tools until:
  (1) the task is complete, and
  (2) verification passes.
- If a tool returns empty or partial results, retry with a different strategy.
```

### Dependency Checks
```
- Before taking an action, check whether prerequisite discovery, lookup, or memory retrieval steps are required.
- Do not skip prerequisite steps just because the intended final action seems obvious.
- If the task depends on the output of a prior step, resolve that dependency first.
```

## Front-End Work

For front-end design/build tasks with GPT-5.4:
- Start with low or medium reasoning before turning it up.
- Define design system constraints up front: typography, palette, spacing, layout, and motion boundaries.
- Use visual references or mood boards when available.
- Prefer one strong composition over generic complexity or card-heavy layouts.
- Verify the result visually after implementation.
- For visually strong landing pages, websites, apps, prototypes, demos, or game UI, use the dedicated skill at `skills/frontend-skill/SKILL.md`.

## Usage in OpenClaw

When model switches to `openai-codex/gpt-5.4` (codex5.4), read this file first to apply the above patterns.
