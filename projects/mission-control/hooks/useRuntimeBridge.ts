'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

type RuntimeBridgeWsState = 'unavailable' | 'connecting' | 'open' | 'closed' | 'error';
type RuntimeBridgeSessionState =
  | 'unavailable'
  | 'waiting'
  | 'challenged'
  | 'connecting'
  | 'connected'
  | 'rejected'
  | 'closed'
  | 'error';

type GatewayEventMessage = {
  type?: 'event';
  event?: string;
  payload?: unknown;
  seq?: number;
};

type GatewayResponseMessage = {
  type?: 'res';
  id?: string;
  ok?: boolean;
  payload?: unknown;
  error?: { message?: string };
};

type GatewayMessage = GatewayEventMessage | GatewayResponseMessage;

type RuntimeBridgeSessionSnapshot = {
  state: RuntimeBridgeSessionState;
  detail: string | null;
  challengeSeen: boolean;
  sessionId: string | null;
  protocolVersion: number | null;
  scopes: string[];
  lastEvent: string | null;
  eventCount: number;
};

export type RuntimeBridgeChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  variant?: 'bridge-note' | 'activity';
  body: string;
  sessionKey: string | null;
  runId: string | null;
  status: 'pending' | 'streaming' | 'final' | 'error';
  at: number;
};

export type RuntimeBridgeToolEvent = {
  stream: 'tool';
  phase: 'start' | 'update' | 'result';
  name: string;
  toolCallId: string | null;
  args: Record<string, unknown> | null;
  meta: string | null;
  isError: boolean;
};

export type RuntimeBridgeLiveEvent = {
  id: string;
  name: string;
  detail: string;
  sessionKey: string | null;
  runId: string | null;
  seq: number | null;
  at: number;
  tool: RuntimeBridgeToolEvent | null;
};

export type RuntimeBridgeTransientNotice = {
  id: string;
  kind: 'context-compression' | 'fallback-model';
  message: string;
  at: number;
};

type RuntimeBridgeSendState = 'idle' | 'sending' | 'streaming' | 'error';

type RuntimeBridgeLiveSessionTarget = {
  key: string | null;
  label: string;
};

type RuntimeBridgeLiveState = {
  targetSession: RuntimeBridgeLiveSessionTarget;
  canSend: boolean;
  canAbort: boolean;
  sendState: RuntimeBridgeSendState;
  sendError: string | null;
  activeRunId: string | null;
  messages: RuntimeBridgeChatMessage[];
  events: RuntimeBridgeLiveEvent[];
  notices: RuntimeBridgeTransientNotice[];
  sendPrompt: (prompt: string) => Promise<void>;
  abortPrompt: () => Promise<void>;
};

