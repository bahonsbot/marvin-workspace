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

## [ERR-20260411-1000]

**What failed:** Mission Control autonomous Tasks sync semantics after daily task generation
**Error:** newly generated backlog tasks were still being written only into `AUTONOMOUS.md`, while the Tasks cleanup path treated the structured board as source of truth and reconciled markdown from it. Result: clicking sync/cleanup could remove valid fresh tasks from `AUTONOMOUS.md` instead of bringing them into the board.
**Context:** Apr 11 Mission Control review after Philippe noticed fresh generated tasks disappeared from markdown when syncing, even though the intended architecture was `structured board = truth`, `AUTONOMOUS.md = mirror`.
**Suggested fix:** generated backlog items must land in `projects/mission-control/data/autonomous-tasks.json` as part of the generation flow, not only in legacy markdown. Also keep suppressed legacy delete keys respected so manually removed tasks do not silently return.
**Resolution:** Fixed on 2026-04-11 by patching `scripts/daily-task-generator.py`, `projects/mission-control/lib/autonomous.ts`, `projects/mission-control/lib/adapters/tasks.ts`, and the Tasks UI labels; generated tasks now sync into the structured store and manual deletes stay suppressed.

**Priority:** high
**Status:** resolved


## [ERR-20260410-1310]

**What failed:** Morning Meeting push after remote history rewrite
**Error:** normal `git push origin master` was rejected because the remote had been force-rewritten and the local workspace still sat on the pre-rewrite ancestry, producing a massive ahead/behind divergence despite only two real local commits needing to land
**Context:** Apr 10 follow-up after removing `openclaw.json` from remote history and then trying to push the approved Morning Meeting fixes from the main workspace checkout
**Suggested fix:** after any remote history rewrite, do not trust the main dirty workspace checkout for normal push/pull flow. Either realign the local repo deliberately first, or push approved follow-up commits from a clean temporary clone based on the rewritten remote.
**Resolution:** Resolved same session by exporting the two approved commits as patches, applying them in a clean temporary clone of the rewritten remote, and pushing from there

**Priority:** medium
**Status:** resolved

## [ERR-20260410-1302]

**What failed:** Nightly security review finding quality on `openclaw.json`
**Error:** the report framed workspace `openclaw.json` as an active git-tracked secret-file misconfiguration with an env-migration fix, but the file was not present in current HEAD/workspace and the proposed remediation did not fit the real architecture
**Context:** Apr 10 Morning Meeting review after Philippe challenged the recommendation
**Suggested fix:** for sensitive-file findings, verify three things separately before escalating: (1) present in current workspace/HEAD, (2) merely historical in git, or (3) architectural accepted-risk by design. Do not recommend env migration when the file's role makes that non-viable.
**Resolution:** Resolved same session by verifying actual git state, removing the file from remote history, adding ignore protection upstream, and promoting a durable review-suppression rule in `MEMORY.md`

**Priority:** high
**Status:** resolved

## [ERR-20260408-1735]

**What failed:** first attempted Home-page redo after Philippe’s major visual critique
**Error:** the delegated follow-up did not produce a usable implementation summary and instead surfaced unrelated/truncated JSON data, leaving the Home page effectively unchanged despite the run claiming completion
**Context:** Apr 8 evening after the first Home rewrite was strongly rejected and a fresh redo was requested
**Suggested fix:** when a delegated coding run returns malformed or irrelevant output, verify repo state and actual changed files immediately instead of trusting the completion text. Treat `claimed success + nonsense payload` as failure until proven otherwise.
**Resolution:** Verified the real repo state manually, confirmed the redo had not landed, and restarted the Home work from the true open point with a fresh implementation pass

**Priority:** medium
**Status:** resolved

## [ERR-20260408-2208]

**What failed:** heartbeat-style trading bot alerting produced a false positive
**Error:** a watchdog/process-name check implied the trading bot was down, but direct health checks at `http://127.0.0.1:8000/health` and `/health/auth` were returning OK
**Context:** Apr 8 evening, after repeated `Trading bot health check still needs attention` messages surfaced while the receiver was actually healthy
**Suggested fix:** for trading-bot heartbeat checks, prefer endpoint truth over watchdog/process-name presence. Treat process absence alone as insufficient if `/health` is green.
**Resolution:** Updated `HEARTBEAT.md` guidance on 2026-04-08 to use endpoint-first verification for the trading bot

**Priority:** medium
**Status:** resolved

## [ERR-20260408-1450]

**What failed:** `nightly-memory-extraction` scheduled run completed scheduling but failed inside the model-backed job
**Error:** the run attempted forbidden home-relative paths like `~/.openclaw/workspace/...` instead of `/data/.openclaw/workspace/...`, causing the extraction to fail even though the cron schedule itself was healthy
**Context:** Morning Meeting investigation on Apr 8 after the overnight pre-check showed the extractor had not completed cleanly
**Suggested fix:** for model-backed file-mutation jobs, make forbidden paths skip-only, allow rewrite only when the exact `/data/.openclaw/workspace/...` target is unambiguous, and require a fallback success path so one bad entity update does not kill the whole run
**Resolution:** Fixed on 2026-04-08 by hardening the live `nightly-memory-extraction` cron prompt; daily memory update is now mandatory even if some entity updates are skipped

**Priority:** medium
**Status:** resolved

## [ERR-20260408-1510]

**What failed:** autonomous-kanban Done visibility for an executor-created artifact
**Error:** the completed executor result for `scripts/cron_run_summary.py` existed in `memory/executor-subagent-queue.json`, but the Done surface depended mainly on `memory/tasks-log.md`; because the append was missed, the completion was easy to lose from the visible board history
**Context:** Apr 8 follow-up after Philippe asked what the autonomous queue task had actually delivered and the Telegram completion existed but the deliverable was not obvious from the board/log flow
**Suggested fix:** preserve `tasks-log.md` as durable completion history, but let the board also read verified completed executor queue entries as a fallback for visibility; backfill missed task-log rows when found
**Resolution:** Fixed on 2026-04-08 in autonomous-kanban board readers/sync plus a backfilled `tasks-log.md` completion entry; git commit `5ceb878`

**Priority:** medium
**Status:** resolved

## [ERR-20260406-1742]

**What failed:** first real Mission Control Sudo workflow test from the Chat seat selector
**Error:** Sudo-seat composer submit still followed the generic live-chat send path, so a task intended for Sudo orchestration was sent into the normal Marvin runtime and replayed/reused unrelated Marvin-side content instead of creating a fresh Sudo orchestration run
**Context:** Apr 6 live testing after the Phase 3 stack was declared complete enough for real workflow testing; Philippe submitted a left-sidebar implementation brief while the Sudo seat was active and got what looked like an old Marvin reply instead of a Sudo-led run
**Suggested fix:** seat-aware Chat UI is not enough; the composer submit path must also be seat-aware. When Sudo is the active seat, normal submit/Enter should route into Sudo orchestration first, not `live.sendPrompt(...)`
**Resolution:** Fixed on 2026-04-06 in `projects/mission-control/components/chat/MissionControlChatSurface.tsx`; nested Mission Control repo commit `2a0c4231`

**Priority:** high
**Status:** resolved

## [ERR-20260406-1949]

