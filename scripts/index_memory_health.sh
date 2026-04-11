#!/usr/bin/env bash
# QMD memory index refresh for the Marvin workspace.
# Ensures the marvin-workspace collection exists and is up-to-date with current content.
#
# Usage:
#   bash scripts/index_memory_health.sh
#
# What it does:
#   1. Checks qmd is available; exits silently if not installed
#   2. Creates the marvin-workspace collection if it does not already exist
#   3. Runs qmd update to refresh all indexed collections
#
# When to run:
#   - After installing or upgrading QMD
#   - After adding significant new content to the workspace (e.g., new project dirs, learnings)
#   - As part of periodic memory hygiene (referenced in docs/runbooks/memory-system-health.md)
#
# See also:
#   docs/runbooks/memory-system-health.md — memory layer contracts and retrieval guidance
#   scripts/memory_recall_smoke_test.sh   — quick recall verification after indexing

set -euo pipefail

cd /data/.openclaw/workspace

if ! command -v qmd >/dev/null 2>&1; then
  echo "qmd not found — skipping index refresh"
  exit 0
fi

if ! qmd collection list | grep -q '^marvin-workspace '; then
  echo "Adding QMD workspace collection..."
  qmd collection add /data/.openclaw/workspace --name marvin-workspace
  qmd context add qmd://marvin-workspace "Marvin workspace memory, runbooks, learnings, durable memory, and project documentation for Philippe and Motion Display." || true
fi

echo "Refreshing QMD collections..."
qmd update

echo "QMD refresh complete."
