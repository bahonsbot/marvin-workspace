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

**Error:** `minimax2.7` alias resolved and runtime restart succeeded, but actual message send returned `HTTP 404: 404 page not found` — even after switching baseUrl from `api.minimax.chat` to `api.minimax.io/v1`.
**Root cause:** The MiniMax provider was configured without an explicit `api` adapter, causing OpenClaw to fall back to the wrong transport family. The fix required switching to `api: "anthropic-messages"` with `baseUrl: "https://api.minimax.io/anthropic"` — the Anthropic-compatible path, not the bare `/v1` path.
**Lesson:** When 404 survives a clean provider/alias setup, it is almost always a transport/API-contract mismatch, not a credential or hostname problem. Diagnostic path: (1) read provider's official API docs, (2) read OpenClaw's own provider docs, (3) compare both against current config, then (4) apply the minimum transport-layer fix. Never stack speculative config edits for a 404 — always get the contract right first.
**Resolution (2026-03-20):** Applied `baseUrl: "https://api.minimax.io/anthropic"` + `api: "anthropic-messages"` + corrected `contextWindow: 204800`. Live generation test returned clean "MINIMAX_M27_OK" in ~5s. Both `codex5.4mini` and `minimax2.7` are now confirmed working.

