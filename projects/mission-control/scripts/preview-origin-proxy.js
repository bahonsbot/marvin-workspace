#!/usr/bin/env node

const http = require('node:http');
const net = require('node:net');
const { URL } = require('node:url');

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

  const clientId = Math.random().toString(36).slice(2, 9);
  const upstreamSocket = net.connect(sidecarPort, sidecarHost, () => {
    console.log(`[mission-control-preview-proxy] Runtime WS tunnel open [${clientId}]`);
    const upstreamPath = `${sidecarPath}${requestUrl.search || ''}`;
    let rawRequest = `${req.method || 'GET'} ${upstreamPath} HTTP/${req.httpVersion}\r\n`;
    for (const [name, value] of Object.entries(req.headers)) {
      if (name.toLowerCase() === 'host') continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          rawRequest += `${name}: ${item}\r\n`;
        }
      } else if (typeof value === 'string') {
        rawRequest += `${name}: ${value}\r\n`;
      }
    }
      rawRequest += `host: ${sidecarHost}:${sidecarPort}\r\n`;
      rawRequest += '\r\n';
      upstreamSocket.write(rawRequest);
      if (head.length > 0) {
        upstreamSocket.write(head);
      }
      socket.pipe(upstreamSocket).pipe(socket);
  });

  upstreamSocket.on('error', (cause) => {
    console.error(`[mission-control-preview-proxy] Runtime WS tunnel error [${clientId}]:`, cause instanceof Error ? cause.message : String(cause));
    if (!socket.destroyed) {
      socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
    }
  });

  upstreamSocket.on('close', () => {
    console.log(`[mission-control-preview-proxy] Runtime WS tunnel closed [${clientId}]`);
    if (!socket.destroyed) {
      socket.end();
    }
  });

  socket.on('close', () => {
    if (!upstreamSocket.destroyed) {
      upstreamSocket.end();
    }
  });

  socket.on('error', (cause) => {
    console.error(`[mission-control-preview-proxy] Browser WS tunnel error [${clientId}]:`, cause instanceof Error ? cause.message : String(cause));
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  });
});

function shutdown() {
  server.close(() => process.exit(0));
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
