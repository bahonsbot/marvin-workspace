# Mission Control Savepoint — 2026-04-16 late evening

## Snapshot
- **Window:** Apr 16, from overnight upgrade prep through late-evening wrap-up
- **Theme of the day:** live OpenClaw `v2026.4.12` upgrade work, Mission Control post-upgrade stabilization, then a cautious end-of-day rollback of the **Mission Control workspace code** to the last clearly good cutoff
- **Final accepted Mission Control code state:** workspace HEAD `a097067` (`Fix Mission Control compaction resync`)
- **Live OpenClaw runtime state at stop:** still on `v2026.4.12`
- **Preview state at stop:**
  - local Mission Control preview healthy on `http://127.0.0.1:3005`
  - WS sidecar healthy on `http://127.0.0.1:3006/healthz`
  - public HTTP path reachable and auth-gated (`401` on `http://preview.motiondisplay.cloud/general/chat`)
  - public HTTPS path still misrouted (`404` on `https://preview.motiondisplay.cloud/general/chat`), which remains a separate host-side nginx problem
- **Why this save exists:** future work should be resumable from docs alone, without Philippe needing to re-explain the upgrade arc, the rollback decision, the surviving bugs, or the agreed product priorities

## The answer in one paragraph
Today produced two different kinds of truth. First, the **runtime/ops truth**: OpenClaw `v2026.4.12` is now the live runtime, the preview can be rebuilt cleanly after restarts, the retry-preflight/runbook lane is much safer, and several real migration traps are now understood. Second, the **Mission Control product-code truth**: the best end-of-day stop point was not the absolute latest commit, but the last commit that still represented real product state rather than accumulated diagnosis noise. That stop point is `a097067`, with `e71c995` and `8a7c0f3` intentionally kept underneath it.

## Final verified stop-state

### Mission Control workspace
- Current branch tip: `a097067` (`Fix Mission Control compaction resync`)
- Repo relation: `master...origin/master [ahead 20]`
- This was an intentional git reset, not a runtime rollback
- Later logging-only commits were preserved in backup/stash, not kept at branch tip

### Live runtime / preview
- Local Mission Control preview routes were rechecked after the git reset and returned `200`
- WS sidecar stayed healthy after the rebuild/restart
- Public HTTP preview remains reachable behind auth
- Public HTTPS remains broken on the host-side proxy lane

### Current non-product working-tree noise
These are live-process/runtime churn items, not part of the intended Mission Control wrap-up:
- `memory/cron-context.json`
- `projects/autonomous-trading-bot/data/state/auto_signal_dispatch.json`
- `projects/market-intel/data/signal_ab_comparison.json`
- `projects/market-intel/data/signals_enriched_shadow.json`
- `projects/mission-control/data/custom-news-briefings.json`
- untracked `projects/mission-control/data/skills-summary-cache.json`

Treat those as runtime data churn unless a later investigation proves otherwise.

## The code state we intentionally kept

These are the three Mission Control commits that define the accepted code baseline at stop:
- `e71c995` — `Harden Mission Control post-upgrade adapters`
- `8a7c0f3` — `Harden Mission Control bridge reconnect behavior`
- `a097067` — `Fix Mission Control compaction resync`

Why this trio matters:
- `e71c995` keeps the useful post-upgrade adapter hardening work
- `8a7c0f3` keeps the reconnect-side Chat hardening work
- `a097067` keeps the compaction-resync fix, which was the strongest real product-side bug fix uncovered in the late-day debugging lane

This is the point Philippe approved as “good enough for now” for end-of-day continuity.

## The commits intentionally dropped from branch tip

These were not thrown away blindly. They were judged useful as evidence, but not worthy of remaining at the product branch tip:
- `230f671` — `Log direct exec-session leak evidence`
- `5c17f7b` — `Broaden system-message leak diagnosis`
- `d39ff29` — `Log shared system-event leak hotfix`

