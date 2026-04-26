"""
Cron Runner Tasks - Task definitions for cron_runner.py.

This module defines the declarative task registry used by scripts/cron_runner.py.
Each task specifies: name, kind, cwd, command, timeout, lock, notify policy, and artifacts.

Adding a new cron job:
1. Add task definition to TASKS dict below
2. Run: python3 scripts/cron_runner.py --list-tasks (verify it appears)
3. Add to OpenClaw cron jobs.json with appropriate schedule
"""

from __future__ import annotations

from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent

TASKS = {
    "audit-sensitive-snapshot": {
        "name": "audit-sensitive-snapshot",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/audit_sensitive_snapshot.py"],
        "timeout_seconds": 120,
        "lock_name": "audit-sensitive-snapshot",
        "notify_policy": "failure",
        "artifacts": ["logs/security-sensitive-state.tsv", "logs/security-actions.jsonl"],
    },
    "session-log-cleanup": {
        "name": "session-log-cleanup",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/session_log_cleanup.py"],
        "timeout_seconds": 120,
        "lock_name": "session-log-cleanup",
        "notify_policy": "failure",
        "artifacts": [],
    },
    "data-manager": {
        "name": "data-manager",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/data_manager.py"],
        "timeout_seconds": 300,
        "lock_name": "data-manager",
        "notify_policy": "failure",
        "artifacts": [],
    },
    "entity-lifecycle-manager": {
        "name": "entity-lifecycle-manager",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/lifecycle_entities.py", "--dry-run"],
        "timeout_seconds": 120,
        "lock_name": "entity-lifecycle-manager",
        "notify_policy": "failure",
        "artifacts": ["memory/health-council/entity-lifecycle-YYYY-MM-DD.md"],
    },
    "dependency-update-audit": {
        "name": "dependency-update-audit",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/dependency_update_audit.py"],
        "timeout_seconds": 300,
        "lock_name": "dependency-update-audit",
        "notify_policy": "failure",
        "artifacts": ["memory/health-council/dependency-audit-YYYY-MM-DD.md"],
    },
    "weekly-test-suite": {
        "name": "weekly-test-suite",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/weekly_test_suite.py"],
        "timeout_seconds": 600,
        "lock_name": "weekly-test-suite",
        "notify_policy": "failure",
        "artifacts": ["memory/health-council/test-suite-YYYY-MM-DD.md"],
    },
    "rss-feed-monitor": {
        "name": "rss-feed-monitor",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/rss_feed_monitor.py"],
        "timeout_seconds": 300,
        "lock_name": "rss-feed-monitor",
        "notify_policy": "failure",
        "artifacts": ["projects/market-intel/data/rss_alerts.json", "memory/cron-context.json"],
    },
    "rss-feed-monitor-weekend-light": {
        "name": "rss-feed-monitor-weekend-light",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/rss_feed_monitor.py"],
        "timeout_seconds": 300,
        "lock_name": "rss-feed-monitor",
        "notify_policy": "failure",
        "artifacts": ["projects/market-intel/data/rss_alerts.json", "memory/cron-context.json"],
    },
    "custom-news-feed-monitor": {
        "name": "custom-news-feed-monitor",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/custom_news_feed_monitor.py"],
        "timeout_seconds": 360,
        "lock_name": "custom-news-feed-monitor",
        "notify_policy": "failure",
        "artifacts": ["projects/mission-control/data/custom-news-briefings.json"],
    },
    "reddit-monitor": {
        "name": "reddit-monitor",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/reddit_monitor.py"],
        "timeout_seconds": 300,
        "lock_name": "reddit-monitor",
        "notify_policy": "failure",
        "artifacts": ["projects/market-intel/data/reddit_alerts.json", "memory/cron-context.json"],
    },
    "reddit-monitor-weekend-light": {
        "name": "reddit-monitor-weekend-light",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/reddit_monitor.py"],
        "timeout_seconds": 300,
        "lock_name": "reddit-monitor",
        "notify_policy": "failure",
        "artifacts": ["projects/market-intel/data/reddit_alerts.json", "memory/cron-context.json"],
    },
    "auto-signal-dispatcher": {
        "name": "auto-signal-dispatcher",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT / "projects" / "autonomous-trading-bot"),
        "command": ["python3", "scripts/dispatch_market_intel_signals.py", "--quiet"],
        "timeout_seconds": 180,
        "lock_name": "auto-signal-dispatcher",
        "notify_policy": "failure",
        "artifacts": ["projects/autonomous-trading-bot/data/state/auto_signal_dispatch.json"],
    },
    "trading-daily-report": {
        "name": "trading-daily-report",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/trading_daily_report.py"],
        "timeout_seconds": 180,
        "lock_name": "trading-daily-report",
        "notify_policy": "failure",
        "artifacts": ["projects/autonomous-trading-bot/logs/webhook_decisions.jsonl"],
    },
    "pre-market-brief": {
        "name": "pre-market-brief",
        "kind": "script_only",
        "cwd": str(WORKSPACE_ROOT),
        "command": ["python3", "scripts/cron_tasks/pre_market_brief.py"],
        "timeout_seconds": 300,
        "lock_name": "pre-market-brief",
        "notify_policy": "failure",
        "artifacts": ["projects/manual-trading-brief/src/brief_generator.py"],
    },
}


def get_task(name: str):
    return TASKS.get(name)


def list_task_names():
    return sorted(TASKS.keys())
