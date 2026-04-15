# OpenClaw `2026.3.8` → `v2026.4.12` Feature Delta

Date: 2026-04-16
Intent: highlight the **meaningful feature additions** from **after `2026.3.8`** through **`v2026.4.12`**, ordered from **most interesting for our setup** to **nice to have**.

This is **not** a bug-fix list and **not** a security changelog.

## My blunt ranking

## 1. Active Memory plugin
**Why it matters:** the most potentially useful day-to-day upgrade in the whole span.

What it adds:
- a dedicated memory sub-agent before the main reply
- automatic recall of preferences, context, and prior details
- configurable recall depth and tuning controls
- live `/verbose` visibility into memory behavior

Why it matters for us:
- directly improves continuity
- reduces the amount of manual memory wrangling needed in long-running work

Version notes:
- major landing in `2026.4.10`
- further refinement in `2026.4.12`

## 2. Task Flow becoming a real orchestration substrate
**Why it matters:** this is a structural capability jump, not UI glitter.

What it adds:
- managed Task Flow state
- recovery and inspection primitives
- managed vs mirrored sync modes
- child-task spawning and cancellation behavior
- a clearer substrate for long-running coordinated work

Why it matters for us:
- much closer to the sort of structured backlog/execution system we keep needing
- a better base for autonomous or semi-autonomous work than improvised queues

Version notes:
- major additions in `2026.4.2`

## 3. First-class Codex provider lane
**Why it matters:** Codex became more native and less like a slightly awkward compatibility layer.

What it adds:
- bundled Codex provider
- provider-owned app-server harness
- Codex-managed auth, native threads, discovery, and compaction
- a cleaner separation from generic OpenAI provider behavior

Why it matters for us:
- we already rely on Codex heavily
- this should make Codex workflows more first-class and less brittle

Version notes:
- major landing in `2026.4.10`

## 4. Dreaming + memory-wiki becoming genuinely usable
**Why it matters:** still optional for the first live upgrade, but it matured a lot.

What it adds:
- grounded REM backfill
- diary reset/backfill flows
- ChatGPT import ingestion
- `Imported Insights` and `Memory Palace` UI tabs
- stronger hybrid `memory-wiki` guidance and bridge-mode docs
- more traceable dreaming summaries and scene behavior

Why it matters for us:
- first point where this starts looking like a real memory workflow rather than a vague experiment
- more interesting for long-range reflection and historical context shaping

Version notes:
- big steps across `2026.4.9`, `2026.4.10`, `2026.4.11`, `2026.4.12`

## 5. Dashboard v2 / much stronger Control UI operator surface
**Why it matters:** this is one of the biggest March additions and easy to underrate.

What it adds:
- modular dashboard with overview, chat, config, agent, and session views
- command palette
- mobile bottom tabs
- richer chat tooling like slash commands, search, export, and pinned messages
- later April chat-surface improvements for richer embedded media and command discovery

Why it matters for us:
- directly improves the operator experience in the browser
- makes OpenClaw feel more like a proper control plane and less like a thin shell

Version notes:
- major landing in `2026.3.12`
- additional chat-surface improvements in `2026.4.10` to `2026.4.12`

## 6. Browser attach to a real signed-in Chrome session
**Why it matters:** this is a big practical upgrade if we want less fake-browser theater.

What it adds:
- official Chrome DevTools MCP attach mode for a live signed-in browser session
- built-in browser `profile="user"` and `profile="chrome-relay"`
- better browser act automation with batching, selector targeting, and delayed clicks

Why it matters for us:
- agents can work against the real signed-in browser instead of a disposable isolated shell
- much more useful for workflows that depend on real sessions/accounts

Version notes:
- major landing in `2026.3.13`

## 7. Better local/self-hosted model stack: provider plugins, Ollama, Infer Hub, LM Studio
**Why it matters:** the provider layer got materially more serious.

