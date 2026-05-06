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


## [ERR-20260430-1807]

**What failed:** Initial Lab provider-enrichment validation briefly read stale runtime/cache behavior after source changes.
**Error:** The existing Lab preview could still serve older compiled code or old ticker-profile cache JSON, making AAPL.US appear unenriched even after the new yfinance/FinanceDatabase code path compiled.
**Context:** During the Mission Control Lab Trading FinanceDatabase + yfinance integration, provider code was changed under `projects/mission-control-lab`, then ticker pages were checked while the running preview/caches had not fully reflected the new build path.
**Suggested fix:** For provider/source changes, validate against a fresh build/start or restarted Lab preview, clear the relevant `data/trading/ticker-profiles/*.json` cache files, then inspect both route status and generated cache JSON before concluding enrichment failed. Treat stale preview evidence as weaker than fresh-server/cache evidence.
**Resolution:** Resolved the same block by running `npx tsc --noEmit`, `npm run lint`, `npm run build`, smoking a fresh production server on port 3099, restarting Lab preview, running `scripts/lab-health.sh`, clearing affected ticker caches, and confirming AAPL.US / ASML.AS / VCB.VN had yfinance-backed market cap, P/E, estimates, and ownership.

**Priority:** medium
**Status:** resolved

## [ERR-20260427-1212]

**What failed:** Ad-hoc Mission Control ops learnings were saved as a standalone project `_ops` note instead of structured `.learnings/` entries
**Error:** `projects/_ops/mission-control-dashboard-learnings-2026-04-22.md` mixed reusable lessons, stale operational state, and sensitive access details in a clutter-prone project doc.
**Context:** During Morning Meeting cleanup, Philippe found the file and asked to mirror useful content into the real learnings system, then remove the stray note.
**Suggested fix:** Put reusable failures and operating lessons in `.learnings/errors.md` or `.learnings/corrections.md`; keep project `_ops` docs for current runbooks/savepoints only. Never store raw gateway tokens, Basic Auth credentials, or similar live access details in ad-hoc learnings docs; use redacted placeholders and point to the proper secret store/runtime config.
**Resolution:** Mirrored the durable lessons into structured learnings and removed the stray `_ops` dashboard-learnings file.

**Priority:** high
**Status:** resolved

## [ERR-20260422-2200]

**What failed:** Mission Control Dashboard and native OpenClaw Control UI were blurred during early dashboard exposure planning
**Error:** `dashboard.motiondisplay.cloud` successfully exposed the custom Mission Control Next.js app, while the native OpenClaw gateway/control UI remained a separate loopback-bound surface. Treating them as one product confused routing and access expectations.
**Context:** Apr 22 dashboard work brought Mission Control live behind nginx/HTTPS/Basic Auth, but the OpenClaw gateway socket was still only reachable on container loopback despite config/status suggesting a broader bind.
**Suggested fix:** Keep the two browser surfaces explicit: Mission Control is the custom operator app on the 3005/3006/3007 lane; native OpenClaw Control UI/Gateway is the gateway surface on its own port and auth model. When exposing or diagnosing either, verify the actual socket and route path instead of relying on config/status wording alone.
**Resolution:** Later Mission Control lane docs and runtime notes separated Dashboard/Lab/Preview surfaces; this entry preserves the reusable lesson from the stray ops note.

**Priority:** medium
**Status:** resolved

## [ERR-20260426-2334]

**What failed:** Mission Control Lab recovery used a broad/shared process-group kill during a live Gateway/Dashboard/Lab session
**Error:** Killing the supervisor process group while trying to resolve a Lab build/restart race disrupted Gateway connectivity and forced Philippe to manually restart the Gateway.
**Context:** During Moonshine STT worker optimization, Lab supervision had invoked a rebuild-heavy restart path. I correctly identified the restart/build race, but recovery crossed the safety boundary by using a process-group kill in a shared container instead of pid-file/port-scoped service scripts.
**Suggested fix:** For Mission Control Dashboard/Lab recovery, never kill broad/shared process groups or global process patterns. Use maintenance locks, pid-file scoped stop/start scripts, and port-scoped cleanup only. If process ownership is unclear, inspect and pause instead of acting. Runtime supervisor restarts must not rebuild; rebuilds are deliberate promotion/dev actions.
**Resolution:** Recovered Gateway after Philippe's manual restart, restored Dashboard and Lab health, changed service restart paths to avoid rebuild-on-supervisor-restart, and validated Dashboard/Lab with worker health plus lane smoke.

**Priority:** critical
**Status:** resolved



## [ERR-20260426-1611]

**What failed:** Mission Control Lab rebuild under active supervisor
**Error:** Lab `next build` hit file-race failures such as `ENOENT ... .next/static/.../_buildManifest.js.tmp...` because the Lab foreground supervisor auto-restarted the runtime while a manual clean build was manipulating `.next`. Earlier build attempts also risked double-build locks.
**Context:** While validating a small Mission Control chat UI patch, Lab was correctly used as the experimental surface, but the newly persistent Lab supervisor kept trying to heal/restart during manual rebuilds. That made the experimental lane noisy and could have caused misleading app/build failures.
**Suggested fix:** Supervisors for Dashboard and Lab should respect explicit maintenance locks before health-check restarts. Manual promotion should create the lock, stop the bundle, rebuild and verify artifacts, then remove the lock and let the supervisor resume/start cleanly.
**Resolution:** implemented maintenance-lock awareness in both Mission Control service runners using `.preview-runtime/maintenance.lock` for Dashboard and `.lab-runtime/maintenance.lock` for Lab. Lab rebuild under lock then passed lint/build/artifact checks, health, and lane smoke. Dashboard promotion used a guarded stop/build/artifact/start/health/smoke sequence.

**Priority:** high
**Status:** resolved


## [ERR-20260426-1451]

**What failed:** Mission Control Dashboard promotion/restart after Lab-first UI patch
**Error:** `dashboard.motiondisplay.cloud` showed `Mission Control preview proxy could not reach the Next.js server`; dashboard proxy stayed alive on `3005`, but internal Next on `3007` was not running. Dashboard `.next` was missing production artifacts including `build-manifest.json`, `prerender-manifest.json`, `routes-manifest.json`, `server/pages-manifest.json`, and `server/app-paths-manifest.json`.
**Context:** While applying a small Mission Control chat UI patch, Lab remained available but Dashboard was touched before the stable-lane promotion gates were strict enough. A build/restart race and incomplete `.next` state caused Dashboard to break even though the proxy process was still up.
**Suggested fix:** enforce a stable Dashboard promotion gate: source lint/build first, Lab copy/build/restart/health/lane-smoke second, then Dashboard-only stop, clean build, artifact verification, start, service health, and public lane smoke. Do not claim success from proxy PID or partial local health. If `.next` artifacts are missing, stop Dashboard bundle, `rm -rf .next`, rebuild, verify artifacts, then start.
**Resolution:** operationally recovered the same day by stopping the Dashboard bundle, deleting `.next`, running `npm run build`, verifying required artifacts, starting the service, and passing Dashboard health plus lane smoke for dashboard/lab/preview.

**Priority:** high
**Status:** resolved


## [ERR-20260424-1142]

**What failed:** Mission Control live dashboard websocket stayed stuck after the socket opened on the real host
**Error:** `dashboard.motiondisplay.cloud` could open the runtime socket and receive `connect.challenge`, but Chat flickered through repeated reconnects and could remain stuck on `Runtime socket is open. Waiting for gateway handshake.` even though the sidecar was already sending `mc-server-connect` server-side.
**Context:** After landing the first R5 live-websocket slice, Philippe tested the real dashboard host and reported handshake flicker plus a stuck waiting-for-handshake state. Local proxy/sidecar logs showed the browser websocket closing repeatedly right after challenge, pointing to a client-side stability bug rather than a pure routing failure.
**Suggested fix:** keep post-connect websocket subscription helpers stable during server-owned handshake. Avoid closing over volatile React state like `session.state` inside the callback that the websocket effect depends on; use the latest session-state ref instead so the effect does not tear down and recreate the socket mid-handshake.
**Resolution:** partially resolved the same day in multiple steps: first by changing `subscribeToActiveSession(...)` in `projects/mission-control/hooks/useRuntimeBridge.ts` to read `latestSessionStateRef.current` and to drop `session.state` from the callback dependency list, which restored a proper hello on `dashboard.motiondisplay.cloud`; later by widening HTTP-backed recovery behavior, fixing the handshake badge to show `Recovering`, and finally changing the chat boot path plus first runtime-bridge load path to use a fresh orchestrator summary instead of a deferred placeholder. Philippe's live hard-refresh handshake improved from roughly 43.6s to 22.5s and then 19.4s, but the remaining slow post-challenge gap is not fully eliminated yet.

**Priority:** high
**Status:** pending

## [ERR-20260424-0955]

