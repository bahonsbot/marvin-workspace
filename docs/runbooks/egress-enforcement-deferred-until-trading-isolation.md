# Egress Enforcement Deferred Until Trading Isolation

## Decision Summary
Phase-1 egress **inventory succeeded**, but **hard enforcement is deferred** until the trading/webhook path is isolated into a tighter boundary than the full OpenClaw container.

This runbook is now the single durable reference for the deferred trading-isolation design. Earlier March/April planning notes for a `marvin-trading-bot` container were consolidated here on 2026-05-15 so stale pre-cutover documents do not appear as live operational runbooks.

## Current Status
- **Inventory/observation:** complete
- **Enforce mode on current main container:** deferred
- **Dedicated trading container:** not deployed
- **Current live webhook path:** still runs from the main OpenClaw container
- **Next prerequisite:** approve and implement a dedicated trading-path isolation boundary before any deny-by-default egress enforcement

## Why Enforcement Is Deferred
The current nftables monitor rules target source IP `172.18.0.2`, which is the **entire `openclaw-ktrt-openclaw-1` container**, not just the trading bot or webhook receiver.

Applying deny-by-default egress rules at this boundary would risk breaking unrelated workloads that still share the same container/network identity, including:
- model/runtime provider traffic
- GitHub/docs/software-fetch traffic
- RSS/news/research traffic
- other OpenClaw features and automations

So although we now know some sensitive destinations, the current security boundary is too coarse for safe enforcement.

## What the Monitoring Proved
### Confirmed destinations
- **Telegram:** `149.154.166.110:443`
- **Alpaca paper trading:** `35.194.67.18:443` → `paper-api.alpaca.markets`

### Additional observed but unclassified destinations
- `104.18.32.47:443`
- `172.64.155.209:443`

These likely represent broader platform traffic behind CDN/proxy infrastructure, reinforcing that the container boundary currently mixes multiple outbound roles.

## Recommended Next Architecture Step
Create a **dedicated trading-path container** or equivalent isolated runtime/network boundary for the trading execution path.

### Proposed container
- Name: `marvin-trading-bot`
- Responsibility: own only the paper-trading execution path:
  - webhook receiver (`python3 -m src.webhook_receiver`)
  - Alpaca paper adapter / execution orchestrator
  - trading Telegram notifications
  - optional trading reports only if they depend directly on broker state

### Keep outside this container
- core OpenClaw runtime
- model-backed cron jobs
- broad research/content fetching
- GitHub/docs/software-fetch behavior
- general-purpose orchestration

## Runtime Shape
### Fastest safe first implementation
Use a workspace-mounted dedicated container:
- Base image: Python runtime compatible with `projects/autonomous-trading-bot`
- Working directory: `/app`
- Entrypoint: `python3 -m src.webhook_receiver`
- Lifecycle: Docker restart policy or a host service supervising only this container

This is less elegant than a fully baked image, but it is the fastest reversible path to a separate network identity.

### Medium-term improved implementation
Build a dedicated trading image that copies only required runtime files. This gives stronger reproducibility and least-privilege posture, but costs more setup work.

## Mounts and Environment
### Writable mount
- `/data/.openclaw/workspace/projects/autonomous-trading-bot` → `/app`

### Optional read-only context mounts
Only if the execution path still needs local Market Intel artifacts:
- `/data/.openclaw/workspace/projects/market-intel/data` → `/market-intel/data:ro`
- `/data/.openclaw/workspace/projects/market-intel-news-reader/data` → `/market-intel-news-reader/data:ro`

Do **not** mount the full workspace read-write into the trading container.

### Required environment
Use a container-specific env file instead of blindly reusing the full project `.env`; suggested path:
- `projects/autonomous-trading-bot/.env.runtime-trading`

Required categories:
- webhook auth: `WEBHOOK_SHARED_SECRET`, `WEBHOOK_HOST`, `WEBHOOK_PORT`
- Alpaca paper: `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ALPACA_BASE_URL`
- execution mode: `PAPER_EXECUTE`, `KILL_SWITCH`
- risk config: `DAILY_LOSS_CAP`, `MAX_POSITION_SIZE`, `MAX_OPEN_POSITIONS`
- auto-dispatch config: `AUTO_MIN_CONFIDENCE`, `AUTO_MIN_REASONING_SCORE`, `AUTO_BASE_QTY`, `AUTO_MAX_QTY`, `AUTO_MARKET_HOURS_ONLY`, `EXECUTION_CANDIDATES_ENABLED`
- notifications if used: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

`ALPACA_BASE_URL` must remain `https://paper-api.alpaca.markets` unless a separately approved live-trading migration exists.

## Networking Design
### Preferred posture
- dedicated Docker bridge network, for example `marvin-trading-net`
- fixed container name: `marvin-trading-bot`
- predictable container IP or dedicated bridge/network for clean firewall targeting

### Inbound ports
- receiver remains port `8000` inside the container
- for shadow validation, bind host `127.0.0.1:18000 -> 8000` to avoid colliding with the current live mixed-container receiver on `8000`
- only move to final ingress binding during an approved cutover

Published-port forwarding has previously been unreliable on this VPS. If needed, validate `--network host` with `WEBHOOK_HOST=127.0.0.1`, but treat that as a deliberate design choice and preserve signed-request requirements.

## Egress Allowlist Target
After isolation and monitor-mode validation, allow only:
- `paper-api.alpaca.markets`
- Telegram Bot API traffic, if trading notifications remain in this container
- DNS to the configured resolver

Everything else should become deny-by-default on the isolated boundary only.

Because broker and Telegram IPs can change, avoid long-term single-IP assumptions unless backed by a managed IP-set refresh process. Static IPs are acceptable evidence for inventory, not a robust maintenance strategy.

## Shadow Validation Checklist
Before any cutover:
- [ ] Container starts cleanly
- [ ] `/health` responds
- [ ] `/health/auth` responds
- [ ] Signed test webhook succeeds
- [ ] Paper-only Alpaca guard remains intact
- [ ] `PAPER_EXECUTE=false` is used for first shadow validation
- [ ] Telegram notification path works, if included
- [ ] Alpaca paper connectivity works
- [ ] Context mounts load without unexpected file/path errors
- [ ] No broad workspace read-write mount is present

Expected receiver evidence:
- `Paper-only webhook receiver listening...`
- `paper_only: true` in health/decision output
- dry-run or explicitly controlled paper execution according to the validation phase

## Cutover Checklist
Cutover requires explicit approval.

1. Confirm shadow validation is clean.
2. Stop the old webhook receiver path in the main container.
3. Start or promote the isolated container path.
4. Send signed test webhook to the isolated path.
5. Confirm decision logging, idempotency behavior, and notification behavior.
6. Confirm no live Alpaca endpoint drift.
7. Observe isolated egress in monitor mode.
8. Draft and apply allowlist only after monitor-mode validation.

## Rollback
```bash
cd /data/.openclaw/workspace/projects/autonomous-trading-bot
docker compose -f docker-compose.trading.yml down
# Then restore the prior receiver path and verify health locally:
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/auth
```

## Immediate Safe Actions
- keep destination evidence in this memo and daily memory
- do not apply deny-by-default egress to the full OpenClaw container
- remove temporary monitor-only nftables table only when it is no longer needed and after confirming no current investigation depends on it

## Deprecated Source Notes
The following former runbooks were consolidated into this memo on 2026-05-15 and should not be treated as live operational references:
- `docs/runbooks/trading-path-container-cutover.md`
- `docs/runbooks/trading-path-container-implementation-proposal.md`
- `docs/runbooks/trading-path-container-isolation-plan.md`
