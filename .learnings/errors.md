# Errors Log

Command/tool failures and exceptions.

## Format
## [ERR-YYYYMMDD-HHMM]

**What failed:** [command or operation]
**Error:** [actual error message]
**Context:** [what you were trying to do]
**Suggested fix:** [if identifiable]

**Priority:** low | medium | high | critical
**Status:** pending | resolved | wont_fix

---

## Recent Errors

## [ERR-20260313-1633]

**What failed:** focused Python test run with `pytest`
**Error:** `/usr/bin/python3: No module named pytest`
**Context:** Verifying the equity-bot execution-candidates consumer bridge in `projects/autonomous-trading-bot`
**Suggested fix:** Keep using `python3 -m unittest` in this container or install `pytest` into the project/runtime if pytest-based workflows are expected
**Resolution:** Re-checked on 2026-03-14. `pytest` is now available in the current runtime, so this specific container-path issue no longer reproduces. Keep `python3` as the safe interpreter assumption; use project-appropriate test runner per repo.

**Priority:** low
**Status:** resolved

## [ERR-20260313-1608]

**What failed:** pre-task memory lookup and default shell tool assumptions
**Error:** `qmd search ...` failed with `Module not found "/data/.bun/install/global/node_modules/@tobilu/qmd/dist/cli/qmd.js"`; `rg` and `python` were also unavailable in this container
**Context:** Starting M1 implementation for the Market Intel execution-candidates producer
**Suggested fix:** Repair the global `qmd` install/path and rely on `python3` / `find` fallbacks when `python` / `rg` are not present
**Resolution:** Re-checked on 2026-03-14. `qmd` is now available again in the current runtime. `python` and `rg` are still absent, so the durable rule is: prefer `python3`; use `find`/`grep` fallbacks when `rg` is unavailable; do not assume bare `python` exists.

**Priority:** medium
**Status:** resolved

## [ERR-20260312-1742]

**What failed:** explicit specialist-model delegation paths during hybrid team trial
**Error:** `sessions_spawn` with `agentId: codex` on subagent route was forbidden (`allowed: none`); ACP spawn also failed (`spawnedBy is only supported for subagent:* sessions`)
**Context:** Tried to route Builder directly to Codex for the first live team trial
**Suggested fix:** Use supported delegated subagent route as practical path; document exec-based Codex fallback when full Codex behavior is required

**Priority:** medium
**Status:** resolved

## [ERR-20260312-0900]

**What failed:** autonomous-task-executor cron job
**Error:** "cron: job execution timed out" (180s limit)
**Context:** Task execution exceeded timeout — queue processing was blocked
**Suggested fix:** Break tasks into smaller chunks, queue now processes one at a time with stale-task self-heal

**Priority:** high
**Status:** resolved
