# Mission Control host-side persistence diagnostic — 2026-04-24

## Purpose
Use this checklist to identify **where the real OpenClaw container boot command and runtime config are actually sourced from** on the Hostinger VPS, and whether Hostinger is regenerating them on restart.

This is a diagnostic step before the next Mission Control boot cutover retry.

## The core question
When the container restarts, what system is re-creating its command and config?

If the answer is "Hostinger panel state" or some generated deployment layer, then changing the command only inside a live shell will never persist.

## What this checklist is trying to prove
We want to establish which of these is true:

1. the real source of truth is a compose or YAML file on disk
2. the real source of truth is a Hostinger-managed deployment template or panel setting
3. the container is being re-created from an image/start command that ignores local runtime edits
4. some config files are mounted and persist, but startup command/runtime env are regenerated on each restart

## Signals already seen
These previous observations strongly suggest nontrivial Hostinger regeneration behavior:
- the Mission Control wrapper works when launched manually
- after a real restart, the container appears to return to the old boot behavior
- prior config cleanup attempts around Nexos models also appeared to revert on restart

So the burden of proof is now on identifying the **host-level source of truth**.

## Diagnostic checklist

### 1. Capture the current container identity
Record:
- container name
- image name
- container ID
- restart policy
- current command/entrypoint as seen by Docker

Suggested commands:

```bash
docker ps --no-trunc
```

```bash
docker inspect <container_name_or_id>
```

Important fields to capture from `docker inspect`:
- `Config.Cmd`
- `Config.Entrypoint`
- `Path`
- `Args`
- `HostConfig.RestartPolicy`
- labels that might indicate a platform-managed deployment

### 2. Check whether the running container command is generated, not hand-authored
If `docker inspect` shows the container still launches plain `node server.mjs` after your earlier changes, that is strong evidence the live source of truth is elsewhere.

### 3. Search the host for compose/deployment definitions
Look for likely sources on disk:

```bash
find / -maxdepth 4 \( -name 'docker-compose.yml' -o -name 'compose.yml' -o -name 'compose.yaml' -o -name '*.stack.yml' -o -name '*.yaml' -o -name '*.yml' \) 2>/dev/null
```

Also inspect likely app/deploy directories manually if known.

### 4. Search specifically for the old boot command
Search the host for references to:

```text
node server.mjs
```

and for the wrapper command path:

```text
openclaw-container-command-with-mission-control.sh
```

Suggested commands:

```bash
grep -R "node server.mjs" /etc /opt /srv /root /home /data 2>/dev/null
```

```bash
grep -R "openclaw-container-command-with-mission-control.sh" /etc /opt /srv /root /home /data 2>/dev/null
```

### 5. Look for Hostinger-specific regeneration clues
Check for:
- generated compose files
- deployment manifests under platform-managed directories
- comments or labels indicating a managed stack
- restart hooks or provisioning scripts
- admin panels that expose image/command/environment separately from on-disk files

### 6. Check whether runtime config persists differently from startup command
Compare what survives restart:
- mounted files under `/data/.openclaw`
- workspace files under `/data/.openclaw/workspace`
- container command
- image environment
- generated startup command

This helps distinguish:
- persistent volume state
- from non-persistent container runtime definition

### 7. Inspect container labels and metadata for platform ownership
From `docker inspect`, pay attention to labels that may reveal:
- compose project name
- platform deploy IDs
- panel-managed stack names
- auto-regeneration or orchestration ownership

### 8. If the panel is the source of truth, stop editing only inside the container
If Hostinger is restoring command/env/image settings from its own deployment record, then the next cutover must be applied in that control plane, not only in a shell session.

### 9. Decide which persistence model is real
At the end of the check, classify the environment as one of these:

#### Model A — file-backed deployment
- a compose or deploy file on disk is the real source of truth
- next action: patch that file and redeploy

#### Model B — panel-backed deployment
- Hostinger panel or managed deployment state is the real source of truth
- next action: patch the startup command in the panel/control surface itself

#### Model C — mixed model
- volumes/workspace persist, but container runtime definition is panel/generated
- next action: treat code/scripts as persistent, but apply command/env changes only in the deployment control plane

## Minimum evidence to collect before retrying cutover
Before the next attempt, have these three facts in hand:

1. what exact system defines the container command today
2. what exact command that system currently stores
3. how to update that system so the wrapper command survives a real restart

## Recommended output format
When reporting back, capture:
- container name / image / restart policy
- `docker inspect` command/entrypoint summary
- whether `node server.mjs` still appears in the managed definition
- whether the wrapper command appears anywhere persistent
- whether Hostinger panel/deployment UI appears to be the actual source of truth

## Bottom line
Do not retry the Mission Control boot cutover until the persistence source of truth is identified.
The next successful cutover depends less on the wrapper script now, and more on changing the **real boot-definition owner**.
