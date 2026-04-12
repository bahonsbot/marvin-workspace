#!/usr/bin/env node

const http = require('node:http');
const net = require('node:net');
const { URL } = require('node:url');
const { WebSocketServer, WebSocket } = require('ws');

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function isLoopbackAddress(value) {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1' || value === 'localhost';
}

function isLocalRequest(req) {
  const forwardedFor = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
  const hostHeader = req.headers.host?.split(':')[0]?.trim();
  return isLoopbackAddress(req.socket.remoteAddress || '') || isLoopbackAddress(forwardedFor || '') || isLoopbackAddress(hostHeader || '');
}

function parseBasicAuthHeader(headerValue) {
  if (!headerValue || !headerValue.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = Buffer.from(headerValue.slice('Basic '.length).trim(), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      pass: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function hasValidBasicAuth(req) {
  const expectedUser = process.env.MISSION_CONTROL_BASIC_AUTH_USER;
  const expectedPass = process.env.MISSION_CONTROL_BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return false;
  }

  const parsed = parseBasicAuthHeader(req.headers.authorization);
  return Boolean(parsed && parsed.user === expectedUser && parsed.pass === expectedPass);
}

function isSameOriginUpgrade(req, requestUrl) {
  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const hostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;

  if (!originHeader || !hostHeader) {
    return false;
  }

  try {
    const originUrl = new URL(originHeader);
    return originUrl.host === hostHeader && originUrl.pathname === '/' && requestUrl.pathname === publicWsPath;
  } catch {
    return false;
  }
}

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

const publicHost = (process.env.MISSION_CONTROL_PREVIEW_HOST || '0.0.0.0').trim();
const publicPort = parsePort(process.env.MISSION_CONTROL_PREVIEW_PORT, 3005);
const internalNextHost = (process.env.MISSION_CONTROL_PREVIEW_INTERNAL_HOST || '127.0.0.1').trim();
const internalNextPort = parsePort(process.env.MISSION_CONTROL_PREVIEW_INTERNAL_PORT, 3007);
const publicWsPath = (process.env.MISSION_CONTROL_WS_PUBLIC_PATH || '/api/runtime-bridge/ws').trim();
const sidecarHost = (process.env.MISSION_CONTROL_WS_SIDECAR_HOST || '127.0.0.1').trim();
const sidecarPort = parsePort(process.env.MISSION_CONTROL_WS_SIDECAR_PORT, 3006);
const sidecarPath = (process.env.MISSION_CONTROL_WS_SIDECAR_PATH || '/mission-control-runtime').trim();
const bridgeToken = process.env.MISSION_CONTROL_WS_SIDECAR_TOKEN || '';

if (!bridgeToken) {
  console.error('[mission-control-preview-proxy] Refusing to start without MISSION_CONTROL_WS_SIDECAR_TOKEN.');
  process.exit(1);
}

const sidecarTarget = `ws://${sidecarHost}:${sidecarPort}${sidecarPath}`;
const wss = new WebSocketServer({ noServer: true });

const server = http.createServer((req, res) => {
  const request = http.request(
    {
      host: internalNextHost,
      port: internalNextPort,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: req.headers.host,
        'x-forwarded-host': req.headers.host,
        'x-forwarded-proto': req.socket.encrypted ? 'https' : 'http',
        'x-forwarded-for': req.socket.remoteAddress || '',
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  request.on('error', (cause) => {
    console.error('[mission-control-preview-proxy] HTTP proxy error:', cause instanceof Error ? cause.message : String(cause));
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    }
    res.end('Mission Control preview proxy could not reach the Next.js server.');
  });

  req.pipe(request);
});

server.on('upgrade', (req, socket, head) => {
  let requestUrl;

  try {
    requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  } catch {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  if (requestUrl.pathname !== publicWsPath) {
    const upstreamSocket = net.connect(internalNextPort, internalNextHost, () => {
      let rawRequest = `${req.method || 'GET'} ${req.url || '/'} HTTP/${req.httpVersion}\r\n`;
      for (const [name, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            rawRequest += `${name}: ${item}\r\n`;
          }
        } else if (typeof value === 'string') {
          rawRequest += `${name}: ${value}\r\n`;
        }
      }
      rawRequest += '\r\n';
      upstreamSocket.write(rawRequest);
      if (head.length > 0) {
        upstreamSocket.write(head);
      }
      socket.pipe(upstreamSocket).pipe(socket);
    });

    upstreamSocket.on('error', () => {
      socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
    });
    return;
  }

  const tokenMatches = requestUrl.searchParams.get('bridgeToken') === bridgeToken;
  const localRequest = isLocalRequest(req);
  const basicAuthValid = hasValidBasicAuth(req);
  const sameOrigin = isSameOriginUpgrade(req, requestUrl);

  if (!tokenMatches) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!localRequest && !basicAuthValid && !sameOrigin) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    wss.emit('connection', client);
  });
});

wss.on('connection', (client) => {
  const clientId = Math.random().toString(36).slice(2, 9);
  console.log(`[mission-control-preview-proxy] Browser WS connected [${clientId}] total=${wss.clients.size}`);

  const upstreamUrl = new URL(sidecarTarget);
  upstreamUrl.searchParams.set('bridgeToken', bridgeToken);
  const upstream = new WebSocket(upstreamUrl);

  upstream.on('open', () => {
    console.log(`[mission-control-preview-proxy] Sidecar WS open [${clientId}]`);
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
    console.error(`[mission-control-preview-proxy] Sidecar WS error [${clientId}]:`, cause instanceof Error ? cause.message : String(cause));
    closePair(client, upstream, 1011, 'Mission Control sidecar unavailable');
  });

  upstream.on('close', (code, reason) => {
    console.log(`[mission-control-preview-proxy] Sidecar WS closed [${clientId}] code=${code} reason="${reason}"`);
    closePair(client, upstream, code || 1011, reason.toString() || 'Mission Control sidecar closed');
  });

  client.on('close', (code, reason) => {
    console.log(`[mission-control-preview-proxy] Browser WS closed [${clientId}] code=${code} reason="${reason}" total=${wss.clients.size}`);
    closePair(client, upstream, code || 1000, reason.toString() || 'Client closed');
  });

  client.on('error', (cause) => {
    console.error(`[mission-control-preview-proxy] Browser WS error [${clientId}]:`, cause instanceof Error ? cause.message : String(cause));
    closePair(client, upstream, 1011, 'Browser socket error');
  });
});

function shutdown() {
  for (const client of wss.clients) {
    client.close(1001, 'Mission Control preview proxy stopping');
  }
  wss.close(() => {
    server.close(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('error', (cause) => {
  console.error('[mission-control-preview-proxy] Server error:', cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
});

server.listen(publicPort, publicHost, () => {
  console.log(`[mission-control-preview-proxy] Listening on http://${publicHost}:${publicPort}`);
  console.log(`[mission-control-preview-proxy] Forwarding HTTP to http://${internalNextHost}:${internalNextPort}`);
  console.log(`[mission-control-preview-proxy] Forwarding ${publicWsPath} to ${sidecarTarget}`);
});