What it adds across March and April:
- Ollama, vLLM, and SGLang moved onto the provider-plugin architecture
- first-class Ollama onboarding with Local or Cloud + Local modes
- Infer Hub restored as a bundled manager for local/self-hosted OpenAI-compatible servers
- bundled LM Studio provider and broader provider docs

Why it matters for us:
- we keep experimenting with local/self-hosted endpoints and custom routes
- this makes that lane more official and less hand-built

Version notes:
- foundational provider-plugin shift in `2026.3.12`
- first-class Ollama onboarding in `2026.3.11`
- Infer Hub / LM Studio improvements in `2026.4.7`, `2026.4.10`, `2026.4.12`

## 8. Fast mode as a real cross-surface speed toggle
**Why it matters:** simple, but genuinely useful.

What it adds:
- session-level fast toggles across `/fast`, TUI, Control UI, and ACP
- OpenAI/Codex fast-mode request shaping
- Anthropic fast-mode/service-tier support

Why it matters for us:
- practical way to trade off cost/latency without fiddling with lower-level settings constantly
- likely to become a frequently used operator control

Version notes:
- major landing in `2026.3.12`

## 9. Session checkpoints / restore / branch
**Why it matters:** long-running sessions finally got a more adult safety net.

What it adds:
- prompt snapshots / checkpoints
- restore and branch flows
- checkpoint viewing in TUI and Control UI

Why it matters for us:
- we do enough fragile, long-running work that branching/restoring matters
- one of the cleaner operator-facing improvements in the whole range

Version notes:
- major landing in `2026.4.7`

## 10. Much richer media generation
**Why it matters:** surprisingly large creative expansion.

What it adds:
- `music_generate`
- richer `video_generate`
- typed provider-specific generation options
- reference audio support
- per-asset role hints
- adaptive aspect ratio
- Seedance 2.0 and broader fal video support
- higher image-input caps and cleaner generated-asset delivery

Why it matters for us:
- directly relevant to your creative interests
- makes OpenClaw more useful as a creative production surface, not just a text router

Version notes:
- major steps across `2026.4.7`, `2026.4.9`, `2026.4.10`, `2026.4.11`

## 11. Memory search got more capable: multimodal indexing + Gemini embeddings
**Why it matters:** a real March addition, not just April memory hype.

What it adds:
- opt-in image and audio indexing for `memorySearch.extraPaths`
- Gemini embedding support (`gemini-embedding-2-preview`)
- configurable output dimensions and reindexing behavior when dimensions change

Why it matters for us:
- pushes memory search beyond plain text
- potentially useful for richer archival/search setups later

Version notes:
- major landing in `2026.3.11`

## 12. Webhook ingress + webhook-to-TaskFlow automation
**Why it matters:** much cleaner event-driven automation path.

What it adds:
- bundled webhook ingress plugin
- webhook routes that can launch Task Flows
- cleaner config surface for external-trigger automation

Why it matters for us:
- useful for integrations and operational glue
- much closer to how we actually end up wiring systems together

Version notes:
- major landing in `2026.4.7`

## 13. ACP / IDE session continuity improved a lot
**Why it matters:** not the flashiest feature, but very practical.

What it adds:
- `sessions_spawn` support for `resumeSessionId`
- better ACP session restore and load behavior
- better tool/activity visibility in bridge clients
- richer ACP session UX and controls

Why it matters for us:
- improves continuity for ACP/Codex-like workflows
- less restart-from-scratch nonsense in IDE-linked sessions

Version notes:
- important foundation in `2026.3.11`
- more ACP surfacing continued in March and April

## 14. Cron got more flexible and more usable
**Why it matters:** we lean on cron heavily.

What it adds across March and April:
- `sessionTarget: "current"` and `session:<id>` support
- per-job cron tool allowlists
- stronger isolated cron behavior
- more explicit cron execution control

Why it matters for us:
- better control over where scheduled work lands
- especially useful for persistent-session and safer scheduled-job flows