These are preserved via backup/stash, but they are **diagnosis/logging commits**, not the product-state baseline we want to resume from.

There was also a more aggressive possible fallback cutoff, `8a7c0f3`, but Philippe chose `a097067` because it kept the real compaction-resync fix while still removing the later log-heavy tail.

## Safety artifacts created before the reset
- Backup branch: `backup/pre-a097067-20260416-224130`
- Stash: `stash@{0}` with message `pre-a097067-cutoff-20260416-224348`
- Extra cron-context backup: `/tmp/cron-context.pre-a097067-20260416-224348.json`

This means the late logging tail and pre-reset working state are still recoverable if needed.

## Important rollback trap discovered during the reset
A very practical operational problem surfaced during the git-reset work:
- `memory/cron-context.json` was script-managed as `root:root` with mode `600`
- normal `git stash` / dirty-tree handling could fail on that file
- the successful path was:
  1. `sudo` copy the file aside
  2. temporarily `chown` just that file to `node:node`
  3. run stash/reset
  4. restore `root:root` and `600` immediately afterward

This is not just a one-off annoyance. It is a real operator rule for this workspace whenever script-managed root-owned files sit inside the git tree.

## Big-picture arc of the day

### 1. Overnight and pre-window work made the upgrade lane much safer
Before the live cutover drama, a lot of useful prep landed and remains important context:
- the full `2026.3.8 -> v2026.4.12` audit was written
- an isolated rehearsal lane was built and smoke-tested successfully
- the rehearsal revealed a real QMD migration risk (`memory` vs `memory-dir-main` collection naming)
- `preview-stop.sh` was fixed so parallel preview lanes no longer kill each other with broad `pkill` patterns
- a disposable rehearsal cron run proved the isolated lane could do a real write-surface action, not just static health checks

That work was real and valuable. The later live-window trouble does not invalidate it.

### 2. The first live upgrade attempt failed in a messy but useful way
The first real live `v2026.4.12` attempt failed hard enough that Philippe rolled the VPS back.

Most important lessons from that failure:
- do not trust Dashboard/UI vibes as version proof
- target-version config/schema compatibility must be checked before mutation, especially Telegram config keys like `channels.telegram.streaming`
- Mission Control preview restore must be treated as an explicit post-restart step, not assumed to happen automatically
- rollback safety depends on restoring the **raw pre-upgrade config backup** before any `2026.3.8` restart if the target version normalized legacy config into a shape the old version rejects

This failure directly produced better runbooks and a safer retry-preflight lane.

### 3. The retry-preflight lane was the right recovery move
The day then improved significantly:
- `projects/_ops/scripts/openclaw_retry_preflight.py` was created
- companion runbooks/checklists were updated
- the Telegram streaming normalization trap was proven, not guessed
- the live memory gate was corrected to use the target CLI path with the right QMD/Bun PATH
- the agent QMD config was repaired from legacy `memory` to `memory-dir-main`

This turned the upgrade lane from “hopeful sequence of commands” into something closer to a disciplined proof loop.

### 4. The live runtime ultimately did come up on `v2026.4.12`
By the afternoon/evening, the live runtime was working on `v2026.4.12`.

Important nuance:
- the active runtime resolved the newer install under `/data/.npm-global/...`
- `/usr/local/bin/openclaw` still pointed at the stale `/usr/local/...` install
- that created a split-install reality where different shells could appear to be on different versions even after the same upgrade

This is a major operator fact going forward. Future runtime/version checks must verify **which binary path is actually being used**, not just which version one random shell prints.

### 5. Mission Control then needed post-upgrade stabilization
Once the runtime was up, Mission Control still needed a real cleanup pass.

Key stabilizing work or findings from that lane:
- preview-first recovery after gateway restart was necessary, not optional
- the Crons `Recent runs` tab bug was fixed by resolving async `searchParams` correctly under Next 16
- bridge/proxy probes showed the preview-side websocket path itself could be healthy even when the browser UI still looked stale
- a shared upstream system-event leak was identified as **not** being Mission Control-specific
- reconnect behavior was hardened in `useRuntimeBridge.ts`
- compaction resync behavior was hardened in `useRuntimeBridge.ts`