**What failed:** canonical daily memory stayed clean after several savepoint/session-preservation passes
**Error:** non-canonical date-suffixed memory sidecar files accumulated alongside normal daily notes, for example `memory/2026-04-23-task-generator.md`, `memory/2026-04-23-runtime-bridge.md`, `memory/2026-04-23-bridge-proof.md`, and `memory/2026-04-24-ws-patch.md`. They contained partial transcript spillover / session-export style content and later forced a manual merge back into `memory/YYYY-MM-DD.md`.
**Context:** Apr 24 Morning Meeting self-improvement cleanup found duplicated chronology inside `memory/2026-04-23.md` and several adjacent sidecar files that were not part of the intended canonical memory layout.
**Suggested fix:** if session-preservation or pre-compaction helpers need temporary spillover artifacts, keep them outside the canonical `memory/YYYY-MM-DD.md` lane or add an explicit bounded merge/cleanup step so raw sidecars do not accumulate as if they are first-class daily memory.
**Resolution:** operationally resolved Apr 24 by merging unique content into canonical daily memory, deleting the redundant sidecar files, and preserving only the canonical notes. Root creating mechanism still uncertain, but this sidecar pattern should be treated as cleanup-required rather than canonical.

**Priority:** medium
**Status:** resolved

## [ERR-20260423-1205]

**What failed:** `daily-task-generator` successful morning run gave no Telegram announcement and left backlog underfilled
**Error:** the job finished with `summary: NO_REPLY` / `deliveryStatus: not-delivered`, because the cron contract combined announce-style delivery with `NO_REPLY`; separately, `scripts/daily-task-generator.py` generated a shallow first-pass set of tasks that were all later filtered as recent/done/suppressed duplicates, but it did not keep searching for alternate same-goal tasks, so the backlog could stay at 1 even after a nominally successful run.
**Context:** Philippe noticed there was no usual `goal-tasks` Telegram message and no fresh Mission Control tasks on Apr 23 morning, even though cron status showed the job had run `ok`.
**Suggested fix:** keep delivery and reply contract aligned, for example by having the generator emit one canonical completion line for announce delivery instead of `NO_REPLY`; during generation, search alternate deterministic task variants for the same goal/genre when exact candidates are blocked so backlog refill survives dedupe/history filters.
**Resolution:** resolved the same day by patching `scripts/daily-task-generator.py` to generate alternate same-goal variants and print a final `🎯 Daily Tasks Generated: N new tasks added to Open Backlog` line, then updating the cron contract to announce that line to Telegram instead of suppressing delivery with `NO_REPLY`.

**Priority:** high
**Status:** resolved

## [ERR-20260422-1534]

**What failed:** completed autonomous tasks were still able to reappear in active backlog after generator reruns
**Error:** `scripts/daily-task-generator.py` deduped against active structured tasks and recent task-log completions, but existing-backlog carry-forward could still keep or reintroduce a stale regenerated task when the completed task identity differed slightly between sources, especially around category tags like `[Career]`.
**Context:** Apr 22 bounded cleanup of task-sync drift found one live duplicate for `Draft: Creative-tool automation script plan`, with one row already `done` and a later stale regenerated row still in `backlog`.
**Suggested fix:** when syncing generator output against board truth, compare task identity with a category-agnostic match key as well as the legacy first-line key, and block existing-backlog carry-forward when the task already exists in recent completions or structured `done` state.
**Resolution:** resolved the same afternoon by adding `normalize_task_match_key()`, extending completion/done-key collection to include match keys, and filtering existing-backlog carry-forward against both recent-completion and structured-done matches before rerunning the generator and reconciling the stale duplicate.

**Priority:** high
**Status:** resolved

## [ERR-20260422-0016]

**What failed:** first memory-flush attempt for `memory/2026-04-22.md`
**Error:** the session reported that the new daily memory entry had been appended, but an immediate follow-up read returned `ENOENT`, creating conflicting evidence about whether the file had actually been created/written on the first pass.
**Context:** after finishing the first Mission Control live-rollout plan, I tried to do the requested end-of-block memory save and got inconsistent tool/reporting history around the new daily file.
**Suggested fix:** after first-write creation of a new daily memory file, verify existence with an immediate read and treat any contradictory result as unresolved until re-read or rewritten cleanly. For important savepoints, do not rely on a single successful write message when the file did not previously exist.
**Resolution:** operationally worked around the same night by re-reading and then writing the durable carry-forward content again, after which `memory/2026-04-22.md` exists and contains the carry-forward summary.

**Priority:** medium
**Status:** resolved

## [ERR-20260421-2302]

**What failed:** Mission Control preview restart after final Agents-page polish
**Error:** `scripts/preview-stop.sh` relied on stale `.preview-runtime/*.pid` files, so the visible old preview stack kept running even after a documented restart flow. The old live processes had different PIDs than the files indicated.
**Context:** Philippe noticed the preview still had not actually reset after the first rebuild/restart attempt and explicitly asked me to read the project instructions and stop assuming the wrapper script had fully worked.
**Suggested fix:** preview stop logic must not trust PID files alone. For Mission Control preview, stop should use PID files first but also target known live preview processes and remaining listeners on ports `3005`, `3006`, and `3007`, with a fallback like `fuser` when `ss` is unavailable. Verify by confirming the ports are actually cleared before restart.
**Resolution:** Resolved the same night by hardening `projects/mission-control/scripts/preview-stop.sh` and committing `4e6de3c` (`Harden Mission Control preview stop script`).

**Priority:** high
**Status:** resolved

## [ERR-20260421-1811]

**What failed:** follow-up GPT-5.4 context-limit edit in `~/.openclaw/openclaw.json`
**Error:** config validation failed with:
- `models.providers.openai-codex.baseUrl: Invalid input: expected string, received undefined`
- `models.providers.openai-codex.models.0.name: Invalid input: expected string, received undefined`
**Context:** after an earlier unsuccessful attempt to raise GPT-5.4 from 200k to 250k, I made a bad follow-up edit to the provider config and broke the gateway-critical config shape.
**Suggested fix:** for OpenClaw config changes, do not improvise provider/model structure from memory. Verify the exact docs/schema first, preserve required keys like `baseUrl` and model `name`, and if full certainty is missing, stop and propose instead of mutating `openclaw.json`.
**Resolution:** Closed during the Apr 29 Morning Meeting because the durable safety rule is now captured in `MEMORY.md` Config Safety Rules and `TOOLS.md` Safety Constraints. Future OpenClaw config changes must verify docs/schema first, preserve required sibling fields, and stop/propose if certainty is not absolute.

**Priority:** critical
**Status:** resolved

## [ERR-20260421-1216]

**What failed:** first GPT-5.4 context-window override attempt
**Error:** putting `contextTokens` under `agents.defaults.models["openai-codex/gpt-5.4"]` did not affect live/default session context resolution for the generic provider path, so status stayed at `200000`.
**Context:** Philippe approved raising GPT-5.4 from 200k to 250k, and I first targeted the wrong config tree.
**Suggested fix:** for generic model context overrides, use the provider catalog path that context resolution actually reads, namely top-level `models.providers.<provider>.models[]` with `contextTokens` or `contextWindow`, or use `agents.defaults.contextTokens` only if a truly global override is intended. Expect existing sessions to keep their persisted context window until a new session or reset.

**Priority:** medium
**Status:** resolved

## [ERR-20260505-1232]

**What failed:** installed OpenClaw runtime updates surfaced deferred context-engine maintenance as user-visible background-task chat noise
**Error:** the running gateway auto-delivered `context_engine_turn_maintenance` state changes / terminal updates into chat, producing lines like `Background task update: Context engine turn maintenance...` and heartbeat-looking popups that were unrelated to the real 180-minute heartbeat cadence.
**Context:** Philippe reported the repeated popups were disruptive and polluting chat channels. Investigation showed the issue lived in installed OpenClaw dist runtime code, not `HEARTBEAT.md` scheduling.
**Suggested fix:** if the symptom returns after an update/reinstall, reapply the local guard in `/data/.npm-global/lib/node_modules/openclaw/dist/task-registry-DfxdgLn1.js` so `shouldAutoDeliverTaskTerminalUpdate(task)` and `shouldAutoDeliverTaskStateChange(task)` both early-return `false` for `taskKind === "context_engine_turn_maintenance"`, then activate it with a minimal gateway-only `SIGUSR1` restart and verify the reload completed.
**Resolution:** Hotfixed on 2026-05-05 and documented in `docs/runbooks/openclaw-context-maintenance-chat-spam-hotfix.md`. This remains a local installed-dist patch that can be overwritten by future OpenClaw updates.

**Priority:** high
**Status:** pending

## [ERR-20260421-1115]

