# OpenClaw `v2026.4.12` Retry Preflight

Date: 2026-04-16
Purpose: catch the Telegram config/rollback trap **before** another live upgrade attempt.

## The proven trap

Current live config still uses the legacy Telegram shape:

```json
"channels": {
  "telegram": {
    "streaming": "off"
  }
}
```

That matters because:
- **OpenClaw 2026.3.8** accepts the legacy scalar shape.
- **OpenClaw 2026.4.12** also accepts it, but normalizes it to the newer nested shape:

```json
"channels": {
  "telegram": {
    "streaming": {
      "mode": "off"
    }
  }
}
```

- **OpenClaw 2026.3.8 rejects that nested shape.**

So the dangerous sequence is:
1. upgrade to `v2026.4.12`
2. target runtime rewrites Telegram streaming config to the nested object
3. upgrade fails for some other reason
4. we downgrade package back to `2026.3.8`
5. `2026.3.8` now refuses to start cleanly because the config file is no longer in its accepted shape

That makes this a **rollback compatibility problem**, not just a forward-upgrade problem.

## Proven compatibility result

Validated locally with temp config copies:
- `2026.3.8` + raw live config → **PASS**
- `2026.4.12` + raw live config → **PASS**
- `2026.3.8` + migrated Telegram nested shape → **FAIL**
  - `channels.telegram.streaming: Invalid input (allowed: true, false, "off", "partial", "block", "progress")`

## Mandatory retry gate

Before any new live retry:
1. create a **byte-for-byte backup** of the raw `/data/.openclaw/openclaw.json`
2. run the retry preflight script
3. do **not** proceed unless the script passes
4. if a rollback becomes necessary after any `v2026.4.12` config rewrite, restore the raw config backup **before** restarting `2026.3.8`

## Preflight script

Path:

```bash
projects/_ops/scripts/openclaw_retry_preflight.py
```

What it proves:
- current runtime validates the raw config
- target runtime validates the raw config
- current runtime fails against a simulated migrated Telegram config shape
- rollback-safe status only passes when a matching raw-config backup exists

## Recommended operator commands

Create the backup in the live window log directory first:

```bash
LOGDIR=/data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300
mkdir -p "$LOGDIR"
cp /data/.openclaw/openclaw.json "$LOGDIR/00-openclaw-json-pre.json"
```

Run the retry preflight:

```bash
python3 /data/.openclaw/workspace/projects/_ops/scripts/openclaw_retry_preflight.py \
  --rollback-backup "$LOGDIR/00-openclaw-json-pre.json"
```

## Pass condition

The script must end with:

```text
PRECHECK RESULT: PASS
```

and, for the current deployment, it should explicitly say:

```text
rollback must restore the saved raw config backup before any 2026.3.8 restart
```

## Rollback correction for the next live attempt

If the upgrade fails after `v2026.4.12` has touched config, rollback is **not** just npm downgrade + container restart.

The rollback must be:

```bash
LOGDIR=/data/.openclaw/workspace/projects/_ops/logs/live-upgrade-2026-04-16-1300
cp "$LOGDIR/00-openclaw-json-pre.json" /data/.openclaw/openclaw.json
docker exec -i openclaw-ktrt-openclaw-1 bash -lc 'npm install -g openclaw@2026.3.8'
docker restart openclaw-ktrt-openclaw-1
```

If the raw config backup is not restored first, `2026.3.8` may be asked to boot against a Telegram streaming shape it does not accept.