**What failed:** Mission Control Sudo orchestration model selection during real workflow testing
**Error:** Sudo orchestration repeatedly blocked with `model override was not acknowledged by runtime. Requested codex5.4.` because the runner tried to force models by sending `/model ...` chat commands into synthetic execution sessions, then treated chat-style acknowledgement as runtime truth
**Context:** Apr 6 evening after Sudo successfully intercepted composer submits but still could not reliably start its orchestration run on `codex5.4`
**Suggested fix:** for synthetic/autonomous Mission Control runs, do not treat `/model ...` chat commands as the primary model-selection mechanism. Prefer session/run setup with the requested model baked in, then verify against returned runtime/session metadata
**Resolution:** Interim matcher hardening landed first (`c7fa75c5`), but the real fix was the session-setup refactor on 2026-04-06 in `projects/mission-control/scripts/run-sudo-orchestration.mjs` and `scripts/run-sudo-delegation.mjs`; nested Mission Control repo commit `3672cad4`

**Priority:** high
**Status:** resolved

## [ERR-20260406-2000]

**What failed:** Mission Control Sudo orchestration decision parsing after clearing the model-selection blocker
**Error:** the orchestration runner threw `Sudo orchestration did not return a supported decision mode` even though the model had produced a valid fenced decision payload, because the extractor naively grabbed the first JSON object in stdout/wrapper output instead of the actual decision JSON
**Context:** Apr 6 evening while pressure-testing the first real Sudo-led task after model-setup fixes
**Suggested fix:** for wrapped model/CLI output, do not use first-object JSON extraction. Rank candidate JSON objects by schema affinity and prefer the one that actually matches the expected decision contract (`mode`, `lanePlan`, `lanePlanSteps`, `oversight`, etc.)
**Resolution:** Fixed on 2026-04-06 in `projects/mission-control/scripts/run-sudo-orchestration.mjs`; nested Mission Control repo commit `3b9a76c3`

**Priority:** high
**Status:** resolved

## [ERR-20260404-2243]

**What failed:** Mission Control autonomous research task execution entered a false `In Progress` state with no real worker/session behind it
**Error:** `projects/mission-control/scripts/run-autonomous-task.mjs` contained a JavaScript syntax error (`minimax2.7:` used as an unquoted object key), so the detached runner crashed immediately on load while the execute route had already marked the task as `in-progress` with `Execution started`
**Context:** Apr 4 Mission Control autonomous web-research verification after Philippe reported a fresh research task looked stuck and MiniMax showed no token usage
**Suggested fix:** for detached autonomous execution, do not treat task-store `running` state as proof of a live run; verify at least one concrete runtime signal (session log creation, session-registry entry, transcript growth, or model usage) and fail fast if the worker dies before real session creation. Also run `node --check` or equivalent syntax validation on edited runner scripts before relying on detached launch paths
**Resolution:** Root cause identified and fixed on 2026-04-04 in `projects/mission-control/scripts/run-autonomous-task.mjs`; nested Mission Control repo commit `13f21391`

**Priority:** high
**Status:** resolved

## [ERR-20260404-2140]

**What failed:** Mission Control Tasks browser preflight kept warning that web research was unavailable even after backend autonomous web research had been enabled
**Error:** the browser-side capability check only saw server-side env assumptions, so the UI emitted a false missing-capability warning while the backend/runtime path was actually configured
**Context:** Apr 4 Mission Control Tasks follow-up after Philippe saw `This task requests web research, but the current runtime has no web-search capability configured...` on a newly created research task
**Suggested fix:** when capability checks run in both server execution and browser preflight, mirror the env contract explicitly for the client path (for example `NEXT_PUBLIC_*`) so the UI and runtime share the same truth source
**Resolution:** Fixed on 2026-04-04 by updating `projects/mission-control/lib/autonomous-preflight.ts` to honor `NEXT_PUBLIC_MISSION_CONTROL_WEB_RESEARCH_ENABLED` and `NEXT_PUBLIC_MISSION_CONTROL_SEARCH_PROVIDER`, and by setting those values in the real preview runtime env

**Priority:** medium
**Status:** resolved

## [ERR-20260402-2340]

**What failed:** Mission Control Chat active-session transcript hydration after the April 2 hardening pass
**Error:** repeated transcript rehydration for the already-live active thread caused delayed duplicate user/assistant turns, clone accumulation over time, and occasional transcript self-scroll jumps; wrapper-stripping/dedupe patches improved symptoms but did not fix the core problem
**Context:** late-night Mission Control Chat regression hunt after Philippe reported that both his messages and Marvin replies reappeared a few seconds later and older turns could accumulate into many copies
**Suggested fix:** for the active live chat thread, keep transcript hydration conservative: hydrate on session change or when no meaningful transcript exists, then rely on WS live updates for ongoing conversation instead of repeatedly re-merging history on transcript-signature changes
**Resolution:** Fixed on 2026-04-02 in `projects/mission-control/hooks/useRuntimeBridge.ts` via commit `e162301`; Control UI wrapper stripping in `projects/mission-control/app/api/runtime-bridge/route.ts` remains a useful supporting cleanup but was not the root fix

**Priority:** high
**Status:** resolved

## [ERR-20260331-1258]

**What failed:** Mission Control Chat live session continuity after send
**Error:** the runtime bridge hook recreated its websocket effect after a normal user send because `load()` depended on `messages.length`, which changed callback identities upstream and tore down/rebuilt the bridge; a second churn path let summary refresh recreate the bridge/session effect even when material transport values had not changed
**Context:** Mar 31 Mission Control Chat audit after Philippe reported that every sent message effectively kicked him out of the session until a hard reload
**Suggested fix:** for live bridge hooks, never let transcript-length or broad summary-object churn sit in callback/effect dependencies that own websocket lifecycle; derive hydration decisions from functional state updates and narrow transport effects to stable scalar inputs only
**Resolution:** Fixed on 2026-03-31 in `projects/mission-control/hooks/useRuntimeBridge.ts`; commits `d417389` and `1d4c3d2`

**Priority:** high
**Status:** resolved

## [ERR-20260331-1358]

**What failed:** first Mission Control chat-to-Files linkifier pass
**Error:** file-path linking initially failed for inline-code file mentions because code rendering took precedence over plain-text linking, then the follow-up clickable-code implementation became too permissive and linked generic code-ish tokens like `read`, `exec`, and CSS property names
**Context:** Mar 31 Mission Control Chat UX pass after Philippe asked for file mentions in chat to open the corresponding file in the Files page
**Suggested fix:** when linkifying file references in rich text, handle inline-code file paths explicitly and gate all linking behind a strict workspace-file test: allowed workspace roots, at least one slash, and a filename-like last segment
**Resolution:** Fixed on 2026-03-31 in `projects/mission-control/components/chat/MissionControlChatSurface.tsx`; initial link commit `596ad35`, then matcher tightened in the same file after live feedback

**Priority:** medium
**Status:** resolved

## [ERR-20260330-1544]