**What failed:** main-session system-event cron jobs looked enabled but were skipped as `disabled`
**Error:** `workspace-home-improvement` and `Memory Dreaming Promotion` were still `enabled: true`, but because they depended on `sessionTarget: "main"` + `payload.kind: "systemEvent"`, disabling the main heartbeat/wake path caused cron to skip them with `lastError: "disabled"`.
**Context:** Morning Meeting investigation into why Dreaming and home-improvement did not run on Apr 21 even though the jobs still existed.
**Suggested fix:** do not treat this as manual job disablement or a task-logic failure. For jobs that do not truly need main-session injection, move them to isolated `agentTurn` execution with `delivery.mode: "none"`. For Dreaming, inspect memory-core implementation before editing cron, because the plugin reconciles the managed job back to a main-session heartbeat-dependent path.

**Priority:** high
**Status:** pending

## [ERR-20260420-1850]

**What failed:** first Mission Control Chat reload after a fresh preview restart still paid a very large websocket handshake delay even after the preview proxy and warm-path responsiveness fixes
**Error:** Philippe measured the first post-restart handshake at about `25.4s`, while subsequent reloads dropped to about `1.2s`, then `388ms` and `378ms`
**Context:** Apr 20 Mission Control responsiveness/debugging after the top-rail/runtime-summary regressions were fixed and the preview proxy path had already been improved
**Suggested fix:** treat this as a restart-only cold-path issue, not a general chat reload issue. When resuming, inspect preview startup/runtime warm state and the very first preview-path handshake after restart instead of reopening transcript, shell prefetch, or warm steady-state transport work.

**Priority:** medium
**Status:** pending


## [ERR-20260419-1207]

**What failed:** host-level verification attempt for webhook receiver systemd supervision
**Error:** `elevated is not available right now (runtime=direct). Failing gates: allowFrom ... provider=webchat`
**Context:** While hardening trading webhook supervision, I tried to check `systemctl status marvin-webhook-receiver.service` and related host-side runtime state from the current webchat session.
**Suggested fix:** From this direct webchat runtime, do not assume elevated host exec is available. If host/service-manager verification is required, either use an approved host-side path with explicit operator involvement or fall back to workspace-local mitigation and document the remaining limitation.

**Priority:** medium
**Status:** pending

## [ERR-20260419-1209]

**What failed:** pytest verification for trading webhook hardening
**Error:** `/usr/bin/python3: No module named pytest`
**Context:** After patching the webhook supervision scripts, I tried to run `python3 -m pytest tests/test_webhook_receiver.py -q` inside the container to verify the change.
**Suggested fix:** When the runtime container does not include pytest, do not block urgent shell/runtime hardening on that missing dependency. Verify behavior directly with health checks and failure-recovery tests, and reserve pytest runs for a dev/test environment that actually has the dependency installed.

**Priority:** low
**Status:** pending

## [ERR-20260418-1700]

**What failed:** Mission Control runtime bridge after the OpenClaw update
**Error:** Mission Control preview could load and show transcript/history, but the live websocket bridge kept retrying and then failed with `WS sidecar closed: origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)`.
**Context:** Apr 18 live Mission Control audit after the broader OpenClaw update path, while using preview through `preview.motiondisplay.cloud`
**Suggested fix:** if Mission Control sidecar/proxy sets an explicit upstream Origin header, do not rely on `dangerouslyAllowHostHeaderOriginFallback` alone. Add the real preview/browser origins to `gateway.controlUi.allowedOrigins`, reload the live gateway/runtime so the new policy is actually loaded, then re-test the websocket path from Mission Control itself.
**Resolution:** Resolved Apr 18 by adding `http://localhost:8080`, `http://127.0.0.1:8080`, `http://preview.motiondisplay.cloud`, and `https://preview.motiondisplay.cloud` to `gateway.controlUi.allowedOrigins` in `/data/.openclaw/openclaw.json`, then reloading the live gateway/runtime and restarting Mission Control preview. Philippe confirmed Mission Control connected successfully afterward.

**Priority:** high
**Status:** resolved

## [ERR-20260416-0144]

**What failed:** live model/fallback readout stayed noisy during rehearsal work
**Error:** Mission Control / Control UI intermittently surfaced fallback-model chatter such as fallback activation/clearing even while runtime `session_status` still reported the live session on `gpt-5.4`. This created operator doubt about whether the active model had really dropped or whether the UI/status layer was over-reporting the configured fallback chain.
**Context:** Apr 16 overnight OpenClaw `v2026.4.12` rehearsal, while live preview and live runtime remained in use on the main lane
**Suggested fix:** when the UI reports fallback activity, verify against runtime truth first (`session_status`, live status/readback, actual reply behavior). Treat the UI message as untrusted until the runtime confirms a real active-model switch. Later, audit the Control UI readout path so configured fallback chains are not presented like confirmed runtime transitions.
**Resolution:** Not fully resolved yet. Operational workaround is to trust runtime `session_status` over intermittent UI fallback chatter unless the runtime itself confirms a live model drop.

**Priority:** medium
**Status:** pending

## [ERR-20260416-0102]

**What failed:** rehearsal `v2026.4.12` memory search after state copy
**Error:** isolated QMD state still carried a legacy collection named `memory`, while `v2026.4.12` managed search expected the scoped collection name `memory-dir-main`. Result: `memory status` could look healthy, but `memory search` failed until the stale legacy collection was removed from the isolated rehearsal QMD state.
**Context:** Apr 16 isolated OpenClaw `v2026.4.12` rehearsal after QMD/Bun PATH was corrected
**Suggested fix:** after upgrading into a copied state, do not treat `memory status` as sufficient proof. Run a real `openclaw memory search ...` command. If search fails with missing managed collection behavior, inspect the isolated QMD collection config for stale legacy collection names and repair them before calling the upgrade healthy.
**Resolution:** Resolved Apr 16 in the isolated rehearsal state by removing the legacy `memory` collection, after which `memory search "Philippe" --max-results 3 --json` succeeded.

**Priority:** high
**Status:** resolved

## [ERR-20260416-0048]

**What failed:** parallel Mission Control preview safety during isolated rehearsal work
**Error:** `projects/mission-control/scripts/preview-stop.sh` used broad `pkill` patterns such as `next-server`, `runtime-bridge-ws-sidecar.js`, and `preview-origin-proxy.js`, so stopping or restarting a rehearsal preview lane could kill the normal preview lane too and produce a `502 Bad Gateway`.
**Context:** Apr 16 isolated OpenClaw `v2026.4.12` rehearsal bring-up with a second Mission Control preview on ports `3015/3016/3017`
**Suggested fix:** for any multi-preview or multi-runtime setup, stop only the processes referenced by the selected runtime directory PID files, preferably using process-group aware termination. Do not use global `pkill` cleanup for shared binaries like `next-server`, sidecars, or preview proxies.
**Resolution:** Resolved Apr 16 by rewriting `projects/mission-control/scripts/preview-stop.sh` to kill only the runtime-dir PID-file-backed process groups.

**Priority:** high
**Status:** resolved

## [ERR-20260415-1019]

**Context:** Mission Control Chat preview refreshes could rehydrate older tool history rows after file/document-heavy work.
**What failed:** history-loaded `read` / `exec` tool rows could fall back to the full raw `meta` body when richer args/context were missing, which made collapsed or lightly expanded tool cards dump huge document/output walls into the transcript.
**Suggested fix:** keep hydrated `read` / `exec` rows summary-first even when only result text is present, and route large bodies through an explicit collapsible viewer rather than inline `Result:` dumping.
**Resolution:** Resolved Apr 15 by tightening `projects/mission-control/components/chat/chat-tool-groups.tsx` so history-loaded read/exec previews stay compact and expanded bodies render via `ChatFileContentView`.

**Priority:** medium
**Status:** resolved

## [ERR-20260415-1153]

**Context:** Mission Control Files/Memory editor search was upgraded to real CodeMirror 6, but Philippe immediately tested the behavior from the page chrome instead of with editor focus already inside the text area.
**What failed:** relying on `Cmd/Ctrl+F` alone for embedded editor search was misleading because the browser-level find shortcut still wins when focus is outside the editor, making the new search feel broken even though CM search support is enabled.
**Suggested fix:** for browser-embedded editors, provide an explicit `Find` affordance that focuses the editor and opens the CodeMirror search panel programmatically; treat the keyboard shortcut as a bonus when focus is already inside the editor.
**Resolution:** Resolved Apr 15 by adding a shared header `Find` button in `projects/mission-control/components/editor/CodeMirrorEditor.tsx` for both Files and Memory editors.

**Priority:** medium
**Status:** resolved

## [ERR-20260415-1405]