### 6. End-of-day judgment: keep the real fixes, drop the diagnostic tail
This is the most important wrap-up decision.

By late evening, the branch tip had become a mix of:
- real product fixes worth keeping
- increasingly diagnosis-heavy commits that were useful during the live hunt but not the right resume point

Philippe approved ending the day by rolling the Mission Control workspace repo back to `a097067`, with safety artifacts preserved.

That is the accepted Mission Control baseline from this point.

## What we know about the remaining bugs

### Bug class 1: Mission Control live-update / transcript hygiene issues
This remains the main product bug lane.

Strongest facts from today:
- there was real evidence that reconnect and compaction boundaries could strand the Mission Control transcript on stale tool state
- `a097067` specifically exists to keep the compaction-resync fix at branch tip
- after the rollback, this is the best clean product baseline to resume from

Implication for the next session:
- do **not** assume the stale-live-update problem is fully dead just because the best fix landed
- re-test it from the cleaner `a097067` baseline
- if it still reproduces, debug from there instead of from the noisier later log-commit tail

### Bug class 2: shared raw `System (untrusted)` exec-completion leak
This is still open.

What matters:
- it showed up in both OpenClaw Control UI and Mission Control
- it is tied to shared async exec completion / system-event presentation, not just Mission Control rendering
- patching only Mission Control would be the wrong fix lane

Implication:
- treat this as an upstream/runtime presentation problem first
- keep Mission Control-specific chat work separate from this until there is strong evidence of a Mission Control-only rendering fault

### Bug class 3: public preview HTTPS misroute
Still open, but it is a separate host/proxy issue.

Current truth:
- HTTP path is reachable and auth-gated
- HTTPS path still returns `404`
- this is not the first product bug to take on next unless it blocks the next Mission Control work slice

## What was solved today and should be treated as real

### Runtime / ops truths now established
- OpenClaw `v2026.4.12` can run live here
- retry-preflight is now a real required step for future live retries or similar risky changes
- QMD collection naming drift is a real migration risk, not a theory
- install-prefix/path drift inside the container is a real operational risk
- Mission Control preview does not automatically restore itself after every runtime/container restart and should be rebuilt/restarted explicitly when needed

### Mission Control truths now established
- the best surviving late-day product fix is the compaction-resync lane kept in `a097067`
- reconnect behavior got meaningful hardening in the kept slice
- post-upgrade adapter hardening in the kept slice matters and should stay
- the shared system-event leak is not a Mission Control-only bug
- the next meaningful Mission Control work should begin from `a097067`, not from the dropped log tail

## Important docs and artifacts produced today

### Upgrade / rehearsal / retry-preflight artifacts
These matter because the runtime story today was not just debugging noise.
- `projects/_ops/openclaw-v2026.4.12-upgrade-audit-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-rehearsal-execution-plan-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-live-upgrade-window-plan-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-live-execution-checklist-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-live-operator-script-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-feature-delta-2026-04-16.md`
- `projects/_ops/openclaw-v2026.4.12-retry-preflight-2026-04-16.md`
- `projects/_ops/scripts/openclaw_retry_preflight.py`

### Continuity artifacts for this wrap-up
- `memory/2026-04-16.md`
- `.learnings/errors.md`
- `projects/_ops/mc-savepoint-2026-04-16-late-evening.md` (this file)

## The agreed next-work order
Philippe was explicit about this. The next phase is **not** broad redesign. It is:

### First, tackle the remaining bugs
Recommended order inside the bug lane:
1. Re-test Mission Control Chat reliability from the clean `a097067` baseline, especially stale live updates, compaction boundary behavior, tool ordering, and forced history resync behavior.
2. Keep the shared raw system-event leak on the upstream/runtime lane unless new evidence proves a Mission Control-only rendering bug.
3. Treat public preview HTTPS as a separate host/proxy lane, not as the first Mission Control product task, unless it becomes a blocker for the next slice.

