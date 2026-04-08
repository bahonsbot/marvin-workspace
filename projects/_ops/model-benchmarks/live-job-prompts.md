# Live Job Prompt Reference

This file snapshots the current live job families we want to compare.
Use these as the source prompts for the benchmark unless we intentionally revise the jobs later.

## nightly-memory-extraction
**Current live model:** `bailian/qwen3.5-plus`

```text
Review today's conversations in the workspace. Extract durable facts only: key decisions, relationships, status changes, project updates, and people/company facts. Skip small talk and transient requests.

HARD PATH RULES:
- Every file path you read, write, or edit must start exactly with /data/.openclaw/workspace/.
- Never use, reference, infer, rewrite to, or attempt to edit ~/.openclaw/workspace/, ~, $HOME, or any home-relative path.
- Before every single read/write/edit tool call, re-check the exact path string you are about to send.
- If the path does not begin with /data/.openclaw/workspace/, do not call the tool with that path.
- If any candidate path appears in a forbidden form, convert it to the correct /data/.openclaw/workspace/... absolute path only if the exact intended workspace path is unambiguous.
- If the exact intended workspace path is not unambiguous, skip that edit entirely and continue.
- Forbidden-path candidates are skip-only, never attempt-only. Do not test them, do not probe them, do not send a failing tool call.
- If a planned life-entity update would require any forbidden or uncertain path, skip that entity update, continue the rest of the extraction, and note the skip in today's memory summary instead of failing the run.
- The daily memory update is mandatory even if one or more entity updates are skipped.

SOURCE-OF-TRUTH PATHS:
- Daily memory file for today: /data/.openclaw/workspace/memory/YYYY-MM-DD.md
- Entity roots allowed for updates:
  - /data/.openclaw/workspace/life/projects/
  - /data/.openclaw/workspace/life/areas/people/
  - /data/.openclaw/workspace/life/areas/companies/
  - /data/.openclaw/workspace/life/resources/
- Do not invent any other root path.

For each durable fact:
1. Save it to the appropriate /data/.openclaw/workspace/life/ entity (projects/, areas/people/, areas/companies/, resources/)
2. Use the atomic fact schema: fact, category, timestamp, status, relatedEntities
3. Bump accessCount on any existing facts referenced today when the existing entity file is at a valid allowed absolute path

Also update /data/.openclaw/workspace/memory/YYYY-MM-DD.md for today's date by preserving existing content and appending or integrating new extraction notes. Do not overwrite the whole file with a fresh stub.

If there are no safe entity updates, still complete the run by updating only the daily memory file with a concise extraction summary and any skipped-entity notes.

Use ONLY absolute paths starting with /data/.openclaw/workspace/.

Reply with NO_REPLY when complete.
```

## nightly-security-review
**Current live model:** `bailian/qwen3.5-plus`

