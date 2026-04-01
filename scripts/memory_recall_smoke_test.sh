#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace

if ! command -v qmd >/dev/null 2>&1; then
  echo "FAIL: qmd not installed"
  exit 1
fi

if ! qmd collection list | grep -q '^marvin-workspace '; then
  echo "FAIL: marvin-workspace collection missing"
  exit 1
fi

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

qmd search ".learnings corrections errors requests" -c marvin-workspace -n 5 >/tmp/memory-smoke-1.txt || fail "qmd search failed for learnings coverage"
grep -q ".learnings/" /tmp/memory-smoke-1.txt && pass "structured learnings are discoverable" || fail "structured learnings not found in search output"

qmd search "memory system hardening" -c marvin-workspace -n 10 >/tmp/memory-smoke-2.txt || fail "qmd search failed for memory-system query"
grep -Eq "memory-system-health|memory/2026-03-19|MEMORY.md" /tmp/memory-smoke-2.txt && pass "memory-system hardening surfaces are discoverable" || fail "memory-system hardening results missing"

qmd collection list >/tmp/memory-smoke-3.txt || fail "qmd collection list failed"
grep -q "^marvin-workspace " /tmp/memory-smoke-3.txt && pass "workspace collection is registered" || fail "workspace collection missing from collection list"

echo "OK: memory recall smoke test passed"
