import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

type SessionView = OrchestratorIntegrationSummary['sessionContext']['recent'][number];

export type ChatArtifact =
  | {
      type: 'diff';
      title: string;
      filePath: string;
      beforeLabel: string;
      afterLabel: string;
      oldText: string;
      newText: string;
    }
  | {
      type: 'file';
      title: string;
      filePath: string;
      language: string;
      content: string;
    }
  | {
      type: 'chart';
      title: string;
      subtitle: string;
      points: Array<{ label: string; value: number }>;
      emptyLabel: string;
    };

export type ProcessRail = {
  kind: 'thinking' | 'tools';
  title: string;
  summary: string;
  detail: string;
  metrics: string[];
  items: Array<{
    label: string;
    meta?: string;
    preview: string;
  }>;
};

export type ChatThreadEntry =
  | {
      id: string;
      type: 'user' | 'assistant';
      title?: string;
      body: string;
      tone?: 'default' | 'muted';
      artifacts?: ChatArtifact[];
    }
  | {
      id: string;
      type: 'rail';
      rail: ProcessRail;
    };

export type ChatSurfaceModel = {
  primarySession: SessionView | null;
  recentSessions: SessionView[];
  agentLabel: string;
  sessionLabel: string;
  modelLabel: string;
  effortLabel: string;
  runtimeStatus: string;
  runtimeTone: 'ok' | 'warn';
  contextPercent: number | null;
  contextLabel: string;
  bridgeStatus: string;
  bridgeDescriptor: string;
  bridgeLimitations: string[];
  controlLabel: string;
  controlHref: string | null;
  controlGuidance: string;
  endpointLabel: string;
  endpointValue: string;
  thread: ChatThreadEntry[];
  notes: string[];
};

function agentLabelForSession(session: SessionView | null, defaultAgentId: string | null): string {
  const key = session?.key ?? defaultAgentId ?? '';
  if (key.includes('agent:main:main') || key === 'main') return 'Marvin';
  if (/builder/i.test(key)) return 'Builder';
  if (/reviewer/i.test(key)) return 'Reviewer';
  if (defaultAgentId) return defaultAgentId.replace(/^agent:/, '');
  return 'Mission Control';
}

function shortSessionKey(key: string | null | undefined): string {
  if (!key) return 'session unavailable';
  if (key.length <= 32) return key;
  return `${key.slice(0, 16)}...${key.slice(-10)}`;
}

function formatAge(ageMs: number | null): string {
  if (ageMs === null || Number.isNaN(ageMs)) return 'freshness unavailable';
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'updated just now';
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `updated ${hours}h ${rem}m ago` : `updated ${hours}h ago`;
  return `updated ${Math.floor(hours / 24)}d ago`;
}

function derivePrimarySession(summary: OrchestratorIntegrationSummary): SessionView | null {
  const sessions = summary.sessionContext.recent;
  if (sessions.length === 0) return null;

  const mainExact = sessions.find((session) => session.key === 'agent:main:main');
  if (mainExact) return mainExact;

  const configuredMain = sessions.find((session) => session.key === summary.sessionContext.mainSession.key);
  if (configuredMain) return configuredMain;

  if (summary.runtime.defaultAgentId) {
    const exactDefault = sessions.find((session) => session.key === summary.runtime.defaultAgentId);
    if (exactDefault) return exactDefault;

    const includesDefault = sessions.find((session) => session.key.includes(summary.runtime.defaultAgentId as string));
    if (includesDefault) return includesDefault;
  }

  const directSession = sessions.find((session) => session.kind === 'direct');
  if (directSession) return directSession;

  return sessions[0] ?? null;
}

