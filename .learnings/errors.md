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

## [ERR-20260312-0900]

**What failed:** autonomous-task-executor cron job
**Error:** "cron: job execution timed out" (180s limit)
**Context:** Task execution exceeded timeout — queue processing was blocked
**Suggested fix:** Break tasks into smaller chunks, queue now processes one at a time with stale-task self-heal

**Priority:** high
**Status:** resolved