export type RuntimeBridgeState = {
  summary: OrchestratorIntegrationSummary;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  wsState: RuntimeBridgeWsState;
  wsDetail: string | null;
  session: RuntimeBridgeSessionSnapshot;
  live: RuntimeBridgeLiveState;
  refresh: () => Promise<void>;
  switchSession: (sessionKey: string) => Promise<void>;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

const CLIENT_ID = 'openclaw-control-ui';
const CLIENT_VERSION = '0.1.0';
const CLIENT_MODE = 'webchat';
const INSTANCE_ID_STORAGE_KEY = 'mission-control-runtime-bridge-instance-id';
const CONNECT_PROTOCOL_VERSION = 3;
const CONNECT_SCOPES = ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'];
const MAX_LIVE_MESSAGES = 24;
const MAX_LIVE_EVENTS = 48;
const MAX_TRANSIENT_NOTICES = 6;
const MAIN_SESSION_KEY = 'agent:main:main';

function createEmptySession(
  state: RuntimeBridgeSessionState,
  detail: string | null,
): RuntimeBridgeSessionSnapshot {
  return {
    state,
    detail,
    challengeSeen: false,
    sessionId: null,
    protocolVersion: null,
    scopes: [],
    lastEvent: null,
    eventCount: 0,
  };
}

function generateId(prefix: string): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreateInstanceId(): string {
  const fallback = generateId('mission-control');
  if (typeof window === 'undefined') return fallback;

  try {
    const existing = window.sessionStorage.getItem(INSTANCE_ID_STORAGE_KEY);
    if (existing) return existing;

    window.sessionStorage.setItem(INSTANCE_ID_STORAGE_KEY, fallback);
    return fallback;
  } catch {
    return fallback;
  }
}

function resolveWebSocketUrl(input: string): URL {
  const resolved = new URL(input, window.location.href);
  if (resolved.protocol === 'https:') {
    resolved.protocol = 'wss:';
  } else if (resolved.protocol === 'http:') {
    resolved.protocol = 'ws:';
  }
  return resolved;
}

function shortenSessionKey(key: string | null): string {
  if (!key) return 'No target session';
  if (key.length <= 36) return key;
  return `${key.slice(0, 18)}...${key.slice(-12)}`;
}

function chooseTargetSession(summary: OrchestratorIntegrationSummary): RuntimeBridgeLiveSessionTarget {
  const sessions = summary.sessionContext.recent;
  const mainSession = sessions.find((session) => session.key === MAIN_SESSION_KEY);
  if (mainSession) {
    return { key: mainSession.key, label: shortenSessionKey(mainSession.key) };
  }

  if (summary.runtime.defaultAgentId) {
    const defaultAgentId = summary.runtime.defaultAgentId;
    const matched = sessions.find((session) => session.key === defaultAgentId || session.key.includes(defaultAgentId));
    if (matched) {
      return { key: matched.key, label: shortenSessionKey(matched.key) };
    }
  }

  const fallback = sessions[0]?.key ?? null;
  return { key: fallback, label: shortenSessionKey(fallback) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractTextFromContentBlocks(content: unknown): string {
  if (!Array.isArray(content)) return '';

  return content
    .map((block) => {
      const blockRecord = asRecord(block);
      if (!blockRecord) return '';
      if (typeof blockRecord.text === 'string') return blockRecord.text;
      return extractTextFromContentBlocks(blockRecord.content);
    })
    .filter(Boolean)
    .join('');
}

function extractTextFromGatewayMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  const record = asRecord(message);
  if (!record) return '';
  if (typeof record.text === 'string' && record.text.length > 0) return record.text;
  if (typeof record.content === 'string') return record.content;
  return extractTextFromContentBlocks(record.content);
}

function extractFinalChatText(payload: Record<string, unknown>): string {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = extractTextFromGatewayMessage(messages[index]);
    if (text) return text;
  }

  const directMessage = extractTextFromGatewayMessage(payload.message);
  if (directMessage) return directMessage;

  return extractTextFromContentBlocks(payload.content);
}

function summarizeToolTarget(name: string, args: Record<string, unknown> | null, meta: string | null): string {
  const filePath = typeof args?.file_path === 'string' ? args.file_path : typeof args?.path === 'string' ? args.path : null;
  const command = typeof args?.command === 'string' ? args.command : null;
  if ((name === 'read' || name === 'write' || name === 'edit') && filePath) return filePath.split('/').pop() || filePath;
  if (name === 'exec' && command) return command;
  return meta || name;
}

function extractToolEvent(payload: Record<string, unknown> | null): RuntimeBridgeToolEvent | null {
  if (!payload) return null;
  if (payload.stream !== 'tool') return null;
  const data = asRecord(payload.data);
  if (!data) return null;
  const name = typeof data.name === 'string' ? data.name : null;
  const phase = typeof data.phase === 'string' ? data.phase : null;
  if (!name || (phase !== 'start' && phase !== 'update' && phase !== 'result')) return null;
  return {
    stream: 'tool',
    phase,
    name,
    toolCallId: typeof data.toolCallId === 'string' ? data.toolCallId : null,
    args: asRecord(data.args),
    meta: typeof data.meta === 'string' ? data.meta : null,
    isError: Boolean(data.isError),
  };
}

function describeGatewayEvent(name: string | null, payload: Record<string, unknown> | null): string {
  if (!name) return 'Unnamed gateway event';
  if (name === 'connect.challenge') return 'Gateway challenge received.';
  if (name === 'chat') {
    const state = typeof payload?.state === 'string' ? payload.state : 'unknown';
    const sessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : null;
    return sessionKey ? `Chat ${state} for ${shortenSessionKey(sessionKey)}.` : `Chat ${state}.`;
  }
  if (name === 'agent') {
    const tool = extractToolEvent(payload);
    if (tool) {
      const target = summarizeToolTarget(tool.name, tool.args, tool.meta);
      if (tool.phase === 'start') return `${tool.name} started: ${target}`;
      if (tool.phase === 'update') return `${tool.name} running: ${target}`;
      return tool.isError ? `${tool.name} failed: ${target}` : `${tool.name} completed: ${target}`;
    }
    const stream = typeof payload?.stream === 'string' ? payload.stream : null;
    if (stream === 'lifecycle') {
      const data = asRecord(payload?.data);
      const phase = typeof data?.phase === 'string' ? data.phase : 'update';
      return `Run ${phase}.`;
    }
    if (stream === 'assistant') return 'Assistant streaming update.';
    const state =
      typeof payload?.state === 'string'
        ? payload.state
        : typeof payload?.agentState === 'string'
          ? payload.agentState
          : 'update';
    return `Agent ${state}.`;
  }
  return name;
}

function appendBounded<T>(items: T[], next: T, limit: number): T[] {
  const appended = [...items, next];
  return appended.length > limit ? appended.slice(-limit) : appended;
}

function detectRuntimeNotice(payload: Record<string, unknown> | null): Omit<RuntimeBridgeTransientNotice, 'id' | 'at'> | null {
  if (!payload) return null;
  const serialized = JSON.stringify(payload).toLowerCase();

  const compressionSignal =
    serialized.includes('context compression') ||
    serialized.includes('context compressed') ||
    serialized.includes('compressed context') ||
    serialized.includes('contextcompression') ||
    serialized.includes('compressionapplied');

  if (compressionSignal) {
    return {
      kind: 'context-compression',
      message: 'Context compression applied for this run.',
    };
  }

  const fallbackSignal =
    serialized.includes('fallback model') ||
    serialized.includes('model fallback') ||
    serialized.includes('fallback activated') ||
    serialized.includes('fallbackmodel') ||
    serialized.includes('fallbacktriggered');

  if (fallbackSignal) {
    return {
      kind: 'fallback-model',
      message: 'Fallback model activated for this run.',
    };
  }

  return null;
}

function mergeHydratedMessages(
  current: RuntimeBridgeChatMessage[],
  incoming: RuntimeBridgeChatMessage[],
  sessionKey: string | null,
): RuntimeBridgeChatMessage[] {
  const scopedCurrent = current.filter((message) => !sessionKey || message.sessionKey === sessionKey || message.sessionKey === null);
  const keyed = new Map<string, RuntimeBridgeChatMessage>();

  const buildFallbackKey = (message: RuntimeBridgeChatMessage, normalizedBody: string) =>
    `${message.role}|${message.sessionKey ?? 'none'}|${message.runId ?? 'none'}|${normalizedBody}`;

  const upsert = (message: RuntimeBridgeChatMessage, source: 'current' | 'hydrated') => {
    const normalizedBody = message.body.trim();
    if (!normalizedBody) return;

    const normalizedAt = Number.isFinite(message.at) ? message.at : Date.now();
    const normalized: RuntimeBridgeChatMessage = {
      ...message,
      body: normalizedBody,
      at: normalizedAt,
    };
    const idKey = normalized.id ? `id:${normalized.id}` : null;
    const fallbackKey = `body:${buildFallbackKey(normalized, normalizedBody)}`;
    const existing = (idKey && keyed.get(idKey)) ?? keyed.get(fallbackKey);

    if (!existing) {
      if (idKey) keyed.set(idKey, normalized);
      keyed.set(fallbackKey, normalized);
      return;
    }

    const incomingIsNewer = normalized.at > existing.at;
    const incomingIsSameTime = normalized.at === existing.at;
    const incomingWinsOnTie = incomingIsSameTime && (
      (existing.status !== 'final' && normalized.status === 'final') || normalized.body.length > existing.body.length
    );
    const winner = incomingIsNewer || incomingWinsOnTie ? normalized : existing;
    const merged: RuntimeBridgeChatMessage = {
      ...existing,
      ...winner,
      status: winner.status,
      body: winner.body,
      at: winner.at,
      runId: winner.runId ?? existing.runId,
      // Prefer existing id when hydrating into a live message bucket to avoid id churn.
      id: source === 'hydrated' ? existing.id : winner.id,
    };

    if (idKey) keyed.set(idKey, merged);
    keyed.set(fallbackKey, merged);
    if (existing.id && existing.id !== merged.id) {
      keyed.set(`id:${existing.id}`, merged);
    }
  };

  for (const message of scopedCurrent) upsert(message, 'current');
  for (const message of incoming) upsert(message, 'hydrated');

  const deduped = Array.from(new Set(keyed.values()));
  deduped.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return deduped.slice(-MAX_LIVE_MESSAGES);
}

function upsertAssistantMessage(params: {
  messages: RuntimeBridgeChatMessage[];
  sessionKey: string | null;
  runId: string | null;
  text: string;
  status: RuntimeBridgeChatMessage['status'];
}): RuntimeBridgeChatMessage[] {
  const { messages, sessionKey, runId, text, status } = params;
  const normalized = text.trim();
  if (!normalized) return messages;

  const existingIndex = [...messages].reverse().findIndex((message) => {
    if (message.role !== 'assistant') return false;
    if (runId && message.runId === runId) return true;
    return message.status === 'streaming' && message.sessionKey === sessionKey;
  });

  if (existingIndex === -1) {
    return appendBounded(
      messages,
      {
        id: generateId('mc-assistant'),
        role: 'assistant',
        body: normalized,
        sessionKey,
        runId,
        status,
        at: Date.now(),
      },
      MAX_LIVE_MESSAGES,
    );
  }

  const resolvedIndex = messages.length - 1 - existingIndex;
  const current = messages[resolvedIndex];
  const nextBody =
    status === 'final'
      ? normalized
      : normalized.startsWith(current.body)
        ? normalized
        : `${current.body}${normalized}`;

  return messages.map((message, index) =>
    index === resolvedIndex
      ? {
          ...message,
          body: nextBody,
          runId: runId ?? message.runId,
          status,
          at: Date.now(),
        }
      : message,
  );
}

export function useRuntimeBridge(initialSummary: OrchestratorIntegrationSummary): RuntimeBridgeState {
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<RuntimeBridgeWsState>('unavailable');
  const [wsDetail, setWsDetail] = useState<string | null>(null);
  const [session, setSession] = useState<RuntimeBridgeSessionSnapshot>(
    createEmptySession('unavailable', 'No Mission Control WS sidecar descriptor is available for this preview.'),
  );
  const [messages, setMessages] = useState<RuntimeBridgeChatMessage[]>([]);
  const [events, setEvents] = useState<RuntimeBridgeLiveEvent[]>([]);
  const [notices, setNotices] = useState<RuntimeBridgeTransientNotice[]>([]);
  const [sendState, setSendState] = useState<RuntimeBridgeSendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(() => chooseTargetSession(initialSummary).key);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const mountedRef = useRef(true);
  const hydratedSessionKeyRef = useRef<string | null>(null);
  const hydratedTranscriptSignatureRef = useRef<string | null>(null);
  const noticeSignaturesRef = useRef<Set<string>>(new Set());
  const instanceIdRef = useRef(getOrCreateInstanceId());
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Record<string, PendingRequest>>({});
  const pendingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSessionStateRef = useRef<RuntimeBridgeSessionState>('unavailable');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const defaultTargetSession = useMemo(() => chooseTargetSession(summary), [summary]);
  const liveTargetSession = useMemo<RuntimeBridgeLiveSessionTarget>(() => {
    const resolvedKey = activeSessionKey ?? defaultTargetSession.key;
    return { key: resolvedKey, label: shortenSessionKey(resolvedKey) };
  }, [activeSessionKey, defaultTargetSession.key]);

  const rejectPending = useCallback((reason: Error) => {
    const pending = pendingRef.current;
    for (const id of Object.keys(pending)) {
      pending[id].reject(reason);
      delete pending[id];
    }

    const timeouts = pendingTimeoutsRef.current;
    for (const id of Object.keys(timeouts)) {
      clearTimeout(timeouts[id]);
      delete timeouts[id];
    }
  }, []);

  const rpc = useCallback((method: string, params: Record<string, unknown>) => {
    return new Promise<unknown>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('Mission Control bridge is not connected.'));
        return;
      }

      const id = generateId('mc-rpc');
      pendingRef.current[id] = {
        resolve,
        reject: (reason) => reject(reason),
      };
      pendingTimeoutsRef.current[id] = setTimeout(() => {
        if (!pendingRef.current[id]) return;
        delete pendingRef.current[id];
        delete pendingTimeoutsRef.current[id];
        reject(new Error(`Gateway request timed out for ${method}.`));
      }, 30000);

      socket.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      rejectPending(new Error('Mission Control bridge was torn down.'));
    };
  }, [rejectPending]);

  useEffect(() => {
    if (notices.length === 0) return;
    const timer = window.setTimeout(() => {
      setNotices((current) => current.slice(1));
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [notices]);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    if (summary.sessionContext.recent.length === 0) return;
    const recentKeys = new Set(summary.sessionContext.recent.map((candidate) => candidate.key));
    if (activeSessionKey && recentKeys.has(activeSessionKey)) return;
    if (defaultTargetSession.key) {
      setActiveSessionKey(defaultTargetSession.key);
    }
  }, [activeSessionKey, defaultTargetSession.key, summary.sessionContext.recent]);

  const load = useCallback(async (isBackgroundRefresh: boolean) => {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const sessionQuery = activeSessionKey ? `?sessionKey=${encodeURIComponent(activeSessionKey)}` : '';
      const res = await fetch(`/api/runtime-bridge${sessionQuery}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Runtime bridge request failed (${res.status})`);
      }

      const payload = (await res.json()) as OrchestratorIntegrationSummary & {
        transcriptHistory?: {
          sessionKey?: string | null;
          messages?: RuntimeBridgeChatMessage[];
        };
      };
      if (!mountedRef.current) return;

      setSummary(payload);
      if (payload.transcriptHistory?.sessionKey && payload.transcriptHistory.sessionKey === (activeSessionKey ?? defaultTargetSession.key)) {
        const hydratedSessionKey = payload.transcriptHistory.sessionKey ?? null;
        const incomingMessages = payload.transcriptHistory?.messages ?? [];
        const lastIncoming = incomingMessages[incomingMessages.length - 1];
        const incomingSignature = `${hydratedSessionKey ?? 'none'}:${incomingMessages.length}:${lastIncoming?.id ?? ''}:${lastIncoming?.body ?? ''}`;

        setMessages((current) => {
          const scopedCurrent = current.filter((message) => message.sessionKey === hydratedSessionKey || message.sessionKey === null);
          const hasScopedTranscript = scopedCurrent.some((message) => message.role === 'user' || message.role === 'assistant');
          const sessionChanged = hydratedSessionKeyRef.current !== hydratedSessionKey;
          const shouldHydrate = incomingMessages.length > 0 && (sessionChanged || !hasScopedTranscript);
          if (!shouldHydrate) return current;

          hydratedSessionKeyRef.current = hydratedSessionKey;
          hydratedTranscriptSignatureRef.current = incomingSignature;
          return mergeHydratedMessages(current, incomingMessages, hydratedSessionKey);
        });
      }
      setError(null);
    } catch (cause) {
      if (!mountedRef.current) return;

      setError(cause instanceof Error ? cause.message : 'Runtime bridge request failed');
    } finally {
      if (!mountedRef.current) return;

      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSessionKey, defaultTargetSession.key]);

  useEffect(() => {
    if (!activeSessionKey) return;
    void load(true);
  }, [activeSessionKey, load]);

  useEffect(() => {
    if (lastSessionStateRef.current === session.state) return;
    if (lastSessionStateRef.current !== 'unavailable') {
      console.info('[mission-control-runtime] session state', {
        from: lastSessionStateRef.current,
        to: session.state,
        detail: session.detail,
        wsState,
        lastEvent: session.lastEvent,
      });
    }
    lastSessionStateRef.current = session.state;
  }, [session.detail, session.lastEvent, session.state, wsState]);

  const scheduleReconnect = useCallback((reason: string) => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) return;

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    const delayMs = Math.min(1000 * 2 ** Math.min(attempt - 1, 4), 15000);

    console.info('[mission-control-runtime] scheduling reconnect', {
      reason,
      attempt,
      delayMs,
    });

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!mountedRef.current) return;
      setReconnectNonce((current) => current + 1);
    }, delayMs);
  }, []);

  // Auto-refresh removed — refresh is now manual-only via bridge.refresh()

  const handleGatewayEvent = useCallback(
    (message: GatewayEventMessage) => {
      const eventName = message.event ?? null;
      const payload = asRecord(message.payload);
      const eventRunId = typeof payload?.runId === 'string' ? payload.runId : null;
      const eventSessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : null;

      const tool = extractToolEvent(payload);
      const runtimeNotice = detectRuntimeNotice(payload);
      const agentStream = typeof payload?.stream === 'string' ? payload.stream : null;
      const lifecycleData = asRecord(payload?.data);
      const lifecyclePhase = typeof lifecycleData?.phase === 'string' ? lifecycleData.phase : null;
      const shouldRecordEvent =
        Boolean(tool) ||
        eventName === 'chat' ||
        (eventName === 'agent' && agentStream === 'lifecycle' && (lifecyclePhase === 'start' || lifecyclePhase === 'end'));

      if (shouldRecordEvent) {
        setEvents((current) =>
          appendBounded(
            current,
            {
              id: generateId('mc-event'),
              name: eventName ?? 'event',
              detail: describeGatewayEvent(eventName, payload),
              sessionKey: eventSessionKey,
              runId: eventRunId,
              seq: typeof message.seq === 'number' ? message.seq : null,
              at: Date.now(),
              tool,
            },
            MAX_LIVE_EVENTS,
          ),
        );
      }

      if (runtimeNotice) {
        const signature = `${runtimeNotice.kind}:${eventSessionKey ?? 'none'}:${eventRunId ?? 'none'}:${JSON.stringify(payload)}`;
        if (!noticeSignaturesRef.current.has(signature)) {
          noticeSignaturesRef.current.add(signature);
          setNotices((current) =>
            appendBounded(
              current,
              {
                id: generateId('mc-notice'),
                kind: runtimeNotice.kind,
                message: runtimeNotice.message,
                at: Date.now(),
              },
              MAX_TRANSIENT_NOTICES,
            ),
          );
        }
      }

      if (eventName !== 'chat') return;
      if (eventSessionKey && liveTargetSession.key && eventSessionKey !== liveTargetSession.key) return;

      const chatState = typeof payload?.state === 'string' ? payload.state : null;
      if (eventRunId) setActiveRunId(eventRunId);

      if (chatState === 'started') {
        setSendState('streaming');
        setSendError(null);
        return;
      }

      if (chatState === 'delta') {
        const deltaText = extractTextFromGatewayMessage(payload?.message);
        if (!deltaText) return;
        setMessages((current) =>
          upsertAssistantMessage({
            messages: current,
            sessionKey: eventSessionKey ?? liveTargetSession.key,
            runId: eventRunId,
            text: deltaText,
            status: 'streaming',
          }),
        );
        setSendState('streaming');
        return;
      }

      if (chatState === 'final') {
        const finalText = payload ? extractFinalChatText(payload) : '';
        if (finalText) {
          setMessages((current) =>
            upsertAssistantMessage({
              messages: current,
              sessionKey: eventSessionKey ?? liveTargetSession.key,
              runId: eventRunId,
              text: finalText,
              status: 'final',
            }),
          );
        }
        setSendState('idle');
        // Refresh snapshot after chat completion to pick up cross-device messages
        void load(true);
        return;
      }

      if (chatState === 'error') {
        const problem =
          typeof payload?.errorMessage === 'string'
            ? payload.errorMessage
            : typeof payload?.error === 'string'
              ? payload.error
              : 'Gateway chat run failed.';
        setSendState('error');
        setSendError(problem);
        setMessages((current) =>
          appendBounded(
            current,
            {
              id: generateId('mc-system'),
              role: 'system',
              body: problem,
              sessionKey: eventSessionKey ?? liveTargetSession.key,
              runId: eventRunId,
              status: 'error',
              at: Date.now(),
            },
            MAX_LIVE_MESSAGES,
          ),
        );
        // Also refresh on error to keep snapshot in sync
        void load(true);
        return;
      }

      if (chatState === 'aborted') {
        setSendState('idle');
        setSendError(null);
        setActiveRunId(null);
        setEvents((current) =>
          appendBounded(
            current,
            {
              id: generateId('mc-event'),
              name: 'chat.aborted',
              detail: 'Chat run aborted.',
              sessionKey: eventSessionKey ?? liveTargetSession.key,
              runId: eventRunId,
              seq: typeof payload?.seq === 'number' ? payload.seq : null,
              at: Date.now(),
              tool: null,
            },
            MAX_LIVE_EVENTS,
          ),
        );
        // Refresh after abort so snapshot stays aligned, but do not surface it as a fatal UI error.
        void load(true);
      }
    },
    [liveTargetSession.key, load],
  );

  const runtimeBridgeWebsocketConfigured = summary.runtimeBridge.transport.websocket.configured;
  const runtimeBridgeBrowserReachability = summary.runtimeBridge.transport.websocket.browserReachability;
  const runtimeBridgeWebsocketBridgeToken = summary.runtimeBridge.endpoints.websocketBridgeToken;
  const runtimeBridgeWebsocketBaseUrl = summary.runtimeBridge.endpoints.websocket;
  const runtimeBridgeGatewaySessionToken = summary.runtimeBridge.endpoints.gatewaySessionToken;

  useEffect(() => {
    const transportConfigured = runtimeBridgeWebsocketConfigured;
    const browserReachability = runtimeBridgeBrowserReachability;
    const bridgeToken = runtimeBridgeWebsocketBridgeToken;
    const baseUrl = runtimeBridgeWebsocketBaseUrl;
    const gatewaySessionToken = runtimeBridgeGatewaySessionToken;

    if (!transportConfigured || !bridgeToken || !baseUrl) {
      socketRef.current = null;
      setWsState('unavailable');
      setWsDetail('No Mission Control WS sidecar descriptor is available for this preview.');
      setSession(createEmptySession('unavailable', 'No Mission Control WS sidecar descriptor is available for this preview.'));
      setSendState('idle');
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let connectRequestId: string | null = null;
    let url: URL;

    try {
      url = resolveWebSocketUrl(baseUrl);
      url.searchParams.set('bridgeToken', bridgeToken);
    } catch (cause) {
      setWsState('error');
      setWsDetail(cause instanceof Error ? cause.message : 'Mission Control could not resolve the websocket endpoint.');
      setSession(createEmptySession('error', 'Mission Control could not resolve the browser websocket endpoint.'));
      return;
    }

    setWsState('connecting');
    setWsDetail(
      browserReachability === 'explicit'
        ? 'Connecting to the same-origin Mission Control runtime websocket.'
        : 'Connecting to Mission Control WS sidecar.',
    );
    setSession(createEmptySession('waiting', 'Waiting for gateway challenge.'));

    try {
      socket = new WebSocket(url);
      socketRef.current = socket;
    } catch (cause) {
      setWsState('error');
      setWsDetail(cause instanceof Error ? cause.message : 'Could not open Mission Control WS sidecar.');
      setSession(createEmptySession('error', 'Mission Control could not open a websocket to the local WS sidecar.'));
      socketRef.current = null;
      return;
    }

    socket.onopen = () => {
      if (cancelled) return;
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setWsState('open');
      setWsDetail('WS sidecar socket is open. Waiting for gateway handshake.');
      setSendError(null);
      setSession((current) => ({
        ...current,
        state: 'waiting',
        detail: 'Waiting for gateway challenge.',
      }));
    };

    socket.onmessage = (event) => {
      if (cancelled || typeof event.data !== 'string') return;

      let message: GatewayMessage;
      try {
        message = JSON.parse(event.data) as GatewayMessage;
      } catch {
        return;
      }

      if (message.type === 'event') {
        const eventName = message.event ?? null;

        if (eventName === 'connect.challenge') {
          setSession((current) => ({
            ...current,
            state: gatewaySessionToken ? 'connecting' : 'challenged',
            detail: gatewaySessionToken
              ? 'Gateway challenge received. Sending connect request.'
              : 'Gateway challenge reached the browser, but Mission Control has no configured gateway auth token for a real connect request.',
            challengeSeen: true,
            lastEvent: eventName,
            eventCount: current.eventCount + 1,
          }));

          if (!gatewaySessionToken || !socket || socket.readyState !== WebSocket.OPEN || connectRequestId) {
            handleGatewayEvent(message);
            return;
          }

          connectRequestId = generateId('mc-connect');
          socket.send(
            JSON.stringify({
              type: 'req',
              id: connectRequestId,
              method: 'connect',
              params: {
                minProtocol: CONNECT_PROTOCOL_VERSION,
                maxProtocol: CONNECT_PROTOCOL_VERSION,
                client: {
                  id: CLIENT_ID,
                  version: CLIENT_VERSION,
                  platform: 'web',
                  mode: CLIENT_MODE,
                  instanceId: instanceIdRef.current,
                },
                role: 'operator',
                scopes: CONNECT_SCOPES,
                auth: { token: gatewaySessionToken },
                caps: ['tool-events'],
              },
            }),
          );
          handleGatewayEvent(message);
          return;
        }

        setSession((current) => ({
          ...current,
          lastEvent: eventName,
          eventCount: current.eventCount + 1,
          detail:
            current.state === 'connected' && eventName
              ? `Gateway session active. Last event: ${eventName}.`
              : current.detail,
        }));
        handleGatewayEvent(message);
        return;
      }

      if (message.type === 'res' && message.id === connectRequestId) {
        connectRequestId = null;

        if (message.ok) {
          const payload = asRecord(message.payload) ?? {};
          const sessionPayload = asRecord(payload.session);
          const rawScopes = Array.isArray(payload.scopes) ? payload.scopes : [];
          const scopes = rawScopes.filter((value): value is string => typeof value === 'string');
          const protocolVersion =
            typeof payload.protocol === 'number'
              ? payload.protocol
              : typeof payload.protocolVersion === 'number'
                ? payload.protocolVersion
                : CONNECT_PROTOCOL_VERSION;
          const sessionId =
            typeof sessionPayload?.id === 'string'
              ? sessionPayload.id
              : typeof payload.sessionId === 'string'
                ? payload.sessionId
                : null;

          setSession((current) => ({
            ...current,
            state: 'connected',
            detail: sessionId
              ? `Gateway session established as ${sessionId}.`
              : 'Gateway session established through the WS sidecar.',
            sessionId,
            protocolVersion,
            scopes,
          }));
        } else {
          setSession((current) => ({
            ...current,
            state: 'rejected',
            detail: message.error?.message || 'Gateway rejected the connect request.',
          }));
        }
        return;
      }

      if (message.type === 'res' && typeof message.id === 'string') {
        const pending = pendingRef.current[message.id];
        if (!pending) return;

        delete pendingRef.current[message.id];
        const timeout = pendingTimeoutsRef.current[message.id];
        if (timeout) {
          clearTimeout(timeout);
          delete pendingTimeoutsRef.current[message.id];
        }

        if (message.ok) {
          pending.resolve(message.payload);
        } else {
          pending.reject(new Error(message.error?.message || 'Gateway request failed.'));
        }
      }
    };

    socket.onerror = () => {
      if (cancelled) return;
      setWsState('error');
      setWsDetail('Mission Control could not keep a browser socket attached to the WS sidecar. Retrying shortly.');
      setSession((current) => ({
        ...current,
        state: 'error',
        detail: 'Transport error while negotiating or maintaining the gateway session. Retrying shortly.',
      }));
      scheduleReconnect('socket-error');
    };

    socket.onclose = (event) => {
      if (cancelled) return;
      socketRef.current = null;
      const shouldRetry = event.code !== 1000 && event.code !== 1001;
      rejectPending(new Error('Mission Control gateway transport closed.'));
      setWsState(event.wasClean ? 'closed' : 'error');
      setWsDetail(
        event.reason
          ? `WS sidecar closed: ${event.reason}${shouldRetry ? ' Retrying…' : ''}`
          : event.wasClean
            ? shouldRetry
              ? 'WS sidecar connection closed. Retrying…'
              : 'WS sidecar connection closed.'
            : 'WS sidecar closed before a stable runtime session was negotiated. Retrying…',
      );
      setSession((current) => ({
        ...current,
        state: current.state === 'rejected' ? 'rejected' : event.wasClean ? 'closed' : 'error',
        detail: event.reason
          ? `Gateway transport closed: ${event.reason}${shouldRetry ? ' Retrying…' : ''}`
          : event.wasClean
            ? current.state === 'connected'
              ? shouldRetry
                ? 'Gateway session transport closed after connect. Retrying…'
                : 'Gateway session transport closed after connect.'
              : shouldRetry
                ? 'Gateway session transport closed before connect completed. Retrying…'
                : 'Gateway session transport closed before connect completed.'
            : 'Gateway session transport dropped unexpectedly. Retrying…',
      }));
      setSendState((current) => (current === 'streaming' || current === 'sending' ? 'error' : current));
      setSendError((current) => current ?? 'Bridge transport closed before the live response completed.');
      if (shouldRetry) {
        scheduleReconnect(`socket-close-${event.code || 'unknown'}`);
      }
    };

    return () => {
      cancelled = true;
      socketRef.current = null;
      socket?.close();
    };
  }, [
    handleGatewayEvent,
    reconnectNonce,
    rejectPending,
    runtimeBridgeWebsocketBaseUrl,
    runtimeBridgeWebsocketBridgeToken,
    runtimeBridgeGatewaySessionToken,
    runtimeBridgeBrowserReachability,
    runtimeBridgeWebsocketConfigured,
    scheduleReconnect,
  ]);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      if (session.state !== 'connected') {
        throw new Error('Mission Control can only send while the gateway session is connected.');
      }
      const sessionKey = liveTargetSession.key;
      if (!sessionKey) {
        throw new Error('No visible runtime session is available for Mission Control to target.');
      }

      setActiveSessionKey(sessionKey);
      setSendState('sending');
      setSendError(null);
      setMessages((current) =>
        appendBounded(
          current,
          {
            id: generateId('mc-user'),
            role: 'user',
            body: trimmed,
            sessionKey,
            runId: null,
            status: 'final',
            at: Date.now(),
          },
          MAX_LIVE_MESSAGES,
        ),
      );

      try {
        const ack = (await rpc('chat.send', {
          sessionKey,
          message: trimmed,
          deliver: false,
          idempotencyKey: generateId('mc-chat-send'),
        })) as Record<string, unknown> | null;
        const runId = typeof ack?.runId === 'string' ? ack.runId : null;
        const status = typeof ack?.status === 'string' ? ack.status : null;
        setActiveRunId(runId);
        setEvents((current) =>
          appendBounded(
            current,
            {
              id: generateId('mc-event'),
              name: 'chat.send',
              detail: status ? `chat.send acknowledged as ${status}.` : 'chat.send acknowledged.',
              sessionKey,
              runId,
              seq: null,
              at: Date.now(),
              tool: null,
            },
            MAX_LIVE_EVENTS,
          ),
        );
        setSendState(status === 'ok' ? 'idle' : 'streaming');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Mission Control could not send the prompt.';
        setSendState('error');
        setSendError(message);
        setMessages((current) =>
          appendBounded(
            current,
            {
              id: generateId('mc-system'),
              role: 'system',
              body: message,
              sessionKey,
              runId: null,
              status: 'error',
              at: Date.now(),
            },
            MAX_LIVE_MESSAGES,
          ),
        );
        throw cause;
      }
    },
    [liveTargetSession.key, rpc, session.state],
  );

  const abortPrompt = useCallback(async () => {
    const sessionKey = liveTargetSession.key;
    if (session.state !== 'connected') {
      throw new Error('Mission Control can only stop while the gateway session is connected.');
    }
    if (!sessionKey) {
      throw new Error('No visible runtime session is available for Mission Control to stop.');
    }

    try {
      await rpc('chat.abort', { sessionKey });
      setSendError(null);
      setSendState('idle');
      setActiveRunId(null);
      setEvents((current) =>
        appendBounded(
          current,
          {
            id: generateId('mc-event'),
            name: 'chat.abort',
            detail: 'chat.abort requested.',
            sessionKey,
            runId: null,
            seq: null,
            at: Date.now(),
            tool: null,
          },
          MAX_LIVE_EVENTS,
        ),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Mission Control could not stop the active response.';
      setSendError(message);
      throw cause;
    }
  }, [liveTargetSession.key, rpc, session.state]);

  return {
    summary,
    loading,
    refreshing,
    error,
    wsState,
    wsDetail,
    session,
    live: {
      targetSession: liveTargetSession,
      canSend: session.state === 'connected' && Boolean(liveTargetSession.key) && sendState !== 'sending' && sendState !== 'streaming',
      canAbort: session.state === 'connected' && Boolean(liveTargetSession.key) && (sendState === 'sending' || sendState === 'streaming' || Boolean(activeRunId)),
      sendState,
      sendError,
      activeRunId,
      messages,
      events,
      notices,
      sendPrompt,
      abortPrompt,
    },
    refresh: async () => {
      await load(true);
    },
    switchSession: async (sessionKey: string) => {
      hydratedSessionKeyRef.current = null;
      hydratedTranscriptSignatureRef.current = null;
      setActiveSessionKey(sessionKey);
      setMessages([]);
      setEvents([]);
      setNotices([]);
      noticeSignaturesRef.current.clear();
      setSendError(null);
      setSendState('idle');
      setActiveRunId(null);
      await load(true);
    },
  };
}
