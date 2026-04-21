# OpenClaw Safe Recursive Operations Loop Guardrails

## Purpose
Define one bounded operations loop that improves self-checking without drifting into unsupervised control-plane work.

## Loop Trigger
Run the loop only when all conditions are true:
- a scheduled maintenance or review window explicitly calls for an ops check
- no active user task would be interrupted by the work
- the environment is already reachable enough to collect evidence
- the next action is low-risk, reversible, and workspace-scoped

Recommended cadence: at most one bounded cycle per trigger.

## Allowed Actions
The loop may:
- read local docs, runbooks, logs, and recent memory notes
- run read-only health checks and status commands
- compare documented expectations against current observable state
- make low-risk workspace-only fixes, such as docs cleanup, runbook clarifications, note updates, or guardrail tightening
- prepare a proposed fix for approval when an issue touches runtime behavior, security posture, routing, uptime, or external integrations

The loop may not:
- restart or stop gateway/runtime services
- mutate critical OpenClaw config from memory or without schema verification
- change auth, exposure, routing, model/provider policy, or public behavior autonomously
- perform destructive cleanup beyond clearly temporary workspace artifacts
- chain itself into another execution cycle just because it found more possible work

## Execution Shape
1. Collect fresh evidence from recent memory and a small set of direct checks.
2. Classify findings:
   - no issue
   - workspace-safe issue
   - approval-gated issue
   - blocker or unclear state
3. Apply at most one small workspace-safe improvement.
4. Verify the exact effect of that change.
5. Stop and record visibility notes.

## Stop Conditions
Stop immediately when:
- a fix would touch control-plane or host-level behavior
- the evidence is contradictory or incomplete
- the issue needs credentials, approval, or a product decision
- one safe improvement has already been applied in the current cycle
- the check starts expanding into open-ended investigation

Default outcome when nothing clearly safe is available: stop with findings, do not escalate into more action.

## Rollback
Every allowed change should have a quick reversal path:
- prefer single-file edits or isolated new notes
- record the pre-change assumption and post-change verification
- if verification fails, revert the same session before doing anything else
- if the change is documentation-only, rollback is restoring the prior file content from git

## Operator Visibility
Each loop should leave a short visible trace with:
- trigger source
- evidence checked
- any change made
- verification result
- whether follow-up needs approval

Preferred visibility surfaces:
- the created or updated ops note in `projects/_ops/`
- git history for the exact edit
- daily memory note when the finding is operationally relevant beyond the file itself

## Recommendation
Use this as a strict single-pass loop, not a self-expanding maintenance agent. The point is better detection and cleaner escalation, not autonomy theatre.