**What failed:** first live Mission Control tool-lane persistence/collapse behavior
**Error:** newly rendered Tools groups disappeared after completion because the live event buffer was being consumed by low-value assistant delta churn, and later auto-collapse logic stayed wrong because raw `start` rows kept making finished groups appear active; fast runs also appeared collapsed immediately because first render already saw `result` state only
**Context:** Mar 30 Mission Control Chat process-lane rollout after Philippe confirmed tool groups showed while streaming but vanished or collapsed incorrectly once the run ended
**Suggested fix:** treat tool-lane state as a run/group model instead of raw event spam; preserve meaningful tool/chat/lifecycle events, derive per-tool-call latest state, and keep the newest completed group open rather than collapsing immediately
**Resolution:** Resolved on 2026-03-30 in `projects/mission-control/hooks/useRuntimeBridge.ts` and `projects/mission-control/components/chat/MissionControlChatSurface.tsx`; tool groups now survive completion, derive from latest call state, and keep the newest group open

**Priority:** high
**Status:** resolved

## [ERR-20260330-1650]

**What failed:** first Mission Control assistant copy-button implementation
**Error:** relying only on `navigator.clipboard.writeText()` caused the copy button to appear functional while copying nothing on the live preview/browser context
**Context:** Mar 30 Chat Composer/copy-control polish after Philippe confirmed the copy icon showed up but did not actually copy message text
**Suggested fix:** for user-facing clipboard features on preview/browser surfaces, always provide a legacy fallback path (hidden textarea + `document.execCommand('copy')`) instead of assuming async Clipboard API availability
**Resolution:** Resolved on 2026-03-30 by adding the fallback path in `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

**Priority:** medium
**Status:** resolved

## [ERR-20260330-1036]

**What failed:** Morning Meeting token-expiry triage initially treated `config/token-manifest.json` as if it proved the live Codex runtime auth had expired
**Error:** the token-age check reads manual tracking metadata from `config/token-manifest.json`, not the live runtime auth state in `/data/.openclaw/agents/main/agent/auth-profiles.json`, which created a false-positive expired-token finding for `openai-codex:default`
**Context:** Mar 30 Morning Meeting after Philippe said he had refreshed both Codex and runway OpenAI auth recently and asked where the expiry data was coming from
**Suggested fix:** treat `token-manifest.json` as lifecycle-tracking metadata only unless its values are freshly maintained; before surfacing auth-expiry findings as live operational issues, verify the real runtime auth store and recent usage timestamps first
**Resolution:** Resolved on 2026-03-30 by checking the live runtime auth profile, confirming `openai-codex:default` was healthy and recently used, and updating `config/token-manifest.json` to align with reality

**Priority:** high
**Status:** resolved

## [ERR-20260329-1833]

**What failed:** first Mission Control transcript-hydration implementation
**Error:** the runtime-bridge history route assumed the wrong `sessions.json` shape (`sessions[sessionKey]` / `id`) even though the live session registry on this runtime is keyed directly by session key and exposes `sessionId` / `sessionFile`; the client hydration path also hard-replaced transcript state, which could wipe a just-sent user message when assistant output or refresh landed afterward
**Context:** Mar 29 evening Mission Control Chat rehydration work after Philippe confirmed reloads still opened with `No live transcript yet...` and later reported that one user message disappeared when the assistant reply arrived
**Suggested fix:** verify live on-disk session-registry structure before building hydration logic; in chat transcript hydration, merge + dedupe persisted history into live state instead of replacing the whole message array; if manual Refresh works but first load does not, add an explicit hydrate trigger keyed to the resolved active session
**Resolution:** Fixed on 2026-03-29 in `projects/mission-control/app/api/runtime-bridge/route.ts` and `projects/mission-control/hooks/useRuntimeBridge.ts`; transcript rehydration now works automatically and sanitized hydrated text no longer leaks transport wrappers

**Priority:** high
**Status:** resolved

## [ERR-20260329-1924]

**What failed:** first Mission Control Composer/fixed-workspace layout pass
**Error:** the Composer was still implemented inside the scroll card while the shell still reserved bottom-strip space, which caused the Composer to overlay the transcript, left-gutter/outer-page scroll weirdness, and less usable vertical space than intended
**Context:** Mar 29 evening Chat Composer/layout refinement after the first pass visually improved the page but Philippe reported the controls still scrolled oddly and the Composer blocked part of the transcript
**Suggested fix:** treat fixed chat-workspace behavior as a shell/layout concern, not only a component concern; on Chat-only routes, reclaim shell height if necessary, keep the Composer outside the transcript scroll region, and let the middle pane own scrolling
**Resolution:** Fixed on 2026-03-29 by adding Chat-route-aware shell handling in `components/shell/AppShellClient.tsx`, hiding the bottom system strip on Chat only, and moving the Composer into its own bottom dock region outside the transcript scroll card

**Priority:** high
**Status:** resolved

## [ERR-20260327-1257]

**What failed:** nightly-security-review Telegram delivery during offensive-slice recovery
**Error:** a subagent timeout/recovery narrative leaked into the operator-facing Telegram group even though the parent `nightly-security-review` run completed and saved a canonical report successfully
**Context:** Morning Meeting investigation on 2026-03-27 after Philippe saw a Telegram message claiming the offensive security review had timed out, while cron state and `memory/security/2026-03-27-nightly-security-review.md` showed a successful delivered parent run
**Suggested fix:** for scheduled overnight reviews, keep operator delivery single-session and canonical: do not allow subagents, child sessions, or resumable delegated runs to produce user-visible completion/recovery chatter; derive the final delivery only from the saved parent report
**Resolution:** Fixed on 2026-03-27 by updating the live `nightly-security-review` cron prompt and `skills/security-review/SKILL.md` to require a single parent session with one canonical operator summary only

**Priority:** high
**Status:** resolved

## [ERR-20260327-1408]

**What failed:** Mission Control persistent auth file rollout used the wrong execution/storage context at first
**Error:** the persistent Basic Auth file was initially created or reasoned about from the wrong side of the host/container boundary, so the live preview process kept returning `503 Mission Control auth is not configured` until the real `mission-control-preview.env` was written into the container-visible workspace path
**Context:** Mar 27 Mission Control security hardening follow-up after auth middleware was working but incognito/public preview still showed the auth-not-configured message
**Suggested fix:** for container-hosted preview/runtime state, verify the file exists from the same execution context that starts the app; do not assume a host-side path write automatically matches the live container-visible path without checking from inside the container
**Resolution:** Fixed on 2026-03-27 by verifying the live container path, writing the real env file at `/data/.openclaw/workspace/projects/mission-control/.preview-runtime/mission-control-preview.env`, and restarting the preview until public access returned `401 Unauthorized`

**Priority:** medium
**Status:** resolved

## [ERR-20260405-1643]

**What failed:** Mission Control preview repeatedly returned `502 Bad Gateway` shortly after apparently successful rebuild/restart cycles
**Error:** the preview launcher used `nohup ... &` but was not detached robustly enough from the invoking shell/tool lifecycle, so the stack could appear alive for the first request and then disappear, leaving nginx/proxy with instant 502s afterward
**Context:** Apr 5 Agents-page implementation passes when Philippe reported a repeating pattern: first load briefly worked after rebuild, then the preview died and later requests were immediate 502s
**Suggested fix:** for assistant-triggered preview start paths, launch the WS sidecar, internal Next app, and preview-origin proxy in detached sessions (`setsid`), write PID files explicitly, and require a real local health check before reporting success
**Resolution:** Fixed on 2026-04-05 by hardening `projects/mission-control/scripts/preview-start.sh` to use detached session launches plus startup health verification; verify persistence by checking the route again after the launching shell has already exited

**Priority:** high
**Status:** resolved

## [ERR-20260405-2213]

**What failed:** ClawHub live pull/inspection for the intended Johan/Milou/Japin skill packages
**Error:** full URLs are not valid input to `clawhub install`, and subsequent slug-based installs were blocked by registry rate limiting (`Rate limit exceeded`)
**Context:** Apr 5 Agents identity/skills pass after Philippe supplied the intended ClawHub references for sportsbet-advisor, trading, and language-learning
**Suggested fix:** use slug-based install syntax, serialize downloads one by one, and if the registry remains rate-limited, accept manually uploaded local skill copies as the practical source of truth for alignment work
**Resolution:** worked around the issue by using Philippe's manually uploaded local copies under `uploads/mission-control/` to finalize Johan/Milou/Japin skill posture

**Priority:** medium
**Status:** resolved via local-source fallback

## [ERR-20260326-2309]

**What failed:** external Mission Control preview accessibility after shell-framing/status work
**Error:** changing the preview server bind from `0.0.0.0` to `127.0.0.1` preserved local curl checks but broke the reverse-proxied external preview path, leading Philippe to hit `502 Bad Gateway` on `preview.motiondisplay.cloud`
**Context:** late-night Mission Control preview verification after shell framing changes and multiple rebuild/restart cycles
**Suggested fix:** when the preview is meant to be reachable through the external reverse-proxy path, keep the app bound to `0.0.0.0`; do not optimize the preview scripts for local-only verification at the expense of external reachability
**Resolution:** Fixed on 2026-03-26 by restoring `scripts/preview-start.sh` to `--hostname 0.0.0.0` and restarting the preview; Mission Control repo commit `41ef8b60`

**Priority:** high
**Status:** resolved

## [ERR-20260325-2303]

**What failed:** manual-board new-task save flow in Mission Control Tasks
**Error:** the save handler for new manual-board tasks captured stale modal state via `useCallback([])` and still checked `if (!modal) return;`, so saving a newly created task silently bailed out instead of writing it to Personal/Projects
**Context:** Philippe tested the `+` button flow on the Tasks manual boards after the drag-and-drop/manual-board pass
**Suggested fix:** when save handlers already receive the full payload, avoid stale closure guards against transient UI state like modal visibility; use the explicit arguments as source of truth and keep modal state out of the write gate
**Resolution:** Fixed on 2026-03-25 in `components/pages/TasksBoardSwitcher.tsx` by removing the stale modal guard and validating with build + lint + preview restart; Mission Control repo commit `b1a31aed`

**Priority:** high
**Status:** resolved

## [ERR-20260325-2340]

**What failed:** first Tasks visual refinement pass for Mission Control
**Error:** the refinement overshot from visual/style polish into structural page redesign, changing more of the page layout than Philippe wanted
**Context:** applying Stitch-guided Tasks polish after the functional cleanup/draggable-board pass
**Suggested fix:** for Mission Control page refinements, treat the last user-approved layout as protected unless Philippe explicitly asks for layout changes; use page-specific visual passes for materials, spacing, hierarchy, and typography first
**Resolution:** Corrected on 2026-03-25/26 by restoring the previous Tasks layout baseline and then applying narrower refinements; Mission Control repo follow-up commits `91d0c29f`, `f54ae40a`, `c812d7c6`

**Priority:** high
**Status:** resolved


## [ERR-20260325-1223]

**What failed:** nightly-security-review delivery and saved report diverged
**Error:** the Telegram/operator summary was generated from an intermediate aggregation path while the saved markdown report reflected a later, different reconciliation pass, so the delivered findings and the on-disk report did not match
**Context:** Morning Meeting audit on 2026-03-25 after Philippe pasted the Telegram security summary and it conflicted with `memory/security/2026-03-25-nightly-security-review.md`
**Suggested fix:** enforce a canonical-report contract: aggregate once, save the final report first, re-read that saved report, and derive the final delivery summary only from that exact file; never deliver intermediate summaries or unverified carry-forward sections
**Resolution:** Fixed on 2026-03-25 by patching the live `nightly-security-review` cron prompt plus workspace references (`projects/_ops/model-benchmarks/live-job-prompts.md`, `skills/security-review/SKILL.md`) so delivery must be generated from the saved canonical report

**Priority:** high
**Status:** resolved

## [ERR-20260323-1158]

**What failed:** Platform Health Council cron-health analysis produced false-positive overdue findings for deterministic jobs
**Error:** the report counted weekend dates as missed runs for weekday-only jobs and also treated a same-day job as overdue before its scheduled run time, which incorrectly escalated `trading-daily-report` and overstated the `pre-market-brief` issue
**Context:** Morning Meeting review on 2026-03-23 after the health report flagged multiple missed deterministic scheduler runs
**Suggested fix:** make cron-health analysis schedule-aware: compare findings against the actual calendar and the task definitions in `scripts/deterministic_scheduler.py`, never count weekend days for weekday-only jobs, and do not flag a job as overdue before its scheduled time on the current day
**Resolution:** Fixed on 2026-03-23 by updating the `platform-health-council` cron prompt to respect schedule calendars, current-day timing, and deterministic task definitions before calling runs missing

**Priority:** high
**Status:** resolved


## [ERR-20260322-1237]

**What failed:** self-improvement review + executor task-shape routing both produced false-positive outcomes
**Error:** the self-improvement cron inferred two files were missing without explicit on-disk verification, and the executor marked a task asking for a working script/utility as completed with a Markdown artifact because a broad `projects/automation/` route fired before script-specific validation
**Context:** Morning Meeting follow-up on 2026-03-22 after stale findings for `SUBAGENT-POLICY.md` / `model-guidance/gpt-5.4.md` and a flawed 10:00 automation-utility completion
**Suggested fix:** require explicit file-existence verification before any missing-file claim; for executor routing, distinguish script/utility tasks from markdown-spec tasks explicitly and reject Markdown completions for runnable-script deliverables
**Resolution:** Fixed on 2026-03-22 by hardening the self-improvement cron prompt, adding `scripts/executor_artifact_audit.py`, and patching `scripts/autonomous-task-executor.py` / `scripts/daily-task-generator.py` so backlog refill and completion rules match task intent

**Priority:** high
**Status:** resolved


## [ERR-20260322-1931]

**What failed:** market-intel feed intake was only partially working even though most sources were still configured
**Error:** six rss.app feeds were silently broken because inline `# ...` comments in `rss_feeds.txt` were being treated as part of the URL, and the Reddit monitor was over-fetching by pulling top comments for every scanned post before keyword filtering, which amplified `HTTP 429` rate limits
**Context:** feed-pipeline audit after Philippe noticed only a subset of RSS sources appearing in recent market-intel flow
**Suggested fix:** strip inline comments safely when parsing `rss_feeds.txt`; on Reddit, fetch comments only for posts that already look relevant by title/selftext, cap posts per subreddit, and rotate subreddit batches across runs instead of hammering the full list every pass
**Resolution:** Fixed on 2026-03-22 by patching `projects/market-intel/src/rss_monitor.py` and `projects/market-intel/src/reddit_monitor.py`; all 20 configured RSS feeds then loaded cleanly and Reddit was moved to a lower-pressure rotating scan model

