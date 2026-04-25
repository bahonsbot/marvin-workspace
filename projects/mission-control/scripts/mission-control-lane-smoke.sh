#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/data/.openclaw/workspace/projects/mission-control"
cd "$PROJECT_DIR"

BASE_URL="${MISSION_CONTROL_LANE_SMOKE_BASE_URL:-http://127.0.0.1:3005}"

if [[ -x ./scripts/mission-control-service-health.sh ]]; then
  ./scripts/mission-control-service-health.sh
fi

check_descriptor() {
  local host="$1"
  local expected_lane="$2"
  local expected_version="$3"
  local expected_transport="$4"
  local expected_browser_token_relay="$5"

  echo "[lane-smoke] checking $host"

  local payload
  payload="$(curl -fsS -m 20 -H "Host: $host" "$BASE_URL/api/runtime-bridge?fresh=1")"

  PAYLOAD="$payload" HOST_LABEL="$host" EXPECTED_LANE="$expected_lane" EXPECTED_VERSION="$expected_version" EXPECTED_TRANSPORT="$expected_transport" EXPECTED_BROWSER_TOKEN_RELAY="$expected_browser_token_relay" python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ['PAYLOAD'])
host = os.environ['HOST_LABEL']
expected_lane = os.environ['EXPECTED_LANE']
expected_version = os.environ['EXPECTED_VERSION']
expected_transport = os.environ['EXPECTED_TRANSPORT']
expected_browser_token_relay = os.environ['EXPECTED_BROWSER_TOKEN_RELAY'].lower() == 'true'

bridge = payload.get('runtimeBridge') or {}
transport = bridge.get('transport') or {}
auth = bridge.get('auth') or {}
endpoints = bridge.get('endpoints') or {}
capabilities = bridge.get('capabilities') or {}

failures = []

def expect(label, actual, expected):
    if actual != expected:
        failures.append(f"{label}: expected {expected!r}, got {actual!r}")

expect('runtimeBridgeLane', payload.get('runtimeBridgeLane'), expected_lane)
expect('descriptorVersion', bridge.get('descriptorVersion'), expected_version)
expect('runtimeBridge.status', bridge.get('status'), 'ready')
expect('transport.kind', transport.get('kind'), expected_transport)
expect('auth.browserTokenRelay', auth.get('browserTokenRelay'), expected_browser_token_relay)

if expected_lane in {'live', 'lab'}:
    expect('auth.serverConnectConfigured', auth.get('serverConnectConfigured'), True)
    expect('capabilities.eventStream', capabilities.get('eventStream'), True)
    if endpoints.get('websocketBridgeToken'):
        failures.append('live/lab descriptor exposed websocketBridgeToken')
    if endpoints.get('gatewaySessionToken'):
        failures.append('live/lab descriptor exposed gatewaySessionToken')

if expected_lane == 'preview':
    expect('auth.serverConnectConfigured', auth.get('serverConnectConfigured'), True)
    if not endpoints.get('websocketBridgeToken'):
        failures.append('preview descriptor did not expose websocketBridgeToken')

if failures:
    print(f"[fail] {host}")
    for failure in failures:
        print(f"  - {failure}")
    sys.exit(1)

print(
    f"[ok] {host}: lane={payload.get('runtimeBridgeLane')} "
    f"descriptor={bridge.get('descriptorVersion')} transport={transport.get('kind')} "
    f"browserTokenRelay={auth.get('browserTokenRelay')}"
)
PY
}

check_descriptor "dashboard.motiondisplay.cloud" "live" "v3" "http+ws-live" "false"
check_descriptor "lab.motiondisplay.cloud" "lab" "v3" "http+ws-live" "false"
check_descriptor "preview.motiondisplay.cloud" "preview" "v2" "http-poll+ws-sidecar" "true"

echo "[ok] Mission Control lane smoke passed"