Version notes:
- new session targeting in `2026.3.13`
- `cron --tools` and additional cron surface work in `2026.4.1` and later April releases

## 15. ClawHub becoming properly built in
**Why it matters:** skill discovery and install friction dropped.

What it adds:
- ClawHub in CLI and Control UI
- browse, search, install, and publish skills from the official hub

Why it matters for us:
- we use skills constantly
- easier capability expansion without manual scavenging

Version notes:
- major landing in `2026.4.7`

## 16. Chat-native `/tasks` board
**Why it matters:** small feature, potentially sticky habit.

What it adds:
- `/tasks` for background task tracking in the current session
- recent task details inside chat
- fallback task counts when linked tasks are absent

Why it matters for us:
- simple enough to actually get used
- useful when execution state should stay close to the conversation

Version notes:
- landed in `2026.4.1`

## 17. SearXNG became a bundled web-search provider
**Why it matters:** relevant to our current search posture.

What it adds:
- bundled SearXNG provider for `web_search`
- configurable host support

Why it matters for us:
- we already care about SearXNG in this environment
- cleaner and more standard than improvising the route

Version notes:
- landed in `2026.4.1`

## 18. `sessions_yield` and pending-work primitives
**Why it matters:** less glamorous, but useful orchestration groundwork.

What it adds:
- `sessions_yield` so orchestrators can end a turn early and carry hidden follow-up payloads
- narrow `node.pending.enqueue` / `node.pending.drain` primitives as groundwork for dormant-node work delivery

Why it matters for us:
- quietly useful for more disciplined orchestration patterns
- better internal machinery for delayed or deferred work

Version notes:
- `sessions_yield` in `2026.3.12`
- pending-work primitives in `2026.3.11`

## 19. Finer context visibility controls
**Why it matters:** operator hygiene rather than fireworks.

What it adds:
- more per-channel / per-actor control over visible context
- better context-discipline options across channels

Why it matters for us:
- useful when deciding how much context should surface where
- good policy hygiene even if it is not dramatic

Version notes:
- notable additions in `2026.4.7`

## 20. Voice / talk improvements
**Why it matters:** not central right now, but better than before.

What it adds:
- voice wake options
- experimental local MLX speech path
- better playback/interruption handling

Why it matters for us:
- relevant if we lean further into hands-free or speech-driven workflows later

Version notes:
- pieces across `2026.4.1`, `2026.4.10`, `2026.4.12`

## 21. Nice-to-have native/mobile upgrades
**Why it matters:** mostly not core to this VPS setup, but worth noting.

Examples:
- iOS home canvas improvements
- macOS chat model picker and thinking persistence
- iOS push relay
- Android chat/settings refresh
- richer onboarding across mobile/native surfaces

Why it matters for us:
- useful if we spend more time in native/mobile clients later
- not the main reason to do this upgrade today

Version notes:
- especially visible in `2026.3.11`, `2026.3.12`, `2026.3.13`

---

## Reduced to the essentials
If I compress the whole `2026.3.8` → `v2026.4.12` span into the changes that really matter for **our** setup, it comes out like this:

1. **Active Memory**
2. **Task Flow**
3. **First-class Codex provider**
4. **Dreaming + memory-wiki maturing**
5. **Dashboard v2 / stronger operator UI**
6. **Real signed-in Chrome attach + browser profiles**
7. **Better local/self-hosted provider stack**
8. **Fast mode**
9. **Session checkpoints / restore / branch**
10. **Richer media generation**
11. **Better memory search via multimodal indexing**
12. **Webhook-triggered automation**

That is the real upgrade story, not the long tail of fixes.

## Source basis
Primary source used: upstream `CHANGELOG.md` covering the releases after `2026.3.8` through `2026.4.12`, especially `2026.3.11`, `2026.3.12`, `2026.3.13`, `2026.4.1`, `2026.4.2`, `2026.4.7`, `2026.4.9`, `2026.4.10`, `2026.4.11`, and `2026.4.12`.
