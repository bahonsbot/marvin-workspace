import { promises as fs } from 'node:fs';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';
import { runJsonCommand } from '@/lib/adapters/runtime';
import type { RuntimeBridgeLane } from '@/lib/runtime-bridge-lane';
import { getRuntimeBridgeSidecarDescriptor } from '@/lib/runtime-bridge-sidecar';

const RUNTIME_BRIDGE_POLL_INTERVAL_MS = 15000;
const ORCHESTRATOR_SUMMARY_CACHE_TTL_MS = 15000;
const OPENCLAW_STATUS_TIMEOUT_MS = 30000;
const MAIN_SESSION_KEY = 'agent:main:main';
const MAIN_SESSION_REGISTRY_PATH = '/data/.openclaw/agents/main/sessions/sessions.json';

type OpenClawStatusRaw = {
  defaultAgentId?: string;
  gateway?: {
    mode?: string;
    url?: string;
    reachable?: boolean;
    self?: { version?: string };
  };
  sessions?: {
    count?: number;
    recent?: Array<{
      key?: string;
      updatedAt?: number;
      age?: number;
      kind?: string;
      model?: string;
      thinkingLevel?: string | null;
      percentUsed?: number | null;
      totalTokens?: number | null;
      contextTokens?: number | null;
    }>;
  };
};

type SessionRegistryEntry = {
  sessionId?: string;
  updatedAt?: number;
  modelOverride?: string | null;
  providerOverride?: string | null;
  thinkingLevel?: string | null;
};

type SessionRegistryRaw = Record<string, SessionRegistryEntry>;

type OrchestratorSummaryCacheEntry = {
  value: OrchestratorIntegrationSummary;
  expiresAt: number;
};

const orchestratorSummaryCache = new Map<RuntimeBridgeLane, OrchestratorSummaryCacheEntry>();
const orchestratorSummaryPromise = new Map<RuntimeBridgeLane, Promise<OrchestratorIntegrationSummary>>();