**Priority:** high
**Status:** resolved

## [ERR-20260329-1012]

**What failed:** Morning Meeting triage initially treated stale or not-yet-delivered cron state as a fresh live failure
**Error:** I presented `signal-accuracy-review` as an active problem on a Sunday before accounting for its weekday-only schedule, and later I treated a forced `autonomous-queue-wakeup` run as broken because I checked `executor-subagent-queue.json` before the reminder-style job had actually landed in-session and been processed
**Context:** Mar 29 Morning Meeting + autonomy queue debugging after investigating the queued helper-utility task
**Suggested fix:** before declaring a cron issue live, verify the schedule calendar and whether the current day/run should have produced fresh state; for reminder-style cron jobs triggered via `cron run`, remember that acceptance/enqueue happens before the session processes the reminder, so queue/state files may lag until the reminder arrives
**Resolution:** Resolved operationally on 2026-03-29 by re-evaluating the weekday-only schedule, processing the delivered queue reminder correctly, and documenting the cron delivery-model lesson in daily memory/TOOLS

**Priority:** medium
**Status:** resolved


## [ERR-20260320-1916]

**What failed:** custom model/provider config edit in `openclaw.json`
**Error:** treated `OpenAI` and `MiniMax` as if they should be added in a newly inferred custom-provider shape instead of first anchoring on the live installed schema and the current working provider/model patterns already present in the config; Philippe had to roll the VPS back to a snapshot
**Context:** adding GPT-5.4 mini and a newer direct MiniMax model as custom entries while respecting the current OpenClaw version’s config model
**Suggested fix:** validate the live schema first, mirror existing working entries in the current config, and when Philippe explicitly asks to see the proposed config change first, stop before apply and present the exact patch/diff instead of mutating immediately
**Resolution:** unresolved in-session; rollback performed by Philippe, future attempts must be schema-first and diff-first