```text
Run a comprehensive security review of the codebase. Use the security-review skill. Analyze from 4 perspectives: (1) Offensive (2) Defensive (3) Data Privacy (4) Operational. Spawn 4 sub-agents in parallel and aggregate findings.

CANONICAL-REPORT CONTRACT:
- Produce exactly one canonical final report for this run.
- Reconcile sub-agent findings into that report first, including suppressions, fixes already verified, and accepted-risk carryovers.
- Do NOT carry forward a "yesterday pending" section unless each carried item is explicitly re-verified in this run and included in the canonical report.
- Do NOT emit any intermediate or alternative final summaries.
- Save the canonical report to `memory/security/YYYY-MM-DD-nightly-security-review.md` before replying.
- After saving, re-read that saved report and generate the final reply ONLY from the saved report.
- The final reply must not include any finding, priority, or recommendation that is absent from the saved report.
- If sub-agent outputs conflict, resolve the conflict inside the saved report and mention the resolution there; do not let the final reply drift from it.

IMPORTANT: Save full report to memory/security/YYYY-MM-DD-nightly-security-review.md before replying.

RECENT-DECISION SUPPRESSION CHECK:
Before surfacing findings, read recent daily memory first: today plus at least the previous 3 daily notes in `memory/YYYY-MM-DD.md` when available.
- Suppress or downgrade findings that were already fixed, explicitly accepted, or investigated recently unless there is concrete evidence that the state drifted, failed, or reopened.
- Do NOT require every accepted-risk or already-handled item to be promoted into `MEMORY.md` or `TOOLS.md` before honoring it.
- Treat recent daily memory as valid suppression evidence for overnight reviews.
- If re-raising an item despite recent memory, explicitly state what changed.

SUPPRESSION BASELINE (accepted risk controls):
- Do NOT re-raise credential-rotation recommendations for historical .env exposure if all of the following are true at scan time: (a) .env files are mode 600, (b) .env patterns are ignored by git, (c) no .env files are tracked in git, and (d) no new leak evidence is detected in logs/reports.
- Re-open this finding ONLY when there is a new exposure window: permission drift (>600), tracked/committed .env, or fresh secret exposure evidence.
- For accepted-risk items, report once as INFO with a short baseline note, then suppress repeats unless state changes.

PRACTICAL LIKELIHOOD FILTER — apply this to all findings:
A finding is NOT worth surfacing unless BOTH conditions are met:
1. There is a PLAUSIBLE attack path given our setup (localhost-only, single operator, gitignored secrets, no external network exposure).
2. There is REAL current risk with EVIDENCE — not just a theoretical gap that assumes multiple prior failures cascading.

Suppress or downgrade to INFO if the finding:
- Requires an attacker to already have local filesystem access
- Assumes a 3rd-party service compromise we don't control
- Is a "defense in depth" gap with no current exploit path
- Is purely theoretical and requires multiple things to go wrong simultaneously

Keep fully surfaced: RCE, auth bypass, data exposure with clear evidence, credential leaks, replay attacks, injection with clear path.

In your final reply, provide a concise operator summary suitable for delivery to the nightly-security-review Telegram group. Do not send Telegram messages directly from inside the run.
```

## self-improvement
**Current live model:** `bailian/qwen3.5-plus`

```text
Run a daily self-improvement review of core files: AGENTS.md, MEMORY.md, TOOLS.md, SOUL.md, IDENTITY.md, USER.md, HEARTBEAT.md, plus the last 3 daily notes in memory/YYYY-MM-DD.md. Check for outdated info, conflicting rules, undocumented workflows, lessons from recent failures not captured, and missing tool documentation. Spawn sub-agents if helpful for parallel analysis. Produce a concise report with findings, severity, file references, and recommended actions. Do NOT apply edits automatically. Ask for explicit confirmation before any changes.

RECENT-DECISION SUPPRESSION CHECK:
Before surfacing findings, read recent daily memory first: today plus at least the previous 3 daily notes in `memory/YYYY-MM-DD.md` when available.
- Suppress or downgrade findings that were already fixed, explicitly accepted, or investigated recently unless there is concrete evidence that the state drifted, failed, or reopened.
- Do NOT require every accepted-risk or already-handled item to be promoted into `MEMORY.md` or `TOOLS.md` before honoring it.
- Treat recent daily memory as valid suppression evidence for overnight reviews.
- If re-raising an item despite recent memory, explicitly state what changed.

FILE-VERIFICATION RULE:
Before reporting any referenced file as missing, explicitly verify its existence at the exact workspace path on disk. Do not infer "missing" from absence in injected project context, from not having read it yet, or from partial review scope.
- Classify as `missing from workspace` only if the file truly does not exist on disk.
- Classify as `exists but not reviewed` if the file exists but was not opened during the review.
- Classify as `exists but not included in project context` if it exists on disk but was not part of injected context.
- Include the verification basis in the finding so missing-file claims are auditable.

IMPORTANT: Save full report to memory/self-improvement/YYYY-MM-DD.md before replying.

In your final reply, provide a concise operator summary suitable for delivery to the self-improvement Telegram group. Do not send Telegram messages directly from inside the run.
```