function buildToolsRail(summary: OrchestratorIntegrationSummary, primarySession: SessionView | null): ProcessRail {
  const sessions = summary.sessionContext.recent;
  const sessionCount = summary.sessionContext.totalSessionsVisible;
  const channelsOk = summary.runtime.health.channels.filter((channel) => channel.ok).length;
  const channelCount = summary.runtime.health.channels.length;
  const rootCount = summary.sessionContext.roots.length;

  return {
    kind: 'tools',
    title: 'Tools',
    summary: 'Read-only runtime probes used to build this surface',
    detail: 'Mission Control is reading bounded runtime metadata only. It is not replaying message events or inventing tool completions.',
    metrics: [
      channelCount > 0 ? `${channelsOk}/${channelCount} channels healthy` : 'channel health deferred',
      sessionCount !== null ? `${sessionCount} sessions visible` : 'session count unavailable',
      primarySession?.model ?? 'model hidden by runtime',
    ],
    items: [
      {
        label: 'openclaw status --json',
        meta: summary.runtime.gateway.reachable ? 'reachable' : 'gateway unavailable',
        preview: summary.runtime.gateway.url ?? 'No gateway URL exposed by runtime.',
      },
      {
        label: '/data/.openclaw/agents/main/sessions/sessions.json',
        meta: rootCount > 0 ? `${rootCount} roots` : 'registry unavailable',
        preview:
          rootCount > 0
            ? summary.sessionContext.roots
                .slice(0, 3)
                .map((session) => shortSessionKey(session.key))
                .join(' • ')
            : 'No root sessions surfaced from the session registry.',
      },
      {
        label: 'status-backed recent session snapshot',
        meta: sessions.length > 0 ? `${sessions.length} recent` : 'none',
        preview:
          sessions.length > 0
            ? sessions
                .slice(0, 3)
                .map((session) => shortSessionKey(session.key))
                .join(' • ')
            : 'No recent sessions surfaced from the adapter.',
      },
    ],
  };
}

function buildThinkingRail(summary: OrchestratorIntegrationSummary, primarySession: SessionView | null): ProcessRail {
  const controlMode =
    summary.controlPath.embeddable && summary.controlPath.href
      ? 'Browser-reachable control surface available for direct handoff.'
      : 'Custom thread is active, but send/stop/reset remain outside Mission Control until a transport bridge lands.';

  return {
    kind: 'thinking',
    title: 'Thinking',
    summary: 'Phase 1 surface composes runtime truth into a calmer operator thread',
    detail: 'This page now owns chrome, hierarchy, and artifact rendering. Message transport remains intentionally separate until backend event plumbing exists.',
    metrics: [
      controlMode,
      formatAge(primarySession?.ageMs ?? null),
      summary.integrationShape.next,
    ],
    items: [
      {
        label: 'Session-first focus',
        preview: primarySession
          ? `${agentLabelForSession(primarySession, summary.runtime.defaultAgentId)} is treated as the active operator context.`
          : 'No active session was exposed, so the chrome falls back to generic runtime status.',
      },
      {
        label: 'Compressed process rails',
        preview: 'Thinking and Tools stay collapsed by default so answer text and artifacts remain the dominant units.',
      },
      {
        label: 'Artifact staging',
        preview: 'Diff, file preview, and chart containers are real renderers wired to bounded local data contracts.',
      },
    ],
  };
}

function buildChartArtifact(sessions: SessionView[]): ChatArtifact {
  const points = sessions
    .slice(0, 6)
    .map((session, index) => ({
      label: session.key.split(':').pop() || `s${index + 1}`,
      value: Math.max(0, Math.min(100, session.tokenUsage?.percentUsed ?? 0)),
    }))
    .filter((point) => point.value > 0);

  return {
    type: 'chart',
    title: 'Context pressure by visible session',
    subtitle: 'Bounded chart artifact fed from current session token percentages when available.',
    points,
    emptyLabel: 'No session context percentages were exposed by runtime, so the chart container stays empty.',
  };
}

function buildFileArtifact(summary: OrchestratorIntegrationSummary, primarySession: SessionView | null): ChatArtifact {
  const lines = [
    `agent=${agentLabelForSession(primarySession, summary.runtime.defaultAgentId)}`,
    `session=${primarySession?.key ?? 'unavailable'}`,
    `model=${primarySession?.model ?? 'runtime controlled'}`,
    `gateway=${summary.runtime.gateway.url ?? 'unavailable'}`,
    `runtime_health=${summary.runtime.health.ok ? 'ok' : 'degraded'}`,
    `transport_mode=${summary.integrationMode}`,
    ...summary.honestyNotes.map((note, index) => `note_${index + 1}=${note}`),
  ];

  return {
    type: 'file',
    title: 'Runtime boundary snapshot',
    filePath: 'mission-control/runtime-bridge.txt',
    language: 'ini',
    content: lines.join('\n'),
  };
}