**Priority:** critical
**Status:** resolved


## [ERR-20260319-1730]

**What failed:** initial QMD integration pass for memory-system hardening
**Error:** assumed stale CLI commands (`qmd index`, `qmd stats`) and initially created the wrong collection by using `qmd collection add .` without an explicit path/name, which indexed the global QMD package instead of the Marvin workspace
**Context:** wiring `.learnings/*` and durable memory into a reliable QMD-backed recall workflow
**Suggested fix:** validate the installed QMD binary first, use collection-based setup (`qmd collection add /data/.openclaw/workspace --name marvin-workspace`), and refresh with `qmd update` instead of inventing per-file indexing commands
**Resolution:** Fixed on 2026-03-19 by creating the explicit `marvin-workspace` collection, adding collection context, and updating `scripts/index_memory_health.sh` to maintain the real workspace collection

**Priority:** medium
**Status:** resolved


## [ERR-20260318-0039]

**What failed:** initial Mission Control preview route via host nginx
**Error:** nginx alternated between syntax/config failures, broken-site symlink confusion, and `502 Bad Gateway` until the app/upstream boundary was corrected
**Context:** exposing `preview.motiondisplay.cloud` for the Mission Control Next.js app on the Hostinger VPS
**Suggested fix:** when previewing apps that live inside the OpenClaw container, do not assume the app exists on host loopback. First confirm where the app process actually runs, start it bound to `0.0.0.0` inside the container if needed, verify host reachability to the container-side target, then point host nginx at that reachable upstream
**Resolution:** Fixed on 2026-03-18 by proxying host nginx to the container-side Mission Control app target (`172.18.0.2:3005`) instead of `127.0.0.1:3005`

**Priority:** high
**Status:** resolved

## [ERR-20260317-1844]

**What failed:** initial SearXNG endpoint assumption after enabling JSON
**Error:** testing initially used stale external port `32768`, but the live Docker publish had shifted to `32769`, causing false-negative connection failures during verification
**Context:** post-config verification of SearXNG JSON output on the Hostinger VPS
**Suggested fix:** before testing self-hosted search services, confirm the current published port with `docker ps` instead of assuming the earlier exposed port is still valid after restart/redeploy
**Resolution:** Fixed on 2026-03-17 by checking `docker ps`, identifying `0.0.0.0:32769->8080/tcp`, and re-testing successfully against the correct endpoint

**Priority:** low
**Status:** resolved

## [ERR-20260317-1736]

**What failed:** attempted Hostinger nginx → OpenClaw Control UI reverse-proxy exposure for `openclaw.motiondisplay.cloud`
**Error:** even after `gateway.bind` was changed from `loopback` to `lan` and the OpenClaw container was fully restarted, the live OpenClaw listener remained reachable only on container-local `127.0.0.1:18789` and not on the container IP / host nginx path, producing host resets and `502 Bad Gateway`
**Context:** pre-update preparation for a future OpenClaw upgrade; goal was to secure Control UI access over HTTPS before attempting any version bump, while preserving Mission Control hybrid stability
**Suggested fix:** if revisiting, treat the current Hostinger Docker deployment as potentially non-host-proxyable in local mode until proven otherwise; start from VPS snapshot + checkpoint package and prefer a controlled-access path unless newer OpenClaw docs/releases explicitly support a cleaner exposure pattern
**Resolution:** attempt was rolled back on 2026-03-17 by reverting `gateway.bind` to `loopback` and disabling the unfinished nginx site

**Priority:** high
**Status:** resolved

## [ERR-20260317-1245]

**What failed:** runner-backed cron singleton protection in `scripts/cron_runner.py`
**Error:** non-atomic lock-file check/create allowed near-simultaneous duplicate executions of the same job
**Context:** Philippe reported duplicate Telegram sends for `pre-market-brief` and `trading-daily-report`; investigation also showed duplicates on other runner-backed jobs
**Suggested fix:** use atomic lock creation (`O_CREAT | O_EXCL`) at the runner boundary and keep stale-lock recovery separate from acquisition
**Resolution:** Fixed on 2026-03-17 by switching `cron_runner.py` to atomic lock creation and verifying with a forced concurrency test (first run completed, second skipped with active lock)

**Priority:** high
**Status:** resolved


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

## [ERR-20260319-1635]

**What failed:** first shadow validation path for the isolated trading container
**Error:** host-side validation got tripped by multiple environment-boundary issues: copied compose/runtime artifacts still referenced in-container absolute paths, host-side bind mounts overrode `/app` with non-existent `/data/...` paths, and `WEBHOOK_HOST=0.0.0.0` was rejected by the receiver's localhost-only bind protection
**Context:** validating the new dedicated trading-path container prototype on the Hostinger VPS after the egress-isolation design work
**Suggested fix:** for first validation of containerized workloads copied out of the OpenClaw container, prefer the simplest working path (`docker run`) over debugging compose/bind-mount drift; keep shadow validation local-only (`WEBHOOK_HOST=127.0.0.1`, host bind `127.0.0.1:18000`); treat host/container absolute-path assumptions as suspect until verified
**Resolution:** resolved enough for prototype validation on 2026-03-19 by switching to direct `docker run`, setting `WEBHOOK_HOST=127.0.0.1`, and confirming the isolated shadow container starts cleanly in paper-only safe mode

**Priority:** medium
**Status:** resolved

---

## [ERR-20260323-1845]