**Context:** Philippe asked Link to use `agent-workspaces/job-advisor/memory/applications/philippe-master-resume-2026-04-13.md` while the specialist seats were running through their dedicated seat-local workspace mounts.
**What failed:** specialist seats like Link still become fragile when the user provides shared-workspace files via relative `agent-workspaces/<seat>/...` paths. The bridge prompts were fixed on Apr 13 to inject absolute shared paths, but the seat-local mounts remained mostly scaffolds, so user-supplied relative paths could still resolve against `/data/.openclaw/workspace-<seat>` and fail. Link then wandered into unnecessary file/skill discovery instead of converting the path or asking for clarification.
**Suggested fix:** harden specialist handling in two places: (1) normalize user-supplied `agent-workspaces/<seat>/...` paths to `/data/.openclaw/workspace/agent-workspaces/<seat>/...` before attempting reads, and (2) update specialist-facing skill/continuity docs to prefer absolute shared-workspace paths where seat-local mounts are not the source of truth.
**Resolution:** Resolved Apr 15 by aliasing each seat-local specialist content layer back to the shared specialist workspace (`memory`, `artifacts`, `.learnings`, `MEMORY.md`, `SKILLS.md`, `WORKSPACE.md`, shared `skills/`, shared `agent-workspaces/`) and updating Link's skill docs to prefer absolute shared-workspace continuity paths.

**Priority:** high
**Status:** resolved

## [ERR-20260415-1736]

**Context:** After the specialist seat history-loader fix, Link's messages appeared correctly only after a hard browser refresh. Live use still showed `WORKING` briefly and then `READY`, while the assistant reply stayed missing until manual reload.
**What failed:** the specialist seat bridge was not reliably delivering live `chat.final` events back into the current Mission Control tab, and `useRuntimeBridge` was letting the send path look effectively idle too early. Result: the transcript only updated after a forced history reload, not when the seat actually finished.
**Suggested fix:** keep specialist sends visually in-flight after the initial ack, then treat lifecycle completion as a trustworthy signal to force-hydrate the active specialist transcript before returning to `READY`.
**Resolution:** Resolved Apr 15 in `projects/mission-control/hooks/useRuntimeBridge.ts` by keeping seat sends active after the initial ack and forcing transcript hydration on lifecycle end. Philippe then tested Milou and reported the chat flow ran smoothly without the old hard-refresh step.

**Priority:** high
**Status:** resolved

## [ERR-20260415-1555]

**Context:** Philippe used the Link seat in Mission Control for Hospitable application-question drafting. The UI showed a brief `WORKING` indicator and a tool run, then went back to `READY` with no visible assistant text.
**What failed:** Link did generate assistant replies in the seat's own transcript, including a short acknowledgment and a full draft answer block, but Mission Control failed to surface those assistant messages in the visible seat transcript even though tool activity and status changes were reflected. This makes the seat look mute when the underlying specialist session actually answered.
**Suggested fix:** audit the specialist-seat bridge / transcript-merging path so assistant text messages from agent-level seat sessions are mirrored into the Mission Control Chat transcript with the same reliability as tool events. Also verify why the seat session is not visible from the current-session `sessions_list` perspective, to avoid debugging blind spots.
**Resolution:** Resolved Apr 15 by teaching `projects/mission-control/lib/runtime-bridge-history.ts` to load transcript history from the session root that matches the target agent slug (for example `/data/.openclaw/agents/job-advisor/sessions`) instead of assuming everything lives under `/data/.openclaw/agents/main/sessions`. Verified by hitting `/api/runtime-bridge/history?sessionKey=agent:job-advisor:main` and confirming Link's missing acknowledgment + draft answers now appear in the returned history entries.

**Priority:** high
**Status:** resolved

## [ERR-20260414-1418]

**Context:** Mission Control Chat `Session connected` badge started appearing about 5 seconds late again after the upgrade/restart loops.
**What failed:** `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js` was resolving the gateway target with `openclaw status --json` on every websocket connection. That CLI call took about 5.57 seconds, so each connect/reconnect paid the full cost before the gateway challenge arrived.
**Suggested fix:** cache the gateway target in-process and refresh only on failure/TTL instead of probing `openclaw status --json` on the hot path.
**Resolution:** Resolved Apr 14 by caching the gateway target in-process inside the sidecar and reusing it across connections.

**Priority:** high
**Status:** resolved

## [ERR-20260414-1513]

**Context:** Manual autonomous tasks on the Mission Control board flipped to `in-progress/running` but never created a real session and appeared to hang forever.
**What failed:** the execute route startup validation and runner-launch path regressed during the Next 16 migration work. The board could say `running` before execution had real backing, and planning-only tasks could also be falsely rejected because preview/runtime log churn looked like forbidden file edits.
**Suggested fix:** fail fast only on real launch errors / truly early exits, do not require immediate session-log creation as the sole success signal, and ignore preview/runtime log churn when enforcing planning-only artifact restrictions.
**Resolution:** Resolved Apr 14 by hardening `app/api/tasks/autonomous/[taskId]/execute/route.ts` startup validation and teaching `scripts/run-autonomous-task.mjs` to ignore preview/runtime log churn for planning-only tasks.

**Priority:** high
**Status:** resolved

## [ERR-20260414-1602]

**Context:** A Marvin planning task reached Review with a misleading `Context overflow: prompt too large for the model` proof message.
**What failed:** the actual provider error was OpenAI Codex rejecting `prompt_cache_key` because the autonomous session id was too long (`max 64`, got `70`). Long `mc-auto-${task.id}-${timestamp}` ids pushed the derived cache key over the limit.
**Suggested fix:** use shortened hashed autonomous session ids and do not trust overflow-style proof wording at face value without checking provider logs.
**Resolution:** Resolved Apr 14 by switching autonomous session ids to `mc-auto-<10-char-hash>-<timestamp>` in both the execute route and runner fallback path.

**Priority:** high
**Status:** resolved

## [ERR-20260413-1340]

**What failed:** Mission Control specialist-seat continuity loading during real Link seat testing
**Error:** specialist seats like Link were activated with main-workspace-relative paths such as `agent-workspaces/job-advisor/...`, but the actual specialist runtime was mounted on its own workspace root (for example `/data/.openclaw/workspace-job-advisor`). Result: the seat implied continuity/skill files were missing even though the shared files existed.
**Context:** Apr 13 Mission Control seat-bridge validation after the first real Link test
**Suggested fix:** for specialist seats, do not assume the runtime shares the main workspace root. Use seat-safe absolute shared-workspace paths (for example `/data/.openclaw/workspace/...`) when continuity/skill files live in the shared workspace, or seat-local paths when the files truly live inside the specialist mount.
**Resolution:** Resolved same session by switching Mission Control specialist activation and bridge prompts to absolute shared-workspace paths; Link then verified file access correctly and the seat test passed.

**Priority:** high
**Status:** resolved

## [ERR-20260413-2204]

**What failed:** Mission Control `/general/chat` hard-refresh + runtime-summary refresh architecture
**Error:** the page still waited on a heavy runtime summary before finishing the server render, and the summary path paid for multiple expensive CLI probes. At the same time, transcript history and live runtime actions were still too separate, which made any naive speed fix risky for the duplicate-message bug.
**Context:** Apr 13 late-night Mission Control Chat performance pass after the Apr 12 savepoint and Nerve comparison
**Suggested fix:** render transcript history first, defer the heavier summary, slim the summary path to the minimum truthful data source, and move history/live transcript semantics toward one normalized transcript + dedupe path rather than separate truths.
**Resolution:** Resolved in stages the same session: deferred the blocking summary on hard refresh (`cbb0e1b`), slimmed/cached the summary refresh path with status + session registry (`e1dd89d`), and laid the unified transcript foundation for later slices (`b0ae60b`).

**Priority:** high
**Status:** resolved

## [ERR-20260413-1128]

**What failed:** queued autonomous/spec task completion did not write back to the Mission Control structured board state
**Error:** a queued subagent completed the creative-tool automation spec and produced the artifact successfully, but `projects/mission-control/data/autonomous-tasks.json` still showed the original backlog item as untouched `backlog` because completion state/artifacts were never reconciled into the board record
**Context:** Apr 13 Morning Meeting follow-up after the Blender automation spec had landed but the task still appeared in Backlog
**Suggested fix:** when queue/executor/subagent work produces a real deliverable, completion is not done until the structured board record is updated too. Verify artifact existence and then write back `status`, `artifacts`, and a minimal run summary so Mission Control reflects the real task outcome instead of stale backlog truth
**Resolution:** Resolved same session by manually reconciling the affected task record to `done` with both artifacts attached and a minimal completion summary

**Priority:** medium
**Status:** resolved


## [ERR-20260412-2358]

**What failed:** first Mission Control seat-bridge transport assumption for specialist seats
**Error:** I assumed specialist seat slugs like `job-advisor` and `language-tutor` could be invoked as registered OpenClaw agent ids via `openclaw agent --agent <id>`, but the live config only exposed `main`; the direct call failed with `Unknown agent id "job-advisor"`.
**Context:** Apr 12 late-night Mission Control seat-bridge build so Marvin could trigger Sudo, Vantage, and the specialist seats directly instead of falling back to subagents.
**Suggested fix:** before designing seat/runtime transport, check `openclaw agents list` and verify whether the target seat is a real registered agent or only a Mission Control seat concept. If only `main` is registered, bridge specialist seats as persistent seat sessions under the main runtime with seat-specific activation and continuity context instead of `--agent` invocations.
**Resolution:** Resolved same session by pivoting Japin/Johan/Milou/Link to seat-session transport under the main runtime, keeping Sudo on the real orchestration backend and Vantage on a persistent lead-session path.