function storeOrchestratorSummary(
  lane: RuntimeBridgeLane,
  value: OrchestratorIntegrationSummary,
  ttlMs = ORCHESTRATOR_SUMMARY_CACHE_TTL_MS,
): OrchestratorIntegrationSummary {
  orchestratorSummaryCache.set(lane, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

function readCachedOrchestratorSummary(lane: RuntimeBridgeLane): OrchestratorSummaryCacheEntry | null {
  return orchestratorSummaryCache.get(lane) ?? null;
}

function toIso(value?: number): string | null {
  return typeof value === 'number' ? new Date(value).toISOString() : null;
}

function isRunSession(key?: string): boolean {
  return typeof key === 'string' && key.includes(':run:');
}

function isRootSession(key?: string): boolean {
  return typeof key === 'string' && /^agent:[^:]+:main$/.test(key);
}

function deriveControlPath(gatewayUrl?: string | null): OrchestratorIntegrationSummary['controlPath'] {
  if (!gatewayUrl) {
    return {
      label: 'Use the existing OpenClaw control surface',
      href: null,
      endpoint: null,
      guidance: 'No gateway URL was exposed by runtime. Keep using the already-working control/chat path for this environment.',
      note: 'No launch URL available from adapters.',
      sameAuthBoundary: true,
      embeddable: false,
      reason: 'unavailable',
    };
  }

  try {
    const url = new URL(gatewayUrl);
    const protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
    const browserUrl = `${protocol}//${url.host}`;
    const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);

    if (isLoopback) {
      return {
        label: 'Local-only Control UI endpoint detected',
        href: null,
        endpoint: gatewayUrl,
        guidance:
          'Runtime exposed only a localhost gateway URL. That works through an SSH tunnel on the operator machine, but it is not browser-reachable from the remote Mission Control preview origin.',
        note:
          'Loopback-only endpoint detected. Mission Control preview cannot embed 127.0.0.1/localhost from a remote browser. Continue using the existing tunneled Gateway Chat UI until a browser-reachable embed path exists.',
        sameAuthBoundary: true,
        embeddable: false,
        reason: 'loopback-only',
      };
    }

    return {
      label: 'Embedded current Control UI endpoint',
      href: browserUrl,
      endpoint: gatewayUrl,
      guidance: 'Runtime exposed a browser-usable endpoint that can be embedded directly instead of opening a parallel window.',
      note: 'Trusted embedded endpoint reused. No parallel chat transport introduced.',
      sameAuthBoundary: true,
      embeddable: true,
      reason: 'browser-reachable',
    };
  } catch {
    return {
      label: 'Use the existing OpenClaw control surface',
      href: null,
      endpoint: gatewayUrl,
      guidance: 'Gateway URL was present but not safely convertible into a browser launch path.',
      note: 'Gateway URL was invalid or not safely convertible for browser embedding.',
      sameAuthBoundary: true,
      embeddable: false,
      reason: 'invalid',
    };
  }
}

async function readSessionRegistry(): Promise<SessionRegistryRaw> {
  try {
    const raw = await fs.readFile(MAIN_SESSION_REGISTRY_PATH, 'utf8');
    return JSON.parse(raw) as SessionRegistryRaw;
  } catch {
    return {};
  }
}

function derivePreviewRuntimeBridge(controlPath: OrchestratorIntegrationSummary['controlPath'], runtimeOk: boolean): OrchestratorIntegrationSummary['runtimeBridge'] {
  const sidecar = getRuntimeBridgeSidecarDescriptor(process.env);
  const gatewaySessionToken = process.env.MISSION_CONTROL_GATEWAY_AUTH_TOKEN?.trim() || null;
  const gatewaySessionAuthConfigured = Boolean(gatewaySessionToken);
  const serverConnectConfigured =
    process.env.MISSION_CONTROL_SERVER_CONNECT === '1' && sidecar.configured && gatewaySessionAuthConfigured;

  return {
    descriptorVersion: 'v2',
    status: runtimeOk ? 'ready' : controlPath.href ? 'degraded' : 'unavailable',
    mode: sidecar.configured ? 'polling-ws-sidecar' : 'polling-handoff',
    transport: {
      kind: sidecar.configured ? 'http-poll+ws-sidecar' : 'http-poll',
      liveEvents: false,
      wsProxySupported: sidecar.configured,
      pollingIntervalMs: RUNTIME_BRIDGE_POLL_INTERVAL_MS,
      websocket: {
        configured: sidecar.configured,
        browserUrl: sidecar.previewBrowserUrl,
        browserReachability: sidecar.browserReachability,
      },
    },
    auth: {
      strategy: 'mission-control-basic-auth',
      sameOriginApi: true,
      browserTokenRelay: true,
      websocketBridgeToken: sidecar.configured,
      gatewaySessionAuthConfigured,
      serverConnectConfigured,
    },
    capabilities: {
      runtimeSnapshot: true,
      sessionList: true,
      controlHandoff: Boolean(controlPath.href),
      composerSend: sidecar.configured && gatewaySessionAuthConfigured,
      stop: sidecar.configured && gatewaySessionAuthConfigured,
      reset: false,
      eventStream: false,
    },
    endpoints: {
      descriptor: '/api/runtime-bridge',
      history: '/api/runtime-bridge/history',
      sessionPatch: '/api/runtime-bridge/session',
      send: '/api/runtime-bridge/send',
      stop: '/api/runtime-bridge/stop',
      launchControl: controlPath.href,
      websocket: sidecar.previewBrowserUrl,
      websocketHealth: sidecar.localHealthUrl,
      websocketBridgeToken: sidecar.token,
      gatewaySessionToken,
    },
    limitations: [
      'Mission Control exposes bounded runtime snapshots through same-origin HTTP only.',
      sidecar.configured
        ? 'A project-local WebSocket sidecar now stays loopback-only behind a same-origin preview reverse path.'
        : 'No Mission Control WebSocket sidecar is configured for this preview process.',
      serverConnectConfigured
        ? 'Mission Control preview is explicitly configured to wait for a server-owned gateway connect over the WS sidecar, without requiring the browser to hold the gateway auth token.'
        : gatewaySessionAuthConfigured
          ? 'Mission Control can now attempt a real browser-side gateway connect handshake over the WS sidecar, but it still does not stream token deltas or replay the full event model.'
          : 'This bridge can open the WS sidecar transport, but it cannot complete a real gateway session handshake until MISSION_CONTROL_GATEWAY_AUTH_TOKEN is configured for the preview.',
      sidecar.configured && gatewaySessionAuthConfigured
        ? 'Mission Control now exposes bounded same-origin session bootstrap, chat.send, and chat.abort paths to a visible session over the preview bridge. Reset, session creation UX, and the broader event model still remain outside this pass.'
        : 'Composer send, stop, and reset remain outside the Mission Control bridge until a broader runtime transport layer exists.',
    ],
  };
}

function deriveLiveLikeRuntimeBridge(
  lane: Extract<RuntimeBridgeLane, 'lab' | 'live'>,
  controlPath: OrchestratorIntegrationSummary['controlPath'],
  runtimeOk: boolean,
): OrchestratorIntegrationSummary['runtimeBridge'] {
  const sidecar = getRuntimeBridgeSidecarDescriptor(process.env);
  const laneLabel = lane === 'lab' ? 'lab sandbox lane' : 'dashboard lane';
  const serverOwnedHttpActionsAvailable = true;
  const gatewaySessionAuthConfigured = Boolean(process.env.MISSION_CONTROL_GATEWAY_AUTH_TOKEN?.trim());
  const liveWebsocketConfigured = sidecar.configured && Boolean(sidecar.liveBrowserUrl);
  const serverConnectConfigured =
    process.env.MISSION_CONTROL_SERVER_CONNECT === '1' && liveWebsocketConfigured && gatewaySessionAuthConfigured;

  return {
    descriptorVersion: 'v3',
    status:
      runtimeOk && liveWebsocketConfigured
        ? 'ready'
        : runtimeOk || liveWebsocketConfigured || controlPath.href || serverOwnedHttpActionsAvailable
          ? 'degraded'
          : 'unavailable',
    mode: 'server-proxy-bridge',
    transport: {
      kind: liveWebsocketConfigured ? 'http+ws-live' : 'http-poll',
      liveEvents: liveWebsocketConfigured,
      wsProxySupported: liveWebsocketConfigured,
      pollingIntervalMs: RUNTIME_BRIDGE_POLL_INTERVAL_MS,
      websocket: {
        configured: liveWebsocketConfigured,
        browserUrl: liveWebsocketConfigured ? sidecar.liveBrowserUrl : null,
        browserReachability: liveWebsocketConfigured ? sidecar.browserReachability : 'unavailable',
      },
    },
    auth: {
      strategy: 'edge-auth',
      sameOriginApi: true,
      browserTokenRelay: false,
      gatewaySessionAuthConfigured,
      serverConnectConfigured,
    },
    capabilities: {
      runtimeSnapshot: true,
      sessionList: true,
      controlHandoff: Boolean(controlPath.href),
      composerSend: serverOwnedHttpActionsAvailable,
      stop: serverOwnedHttpActionsAvailable,
      reset: false,
      eventStream: liveWebsocketConfigured,
    },
    endpoints: {
      descriptor: '/api/runtime-bridge',
      history: '/api/runtime-bridge/history',
      sessionPatch: '/api/runtime-bridge/session',
      send: '/api/runtime-bridge/send',
      stop: '/api/runtime-bridge/stop',
      launchControl: controlPath.href,
      websocket: liveWebsocketConfigured ? sidecar.liveBrowserUrl : null,
      websocketHealth: liveWebsocketConfigured ? sidecar.localHealthUrl : null,
    },
    limitations: [
      `This ${laneLabel} uses a secret-free runtime descriptor, so browser clients do not receive gateway or bridge tokens.`,
      liveWebsocketConfigured
        ? `This ${laneLabel} now exposes a same-origin websocket path for durable runtime events while keeping browser auth token relay disabled.`
        : `This ${laneLabel} currently relies on same-origin server-owned HTTP actions for session bootstrap, send, stop, and history refresh, without a browser websocket session.`,
      liveWebsocketConfigured
        ? 'Server-owned connect remains sidecar-backed, so the browser never receives the gateway auth token even when websocket transport is active.'
        : 'History bootstrap remains same-origin HTTP only until the server-owned live runtime path grows a durable live event stream.',
      liveWebsocketConfigured
        ? 'HTTP history and server-owned actions remain active as fallback truth for bootstrap and recovery.'
        : 'Live event streaming is still disabled here, so completion and cross-device sync rely on bounded history refresh instead of browser-side websocket deltas.',
      lane === 'lab'
        ? 'Lab is the durable sandbox lane for testing and rollout verification before promoting changes to dashboard.'
        : 'Dashboard is the canonical live lane and should stay aligned with the hardened production path.',
      sidecar.configured
        ? liveWebsocketConfigured
          ? 'Preview keeps its tokenized websocket path, while dashboard and lab use a separate same-origin live websocket route.'
          : 'Preview WS sidecar infrastructure still exists for the preview lane, but the live websocket route is not configured yet.'
        : 'No preview WS sidecar is currently configured for this deployment.',
    ],
  };
}

function deriveRuntimeBridge(
  lane: RuntimeBridgeLane,
  controlPath: OrchestratorIntegrationSummary['controlPath'],
  runtimeOk: boolean,
): OrchestratorIntegrationSummary['runtimeBridge'] {
  if (lane === 'preview') {
    return derivePreviewRuntimeBridge(controlPath, runtimeOk);
  }

  return deriveLiveLikeRuntimeBridge(lane, controlPath, runtimeOk);
}

export function createDeferredOrchestratorIntegrationSummary(lane: RuntimeBridgeLane = 'live'): OrchestratorIntegrationSummary {
  const controlPath: OrchestratorIntegrationSummary['controlPath'] = {
    label: 'Mission Control runtime summary is loading',
    href: null,
    endpoint: null,
    guidance: 'Transcript history can render immediately while Mission Control hydrates the heavier runtime summary in the background.',
    note: 'Deferred summary placeholder only. Live runtime details load after the page mounts.',
    sameAuthBoundary: true,
    embeddable: false,
    reason: 'unavailable',
  };

  return {
    status: 'stub',
    integrationMode: 'hybrid-reuse',
    chatEmbeddingStatus: 'embedded-reuse',
    honestyNotes: [
      'Mission Control is rendering transcript history first and deferring the heavier runtime summary until after mount.',
      'This placeholder is intentional and should be replaced by live runtime metadata within the first background refresh.',
    ],
    runtimeBridgeLane: lane,
    runtimeBridge: deriveRuntimeBridge(lane, controlPath, false),
    controlPath,
    runtime: {
      defaultAgentId: null,
      gateway: { mode: null, url: null, reachable: false, version: null },
      health: { ok: false, channels: [] },
    },
    sessionContext: {
      totalSessionsVisible: null,
      activeDirectLast5m: 0,
      roots: [],
      mainSession: {
        key: MAIN_SESSION_KEY,
        exists: false,
        model: null,
        updatedAt: null,
      },
      recent: [],
    },
    integrationShape: {
      now: 'Transcript history is seeded immediately while the runtime summary hydrates in the background.',
      next: 'Replace this placeholder with live runtime/session metadata as soon as the runtime bridge refresh returns.',
    },
    refreshedAt: new Date().toISOString(),
  };
}

function createUnavailableOrchestratorIntegrationSummary(lane: RuntimeBridgeLane = 'live'): OrchestratorIntegrationSummary {
  const controlPath: OrchestratorIntegrationSummary['controlPath'] = {
    label: 'Use the existing OpenClaw control surface',
    href: null,
    endpoint: null,
    guidance: 'Runtime launch details are unavailable, so the safest path is to keep using the already-working control surface.',
    note: 'No runtime bridge details available.',
    sameAuthBoundary: true,
    embeddable: false,
    reason: 'unavailable',
  };

  return {
    status: 'stub',
    integrationMode: 'hybrid-reuse',
    chatEmbeddingStatus: 'not-implemented',
    honestyNotes: [
      'Could not read runtime/session state from local OpenClaw CLI in this environment.',
      'No fallback chat implementation is provided by Mission Control.',
    ],
    runtimeBridgeLane: lane,
    runtimeBridge: deriveRuntimeBridge(lane, controlPath, false),
    controlPath,
    runtime: {
      defaultAgentId: null,
      gateway: { mode: null, url: null, reachable: false, version: null },
      health: { ok: false, channels: [] },
    },
    sessionContext: {
      totalSessionsVisible: null,
      activeDirectLast5m: 0,
      roots: [],
      mainSession: {
        key: MAIN_SESSION_KEY,
        exists: false,
        model: null,
        updatedAt: null,
      },
      recent: [],
    },
    integrationShape: {
      now: 'No runtime context available from adapters.',
      next: 'Verify local openclaw CLI availability for read-only status/session access, then re-enable bridge and context surfaces.',
    },
    refreshedAt: new Date().toISOString(),
  };
}

async function buildOrchestratorIntegrationSummary(lane: RuntimeBridgeLane): Promise<OrchestratorIntegrationSummary> {
  const [statusRaw, registryRaw] = (await Promise.all([
    runJsonCommand('openclaw status --json', OPENCLAW_STATUS_TIMEOUT_MS),
    readSessionRegistry(),
  ])) as [OpenClawStatusRaw, SessionRegistryRaw];

  const statusRecentByKey = new Map(
    (statusRaw.sessions?.recent ?? [])
      .filter((session) => typeof session.key === 'string')
      .map((session) => [session.key as string, session]),
  );

  const recentSessions = (statusRaw.sessions?.recent ?? [])
    .filter((session) => typeof session.key === 'string')
    .filter((session) => !isRunSession(session.key))
    .slice(0, 8)
    .map((session) => ({
      key: session.key as string,
      model: session.model ?? null,
      thinkingLevel: typeof session.thinkingLevel === 'string' && session.thinkingLevel.trim() ? session.thinkingLevel.trim() : null,
      kind: session.kind ?? 'unknown',
      ageMs: typeof session.age === 'number' ? session.age : null,
      updatedAt: toIso(session.updatedAt),
      tokenUsage:
        typeof session.totalTokens === 'number' && typeof session.contextTokens === 'number' && session.contextTokens > 0
          ? {
              totalTokens: session.totalTokens,
              contextTokens: session.contextTokens,
              percentUsed: typeof session.percentUsed === 'number' ? session.percentUsed : Math.round((session.totalTokens / session.contextTokens) * 100),
            }
          : null,
    }));

  const authoritativeRoots = Object.entries(registryRaw)
    .filter(([key]) => isRootSession(key))
    .sort((left, right) => {
      if (left[0] === MAIN_SESSION_KEY) return -1;
      if (right[0] === MAIN_SESSION_KEY) return 1;
      return (right[1]?.updatedAt ?? 0) - (left[1]?.updatedAt ?? 0);
    })
    .map(([key, entry]) => {
      const statusSession = statusRecentByKey.get(key);
      const modelOverride = typeof entry?.modelOverride === 'string' && entry.modelOverride.trim() ? entry.modelOverride.trim() : null;
      const providerOverride = typeof entry?.providerOverride === 'string' && entry.providerOverride.trim() ? entry.providerOverride.trim() : null;
      const model = statusSession?.model ?? (providerOverride && modelOverride ? `${providerOverride}/${modelOverride}` : modelOverride);
      return {
        key,
        model: model ?? null,
        updatedAt: toIso(entry?.updatedAt ?? statusSession?.updatedAt),
      };
    });

  const mainSession = authoritativeRoots.find((session) => session.key === MAIN_SESSION_KEY) ?? null;
  const activeDirectCount = recentSessions.filter((session) => session.kind === 'direct' && typeof session.ageMs === 'number' && session.ageMs <= 5 * 60 * 1000).length;
  const controlPath = deriveControlPath(statusRaw.gateway?.url ?? null);
  const runtimeOk = Boolean(statusRaw.gateway?.reachable);

  return {
    status: 'partial',
    integrationMode: 'hybrid-reuse',
    chatEmbeddingStatus: 'embedded-reuse',
    honestyNotes: [
      'Mission Control does not implement its own chat transport or session state.',
      'The center chat surface reuses the real OpenClaw Control UI instead of simulating a separate chat system.',
      'This runtime summary now prefers the on-disk session registry plus openclaw status so chat refreshes stay bounded.',
    ],
    runtimeBridgeLane: lane,
    runtimeBridge: deriveRuntimeBridge(lane, controlPath, runtimeOk),
    controlPath,
    runtime: {
      defaultAgentId: statusRaw.defaultAgentId ?? null,
      gateway: {
        mode: statusRaw.gateway?.mode ?? null,
        url: statusRaw.gateway?.url ?? null,
        reachable: Boolean(statusRaw.gateway?.reachable),
        version: statusRaw.gateway?.self?.version ?? null,
      },
      health: {
        ok: runtimeOk,
        channels: [],
      },
    },
    sessionContext: {
      totalSessionsVisible: typeof statusRaw.sessions?.count === 'number' ? statusRaw.sessions.count : null,
      activeDirectLast5m: activeDirectCount,
      roots: authoritativeRoots,
      mainSession: {
        key: MAIN_SESSION_KEY,
        exists: Boolean(mainSession),
        model: mainSession?.model ?? null,
        updatedAt: mainSession?.updatedAt ?? null,
      },
      recent: recentSessions,
    },
    integrationShape: {
      now: 'Reuse the real OpenClaw Control UI as the center chat surface, with Mission Control supplying surrounding context and agent framing.',
      next: 'Keep refining the embedded-chat shell while preserving one real chat transport and auth boundary.',
    },
    refreshedAt: new Date().toISOString(),
  };
}

function startOrchestratorIntegrationSummaryRefresh(lane: RuntimeBridgeLane): Promise<OrchestratorIntegrationSummary> {
  const existingPromise = orchestratorSummaryPromise.get(lane);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = buildOrchestratorIntegrationSummary(lane)
      .then((summary) => storeOrchestratorSummary(lane, summary))
      .catch(() => {
        const fallback = readCachedOrchestratorSummary(lane)?.value ?? createUnavailableOrchestratorIntegrationSummary(lane);
        return storeOrchestratorSummary(lane, fallback, Math.min(ORCHESTRATOR_SUMMARY_CACHE_TTL_MS, 5000));
      })
      .finally(() => {
        orchestratorSummaryPromise.delete(lane);
      });

  orchestratorSummaryPromise.set(lane, refreshPromise);

  return refreshPromise;
}

export async function readOrchestratorIntegrationSummary(lane: RuntimeBridgeLane = 'live'): Promise<OrchestratorIntegrationSummary> {
  const now = Date.now();
  const cached = readCachedOrchestratorSummary(lane);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  void startOrchestratorIntegrationSummaryRefresh(lane);

  if (cached) {
    return cached.value;
  }

  return createDeferredOrchestratorIntegrationSummary(lane);
}

export async function getOrchestratorIntegrationSummary(lane: RuntimeBridgeLane = 'live'): Promise<OrchestratorIntegrationSummary> {
  const now = Date.now();
  const cached = readCachedOrchestratorSummary(lane);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  return startOrchestratorIntegrationSummaryRefresh(lane);
}

export function primeOrchestratorIntegrationSummary(lane: RuntimeBridgeLane = 'live'): void {
  void startOrchestratorIntegrationSummaryRefresh(lane);
}
