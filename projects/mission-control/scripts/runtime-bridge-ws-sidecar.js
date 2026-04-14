#!/usr/bin/env node

const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { URL } = require('node:url');
const { WebSocketServer, WebSocket } = require('ws');

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function readGatewayTarget() {
  const configured = process.env.MISSION_CONTROL_WS_TARGET;
  if (configured) {
    return configured.trim();
  }

  try {
    const stdout = execFileSync('bash', ['-lc', 'openclaw status --json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(stdout);
    const target = parsed?.gateway?.url;
    return typeof target === 'string' ? target.trim() : '';
  } catch (cause) {
    console.error('[mission-control-ws-sidecar] Could not resolve gateway target from openclaw status:', cause instanceof Error ? cause.message : String(cause));
    return '';
  }
}

function parseMs(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

const host = (process.env.MISSION_CONTROL_WS_SIDECAR_HOST || '127.0.0.1').trim();
const port = parsePort(process.env.MISSION_CONTROL_WS_SIDECAR_PORT, 3006);
const path = (process.env.MISSION_CONTROL_WS_SIDECAR_PATH || '/mission-control-runtime').trim();
const upstreamOrigin = (process.env.MISSION_CONTROL_WS_UPSTREAM_ORIGIN || '').trim();
const bridgeToken = process.env.MISSION_CONTROL_WS_SIDECAR_TOKEN || '';
const targetCacheTtlMs = parseMs(process.env.MISSION_CONTROL_WS_TARGET_CACHE_TTL_MS, 30000);
if (!bridgeToken) {
  console.error('[mission-control-ws-sidecar] Refusing to start without MISSION_CONTROL_WS_SIDECAR_TOKEN.');
  process.exit(1);
}

let cachedTarget = null;
let cachedTargetExpiresAt = 0;

function normalizeTarget(target) {
  if (!target) {
    return null;
  }

  try {
    const targetUrl = new URL(target);
    if (!['ws:', 'wss:'].includes(targetUrl.protocol)) {
      console.error('[mission-control-ws-sidecar] Gateway target must use ws:// or wss://:', target);
      return null;
    }
    return target;
  } catch {
    console.error('[mission-control-ws-sidecar] Invalid gateway target:', target);
    return null;
  }
}

function refreshCachedTarget() {
  const target = normalizeTarget(readGatewayTarget());
  cachedTarget = target;
  cachedTargetExpiresAt = Date.now() + targetCacheTtlMs;
  return cachedTarget;
}

function getTarget({ forceRefresh = false } = {}) {
  if (forceRefresh || !cachedTarget || Date.now() >= cachedTargetExpiresAt) {
    return refreshCachedTarget();
  }
  return cachedTarget;
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    const target = getTarget();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: Boolean(target), target, path, port }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true });

function normalizeCloseCode(code, fallback) {
  if (!Number.isInteger(code)) return fallback;
  if (code >= 3000 && code <= 4999) return code;
  const allowed = new Set([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014]);
  return allowed.has(code) ? code : fallback;
}

function normalizeCloseReason(reason, fallback) {
  const value = typeof reason === 'string' ? reason : reason?.toString?.() || '';
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : fallback;
}

function closePair(client, upstream, code, reason) {
  const safeClientCode = normalizeCloseCode(code, 1011);
  const safeUpstreamCode = normalizeCloseCode(code, 1000);
  const safeReason = normalizeCloseReason(reason, 'Socket closed');

  if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
    client.close(safeClientCode, safeReason);
  }
  if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) {
    upstream.close(safeUpstreamCode, safeReason);
  }
}

server.on('upgrade', (req, socket, head) => {
  let requestUrl;

  try {
    requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  } catch {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  if (requestUrl.pathname !== path) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  if (requestUrl.searchParams.get('bridgeToken') !== bridgeToken) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    wss.emit('connection', client, req);
  });
});

wss.on('connection', (client) => {
  const clientId = Math.random().toString(36).slice(2, 9);
  console.log(`[mission-control-ws-sidecar] Connection opened [${clientId}] total=${wss.clients.size}`);

  let target = getTarget();
  if (!target) {
    client.close(1013, 'Gateway target unresolved');
    return;
  }

  let refreshedAfterFailure = false;

  function openUpstream(currentTarget) {
    const upstream = new WebSocket(currentTarget, {
      headers: upstreamOrigin ? { origin: upstreamOrigin } : undefined,
    });

    upstream.on('open', () => {
      console.log(`[mission-control-ws-sidecar] Upstream WS open [${clientId}]`);
      client.on('message', (data, isBinary) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data, { binary: isBinary });
        }
      });
    });

    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });

    upstream.on('error', (cause) => {
      console.error(`[mission-control-ws-sidecar] Upstream WS error [${clientId}]:`, cause instanceof Error ? cause.message : String(cause));
      if (!refreshedAfterFailure) {
        const refreshedTarget = getTarget({ forceRefresh: true });
        refreshedAfterFailure = true;
        if (refreshedTarget && refreshedTarget !== currentTarget) {
          console.log(`[mission-control-ws-sidecar] Retrying upstream WS with refreshed target [${clientId}]`);
          openUpstream(refreshedTarget);
          return;
        }
      }
      closePair(client, upstream, 1011, 'Upstream gateway unavailable');
    });

    upstream.on('close', (code, reason) => {
      console.log(`[mission-control-ws-sidecar] Upstream WS closed [${clientId}] code=${code} reason="${reason}"`);
      closePair(client, upstream, code || 1011, reason.toString() || 'Upstream gateway closed');
    });

    client.on('close', (code, reason) => {
      console.log(`[mission-control-ws-sidecar] Client WS closed [${clientId}] code=${code} reason="${reason}" total=${wss.clients.size}`);
      closePair(client, upstream, code || 1000, reason.toString() || 'Client closed');
    });

    client.on('error', (cause) => {
      console.error(`[mission-control-ws-sidecar] Client WS error [${clientId}]:`, cause instanceof Error ? cause.message : String(cause));
      closePair(client, upstream, 1011, 'Client WS error');
    });
  }

  openUpstream(target);
});

function shutdown() {
  for (const client of wss.clients) {
    client.close(1001, 'Mission Control WS sidecar stopping');
  }
  wss.close(() => {
    server.close(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('error', (cause) => {
  console.error('[mission-control-ws-sidecar] Server error:', cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[mission-control-ws-sidecar] Listening on ws://${host}:${port}${path}`);
  console.log(`[mission-control-ws-sidecar] Initial proxy target ${getTarget() || 'unresolved'}`);
});