**Priority:** high
**Status:** resolved

## [ERR-20260412-2317]

**What failed:** initial Sudo seat-bridge dry-run semantics
**Error:** `--dry-run` still wrote a test orchestration record into `projects/mission-control/data/sudo-delegations.json`, which meant a verification command mutated real orchestration state.
**Context:** Apr 12 late-night seat-bridge verification after adding the first `scripts/seat-bridge.mjs` implementation.
**Suggested fix:** dry-run paths for orchestration/queue systems must construct payloads in memory only. Never write runner state, queue entries, or orchestration records during dry-run verification.
**Resolution:** Resolved same session by gating store writes/spawn behavior behind `!dryRun` and removing the temporary test artifact.

**Priority:** medium
**Status:** resolved

## [ERR-20260412-1115]

**What failed:** first Morning Meeting framing of the `market-signal-generator` cron issue
**Error:** the overnight finding was initially treated like a scheduler/weekend-execution bug, but the real issue was narrower: the single job lacked an explicit `tz`, so weekday semantics drifted relative to Philippe-facing time while the engine itself remained correct.
**Context:** Apr 12 Morning Meeting after Platform Health Council surfaced suspicious weekend-looking timing for `market-signal-generator`
**Suggested fix:** before escalating cron-health findings, distinguish three cases explicitly: (1) bad cron expression, (2) missing/mis-set timezone, (3) actual scheduler misfire. For operator-facing schedules, verify the resolved next-run in both server time and `Asia/Ho_Chi_Minh` before calling it a weekend run.
**Resolution:** Resolved same session by investigating the live job definition, confirming the missing timezone, adding `tz: Asia/Ho_Chi_Minh`, and verifying the next run resolved to Monday in Philippe-facing time.

**Priority:** medium
**Status:** resolved

## [ERR-20260412-2130]

**What failed:** first autonomous backlog generation quality after the evening rollback-safe Tasks cleanup
**Error:** the generator was reading the current `AUTONOMOUS.md` goals, but older keyword heuristics still warped newer goals into stale-style tasks. Example: an automation-scripts goal mentioning Blender/Unreal/After Effects could collapse into a generic creative-practice task, making it look like generation was still following old goals.
**Context:** Apr 12 evening Mission Control Tasks cleanup after Philippe noticed new backlog tasks had weak titles/briefs and felt tied to older goal framing.
**Suggested fix:** when goals evolve, do not rely on broad legacy keyword matches alone. Add higher-priority classifiers for newer goal families, reduce random sampling drift, and verify fresh backlog output against the actual current `AUTONOMOUS.md` goal list before calling generation healthy.
**Resolution:** Resolved same session by tightening `read_autonomous_file()`, prioritizing current-goal classifiers, switching to deterministic category interleaving, and regenerating the backlog against the live goals.

**Priority:** medium
**Status:** resolved

## [ERR-20260412-1313]

**What failed:** several first-pass Chat extraction builds during the Mission Control safe refactor lane
**Error:** after moving UI blocks out of `MissionControlChatSurface.tsx`, the most common failures were not architectural regressions but leftover cleanup misses: stale imports, stale type imports, or narrowing a shared type locally instead of using the exported source-of-truth type.
**Context:** Apr 12 post-rollback Chat-only refactor lane while extracting message/event rendering, transcript-adjacent UI, composer UI, and related helpers
**Suggested fix:** after each extraction, do a deliberate leftover pass before assuming the slice is wrong:
1. check stale imports/types in the parent
2. prefer the real exported hook/runtime type over re-declaring a narrowed local union
3. treat one or two compile misses as normal extraction fallout, then rerun build before reconsidering the slice boundary
**Resolution:** Resolved same session across the extraction series by cleaning leftover imports/types and switching the composer speech status prop to the exported `SpeechToTextStatus` type.

**Priority:** low
**Status:** resolved

## [ERR-20260412-0041]

**What failed:** first Chat helper-extraction build pass during post-rollback safe refactor lane
**Error:** after extracting rich-text/file-link helpers from `MissionControlChatSurface.tsx`, the parent file still imported `isLikelyWorkspaceFilePath` and `normalizeWorkspacePath`, causing ESLint/typecheck failure for unused imports during `next build`
**Context:** Apr 12 late-night Chat-only structural refactor after the rollback, where the working rule was tiny extraction → build → preview verify → commit
**Suggested fix:** after every extraction from a large React file, immediately prune the parent module imports before assuming the move is complete. Treat build verification as part of the extraction, not a postscript.
**Resolution:** Resolved same session by removing the unused imports and rerunning the build successfully

**Priority:** low
**Status:** resolved

## [ERR-20260412-0053]

**What failed:** first tool-group extraction build pass during post-rollback safe refactor lane
**Error:** `formatEventTime` was moved into `chat-tool-groups.tsx` but the old local definition remained in `MissionControlChatSurface.tsx`, producing a duplicate-definition webpack/build error
**Context:** Apr 12 late-night Chat-only structural refactor, third extraction slice
**Suggested fix:** when extracting a rendering cluster that includes shared utilities, remove the original local definitions in the parent immediately and let build verification catch any missed duplicates before restart/commit
**Resolution:** Resolved same session by deleting the duplicate local `formatEventTime` and rerunning the build successfully

**Priority:** low
**Status:** resolved

## [ERR-20260411-1713]

**What failed:** Volkskrant direct RSS ingestion for Mission Control Custom News
**Error:** requests to `https://volkskrant.nl/voorpagina/rss` and `https://www.volkskrant.nl/voorpagina/rss` were redirected into DPG Media consent flow and/or blocked by the publisher WAF, returning HTML/403 instead of feed XML
**Context:** Apr 11 rollout of the Home-page `Custom News` reader for Dutch news briefings
**Suggested fix:** do not rely on Volkskrant direct RSS from this environment. Keep only if publisher access normalizes later, otherwise replace it with a reliably fetchable Dutch source. IEX via rss.app proved to be the better operational third source for this reader.
**Resolution:** Resolved same session by replacing Volkskrant with IEX in the Custom News priority list.

**Priority:** medium
**Status:** resolved

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

## [ERR-20260416-1340]

**What failed:** the first live in-place OpenClaw `2026.3.8` → `v2026.4.12` upgrade window on the Hostinger Docker lane
**Error:** the package install itself appeared to complete, but post-restart validation failed in multiple ways: `openclaw --version` still reported `2026.3.8`, core CLI surfaces started failing config validation on `channels.telegram.streaming={"mode":"off"}`, Mission Control preview on `:3005` was down during the proof window, and the later rollback/login path degraded into plugin requirement skips plus `OpenClaw exited with code 1` before device approval completed. Final recovery required a full VPS rollback.
**Context:** Apr 16 cautious live upgrade attempt after the isolated `v2026.4.12` rehearsal had passed.
**Suggested fix:** before any future live retry, add a target-version config/schema preflight against the real live config, especially Telegram keys like `channels.telegram.streaming`; treat Dashboard/UI appearance as non-authoritative and gate only on CLI/runtime proof; make Mission Control preview restore an explicit post-restart step; and prefer a rollback path proven in advance over assuming in-place npm downgrade + restart will bring the UI path back cleanly.
**Proven cause/refinement:** local temp-config simulation on Apr 16 showed the likely rollback trap clearly:
- `2026.3.8` accepts raw `channels.telegram.streaming: "off"`
- `2026.4.12` accepts the legacy scalar and normalizes it to nested `{"mode":"off"}`
- `2026.3.8` rejects that nested shape
That means rollback can fail unless the raw pre-upgrade `openclaw.json` is restored before any `2026.3.8` restart. The concrete guard now lives in `projects/_ops/scripts/openclaw_retry_preflight.py` plus the companion retry-preflight runbook.
**Extra note:** npm deprecation warnings during `npm install -g` were noise here, not the deciding failure signal.

**Priority:** high
**Status:** active

## [ERR-20260416-1600]

**What failed:** live OpenClaw upgrade landed in a split global-install state inside the container
**Error:** `npm install -g openclaw@2026.4.12` wrote the active runtime install under `/data/.npm-global/...`, while `/usr/local/bin/openclaw` and `/usr/local/lib/node_modules/openclaw` remained on `2026.3.8`, so different shells resolved different OpenClaw versions after the same upgrade.
**Context:** Apr 16 second live retry after the VPS snapshot; runtime/gateway came up on `2026.4.12`, but non-runtime shells still hit the stale `/usr/local` CLI and reported config/version mismatches.
**Suggested fix:** after any container-side global npm upgrade, verify both the active PATH-resolved binary and the canonical `/usr/local/bin/openclaw` target. If the install prefix drifted, normalize it explicitly instead of assuming `npm install -g` updated `/usr/local`.
**Resolution:** Resolved Apr 17 during the 13:00 maintenance session. Removed the stale `/usr/local/bin/openclaw` and `/usr/local/lib/node_modules/openclaw` inside the OpenClaw container, after which `which openclaw` resolved `/data/.npm-global/bin/openclaw` and `openclaw --version` returned `OpenClaw 2026.4.12 (1c0672b)`.
**Priority:** high
**Status:** resolved


