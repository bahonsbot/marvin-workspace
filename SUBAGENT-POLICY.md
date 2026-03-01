# Subagent Policy

Core directive: anything other than a simple conversational message should spawn a subagent.

## When to use a subagent

Use a subagent for:
- Searches (web, social, email)
- API calls
- Multi-step tasks
- Data processing
- File operations beyond simple reads
- Calendar/email operations
- Any task expected to take more than a few seconds
- Anything that could fail or block the main session

## When to work directly

Handle these without a subagent:
- Simple conversational replies
- Quick clarifying questions
- Acknowledgments
- Quick file reads for context
- Single-step lookups where spawning a subagent would take longer than just doing it

The goal is keeping the main session responsive, not spawning subagents for the sake of it. If a direct approach is faster and simpler, use it.

## Coding, debugging, and investigation delegation

All coding, debugging, and investigation tasks go through subagents. The main session should never block on this work.

The subagent evaluates complexity:
- **Simple:** Handle directly. Config changes, small single-file fixes, appending to existing patterns, checking one log or config value.
- **Medium / Major:** Delegate to your coding agent CLI. This includes multi-file features, complex logic, large additions, and multi-step investigations that require tracing across files or systems.

## Why

Main session stability is critical. Subagents:
- Keep the main session responsive so the user can keep talking
- Isolate failures from the main conversation
- Allow concurrent work
- Report back when done

## Delegation announcements

When delegating to a subagent, **always tell the user** — regardless of which model is running. This is mandatory, not optional.

**Rule:** If you're spawning a subagent or running a background task, say so. Don't silently do it.

Format: [model] via [provider/tool]

Examples:
- "Spawning a subagent with MiniMax to search Twitter."
- "Delegating to Codex via coding agent CLI."
- "Running a background check on the cron jobs — will report back."

Include the model and provider in both the start announcement and the completion message if the model used differs from what was initially stated (e.g., fallback).

**Note:** Some models (like MiniMax) may be less vocal about internal operations. Override this by explicitly announcing every subagent spawn — consistency matters more than model default behavior.

## Failure handling

When a subagent fails:
1. Report to the user via messaging platform with error details
2. Retry once if the failure seems transient (network timeout, rate limit)
3. If the retry also fails, report both attempts and stop

## Default model routing

- **MiniMax (minimax/MiniMax-M2.5):** Web searches, crawling, research, cron jobs, data gathering — anything lightweight that doesn't need coding muscle.
- **Codex (openai-codex/gpt-5.3-codex):** Coding tasks, debugging, complex investigations, multi-file features, anything that needs actual programming logic.

## Implementation

Use your framework's subagent spawning mechanism with:
- Clear task description
- Route based on task type: MiniMax for research/web tasks, Codex for coding
- Only deviate when the task specifically requires a different capability
- Estimated time if helpful