**What failed:** first focused synthetic validation for the Market Intel cross-sector execution-candidate expansion
**Error:** attempted to import and call `build_primary_instrument` from `projects/market-intel/src/execution_candidates.py`, but the module exposes `choose_primary_instrument` instead
**Context:** validating rare-earth / industrial-automation routing and execution-candidate mapping after expanding value-chain sector coverage
**Suggested fix:** when building focused validation harnesses for execution-candidate work, inspect the module’s actual public helper names first and use `choose_primary_instrument` for top mapped instrument selection
**Resolution:** resolved on 2026-03-23 by switching the validation harness to `choose_primary_instrument` and re-running the synthetic tests successfully

**Priority:** medium
**Status:** resolved

## [ERR-20260323-1846]

**What failed:** defense-sector direct company detection during synthetic validation
**Error:** negative-title hint matching used raw substring checks, so `miss` could incorrectly fire inside domain words like `missile`, which could flip a directly mentioned defense company to the wrong direction bias
**Context:** validating newly added defense supply-chain routes in `projects/market-intel/src/execution_candidates.py`
**Suggested fix:** for sentiment/direction keyword checks, use phrase-aware or token-boundary-aware matching instead of raw substring scans when sector vocabulary contains overlapping fragments
**Resolution:** resolved on 2026-03-23 by making `NEGATIVE_TITLE_HINTS` checks boundary-aware inside `detect_company_candidates()`

**Priority:** high
**Status:** resolved

## [ERR-20260323-1847]

**What failed:** healthcare-imaging company mapping specificity during synthetic validation
**Error:** generic `siemens` direct matching leaked into `Siemens Healthineers` headlines, pulling the wrong parent-company mapping into healthcare-equipment routing
**Context:** validating `healthcare_equipment / medtech_systems / imaging_diagnostics` coverage in `projects/market-intel/src/execution_candidates.py`
**Suggested fix:** when a generic parent-company token overlaps a more specific operating-unit phrase, suppress the generic direct match if the more specific phrase is present
**Resolution:** resolved on 2026-03-23 by preferring `siemens healthineers` over generic `siemens` during direct company detection

**Priority:** medium
**Status:** resolved

**Error:** `minimax2.7` alias resolved and runtime restart succeeded, but actual message send returned `HTTP 404: 404 page not found` — even after switching baseUrl from `api.minimax.chat` to `api.minimax.io/v1`.
**Root cause:** The MiniMax provider was configured without an explicit `api` adapter, causing OpenClaw to fall back to the wrong transport family. The fix required switching to `api: "anthropic-messages"` with `baseUrl: "https://api.minimax.io/anthropic"` — the Anthropic-compatible path, not the bare `/v1` path.
**Lesson:** When 404 survives a clean provider/alias setup, it is almost always a transport/API-contract mismatch, not a credential or hostname problem. Diagnostic path: (1) read provider's official API docs, (2) read OpenClaw's own provider docs, (3) compare both against current config, then (4) apply the minimum transport-layer fix. Never stack speculative config edits for a 404 — always get the contract right first.
**Resolution (2026-03-20):** Applied `baseUrl: "https://api.minimax.io/anthropic"` + `api: "anthropic-messages"` + corrected `contextWindow: 204800`. Live generation test returned clean "MINIMAX_M27_OK" in ~5s. Both `codex5.4mini` and `minimax2.7` are now confirmed working.


## [ERR-20260324-1530]

**Error:** Duplicate React import in multiple component files after using sed to bulk-add `import { Icon } from './Icon'`.
**What happened:** Components that already had `import { Icon }` got a second identical import line, causing `SyntaxError: Duplicate import` at build time.
**Fix:** Deduplicate Icon imports with a Python script that keeps only the first occurrence per file.
**Prevention:** Use a dedup-aware sed replacement or check for existing imports before bulk-adding.

## [ERR-20260324-1516]

**Error:** GitHub Pages showing 404 despite files being present on the correct branch.
**What happened:** After pushing a new commit to `gh-pages`, GitHub Pages was still serving the old build from cache. GitHub Pages in legacy/static mode does not auto-rebuild from the branch — it needs either a new workflow trigger or the Pages settings to be re-saved.
**Fix:** Pushed an empty commit (`git commit --allow-empty`) to force a new Pages build.
**Prevention:** After switching Pages modes or pushing a significant change, always verify with `curl` that the new assets are being served. If 404 persists, check `gh api repos/USER/REPO/pages` for the current Pages config.

## [ERR-20260324-1510]

**Error:** npm install failing with "API rate limit reached" during lucide-react installation.
**What happened:** npm registry has separate rate limits from the MiniMax API used for AI tasks. The 12% Philippe saw in the MiniMax dashboard was unrelated — it was npm's own rate limiting.
**Fix:** Waited and retried; succeeded on retry.
**Prevention:** If npm rate limits are frequent, consider using a `.npmrc` with a personal access token, or pre-bundle icon fonts.

## [ERR-20260324-1505]

**Error:** Vite build output had wrong asset paths — `/assets/` instead of `/atelier-bot-dashboard/assets/`.
**What happened:** The original Vite config had no `base` set. In development (served from `localhost:5173/`) assets resolve correctly at `/assets/`. But on GitHub Pages at `https://USER.github.io/atelier-bot-dashboard/`, the browser looks for `/assets/` at the root, not `/atelier-bot-dashboard/assets/`.
**Fix:** Rebuilt with `npm run build -- --base /atelier-bot-dashboard/`.
**Prevention:** Always set the Vite `base` option for subpath deployment before the first production build.

## [ERR-20260324-1420]

**Error:** Material Symbols font showing as text (icon names) instead of rendered icons in production.
**What happened:** Google Fonts CDN for Material Symbols was blocked or not reaching the browser in the GitHub Pages production environment. The CSS loaded but the actual font files (WOFF2) were not accessible.
**Fix:** Replaced Material Symbols with Lucide React, which bundles icons as React components with no external CDN dependency.
**Prevention:** For production deployments, prefer self-contained icon libraries (Lucide React, Heroicons) over icon fonts that require external CDN access.


## [ERR-20260324-1700]

**Error:** Codex builds visually correct layouts but loses color fidelity from Stitch.
**What happened:** When Codex reads the Stitch HTML, it sees rendered Tailwind utility classes (e.g. `bg-surface-container`) not the underlying Material Design 3 CSS custom properties. Codex invents its own Tailwind class names or hardcoded values, missing the actual design token values.
**Specific losses observed:**
  - `surface-container` classes rendered as plain white instead of the actual light grey
  - Bar chart colors wrong (Tailwind opacity notation like `bg-secondary/10` not producing visible results in production)
  - Border color using Tailwind's default black instead of the translucent `rgba(193,198,215,0.3)`
  - Active nav state losing the blue text color
**Fix:** Extract design tokens from the Stitch HTML before handing it to Codex. Include explicit hex values and effect tokens in the Codex prompt.
**Prevention:** Make design token extraction Step 0 of every Stitch → Codex workflow.

## [ERR-20260324-1701]

**Error:** Lucide React icons don't match Stitch's Material Symbols icons.
**What happened:** Lucide is a different icon set with different glyphs. "dashboard" in Lucide looks different from "dashboard" in Material Symbols. Some icons (e.g. the pulsing green dot) require custom SVG work rather than a library mapping.
**Fix:** For future projects, try to get Material Symbols working first (self-host the WOFF2 font). If that fails, accept that Lucide is a close approximation, not an identical match.
**Prevention:** Note this as an expected tradeoff in the runbook.

## [ERR-20260324-1702]

