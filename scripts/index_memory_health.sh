#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace

if ! command -v qmd >/dev/null 2>&1; then
  echo "qmd not found"
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
