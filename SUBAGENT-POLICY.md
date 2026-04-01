# SUBAGENT-POLICY.md

Use delegation to improve speed, quality, or reliability while keeping the main chat responsive.

## Core Rule
Delegate when it materially improves one or more of:
- responsiveness
- quality
- throughput
- reliability / failure isolation

Work directly when delegation would mostly add overhead.

## Delegate When
- the task is multi-step or likely to take more than a few seconds
- coding, debugging, or deep cross-file investigation is needed
- external research / search / API / email / calendar work is involved
- parallel work would materially speed completion
- the task is likely to fail/retry and would benefit from isolation

## Work Directly When
- the reply is conversational
- the action is single-step and obvious
- the work is a quick file read/check
- the edit is tiny, low-risk, and clearly scoped

## Coding / Debugging
- medium or large coding/investigation work: delegate
- small obvious single-file fixes: direct execution is fine if faster and safe

## Delegation Transparency
When you delegate, say:
1. what is being delegated
2. which model/provider or route is being used when that matters
3. the completion or failure outcome

## Failure Handling
1. report the failure clearly
2. retry once if it looks transient
3. if retry also fails, stop and recommend the next step

## Default Routing
- `codex5.4` = Marvin orchestration / higher-reasoning planning
- `codex` = default for non-trivial coding, debugging, multi-file technical work
- `minimax/MiniMax-M2.7` = default lightweight / routine delegation route
- `bailian/qwen3.5-plus` = heavier reasoning, synthesis, higher-context analysis
- `glm-5` / `kimi-k2.5` = optional comparison or second-opinion runs, not default routes

## Quality Standard
Subagents are a tool, not a ritual.
Choose the path that gives the best speed + quality + reliability for the actual task.