### Then continue with improvements inspired by the new OpenClaw Control UI
Philippe’s explicit priority order is the product order from here:

1. **Chat reliability and transcript hygiene first**
   - This stays first even though it is not flashy.
   - Borrow the good parts of Control UI’s history reload, reconnect, and synthetic-junk hiding behavior.
   - Mission Control must stop needing hard-refresh luck.

2. **Search or jump to... plus a live command palette**
   - One operator launcher for page jump, session jump, model/thinking changes, task actions, quick file/memory open, and slash commands.
   - Prefer live gateway slash-command catalog truth over a static fake list.

3. **Per-message actions**
   - `Read aloud`
   - `Delete`
   - `Copy`
   - Later possibly `Branch from here` or `Checkpoint here`

4. **Usage page**
   - strong session cost/usage/timeline surface
   - operator-facing, not decorative

5. **Sessions / checkpoints / restore**
   - genuinely useful because Mission Control lives in long-running threads
   - should feel like operator continuity tooling, not filler

6. **Logs / runtime diagnostics**
   - restrained but real
   - especially useful for bridge, preview, session, and cron debugging

7. **Dreams / memory-ops surfaces later**
   - only after the above, and only if Dreaming / Active Memory become real workflow lanes here

## Product posture after today
- Do not turn Mission Control into a clone of the full OpenClaw Control UI admin surface.
- Mission Control should remain a focused operator cockpit.
- The work now is reliability first, then strong operator affordances.
- Broad cosmetic wandering is the wrong next move.

## Exact git triage notes worth preserving
- Before the rollback, the workspace repo was `master...origin/master [ahead 23]`
- Latest pushed remote commit was identified as `dbffaad`
- Nested `projects/mission-control` repo has no remote configured
- Safe rollback options were narrowed to `e71c995`, `8a7c0f3`, and `a097067`
- Philippe chose `a097067`
- After reset, the workspace repo became `master...origin/master [ahead 20]`

This distinction matters because the accepted rollback was **not** “go back to origin/master”. It was “keep the real Mission Control fixes from today, drop the later diagnosis tail”.

## A practical warning for future git work in this workspace
Do not assume a dirty tree here means normal human edits.

On this box, a dirty tree can also mean:
- root-owned script-managed files inside the repo
- autonomous-trading-bot state churn
- market-intel data churn
- Mission Control cached/generated briefing data

Before any future stash/reset/rebase operation:
1. identify which files are runtime churn
2. identify which files are root-owned or script-managed
3. snapshot before destructive actions
4. restore ownership/mode if you had to touch protected files to complete the git operation

## Future agent startup recommendation for this specific thread
If a future agent is resuming Mission Control work from this savepoint, the first reads should be:
1. `projects/_ops/mc-savepoint-2026-04-16-late-evening.md`
2. `memory/2026-04-16.md`
3. `.learnings/errors.md` (especially the Apr 16 entries)
4. `projects/_ops/openclaw-v2026.4.12-retry-preflight-2026-04-16.md`
5. `projects/_ops/openclaw-v2026.4.12-live-operator-script-2026-04-16.md`

Then, before coding, verify:
- current HEAD still equals `a097067` or understand why it changed
- preview is still healthy locally
- shared system-event leak status has not changed upstream
- the stale-live-update bug still reproduces from this cleaner baseline before reopening broad chat work

## Bottom line
The right continuity point is not “latest thing we touched”. It is:
- **runtime truth:** OpenClaw `v2026.4.12` is now real here, with better runbooks and safer upgrade knowledge than we had this morning
- **Mission Control code truth:** resume from `a097067`, because that keeps the real late-day fixes and discards the log-heavy tail
- **product truth:** next comes bug cleanup first, then the Control-UI-inspired operator improvements in Philippe’s exact priority order