## [ERR-20260416-1825]

**What failed:** Mission Control Crons `Recent runs` tab looked clickable but kept rendering the Jobs view
**Error:** `projects/mission-control/components/pages/GeneralCronsPage.tsx` treated `searchParams` like a synchronous object. Under Next.js 16, `searchParams` can arrive asynchronously, so `?tab=runs` was ignored and the server page defaulted back to `jobs`.
**Context:** Apr 16 post-upgrade Mission Control sanity pass after Philippe reported that the Crons page mostly recovered but the `Recent runs` tab still felt unresponsive.
**Suggested fix:** for Next.js 16 server pages, resolve/await `searchParams` before using them for routing state; do not assume old synchronous page-prop behavior on app-router pages.
**Resolution:** Fixed on 2026-04-16 by updating `GeneralCronsPage.tsx` to resolve async `searchParams`, rebuilding, and restarting the Mission Control preview.

**Priority:** medium
**Status:** resolved


## [ERR-20260416-1828]

**What failed:** OpenClaw Control chat surface leaked raw async exec-completion/system payloads into the visible conversation
**Error:** user-facing chat showed internal `System (untrusted)` exec summaries containing probe output, log fragments, and command-result snippets (including Mission Control bridge probe details like `challenge`, `connect-res ok true`, health/tick counts, and HTTP header fragments) instead of keeping them internal.
**Context:** Apr 16 post-upgrade sanity follow-up after Mission Control verification probes; Philippe reported the leak again even after a gateway restart, which confirms it is a reproducible Control-UI presentation bug rather than one stale pre-restart artifact.
**Suggested fix:** audit the OpenClaw Control message-rendering path for async exec completions and internal system notices; internal completion payloads should remain hidden/agent-internal unless explicitly promoted into a human-facing reply. Treat raw `System (untrusted)` exec summaries as unsafe for direct chat rendering.
**Priority:** high
**Status:** active

## [ERR-20260416-2243]

**What failed:** normal git-stash / reset flow during the end-of-day Mission Control rollback
**Error:** `memory/cron-context.json` was script-managed as `root:root` with mode `600`, so normal dirty-tree handling could fail during `git stash push -u` / rollback prep from the `node` user.
**Context:** Apr 16 late-evening wrap-up while resetting the workspace repo back to the accepted Mission Control cutoff `a097067`.
**Suggested fix:** before destructive git actions in this workspace, check whether any dirty files are script-managed and root-owned. For `memory/cron-context.json`, use a bounded recovery path: `sudo` backup the file, temporarily `chown` only that file to `node:node`, complete the stash/reset, then restore `root:root` and `600` immediately afterward.
**Resolution:** resolved the same evening with that bounded ownership flip plus explicit ownership/mode restoration.

**Priority:** medium
**Status:** resolved

## [ERR-20260422-1800]

**What failed:** OpenClaw gateway `bind: "0.0.0.0"` config not actually applied at socket level inside Docker container
**Error:** Even with `gateway.bind: "0.0.0.0"` in `openclaw.json`, the gateway process binds to `127.0.0.1:18789` only. `openclaw gateway run --bind lan --force` also falls back to loopback. `docker restart` of the container does not fix it.
**Context:** Apr 22 afternoon session trying to expose the OpenClaw gateway Control UI externally. The gateway is inside a Docker container on a bridge network (`172.18.0.2`). The gateway's loopback-only bind means traffic from the host to `172.18.0.2:18789` arrives at the container's bridge interface but is never delivered to the loopback-bound gateway socket.
**Root cause:** Docker bridge networking — container has an external interface (`172.18.0.2`) separate from its loopback. The gateway binds to `127.0.0.1` only. Packets from host → `172.18.0.2:18789` reach the bridge interface but no service there to accept them. The gateway's loopback socket never sees that traffic.
**Suggested fix:** A TCP proxy inside the container listening on `172.18.0.2:18790` forwarding to `127.0.0.1:18789` would make the gateway reachable from the host. Alternatively, configure the Docker container to publish port 18789 and have the gateway bind to `0.0.0.0` with that port mapping.
**Priority:** medium
**Status:** active — workaround identified but not yet deployed

## [ERR-20260422-1815]

**What failed:** Misread of Philippe's goal for `dashboard.motiondisplay.cloud`
**Error:** Assumed Philippe wanted the OpenClaw Control UI surfaced at `dashboard.motiondisplay.cloud`. He actually wants Mission Control (the custom Next.js app) surfaced at that URL, live whenever the gateway is up.
**Context:** Apr 22 afternoon. Spent time researching and planning a TCP proxy to expose the OpenClaw Control UI externally. This was the wrong goal.
**Lesson:** When Philippe says "function a similar role as the default OpenClaw Gateway UI", he means the *operator-facing dashboard function* (Mission Control) — not the OpenClaw Control UI product itself. The keyword is "role", not "product".
**Resolution:** Philippe clarified: dashboard should surface Mission Control, not the OpenClaw Control UI. TCP proxy for gateway was abandoned.
**Priority:** low
**Status:** resolved — but the TCP proxy approach remains valid for future gateway-exposure needs


## [ERR-20260425-2032]

**What failed:** Mission Control runtime bridge routes had a longer outer Node wrapper timeout but still let the inner `openclaw gateway call` use its 10s default timeout.
**Error:** During OpenClaw gateway warm-up/lossless compaction load, `chat.history` and `sessions.patch` could fail around 10s even though the Mission Control route process timeout was 30s. The visible symptom was Mission Control showing reconnecting/recovering while backend processes and descriptors looked healthy.
**Context:** Apr 25 post-OpenClaw-2026.4.23 smoke follow-up after Philippe reported Mission Control was visibly reconnecting. Descriptors, sidecar, proxy, and live websocket handshake were healthy; the failure narrowed to slow gateway RPCs and CLI-default timeout behavior.
**Suggested fix:** when Mission Control shells out through `openclaw gateway call`, set an explicit CLI `--timeout` that is lower than but close to the wrapper timeout, e.g. `--timeout 40000` with a 45s `runShellCommand` timeout. Do not assume the outer process timeout changes the gateway RPC timeout.
**Resolution:** Fixed Apr 25 in commit `23138d9` by adding explicit 40s gateway-call timeouts and 45s wrapper timeouts for history, session bootstrap, send, and stop routes. Build and post-restart health/API/websocket checks passed.
**Priority:** high
**Status:** resolved

## [ERR-20260425-2033]

**What failed:** Nexos cleanup initially removed the active config/provider entries but did not update OpenClaw's config recovery baselines.
**Error:** `openclaw config validate`, `openclaw models list`, and `openclaw status` restored Nexos into `/data/.openclaw/openclaw.json` because the cleaned config was much smaller than `/data/.openclaw/openclaw.json.bak` / `.last-good`, triggering OpenClaw's suspicious config clobber recovery (`size-drop-vs-last-good`).
**Context:** Apr 25 post-update cleanup after Nexos aliases/provider reappeared with credential-bearing model config but no active routing usage.
**Suggested fix:** for large config removals, update the active config and accepted recovery baselines together, after creating timestamped backups. Verify after running the OpenClaw commands that previously triggered recovery. Also check agent-local `models.json` and `auth-profiles.json` separately.
**Resolution:** Fixed Apr 25 by backing up and writing the Nexos-free config to `/data/.openclaw/openclaw.json`, `/data/.openclaw/openclaw.json.bak`, and `/data/.openclaw/openclaw.json.last-good`, then cleaning agent-local model/auth files and re-verifying Nexos count stayed 0 after validation/model listing.
**Priority:** high
**Status:** resolved

## [ERR-20260425-2034]

**What failed:** Mission Control restart script can return non-zero from a transient Next `.next/static/...tmp` ENOENT during rebuild even when the runtime comes back healthy.
**Error:** A restart attempt after the timeout patch exited with a Next build/regeneration ENOENT, but immediate service health showed proxy, Next, and websocket sidecar were alive and responding.
**Context:** Apr 25 Mission Control-only restart after runtime bridge timeout hardening. OpenClaw gateway was not restarted.
**Suggested fix:** after a Mission Control restart-script failure, check actual runtime health (`scripts/mission-control-service-health.sh`, relevant pids, and app/runtime-bridge/sidecar endpoints) before declaring the service down. If health is green, treat the ENOENT as a restart/build-script reliability issue rather than an outage.
**Priority:** medium
**Status:** active

## [ERR-20260425-2158]

