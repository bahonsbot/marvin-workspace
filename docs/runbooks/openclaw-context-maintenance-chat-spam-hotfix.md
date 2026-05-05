# OpenClaw Context-Maintenance Chat Spam Hotfix

## Purpose
Restore a local runtime hotfix when OpenClaw updates or reinstalls reintroduce disruptive `Context engine turn maintenance` chat noise.

## Symptom
User-visible chat/channel noise such as:
- `Background task update: Context engine turn maintenance. Deferred maintenance is still running.`
- `Background task done: Context engine turn maintenance...`
- heartbeat-looking wake text that appears much more often than the configured 180-minute heartbeat cadence

## Root cause
The real heartbeat cadence can still be healthy while installed OpenClaw runtime code auto-delivers deferred `context_engine_turn_maintenance` task updates into chat.

In the affected runtime path:
- deferred maintenance tasks are created by the embedded runner
- task visibility can be promoted to `state_changes`
- task-registry auto-delivers those state changes / terminal updates
- the delivery path can enqueue system events and request immediate heartbeat wakes

This is an installed-runtime issue under:
- `/data/.npm-global/lib/node_modules/openclaw/dist/`

It is not fixed by changing `HEARTBEAT.md` alone.

## Local hotfix location
File:
- `/data/.npm-global/lib/node_modules/openclaw/dist/task-registry-DfxdgLn1.js`

Expected local patch:
```js
function isContextEngineTurnMaintenanceTask(task) {
	return task?.taskKind === "context_engine_turn_maintenance";
}
function shouldAutoDeliverTaskTerminalUpdate(task) {
	if (isContextEngineTurnMaintenanceTask(task)) return false;
	...
}
function shouldAutoDeliverTaskStateChange(task) {
	if (isContextEngineTurnMaintenanceTask(task)) return false;
	...
}
```

Meaning:
- suppress terminal auto-delivery for `context_engine_turn_maintenance`
- suppress state-change auto-delivery for `context_engine_turn_maintenance`

## Reapply procedure
1. Confirm the symptom is real
   - verify `HEARTBEAT.md` / heartbeat logs still show the expected 180-minute cadence
   - verify chat noise includes `Context engine turn maintenance` or similar maintenance-task progress/done lines

2. Confirm the runtime file no longer contains the guard
   - inspect `/data/.npm-global/lib/node_modules/openclaw/dist/task-registry-DfxdgLn1.js`
   - look for `isContextEngineTurnMaintenanceTask(task)` and the two early `return false` guards

3. Reapply the patch if missing
   - add:
     - `function isContextEngineTurnMaintenanceTask(task) { return task?.taskKind === "context_engine_turn_maintenance"; }`
   - update:
     - `shouldAutoDeliverTaskTerminalUpdate(task)` to early-return `false`
     - `shouldAutoDeliverTaskStateChange(task)` to early-return `false`

4. Activate the patch
   - send a gateway-only `SIGUSR1` restart so the running gateway reloads the installed dist code
   - prefer the minimal supported gateway restart path, not a full container bounce
   - warn Philippe before restart because the session/UI may briefly blink or disconnect

5. Verify activation
   - log should show the restart actually completed, for example:
     - `received SIGUSR1; restarting`
     - `all active work drained`
     - `restart mode: full process restart (...)` or a clear in-process restart path
     - gateway `ready`
   - confirm the heartbeat subsystem still reports the real interval, e.g. `intervalMs: 10800000`
   - confirm no new `Background task update/done: Context engine turn maintenance` lines appear after restart
   - optionally inspect `/data/.openclaw/tasks/runs.sqlite` for new `context_engine_turn_maintenance` rows and confirm they are no longer being auto-delivered into chat

## Validation commands
### Check whether the patch is present
```bash
python3 - <<'PY'
from pathlib import Path
p = Path('/data/.npm-global/lib/node_modules/openclaw/dist/task-registry-DfxdgLn1.js')
text = p.read_text(encoding='utf-8', errors='ignore')
for needle in [
    'function isContextEngineTurnMaintenanceTask',
    'if (isContextEngineTurnMaintenanceTask(task)) return false;'
]:
    print(needle, needle in text)
PY
```

### Check restart / readiness evidence
```bash
grep -nE 'signal SIGUSR1 received|received SIGUSR1;|all active work drained|restart mode:|heartbeat: started|ready' /tmp/openclaw/openclaw-$(date +%F).log | tail -n 80
```

### Check for leaked maintenance-task chat lines
```bash
grep -nE 'Background task update: Context engine turn maintenance|Background task done: Context engine turn maintenance' /tmp/openclaw/openclaw-$(date +%F).log | tail -n 40
```

## Known caveats
- This is a local installed-dist hotfix, not a durable workspace-source fix.
- npm reinstall/update/rebuild can wipe it.
- Future upstream code changes may rename the bundled file or function layout.
- Gateway restart can defer until active work drains; one signal may only queue restart authorization. Verify completion before claiming success.

## Related references
- `memory/2026-05-05.md` — investigation, activation, and verification log
- `projects/_ops/openclaw-exec-completion-leak-patch-proposal-2026-04-17.md` — related upstream leak pattern for hidden internal system/task text
- `docs/runbooks/memory-system-health.md` — heartbeat/dreaming/memory health context
