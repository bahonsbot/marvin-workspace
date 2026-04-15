# OpenClaw `2026.3.8` → `v2026.4.12` Feature Delta

Date: 2026-04-16
Intent: highlight the **most interesting new capabilities** added between our current live version (`2026.3.8`) and the planned target (`v2026.4.12`).

This is **not** a bug-fix list and **not** a security changelog.
It is deliberately ordered from **most interesting for our setup** to **nice to have**.

## 1. Active Memory plugin
**Why it matters:** probably the single most important new capability for day-to-day continuity.

What it adds:
- a dedicated memory sub-agent before the main reply
- automatic recall of preferences, context, and past details
- configurable recall depth and prompt/tuning controls
- live `/verbose` inspection for what it is doing

Why it is interesting for us:
- it directly attacks the “I have to remember everything manually” problem
- it should reduce the amount of explicit memory prompting needed in long-running chats

Version notes:
- introduced in `2026.4.10`
- refined again in `2026.4.12`

## 2. Task Flow as a real durable orchestration substrate
**Why it matters:** this is a meaningful structural upgrade, not cosmetic polish.

What it adds:
- managed Task Flow state with inspection and recovery primitives
- managed vs mirrored sync modes
- child-task spawning and cancellation behavior
- plugin/runtime seam for driving Task Flows directly

Why it is interesting for us:
- it is the right kind of foundation for more serious autonomous or semi-autonomous work
- it is much closer to the sort of structured execution we keep trying to do around backlogs, queues, and follow-up tasks

Version notes:
- major additions in `2026.4.2`

## 3. Bundled Codex provider with native Codex lane
**Why it matters:** Codex stops being just “OpenAI with a different name” and becomes its own provider path.

What it adds:
- bundled Codex provider
- plugin-owned app-server harness
- Codex-managed auth, native threads, model discovery, and compaction
- clean separation from the normal `openai/gpt-*` provider path

Why it is interesting for us:
- we use Codex heavily already
- this should make Codex behavior more first-class instead of slightly bolted-on

Version notes:
- added in `2026.4.10`
- carried into `2026.4.12`

## 4. Dreaming + memory-wiki became much more usable
**Why it matters:** even if we keep it off for the first live upgrade, the feature itself matured a lot.

What it adds:
- grounded REM backfill from older notes
- diary reset/backfill flows
- traceable dreaming summaries and Scene lane improvements
- ChatGPT import ingestion
- `Imported Insights` and `Memory Palace` UI tabs
- better hybrid `memory-wiki` guidance and bridge-mode docs

Why it is interesting for us:
- this is the first point where Dreaming starts looking like an actual reviewable memory workflow instead of a vague experiment
- it becomes much more useful for historical note mining and long-range context shaping

Version notes:
- major dreaming/wikis changes in `2026.4.9`, `2026.4.10`, `2026.4.11`, `2026.4.12`

## 5. Much stronger media-generation stack
**Why it matters:** this is a surprisingly big creative jump.

What it adds across the month:
- `music_generate` tool and provider support
- richer `video_generate` options
- typed provider-specific options
- reference audio inputs
- per-asset role hints
- `adaptive` aspect ratio
- Seedance 2.0 support and richer fal video options
- higher image-input caps and URL-only generated asset delivery

Why it is interesting for us:
- it is directly relevant to your creative/visual/audio interests
- OpenClaw became more useful as a creative generation surface, not just a text router

Version notes:
- big pieces landed in `2026.4.7`, `2026.4.9`, `2026.4.10`, `2026.4.11`

## 6. Infer Hub and richer bundled provider surface
**Why it matters:** the model/provider layer got materially broader.

What it adds:
- Infer Hub restored as a bundled provider manager for local/self-hosted OpenAI-compatible servers
- bundled LM Studio provider
- more bundled provider docs and onboarding
- per-provider request policies like `allowPrivateNetwork`

Why it is interesting for us:
- we keep experimenting with local/self-hosted or custom endpoint setups
- this makes that world less hacky and more officially supported

Version notes:
- major provider/infer changes in `2026.4.7`, `2026.4.10`, `2026.4.12`

## 7. Webhook ingress + webhook-to-TaskFlow automation
**Why it matters:** this opens cleaner external-trigger automation paths.

What it adds:
- bundled webhook ingress plugin
- webhook routes that can launch Task Flows
- config surface for webhook-driven execution behavior

Why it is interesting for us:
- this is useful for integrations, automations, and external event-driven workflows
- it lines up with the kind of operational glue we often end up building manually

Version notes:
- landed in `2026.4.7`