**What failed:** first attempt to create a physical Mission Control lab lane assumed a clean git worktree could mirror the live dashboard state.
**Error:** the active dashboard checkout was broadly dirty and included untracked runtime-transition files, so a clean worktree from HEAD would have produced a stale lab that did not match what was actually working in production.
**Context:** Apr 25 physical split of `lab.motiondisplay.cloud` from the live dashboard lane.
**Suggested fix:** before creating an isolated lane from a repo, compare HEAD against the working runtime. If the working runtime depends on uncommitted/untracked files, either reconcile/commit first or make an explicit runtime snapshot and label it as such. Do not pretend a snapshot is a clean promotion branch.
**Resolution:** used `/data/.openclaw/workspace/projects/mission-control-lab` as a runtime snapshot, excluding `.git`, `.next`, `node_modules`, `.preview-runtime`, and logs; documented the caveat for future source reconciliation.
**Priority:** high
**Status:** active until Mission Control source-of-truth is reconciled

## [ERR-20260425-2159]

**What failed:** copied Mission Control stop scripts were initially unsafe for a physically split lab runtime.
**Error:** the copied `preview-stop.sh` contained broad process-name kill fallbacks for `node ./scripts/preview-origin-proxy.js` and `node ./scripts/runtime-bridge-ws-sidecar.js`. Dashboard and lab use the same script names, so a lab stop could have killed dashboard processes.
**Context:** Apr 25 lab runtime snapshot hardening before starting lab on ports `3015/3016/3017`.
**Suggested fix:** for duplicated/split service lanes, stop scripts must be scoped by pid files and lane-specific ports/runtime dirs. Avoid broad `pgrep -f` patterns when multiple lanes run identical command names.
**Resolution:** removed broad process-name kill fallbacks from the lab copy and scoped lab cleanup to `.lab-runtime` pid files plus lab-only ports.
**Priority:** high
**Status:** resolved

## [ERR-20260425-2200]

**What failed:** initial host-routing handoff assumed `lab.motiondisplay.cloud` already had its own nginx server block.
**Error:** `sudo grep -RIn "server_name lab.motiondisplay.cloud" ...` returned nothing; lab had been falling through to the dashboard/default HTTPS vhost, including the dashboard certificate and dashboard upstream.
**Context:** Apr 25 public lab cutover after local lab was healthy on port `3015`.
**Suggested fix:** when adding a new public lane, verify the loaded nginx config with `sudo nginx -T` and certificate SANs before editing. If no server block exists, create a dedicated vhost and run Certbot rather than editing a non-existent file.
**Resolution:** Philippe created `/etc/nginx/sites-enabled/lab.motiondisplay.cloud`, Certbot provisioned a lab-specific certificate, and lab now proxies to `172.18.0.2:3015`.
**Priority:** medium
**Status:** resolved

## [ERR-20260425-2258]

**What failed:** Mission Control source reconciliation was harder because runtime app state, generated caches/logs, a lab runtime snapshot, and source changes were all visible as one broad dirty worktree.
**Context:** Apr 25 Mission Control became the main operational UI and required cleanup after lab split/live bridge work.
**Suggested fix:** before committing operational UI changes, classify dirt into: source, docs/runbooks, runtime state, generated cache/logs, snapshots, and unrelated historical ops debris. Commit source in coherent slices; ignore or separately manage runtime state. Do not use a broad `git add -A` in a mixed operational workspace.
**Resolution:** committed source/runtime-service changes in focused nested/root checkpoints, untracked Mission Control live JSON as runtime state, ignored the lab runtime snapshot, and separately removed the approved obsolete preupdate checkpoint.
**Priority:** high
**Status:** active

## Mission Control lane restart supervisor race
- Date: 2026-04-27
- Symptom: Manual Lab/Dashboard restart during Mission Control promotion caused temporary `Mission Control preview proxy could not reach the Next.js server` and/or `EADDRINUSE` on lane ports.
- Cause: The lane supervisor was still running and auto-restarted the bundle while manual restart/build/start steps were also trying to bind the same ports.
- Prevention: Before manual lane restart work, create the lane maintenance lock (`.lab-runtime/maintenance.lock` for Lab, `.preview-runtime/maintenance.lock` for Dashboard), then stop, clear only that lane's ports if needed, start, run health/smoke, and remove the lock. Do not trust proxy PID alone; verify internal Next and lane smoke.

## [ERR-20260427-2302]

**What failed:** First immediate Dashboard route sweep after restart reported `/general/memory` connection failure even though the service recovered moments later.
**Error:** `curl: (7) Failed to connect to 127.0.0.1 port 3005 after 10 ms: Could not connect to server` during the first post-restart local route sweep.
**Context:** After promoting mobile-only Skills/Crons/Memory/Files changes from Lab to Dashboard, the Dashboard service was restarted with the maintenance-lock pattern. Service health subsequently showed all Dashboard processes healthy and the full route sweep/lane smoke passed on retry.
**Suggested fix:** After Dashboard restarts, run `mission-control-service-health.sh` before treating a fast local route-sweep connection refusal as a code regression. If health is recovering, retry the route sweep once before escalating. Continue to inspect logs if the same route fails after health is green.
**Resolution:** Rechecked service health, reran route checks, and all targeted Dashboard routes plus lane smoke passed.

**Priority:** low
**Status:** resolved

## [ERR-20260427-2358]

**What failed:** Mission Control Lab initially kept serving the old Trading section after the BOILER ROOM source changes were committed
**Error:** The running Lab bundle was stale. `http://127.0.0.1:3005/trading` still showed old markers like `Market Intel` and `Bot / Dispatch`, while the real Lab lane was configured through `.lab-runtime` on public port `3015` and internal Next port `3017`.
**Context:** After implementing the first Lab-only Trading scaffolding slice, Philippe refreshed Lab and still saw the old Trading UI. The source/build had changed, but the served runtime had not been rebuilt/restarted on the correct Lab lane.
**Suggested fix:** For Mission Control Lab visual/UI changes, verify the actual user-facing Lab route from `.lab-runtime/mission-control-lab.env`, not hard-coded `3005`. Use the maintenance-lock flow: create `.lab-runtime/maintenance.lock`, run `scripts/lab-stop.sh`, `scripts/lab-build.sh`, `scripts/lab-start.sh`, run `scripts/mission-control-service-health.sh`, remove the lock, then check public `https://lab.motiondisplay.cloud/<route>` with auth for expected markers. Treat `3005` as possibly stale/wrong-lane unless the env says it is current.
**Resolution:** Rebuilt and restarted the Lab lane under maintenance lock, verified `3015/trading` and public Lab showed `BOILER ROOM`, `Health`, `Analytics`, `Screener`, and `Bots`; Philippe confirmed it worked.

**Priority:** high
**Status:** resolved

## [ERR-20260428-1022]

**What failed:** `nightly-memory-extraction` still partially failed even after earlier forbidden-path hardening
**Error:** the cron prompt correctly forbade `~/.openclaw/workspace/...`, but entity-target selection was still too permissive, so the model attempted a legacy summary file (`life/projects/mission-control.md`) instead of the canonical fact store (`life/projects/mission-control/items.json`) and tripped the run
**Context:** Apr 28 Morning Meeting after Platform Health Council flagged `nightly-memory-extraction` as error while the daily memory file had still been updated
**Suggested fix:** for model-backed entity-writing jobs, do not rely on generic root-path allowlists alone when legacy summary files and canonical structured stores coexist. Constrain writes to the canonical file type explicitly, for example existing `items.json` entity files only, and make ambiguous targets skip-only.
**Resolution:** Fixed on 2026-04-28 by tightening the live `nightly-memory-extraction` cron payload to allow entity writes only to existing `items.json` files under `/data/.openclaw/workspace/life/...` and to explicitly ignore legacy `.md` entity summaries

**Priority:** medium
**Status:** resolved

## [ERR-20260428-1815]

**What failed:** Lab Yahoo ticker adapter displayed a fake daily percentage for AMZN.
**Error:** AMZN rendered around `$261.12 +72.13 (+38.17%)`, because the adapter compared `regularMarketPrice` against Yahoo chart `chartPreviousClose` from a `range=1y` response. For that endpoint/range, `chartPreviousClose` is effectively the start-of-range/pre-range close, not the previous trading day's close.
**Context:** While testing `/trading/ticker/AMZN`, Philippe noticed the header percentage was obviously not a daily move.
**Suggested fix:** For Yahoo chart-backed daily change on a 1Y daily series, derive day change from the last two valid daily closes in `indicators.quote[0].close`; use metadata only as a fallback after understanding endpoint semantics. Verify against a known ticker and inspect cache contents, not just rendered formatting.
**Resolution:** Fixed in `projects/mission-control-lab/lib/trading/sources/yahoo.ts`; AMZN verified as `$261.12 -2.87 -1.09%` after cache clear.

**Priority:** high
**Status:** resolved

## [ERR-20260428-1911]