**Error:** Tailwind's `bg-secondary/10` and similar opacity notation renders differently in production than in dev.
**What happened:** Tailwind CDN in dev handles opacity-suffixed classes fine. In production build, the specificity and actual color output can differ. Codex also doesn't reliably reproduce these notations when building new components.
**Fix:** Use explicit RGBA or hex values for any translucent backgrounds rather than Tailwind opacity suffixes.
**Prevention:** In design token extraction, convert all opacity-suffixed classes to explicit rgba() values.

## [ERR-20260324-1703]

**Error:** Codex interprets "soft shadow" or "glass panel" differently from Stitch's actual implementation.
**What happened:** Codex sees Stitch's glass panel and generates `backdrop-blur-md` but without the correct border treatment, resulting in panels that look like flat white boxes with thin black borders instead of the subtle translucent effect.
**Fix:** Extract the exact CSS from Stitch's `<style>` blocks and include it as inline style guidance in the Codex prompt.
**Prevention:** Add glass panel and shadow CSS tokens to the mandatory design token extraction step.

## [ERR-20260324-1704]

**Error:** Design System screen in Stitch uses an internal `asset-stub-assets-...` ID that is not retrievable via MCP API.
**What happened:** Philippe's Stitch export instructions referenced a Design System screen with an asset-stub ID. The MCP API returns "entity not found" for this ID type.
**Fix:** Design tokens must be extracted from the actual screen HTML, not from a separate Design System reference. The screen HTML contains all the colors and CSS needed.
**Prevention:** Do not rely on separate Design System screen exports via MCP. Always extract from screen HTML.


## [ERR-20260324-1955]

**Error:** Could not start Mission Control preview using `vercel dev` / `preview.motiondisplay.cloud` from the VPS.
**What happened:** The `restart-preview.sh` script uses `vercel dev` which creates a Cloudflare tunnel at `preview.motiondisplay.cloud`. This requires the `VCF_BEARER_TOKEN` environment variable to authenticate with Vercel, which is only set on Philippe's local machine. On the VPS, `vercel dev` hangs on authentication.
**Fix:** Documented the limitation. The script must be run from Philippe's local machine where Vercel CLI is authenticated.
**Prevention:** For future Mission Control preview work, either (a) run `vercel dev` locally, or (b) push to GitHub for Vercel auto-deploy to a preview URL.


## [ERR-20260325-0020]

**Error:** Codex exec context cannot write to `memory/mission-control-preview/` directory.
**What happened:** When Codex tries to run the preview helper script, it fails with EACCES permission errors trying to write `latest.pid` and `latest.log`. The script itself works fine when run directly as `node` user.
**Root cause:** Codex exec runs in a sandboxed environment with restricted filesystem access. The preview helper writes to `memory/mission-control-preview/` which may have different permissions in the Codex sandbox context.
**Fix:** For preview operations during Codex sessions, run the preview script directly from the main Marvin session rather than inside Codex exec. Alternatively, run as `node` user directly: `bash scripts/preview-start.sh`
**Prevention:** Don't route preview start/stop through Codex exec. Handle from main session or use a detached exec with proper permissions.

## 2026-03-28 — Mission Control WS bridge pitfalls
- Symptom cluster during Mission Control runtime-bridge work: repeated `CONNECT.CHALLENGE` storms, websocket session rejection, preview-origin/sidecar 502s, and proxy crashes.
- Reusable lessons:
  1. Do not let the main websocket effect depend on the entire refreshed runtime summary object; polling refreshes will tear down and recreate a healthy socket, producing fake instability loops.
  2. Gateway websocket identity matters exactly: using an invented `client.id` / `mode` can trigger schema rejection even when transport is otherwise fine. Align with the accepted control-ui identity when reusing that gateway lane.
  3. Websocket proxies must not pass reserved close codes (`1005`, `1006`, etc.) into `ws.close(...)`; normalize to actually valid close codes or the proxy process will crash and surface as misleading 502s.
  4. For sidecar -> gateway hops, explicit upstream `Origin` may be necessary; browser allowlisting alone may not fix origin rejection if the gateway validates the upstream websocket origin separately.
  5. After gateway restarts, the Mission Control preview stack can split-brain: preview proxy/sidecar may remain up while the internal Next server is down, producing 502s that are preview-stack failures, not app-code failures.

## [ERR-20260329-1234]

**What failed:** first live wiring pass for Mission Control Chat top controls
**Error:** browser hit `Application error: a client-side exception has occurred` after wiring Agent / Model / Effort controls all at once
**Context:** Mar 29 Mission Control Chat top-section iteration after the title/layout cleanup
**Suggested fix:** reintroduce risky control behavior incrementally: first UI-only dropdown shells, then model switching only, then effort switching, then reset hardening; do not wire multiple live control paths at once on this surface
**Resolution:** Fixed on 2026-03-29 by backing out the aggressive control wiring, restoring stability, and reintroducing controls in smaller verified steps

**Priority:** high
**Status:** resolved

## [ERR-20260329-1240]

**What failed:** Mission Control preview restart after UI build
**Error:** helper start path hit `EADDRINUSE` on 3005/3006/3007, leaving stale processes and mismatched runtime/assets that surfaced as browser instability and misleading app failures
**Context:** Mar 29 Chat-top iteration during repeated preview rebuilds
**Suggested fix:** after meaningful Mission Control UI changes, do a real stop/build/start cycle and verify all three layers (Next, proxy, WS sidecar); do not assume a helper exit means the preview stack is clean
**Resolution:** Resolved operationally on 2026-03-29 by repeatedly using the preview runbook scripts and verifying `http://127.0.0.1:3005/general/chat` returns 200 after restart

**Priority:** high
**Status:** resolved

## [ERR-20260329-1545]

**What failed:** top-strip model/effort confirmation behavior under auto-refresh
**Error:** auto-refresh could overwrite pending model/effort state with stale intermediate summary data, causing temporary regressions like old model labels or fake fallback effort labels until manual refresh or a later readback cycle corrected the UI
**Context:** Mar 29 Mission Control Chat top-control hardening after live testing across Codex, MiniMax, and Qwen model/thinking transitions
**Suggested fix:** keep explicit pending model/effort state and only clear it when runtime readback confirms the requested target; do not let intermediate auto-refresh summaries trample pending state too early
**Resolution:** Fixed on 2026-03-29 by adding pending confirmation gates and by carrying `thinkingLevel` from `openclaw status --json` through the Mission Control adapter/surface path

**Priority:** high
**Status:** resolved

## [ERR-20260401-2230]

**Context:** Mission Control feature implementation and preview verification
**What failed:** Multiple coding passes committed cleanly inside the nested `projects/mission-control` repo, but the outer workspace still had unwrapped file changes. That created repeated moments where a feature looked finished in the subrepo yet was not fully live in the main workspace flow until an outer-workspace commit + preview restart happened.
**Prevention:** For Mission Control work, treat nested-repo completion as intermediate only. Before telling Philippe a feature is live, always do the outer-workspace wrap, restart the preview, and perform one light verification pass against the integrated version.
**Status:** resolved
**Closed:** 2026-04-02 (rule is now documented in MEMORY/TOOLS and applied operationally)

## [ERR-20260401-2228]