function buildDiffArtifact(summary: OrchestratorIntegrationSummary): ChatArtifact {
  const oldText = [
    'Primary page posture: embed-first control surface.',
    'Session context lives in a side rail around an iframe.',
    'Artifacts are not rendered inline inside the thread.',
    'Stop/reset/model/effort controls are absent from chat chrome.',
  ].join('\n');

  const newText = [
    'Primary page posture: custom Mission Control chat workspace.',
    'Top chrome surfaces session, agent, model, effort, context, and transport truth.',
    'Thinking and Tools rails collapse process noise by default.',
    'Inline diff, file preview, and bounded chart artifacts are rendered in-thread.',
    `Transport honesty: ${summary.honestyNotes[0] ?? 'Message transport remains separate from this UI.'}`,
  ].join('\n');

  return {
    type: 'diff',
    title: 'Phase 1 surface delta',
    filePath: 'mission-control/chat-surface-phase1.md',
    beforeLabel: 'Before',
    afterLabel: 'Now',
    oldText,
    newText,
  };
}

export function buildChatSurfaceModel(summary: OrchestratorIntegrationSummary): ChatSurfaceModel {
  const primarySession = derivePrimarySession(summary);
  const agentLabel = agentLabelForSession(primarySession, summary.runtime.defaultAgentId);
  const contextPercent = primarySession?.tokenUsage?.percentUsed ?? null;
  const controlHref = summary.controlPath.href;
  const canHandOff = Boolean(controlHref);
  const runtimeStatus = summary.runtime.health.ok
    ? summary.runtime.gateway.reachable
      ? 'Runtime reachable'
      : 'Runtime partial'
    : 'Runtime boundary limited';
  const bridgeStatus =
    summary.runtimeBridge.status === 'ready'
      ? 'Bridge ready'
      : summary.runtimeBridge.status === 'degraded'
        ? 'Bridge degraded'
        : 'Bridge unavailable';

  return {
    primarySession,
    recentSessions: summary.sessionContext.recent,
    agentLabel,
    sessionLabel: shortSessionKey(primarySession?.key ?? summary.runtime.defaultAgentId),
    modelLabel: primarySession?.model ?? summary.sessionContext.mainSession.model ?? summary.runtime.gateway.version ?? 'Runtime controlled',
    effortLabel: primarySession?.thinkingLevel ?? summary.sessionContext.recent.find((session) => session.kind === 'direct' && session.thinkingLevel)?.thinkingLevel ?? summary.sessionContext.recent.find((session) => session.thinkingLevel)?.thinkingLevel ?? 'Last requested: low',
    runtimeStatus,
    runtimeTone: summary.runtime.health.ok && summary.runtime.gateway.reachable ? 'ok' : 'warn',
    contextPercent,
    contextLabel: contextPercent !== null ? `${contextPercent}% of visible context` : 'Context meter waiting on token data',
    bridgeStatus,
    bridgeDescriptor:
      summary.runtimeBridge.transport.kind === 'http-poll+ws-sidecar'
        ? 'HTTP polling + WS sidecar'
        : summary.runtimeBridge.transport.kind === 'http+ws-live'
          ? 'Same-origin live runtime bridge'
          : 'HTTP polling only',
    bridgeLimitations: summary.runtimeBridge.limitations,
    controlLabel: canHandOff ? 'Open control UI' : 'Control UI not launchable here',
    controlHref,
    controlGuidance: summary.controlPath.guidance,
    endpointLabel: summary.controlPath.embeddable ? 'Gateway' : 'Control path',
    endpointValue: summary.controlPath.endpoint ?? 'No browser-reachable endpoint exposed',
    notes: summary.honestyNotes,
    thread: [
      {
        id: 'user-brief',
        type: 'user',
        body: 'Show me the current Mission Control chat state without drowning me in transport noise.',
      },
      {
        id: 'thinking',
        type: 'rail',
        rail: buildThinkingRail(summary, primarySession),
      },
      {
        id: 'tools',
        type: 'rail',
        rail: buildToolsRail(summary, primarySession),
      },
      {
        id: 'assistant-brief',
        type: 'assistant',
        title: 'Operator summary',
        body:
          'Mission Control now owns the chat workspace chrome, thread hierarchy, and artifact rendering. Runtime and session status are real; message send/stop/reset remain separate until a richer gateway event path exists.',
        artifacts: [
          buildDiffArtifact(summary),
          buildFileArtifact(summary, primarySession),
          buildChartArtifact(summary.sessionContext.recent),
        ],
      },
      {
        id: 'assistant-handoff',
        type: 'assistant',
        title: 'Current handoff',
        tone: 'muted',
        body: canHandOff
          ? 'Use the control surface link when you need the live transport. This page is intentionally honest about that boundary while the custom client layer is still staged.'
          : summary.controlPath.note,
      },
    ],
  };
}