## 8. Session checkpoints, restore, and branch tooling
**Why it matters:** finally, more serious session-state handling.

What it adds:
- prompt snapshots / checkpoints
- restore and branch surfaces
- checkpoint viewing in TUI and Control UI
- better recovery semantics around session state

Why it is interesting for us:
- we do enough long-running and fragile sessions that being able to restore/branch matters
- this is one of the more operator-friendly upgrades in the whole batch

Version notes:
- major session checkpoint work in `2026.4.7`

## 9. Chat-native `/tasks` board
**Why it matters:** small feature, useful habit-former.

What it adds:
- `/tasks` command as a background task board for the current session
- recent task details inside chat
- agent-local fallback counts when linked tasks are absent

Why it is interesting for us:
- lightweight enough to actually use
- helpful for keeping execution state close to the conversation

Version notes:
- added in `2026.4.1`

## 10. SearXNG became a bundled web-search provider
**Why it matters:** directly relevant to our current search posture.

What it adds:
- bundled SearXNG provider for `web_search`
- configurable host support

Why it is interesting for us:
- we already care about SearXNG in this environment
- this makes that lane more standard and less improvised

Version notes:
- added in `2026.4.1`

## 11. ClawHub is now properly built in
**Why it matters:** better skill discovery and install flow.

What it adds:
- ClawHub in Control UI and CLI
- browse, search, install, and publish skills from the official hub

Why it is interesting for us:
- we use skills a lot
- this lowers friction for adding or updating capabilities without custom manual digging

Version notes:
- major ClawHub work in `2026.4.7`

## 12. Richer Control UI chat surfaces
**Why it matters:** not a core runtime change, but nicer and more truthful UI.

What it adds:
- structured media / reply / voice bubbles in webchat
- `[embed ...]` support
- remote command discovery via `commands.list`
- better slash-command catalog support in chat

Why it is interesting for us:
- it improves the operator experience in Mission Control / Control UI
- makes chat surfaces less plain-text and more native to the runtime

Version notes:
- notable pieces in `2026.4.10`, `2026.4.11`, `2026.4.12`

## 13. Finer-grained context visibility controls
**Why it matters:** useful for privacy and channel discipline.

What it adds:
- per-channel / per-actor context visibility controls
- more explicit control over what context gets shown or hidden

Why it is interesting for us:
- useful when deciding how much context to surface in different channels or workflows
- good operator hygiene, even if not flashy

Version notes:
- notable changes in `2026.4.7`

## 14. Better cron controls
**Why it matters:** practical, not glamorous.

What it adds:
- per-job cron tool allowlists
- stronger isolated-job behavior
- better cron execution structure overall

Why it is interesting for us:
- we lean on cron heavily
- the tool allowlist piece is especially nice for tighter scheduled-job control

Version notes:
- `cron --tools` landed in `2026.4.1`
- other cron capability work continued through `2026.4.10` and `2026.4.11`

## 15. Local talk / voice improvements
**Why it matters:** nice if we want to lean into speech later.

What it adds:
- macOS Voice Wake option
- experimental local MLX speech provider for Talk Mode
- better local playback / interruption handling

Why it is interesting for us:
- potentially useful later for more natural voice interaction
- not core to today’s setup, but definitely more capable than before

Version notes:
- pieces in `2026.4.1`, `2026.4.10`, `2026.4.12`

## 16. Nice-to-have provider/catalog growth
**Why it matters:** broader optional surface area.

Examples:
- Amazon Bedrock Guardrails
- Arcee provider additions
- more bundled model catalogs like Z.AI `glm-5.1`, `glm-5v-turbo`
- broader OpenAI-compatible provider ergonomics

Why it is interesting for us:
- more routes to try later
- not the main reason to upgrade, but useful optional range

Version notes:
- spread across `2026.4.1` through `2026.4.12`

---

## My blunt ranking summary
If I reduce the whole month of changes to the parts that matter most for **our** setup, it is roughly this:

1. **Active Memory**
2. **Task Flow foundation**
3. **First-class Codex provider lane**
4. **Dreaming + memory-wiki maturation**
5. **Media generation getting much richer**
6. **Infer Hub / local-provider improvements**
7. **Webhook-triggered automation**
8. **Session checkpoints / restore / branch**
9. **SearXNG + `/tasks` + ClawHub convenience**

That is the real argument for the upgrade. The rest is helpful, but those are the meaningful jumps.

## Source basis
Primary source used: upstream `CHANGELOG.md` sections for `2026.4.1` through `2026.4.12` in the OpenClaw repo checkout.
