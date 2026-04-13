import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';
import { runJsonCommand } from '@/lib/adapters/runtime';
import { getRuntimeBridgeSidecarDescriptor } from '@/lib/runtime-bridge-sidecar';

const RUNTIME_BRIDGE_POLL_INTERVAL_MS = 15000;
const MAIN_SESSION_KEY = 'agent:main:main';

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
      model?: string;
      percentUsed?: number | null;
      totalTokens?: number | null;
      contextTokens?: number | null;
    }>;
  };
};

type OpenClawHealthRaw = {
  ok?: boolean;
  channels?: Record<string, { probe?: { ok?: boolean } }>;
};

type SessionsRaw = {
  sessions?: Array<{
    key?: string;
    model?: string;
    ageMs?: number;
    updatedAt?: number;
    kind?: string;
    contextTokens?: number | null;
    totalTokens?: number | null;
  }>;
};

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

function deriveRuntimeBridge(controlPath: OrchestratorIntegrationSummary['controlPath'], runtimeOk: boolean): OrchestratorIntegrationSummary['runtimeBridge'] {
  const sidecar = getRuntimeBridgeSidecarDescriptor(process.env);
  const gatewaySessionToken = process.env.MISSION_CONTROL_GATEWAY_AUTH_TOKEN?.trim() || null;
  const gatewaySessionAuthConfigured = Boolean(gatewaySessionToken);

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
        browserUrl: sidecar.browserUrl,
        browserReachability: sidecar.browserReachability,
      },
    },
    auth: {
      strategy: 'mission-control-basic-auth',
      sameOriginApi: true,
      websocketBridgeToken: sidecar.configured,
      gatewaySessionAuthConfigured,
    },
    capabilities: {
      runtimeSnapshot: true,
      sessionList: true,
      controlHandoff: Boolean(controlPath.href),
      composerSend: sidecar.configured && gatewaySessionAuthConfigured,
      stop: false,
      reset: false,
      eventStream: false,
    },
    endpoints: {
      descriptor: '/api/runtime-bridge',
      launchControl: controlPath.href,
      websocket: sidecar.browserUrl,
      websocketHealth: sidecar.localHealthUrl,
      websocketBridgeToken: sidecar.token,
      gatewaySessionToken,
    },
    limitations: [
      'Mission Control exposes bounded runtime snapshots through same-origin HTTP only.',
      sidecar.configured
        ? 'A project-local WebSocket sidecar now stays loopback-only behind a same-origin preview reverse path.'
        : 'No Mission Control WebSocket sidecar is configured for this preview process.',
      gatewaySessionAuthConfigured
        ? 'Mission Control can now attempt a real browser-side gateway connect handshake over the WS sidecar, but it still does not stream token deltas or replay the full event model.'
        : 'This bridge can open the WS sidecar transport, but it cannot complete a real gateway session handshake until MISSION_CONTROL_GATEWAY_AUTH_TOKEN is configured for the preview.',
      sidecar.configured && gatewaySessionAuthConfigured
        ? 'Mission Control now exposes one bounded chat.send path to a visible session over the same-origin bridge. Stop, reset, session creation, and the broader event model still remain outside this pass.'
        : 'Composer send, stop, and reset remain outside the Mission Control bridge until a broader runtime transport layer exists.',
    ],
  };
}

