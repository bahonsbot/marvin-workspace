# Cron Runner Wave 1 Scaffold Note

## Entry point

```bash
python3 scripts/cron_runner.py --task <task-name>
```

Optional flags:
- `--list-tasks`
- `--dry-run`
- `--json`

## Registry

Task registry lives at:
- `scripts/cron_runner_tasks.py`

Each task defines:
- `name`
- `kind` (`script_only`)
- `cwd`
- `command`
- `timeout_seconds`
- `lock_name`
- `notify_policy`
- `artifacts`

Wave 1 tasks included:
- `data-manager`
- `entity-lifecycle-manager`
- `dependency-update-audit`
- `weekly-test-suite`

## Logging and locks

- Run log JSONL: `memory/cron-run-log.jsonl`
- Per-run details logs: `memory/cron-run-details/`
- Lock files: `memory/locks/`

Lock behavior:
- active lock: task is skipped
- stale lock: lock file is recovered and task continues
