#!/usr/bin/env python3
"""
Shared context management for market-intel cron jobs.

Enables cron jobs to read/write a shared context layer, allowing them to:
- Build on each other's work
- Avoid duplicate reporting
- Provide correlated insights
- Give main agent a unified overnight summary

Usage:
    from cron_context import CronContext
    
    # Read context
    ctx = CronContext.load()
    rss_summary = ctx.get_job_summary('rss-feed-monitor')
    
    # Write context
    ctx.update_job('reddit-monitor', {
        'status': 'ok',
        'items_found': 50,
        'summary': '50 posts from WSB, investing',
        'context': {'correlation': 'Iran conflict trending on both RSS + Reddit'}
    })
    ctx.save()
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

# Resolve paths from this file's location (cron-safe)
SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = SCRIPT_DIR.parents[2]  # market-intel/src/ -> market-intel/ -> workspace/
CONTEXT_PATH = WORKSPACE_ROOT / "memory" / "cron-context.json"


class CronContext:
    """Shared context for market-intel cron pipeline."""

    REQUIRED_KEYS = {
        "version": int,
        "last_updated": str,
        "pipeline": str,
        "jobs": dict,
        "alerts": list,
        "requires_attention": list,
    }

    def __init__(self, data: Optional[Dict[str, Any]] = None):
        if data:
            self.data = data
        else:
            self.data = {
                "version": 1,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "pipeline": "market-intel",
                "jobs": {},
                "alerts": [],
                "requires_attention": []
            }

    @classmethod
    def _is_valid_context(cls, data: Any) -> bool:
        """Basic schema validation for cron context structure."""
        if not isinstance(data, dict):
            return False

        for key, expected_type in cls.REQUIRED_KEYS.items():
            if key not in data or not isinstance(data[key], expected_type):
                return False

        # Guard against incompatible schema version
        if data.get("version") != 1:
            return False

        # Ensure nested collection types are sane
        if not all(isinstance(k, str) and isinstance(v, dict) for k, v in data["jobs"].items()):
            return False
        if not all(isinstance(item, dict) for item in data["alerts"]):
            return False
        if not all(isinstance(item, dict) for item in data["requires_attention"]):
            return False

        return True
    
    @classmethod
    def load(cls) -> "CronContext":
        """Load context from file, or create new if missing/invalid."""
        if CONTEXT_PATH.exists():
            try:
                with open(CONTEXT_PATH, 'r') as f:
                    data = json.load(f)

                if cls._is_valid_context(data):
                    return cls(data)

                # Invalid schema shape/version: fail-safe to fresh context
                return cls()
            except (json.JSONDecodeError, IOError, OSError):
                # Corrupted or unreadable file, start fresh
                return cls()
        return cls()
    
    def save(self) -> None:
        """Save context to file atomically."""
        self.data["last_updated"] = datetime.now(timezone.utc).isoformat()

        # Atomic write: write to temp file, then rename
        CONTEXT_PATH.parent.mkdir(parents=True, exist_ok=True)
        temp_path = CONTEXT_PATH.with_suffix('.tmp')

        with open(temp_path, 'w') as f:
            json.dump(self.data, f, indent=2)

        # Restrictive permissions on temp + final context file
        try:
            os.chmod(temp_path, 0o600)
        except OSError:
            pass

        temp_path.replace(CONTEXT_PATH)

        try:
            os.chmod(CONTEXT_PATH, 0o600)
        except OSError:
            pass
    
    def get_job(self, job_name: str) -> Optional[Dict[str, Any]]:
        """Get job data by name."""
        return self.data.get("jobs", {}).get(job_name)
    
    def get_job_summary(self, job_name: str) -> str:
        """Get job summary (empty string if not found)."""
        job = self.get_job(job_name)
        return job.get("summary", "") if job else ""
    
    def update_job(self, job_name: str, updates: Dict[str, Any]) -> None:
        """Update job data, creating if doesn't exist."""
        if "jobs" not in self.data:
            self.data["jobs"] = {}
        
        if job_name not in self.data["jobs"]:
            self.data["jobs"][job_name] = {}
        
        # Merge updates
        self.data["jobs"][job_name].update(updates)
        self.data["jobs"][job_name]["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    def add_alert(self, alert: str, severity: str = "info") -> None:
        """Add an alert to the context."""
        if "alerts" not in self.data:
            self.data["alerts"] = []
        
        self.data["alerts"].append({
            "message": alert,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def requires_attention(self, reason: str) -> None:
        """Mark that this pipeline run requires human attention."""
        if "requires_attention" not in self.data:
            self.data["requires_attention"] = []
        
        self.data["requires_attention"].append({
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def get_pipeline_summary(self) -> str:
        """Get a summary of all jobs in the pipeline."""
        lines = []
        for job_name, job_data in self.data.get("jobs", {}).items():
            status = job_data.get("status", "unknown")
            summary = job_data.get("summary", "")
            lines.append(f"{job_name}: {status} - {summary}")
        return "\n".join(lines)
    
    def get_correlations(self) -> list:
        """Find correlations between jobs (e.g., same topic in RSS + Reddit)."""
        correlations = []
        
        rss_summary = self.get_job_summary("rss-feed-monitor").lower()
        reddit_summary = self.get_job_summary("reddit-monitor").lower()
        
        # Simple keyword-based correlation
        keywords = ["iran", "oil", "war", "fed", "earnings", "ai", "trump"]
        for keyword in keywords:
            if keyword in rss_summary and keyword in reddit_summary:
                correlations.append(f"{keyword}: Trending on both RSS and Reddit")
        
        return correlations


# Convenience functions for simple usage
def load_context() -> CronContext:
    """Load context from file."""
    return CronContext.load()


def update_job_context(job_name: str, updates: Dict[str, Any]) -> None:
    """Quick update: load, update, save."""
    ctx = CronContext.load()
    ctx.update_job(job_name, updates)
    ctx.save()


if __name__ == "__main__":
    # Test/demo mode
    print(f"Context path: {CONTEXT_PATH}")
    print(f"Context exists: {CONTEXT_PATH.exists()}")
    
    if CONTEXT_PATH.exists():
        ctx = CronContext.load()
        print(f"\nPipeline: {ctx.data.get('pipeline')}")
        print(f"Last updated: {ctx.data.get('last_updated')}")
        print(f"\nJobs:")
        for job_name, job_data in ctx.data.get("jobs", {}).items():
            print(f"  {job_name}: {job_data.get('status')} - {job_data.get('summary', '')[:50]}")