**Context:** Mission Control autonomous task result normalization
**What failed:** Artifact/result parsing was too eager and treated injected/bootstrap workspace files like `AGENTS.md`, `SOUL.md`, and `TOOLS.md` as if they were real output artifacts. It also allowed metadata-only runner envelopes to become visible review summaries or toast text.
**Prevention:** Exclude bootstrap/context files from artifact selection, detect metadata-only runs explicitly, and never let raw runner-envelope JSON become the human-facing headline summary for Tasks/toasts.
**Status:** resolved
**Closed:** 2026-04-02 (artifact filtering and metadata-only handling were patched during Apr 1 stabilization work)


## [ERR-20260402-1737]

**Context:** Mission Control manual task execution with explicit model override
**What failed:** The manual task runner attempted model selection by sending a separate `/model <alias>` message before execution, but the run still executed on the default MiniMax route. Because the runner did not validate the effective model afterward, the task could silently succeed on the wrong model.
**Prevention:** For Mission Control task execution, treat requested model override as untrusted until validated against actual run metadata. If the effective provider/model does not match the requested override family, fail visibly instead of continuing.
**Status:** resolved
**Resolved:** 2026-04-02 late evening — model override validation added to task runner; mismatch now surfaces as visible error.

## [ERR-20260402-1756]

**Context:** Mission Control Chat transcript hydration / merge
**What failed:** A later hydration pass could append an older persisted transcript snapshot and then trim by array position, allowing older hydrated history to displace newer live messages. This caused visible transcript rewind/disappearance after refresh or runtime updates.
**Prevention:** Hydrated transcript merges must be keyed, timestamp-aware, and overwrite-safe. Never rely on append-order + tail-trim for mixed live/hydrated message streams.
**Status:** resolved
**Resolved:** 2026-04-02 late night — timestamp-aware merge in `useRuntimeBridge.ts`; overwrite-safe, older snapshots cannot rewind live state.

## [ERR-20260404-1253]

**Context:** Mission Control preview restart after Files/Memory editor package cleanup
**What failed:** `ws` was briefly removed as if it were stray package noise, but Mission Control's preview-side runtime scripts (`scripts/runtime-bridge-ws-sidecar.js` and `scripts/preview-origin-proxy.js`) require it directly. Result: `next build` and `next start` could succeed while the preview helper still failed its final health check on port 3005 with `Cannot find module 'ws'` in `.preview-runtime/latest.log` / `ws-sidecar.log`.
**Prevention:** Treat preview/sidecar scripts as first-class runtime dependencies when pruning packages. A passing Next.js app build does not prove the preview stack is healthy; verify the proxy/sidecar path too.
**Status:** resolved
**Resolved:** 2026-04-04 afternoon — restored `ws` dependency and reran build + preview restart successfully.

## [ERR-20260406-1309]

**What failed:** Mission Control Skills manual tags and hidden items looked persistent but reset across browser/session/origin changes
**Error:** `components/pages/SkillsWorkspaceClient.tsx` stored skills UI state only in browser `localStorage` (`mission-control:skills:hidden` / `mission-control:skills:tags`), so the feature had no workspace-backed truth and could silently fall back to an empty state outside the original browser context
**Context:** Apr 6 live Mission Control Skills pass after Philippe reported the previously created manual tags and hidden items were gone and the page was back to square one
**Suggested fix:** if Mission Control UI implies durable custom state, store it in a real workspace-backed file/API path instead of local browser state alone; use localStorage only as a migration/cache layer, not as the primary truth source
**Resolution:** Fixed on 2026-04-06 by adding `app/api/skills/preferences/route.ts`, persisting to `projects/mission-control/data/skills-ui-state.json`, and migrating old localStorage state into the new server-backed store when appropriate

**Priority:** high
**Status:** resolved

## [ERR-20260406-1322]

**What failed:** Mission Control Skills `Read more` control only worked reliably after a skill card had already been expanded
**Error:** the trigger lived inside the collapsed `<summary>` region of a `<details>` card, so summary-toggle behavior interfered with the independent button action while the card was still closed
**Context:** Apr 6 immediate live follow-up after the first Skills long-summary improvement landed and Philippe reported the new button did not actually work on closed cards
**Suggested fix:** for Mission Control surfaces using `<details>/<summary>`, do not place important independent controls inside collapsed summary regions when they must work before expansion; move the action outside the `<summary>` block or use a different card interaction model
**Resolution:** Fixed on 2026-04-06 by moving the `Read more` / `Close summary` trigger out of the `<summary>` block and into the card body below the collapsed preview text

**Priority:** medium
**Status:** resolved

## [ERR-20260407-1132]

**Context:** `projects/autonomous-trading-bot/scripts/signal_accuracy_report.py`
**What failed:** The report script instantiated `AlpacaPaperAdapter` without loading the bot project's `.env`, so paper-account position fetches returned `401 unauthorized` even though the project credentials were valid.
**Prevention:** Standalone maintenance/report scripts that depend on broker/runtime credentials must load the same minimal env inputs as the live runtime or explicitly fail with a clear missing-env error; do not assume a parent cron/process exported them.
**Status:** resolved
**Resolved:** 2026-04-07 — report script now loads minimal Alpaca/PAPER env from project `.env` before broker calls.

## [ERR-20260407-1741]

**Context:** Mission Control Sudo panel featured-run selection
**What failed:** The Sudo panel preferred any older still-active waiting run over a newer completed run, so a finished task could appear to snap back to an earlier `Philippe needed` state.
**Prevention:** Multi-run orchestration UIs should feature the newest run by recency and demote older unresolved runs into history; do not use generic "any active run first" selection when multiple orchestration records can coexist.
**Status:** resolved
**Resolved:** 2026-04-07 — Sudo panel now sorts by recency and features the newest orchestration first.

## [ERR-20260409-1500]

**What failed:** first-use direct-specialist workspace state write for Japin / `language-tutor`
**Error:** `ENOENT: no such file or directory, rename ...workspace-state.json.tmp-... -> ...workspace-state.json` during early specialist-seat interaction
**Context:** Apr 9 Mission Control testing after Philippe first used Japin directly and reported a workspace-state rename failure
**Suggested fix:** OpenClaw's workspace-state atomic-write temp filename should not rely only on `process.pid` + `Date.now()`. Add a collision-resistant random suffix (or equivalent uniqueness guarantee) before rename so same-process same-millisecond writes cannot collide.
**Resolution:** Root cause traced on 2026-04-09 to the installed OpenClaw runtime temp-file naming logic. Mission Control itself was not the bug. Runtime hotfix was identified but not applied from this session because the installed package path was permission-blocked and host/container patch context differed.

**Priority:** medium
**Status:** pending host/runtime patch if the issue returns

## [ERR-20260409-1530]

**What failed:** first host-side patch instructions for an installed OpenClaw runtime file
**Error:** the suggested patch path existed from inside the container session but not from Philippe's host terminal, causing file-not-found and command-friction while attempting a hotfix
**Context:** Apr 9 follow-up while trying to patch the OpenClaw temp-file collision bug after tracing it in the installed package
**Suggested fix:** For runtime/package hotfixes in this Docker-based Hostinger setup, do not give host-level patch commands until the actual container/runtime path is confirmed. Start with `docker ps`, inspect the path inside the real container, then patch in the correct namespace.
**Resolution:** Operational lesson captured; hotfix itself was deferred once other things came up.

**Priority:** medium
**Status:** resolved as procedural lesson
