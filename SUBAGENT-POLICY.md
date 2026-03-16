# SUBAGENT-POLICY.md

Purpose: use delegation to improve speed, quality, and reliability while keeping the main chat responsive.

## Core Rule
Delegate when it materially improves one or more of:
- responsiveness (main chat stays unblocked)
- quality (deeper analysis/research)
- throughput (parallel work)
- reliability (failure isolation and safer retries)

Do work directly when delegation would add overhead without clear benefit.

## Use a Subagent When
- Searches (web, social, email)
- API calls and external data collection
- Data processing, synthesis, or comparison
- Calendar/email operations
- Multi-step tasks
- Anything expected to take more than a few seconds
- Anything likely to fail/retry and benefit from isolation
- Coding, debugging, or deep cross-file investigation
- Parallel work would materially speed completion

## Work Directly When
- Simple conversational replies
- Quick clarifying questions or acknowledgments
- Quick file reads/checks
- Single-step actions where spawning would be slower
- Tiny, low-risk edits with obvious scope

## Coding / Debugging Delegation
- Medium/large coding or investigation: delegate
- Small, obvious single-file fixes: direct execution is allowed if faster and safe

## Delegation Transparency
Always announce:
1. what is being delegated
2. model/provider being used
3. completion/failure outcome

## Failure Handling
1. Report failure clearly
2. Retry once for transient failures
3. If retry fails, stop and report both attempts with next recommendation

## Default Routing (Current)

**Note:** We use both Codex versions intentionally:
- `codex5.4` (gpt-5.4): Marvin orchestration, high-reasoning tasks
- `codex` (gpt-5.3-codex): Coding-specific work

**Why both?** `codex5.4` is the orchestration/reasoning default, while `codex` remains the coding-specialist route. This keeps Marvin on the stronger planner and coding-heavy delegated work on the stronger builder.

- **Codex (openai-codex/gpt-5.3-codex):**
  **non-trivial coding, debugging, multi-file technical work, complex investigations**
  → For any coding task beyond simple one-liner fixes, Codex is the default.

- **Bailian MiniMax-M2.5:**
  lightweight research, extraction, and routine task delegation

- **Bailian qwen3.5-plus:**
  heavier reasoning, synthesis, planning, and higher-context analysis

- **Bailian glm-5 / kimi-k2.5 (optional):**
  use selectively for comparison/second-opinion runs or task-specific benchmarking,
  not as default unless a clear quality/cost advantage is established.

## Quality Standard
Subagents are a means, not a ritual.
Choose the path that gives the best speed + quality + reliability for the task.