export function createDeferredOrchestratorIntegrationSummary(): OrchestratorIntegrationSummary {
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
    runtimeBridge: deriveRuntimeBridge(controlPath, false),
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

function createUnavailableOrchestratorIntegrationSummary(): OrchestratorIntegrationSummary {
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
    runtimeBridge: deriveRuntimeBridge(controlPath, false),
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

export async function readOrchestratorIntegrationSummary(): Promise<OrchestratorIntegrationSummary> {
  try {
    const [statusRaw, healthRaw, sessionsRaw, allSessionsRaw] = (await Promise.all([
      runJsonCommand('openclaw status --json'),
      runJsonCommand('openclaw health --json'),
      runJsonCommand('openclaw sessions --all-agents --active 180 --json'),
      runJsonCommand('openclaw sessions --all-agents --json'),
    ])) as [OpenClawStatusRaw, OpenClawHealthRaw, SessionsRaw, SessionsRaw];

    const statusRecentByKey = new Map(
      (statusRaw.sessions?.recent ?? [])
        .filter((session) => typeof session.key === 'string')
        .map((session) => [session.key as string, session]),
    );

    const recentSessions = (sessionsRaw.sessions ?? [])
      .filter((session) => typeof session.key === 'string')
      .filter((session) => !isRunSession(session.key))
      .slice(0, 8)
      .map((session) => {
        const statusSession = statusRecentByKey.get(session.key as string);
        return {
          key: session.key as string,
          model: session.model ?? statusSession?.model ?? null,
          kind: session.kind ?? 'unknown',
          ageMs: typeof session.ageMs === 'number' ? session.ageMs : typeof statusSession?.age === 'number' ? statusSession.age : null,
          updatedAt: toIso(session.updatedAt ?? statusSession?.updatedAt),
          tokenUsage:
            typeof session.totalTokens === 'number' && typeof session.contextTokens === 'number' && session.contextTokens > 0
              ? {
                  totalTokens: session.totalTokens,
                  contextTokens: session.contextTokens,
                  percentUsed: Math.round((session.totalTokens / session.contextTokens) * 100),
                }
              : typeof statusSession?.totalTokens === 'number' && typeof statusSession?.contextTokens === 'number' && statusSession.contextTokens > 0
                ? {
                    totalTokens: statusSession.totalTokens,
                    contextTokens: statusSession.contextTokens,
                    percentUsed: typeof statusSession.percentUsed === 'number' ? statusSession.percentUsed : Math.round((statusSession.totalTokens / statusSession.contextTokens) * 100),
                  }
              : null,
        };
      });

    const authoritativeRoots = (allSessionsRaw.sessions ?? [])
      .filter((session) => typeof session.key === 'string')
      .filter((session) => isRootSession(session.key))
      .sort((left, right) => {
        if (left.key === MAIN_SESSION_KEY) return -1;
        if (right.key === MAIN_SESSION_KEY) return 1;
        return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
      })
      .map((session) => ({
        key: session.key as string,
        model: session.model ?? statusRecentByKey.get(session.key as string)?.model ?? null,
        updatedAt: toIso(session.updatedAt ?? statusRecentByKey.get(session.key as string)?.updatedAt),
      }));

    const mainSession = authoritativeRoots.find((session) => session.key === MAIN_SESSION_KEY) ?? null;

    const activeDirectCount = recentSessions.filter((session) => session.kind === 'direct' && typeof session.ageMs === 'number' && session.ageMs <= 5 * 60 * 1000).length;

    const channelProbe = Object.entries(healthRaw.channels ?? {}).map(([channel, value]) => ({
      channel,
      ok: Boolean(value?.probe?.ok),
    }));
    const controlPath = deriveControlPath(statusRaw.gateway?.url ?? null);
    const runtimeOk = Boolean(healthRaw.ok) && Boolean(statusRaw.gateway?.reachable);

    return {
      status: 'partial',
      integrationMode: 'hybrid-reuse',
      chatEmbeddingStatus: 'embedded-reuse',
      honestyNotes: [
        'Mission Control does not implement its own chat transport or session state.',
        'The center chat surface reuses the real OpenClaw Control UI instead of simulating a separate chat system.',
      ],
      runtimeBridge: deriveRuntimeBridge(controlPath, runtimeOk),
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
          ok: Boolean(healthRaw.ok),
          channels: channelProbe,
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
  } catch {
    return createUnavailableOrchestratorIntegrationSummary();
  }
}

export const getOrchestratorIntegrationSummary = readOrchestratorIntegrationSummary;
