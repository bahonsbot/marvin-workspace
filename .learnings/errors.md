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