**What failed:** First BOILER ROOM ticker mobile pass improved page internals but still showed the Lab shell sidebar at 390px, squeezing the content.
**Error:** The original Trading mobile CSS targeted `.app-shell-grid.trading-shell-grid`, but the shell's CSS-module class composition meant the sidebar collapse rule did not reliably apply in the rendered mobile screenshot.
**Context:** Philippe asked to make `/trading/ticker/[symbol]` mobile-friendly before adding more modules. A Chromium mobile screenshot showed the desktop sidebar consuming much of the viewport.
**Suggested fix:** For Mission Control Lab/Dashboard responsive work, verify the real rendered shell, not just page-level CSS. When route shell classes are composed with CSS modules, add robust selectors/fallbacks such as `:has(.trading-shell-main)` when appropriate. Use screenshot/CDP checks for mobile, including `documentElement.scrollWidth` and `body.scrollWidth`.
**Resolution:** Hardened Trading shell mobile collapse and added a 560px ticker-specific mobile layout. Final CDP check at 390px showed no true page-wide horizontal overflow.

**Priority:** high
**Status:** resolved

## [ERR-20260429-1538]

**What failed:** `lab.motiondisplay.cloud` appeared to serve an old Lab build after the Apr 29 ticker phases.
**Error:** Philippe saw a build from the previous morning even after hard refresh. Local Lab source and `127.0.0.1:3015` were current, but the running/public lane had to be restarted and verified explicitly. The workspace also still had an older main Mission Control preview lane on `3005/3007`, while the real Lab lane is `3015/3017`, creating an easy wrong-port/wrong-build trap.
**Context:** After many Lab-only ticker commits, the CSS/source state was correct and local health was green, but user-facing public verification initially failed from Philippe's browser. Authenticated curl to `lab.motiondisplay.cloud` later confirmed current HTML only after a clean Lab-lane restart/cache refresh.
**Suggested fix:** For Mission Control Lab UI work, source commits, build success, and local route checks are not enough. Verify the authenticated public Lab domain for expected markers after restarting the correct Lab lane. Use `.lab-runtime/mission-control-lab.env` as port truth: public proxy `3015`, internal Next `3017`, sidecar `3016`, voice workers `3022/3023`. Treat `3005/3007` as the main/older preview lane unless the env says otherwise. When restart scripts hit PID/EADDRINUSE noise, use Lab port-scoped cleanup only, then rerun `scripts/lab-health.sh` and public authenticated marker checks.

**Priority:** high
**Status:** active

## [ERR-20260429-1536]

**What failed:** Lab restart flow briefly reported failure around `latest.pid` / port binding even though the lane later came up.
**Error:** `scripts/lab-start.sh`/`preview-start.sh` can hit stale PID/EADDRINUSE timing around ports `3015/3016/3017/3022/3023` and may exit noisily while processes/logs indicate the lane is starting or already bound.
**Context:** During public stale-build recovery, a first restart hit port collisions; a second port-scoped cleanup/start left the runtime files and processes present even though the command path had emitted a `latest.pid` timing error.
**Suggested fix:** After Lab restart noise, inspect `.lab-runtime/*.pid`, `latest.log`, `next.log`, and actual port owners before escalating. Do not broad-kill. Clear only Lab ports if needed, restart, then trust `scripts/lab-health.sh` plus route/public marker checks over wrapper chatter alone.

**Priority:** medium
**Status:** active

## [ERR-20260502-1358]

**What failed:** Lab Trading ticker enrichment regressions escaped through fallback and cache paths during the ticker-page milestone.
**Error:** `005930.KS` quote refresh returned `Quote refresh failed (502)` because the refresh endpoint only used EODHD realtime data even when the ticker page had a cached Yahoo/yfinance quote; `WAWI.OL` regressed to the generic EODHD company-summary fallback because the stricter Wikipedia identity guard rejected the known-safe `WAWI.OL -> Wallenius Wilhelmsen` mapping.
**Context:** After adding official non-US filings, Wikipedia hardening, unsupported-symbol handling, and first-class `yfinance` source metadata, random ticker QA found regressions in paths that were not the headline feature: quote refresh and known-title profile repair.
**Suggested fix:** For ticker/provider work, smoke both rendered page output and companion endpoints/cache state. Test fallback paths explicitly: EODHD-missing quote with cached Yahoo/yfinance quote, known-safe Wikipedia title mappings whose provider name is ticker-like, unsupported aliases, and regenerated cache after source changes. Keep provider/source changes guarded by deterministic smoke tests plus live random-ticker checks.
**Resolution:** Resolved in Lab commit `802a949 Fix Lab quote refresh and WAWI profile fallback`; later protected by `tests/trading-provider-smoke.test.py` coverage and live checks for `005930.KS` and `WAWI.OL`.

**Priority:** medium
**Status:** resolved

## 2026-05-03 — Bad Wikipedia entity match persisted through cache
- `IREN.US` matched an unrelated Wikipedia page because the search term collided with German text in a page title/extract. Adding a resolver guard was not enough because stale bad profile data remained in `data/trading/ticker-profiles/IREN_US.json`.
- Prevention: when fixing reference/entity enrichment bugs, check both resolver logic and cached ticker-profile artifacts. Add cached-profile refresh guards for known-bad summary signatures before declaring the runtime fixed.

## [ERR-20260504-1910]

**What failed:** A rendered ETF-page verification initially read stale Lab preview output after a successful build.
**Error:** The local Host-routed `NUKL.XETRA` page still showed old Finance Glossary / Estimates sections until the scoped Lab preview was restarted.
**Context:** After removing stock-only sections from ETF ticker pages, source tests and build passed, but the running Lab preview was still serving the previous compiled bundle.
**Suggested fix:** For Mission Control Lab visual/UI validation, especially after page-structure changes, restart the Lab preview with scoped Lab scripts before treating rendered HTML as current truth. Do not infer failure from stale preview output if source/build gates are green; refresh the lane and re-check.
**Resolution:** Restarted Lab preview with `scripts/lab-env.sh`, `scripts/preview-stop.sh`, and `scripts/preview-start.sh`, then verified `NUKL.XETRA` no longer rendered Finance Glossary, `id="finance-glossary"`, Estimates, `id="estimates"`, or EPS estimates.

**Priority:** medium
**Status:** resolved

## [ERR-20260505-2322]

**What failed:** Portfolio P/L and Performance can look precise while being reconstructed from current holdings only.
**Error:** A current-holdings-only performance line ignores purchase/sell dates, transaction-date FX, cash-flow timing, historical lots, realized sells, and dividends, so it is useful as a quick approximation but not a true portfolio return record.
**Context:** After making the Lab Portfolio Performance chart functional with lightweight-chart overlays, Philippe correctly noted that actual purchase/sell dates must be saved somewhere or P/L/performance are based on assumptions.
**Suggested fix:** Before treating Portfolio accounting as final, implement a transaction/lot ledger and make performance/P&L calculations source from dated transactions, fees, currency, transaction-date FX, dividends, and cash movements. Keep current reconstructed charts clearly caveated until then.

**Priority:** high
**Status:** pending

## [ERR-20260506-1028]

**What failed:** Mission Control Lab Convex schema/function changes were made locally but the live Convex dev deployment still served old validators.
**Error:** Philippe saw `ArgumentValidationError: Object contains extra field alertEnabled` when saving Watchlist price alerts because `convex/watchlist.ts` had new `alertEnabled` / `alertMinPrice` / `alertMaxPrice` validators locally, but the deployed `watchlist:update` function had not been pushed.
**Context:** May 5 Lab Watchlist alert work. Local lint/build/codegen were not enough to update the active Convex deployment. Running `npx convex dev --once` pushed the updated functions and immediately fixed the live validator mismatch.
**Suggested fix:** After any Mission Control Lab Convex schema/function change, run the appropriate Convex push step, usually `npx convex dev --once` from `projects/mission-control-lab`, then verify live function specs or perform a small runtime mutation smoke before declaring the UI fixed.

**Priority:** medium
**Status:** active reminder

## [ERR-20260506-1055]

**What failed:** `nightly-memory-extraction` cron could complete its real memory/entity work but still end with `lastRunStatus=error` because an intermediate `edit` tool call failed on a large JSON file.
**Error:** The cron registry reported `⚠️ 📝 Edit: in ~/.openclaw/workspace/life/areas/people/philippe/items.json failed`, which looked like a forbidden-path problem. Session evidence showed the actual tool call used `/data/.openclaw/workspace/...`; the displayed `~/.openclaw/...` path was renderer shorthand. The real failure was fragile exact-text matching in the `edit` tool. The agent later recovered with full-file `write`, but the earlier failed tool call poisoned cron status.
**Context:** May 6 Morning Meeting follow-up into recurring `nightly-memory-extraction` errors. Latest extraction had successfully written mission-control facts mcs-068 through mcs-073, Philippe facts philippe-025/026, and the May 5 nightly summary, despite cron status showing error.
**Suggested fix:** For model-backed extraction jobs, avoid `edit` on large JSON/entity files. Prefer read → construct full JSON → write, and skip uncertain updates rather than causing tool errors. When diagnosing cron failures, inspect session transcript/tool calls before trusting rendered `~/.openclaw/...` path text.

**Priority:** medium
**Status:** active reminder
