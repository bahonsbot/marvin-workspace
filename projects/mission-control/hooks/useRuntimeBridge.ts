'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEventEntry,
  createMessageEntry,
  createNoticeEntry,
  createProcessEntry,
  createToolEntry,
  mergeTranscriptEntries,
} from '@/lib/chat/runtime-bridge-transcript';
import type {
  OrchestratorIntegrationSummary,
  RuntimeBridgeTranscriptEntry,
  RuntimeBridgeTranscriptHistory,
} from '@/lib/types/contracts';

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
  entries: RuntimeBridgeTranscriptEntry[];
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
const MAIN_SESSION_LABEL = shortenSessionKey(MAIN_SESSION_KEY);

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

function scopedTranscriptEntries(entries: RuntimeBridgeTranscriptEntry[], sessionKey: string | null): RuntimeBridgeTranscriptEntry[] {
  return entries.filter((entry) => entry.sessionKey === sessionKey || entry.sessionKey === null);
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
  if (summary.sessionContext.mainSession.exists) {
    return { key: MAIN_SESSION_KEY, label: MAIN_SESSION_LABEL };
  }

  return { key: MAIN_SESSION_KEY, label: MAIN_SESSION_LABEL };
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

function buildSeededEntries(
  initialSessionKey: string | null,
  initialTranscriptHistory: RuntimeBridgeTranscriptHistory | null | undefined,
): RuntimeBridgeTranscriptEntry[] {
  if (!initialSessionKey) return [];
  if (!initialTranscriptHistory) return [];
  if (initialTranscriptHistory.sessionKey !== initialSessionKey) return [];
  return initialTranscriptHistory.entries ?? [];
}

function hasScopedTranscriptEntries(entries: RuntimeBridgeTranscriptEntry[], sessionKey: string | null): boolean {
  return entries.some(
    (entry) =>
      entry.kind === 'message' &&
      (entry.role === 'user' || entry.role === 'assistant') &&
      (entry.sessionKey === sessionKey || entry.sessionKey === null),
  );
}

function transcriptEntriesToLiveMessages(entries: RuntimeBridgeTranscriptEntry[]): RuntimeBridgeChatMessage[] {
  return entries
    .filter((entry): entry is Extract<RuntimeBridgeTranscriptEntry, { kind: 'message' }> => entry.kind === 'message')
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system')
    .map((entry): RuntimeBridgeChatMessage => ({
      id: entry.id,
      role: entry.role,
      variant: entry.role === 'system' ? ('bridge-note' as const) : undefined,
      body: entry.body,
      sessionKey: entry.sessionKey,
      runId: entry.runId,
      status: entry.status,
      at: entry.at,
    }))
    .slice(-MAX_LIVE_MESSAGES);
}

function transcriptEntriesToLiveEvents(entries: RuntimeBridgeTranscriptEntry[]): RuntimeBridgeLiveEvent[] {
  const liveEvents: RuntimeBridgeLiveEvent[] = [];

  entries.forEach((entry) => {
      if (entry.kind === 'tool') {
        liveEvents.push({
          id: entry.id,
          name: 'agent',
          detail: describeGatewayEvent('agent', {
            stream: 'tool',
            data: {
              phase: entry.phase,
              name: entry.name,
              toolCallId: entry.toolCallId,
              args: entry.args,
              meta: entry.meta,
              isError: entry.isError,
            },
          }),
          sessionKey: entry.sessionKey,
          runId: entry.runId,
          seq: entry.evidence.seq ?? null,
          at: entry.at,
          tool: {
            stream: 'tool',
            phase: entry.phase,
            name: entry.name,
            toolCallId: entry.toolCallId,
            args: entry.args,
            meta: entry.meta,
            isError: entry.isError,
          },
        });
        return;
      }

      if (entry.kind === 'event') {
        liveEvents.push({
          id: entry.id,
          name: entry.name,
          detail: entry.detail,
          sessionKey: entry.sessionKey,
          runId: entry.runId,
          seq: entry.seq,
          at: entry.at,
          tool: null,
        });
      }
    });

  return liveEvents.slice(-MAX_LIVE_EVENTS);
}

function transcriptEntriesToTransientNotices(entries: RuntimeBridgeTranscriptEntry[]): RuntimeBridgeTransientNotice[] {
  return entries
    .filter(
      (
        entry,
      ): entry is Extract<RuntimeBridgeTranscriptEntry, { kind: 'notice' }> & {
        noticeKind: 'context-compression' | 'fallback-model';
      } => entry.kind === 'notice' && (entry.noticeKind === 'context-compression' || entry.noticeKind === 'fallback-model'),
    )
    .map((entry): RuntimeBridgeTransientNotice => ({
      id: entry.id,
      kind: entry.noticeKind,
      message: entry.message,
      at: entry.at,
    }))
    .slice(-MAX_TRANSIENT_NOTICES);
}

function upsertAssistantEntry(params: {
  entries: RuntimeBridgeTranscriptEntry[];
  sessionKey: string | null;
  runId: string | null;
  text: string;
  status: 'streaming' | 'final' | 'error';
}): RuntimeBridgeTranscriptEntry[] {
  const at = Date.now();
  const entry = createMessageEntry({
    id: params.runId ? `mc-assistant-${params.runId}` : generateId('mc-assistant'),
    role: 'assistant',
    body: params.text,
    status: params.status,
    sessionKey: params.sessionKey,
    runId: params.runId,
    at,
    evidence: {
      sessionKey: params.sessionKey,
      runId: params.runId,
    },
  });

  if (!entry) return params.entries;
  return mergeTranscriptEntries(params.entries, [entry], {
    sessionKey: params.sessionKey,
    limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 40,
  });
}

export function useRuntimeBridge(
  initialSummary: OrchestratorIntegrationSummary,
  initialTranscriptHistory: RuntimeBridgeTranscriptHistory | null = null,
): RuntimeBridgeState {
  const seededEntries = useMemo(
    () => buildSeededEntries(chooseTargetSession(initialSummary).key, initialTranscriptHistory),
    [initialSummary, initialTranscriptHistory],
  );
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<RuntimeBridgeWsState>('unavailable');
  const [wsDetail, setWsDetail] = useState<string | null>(null);
  const [session, setSession] = useState<RuntimeBridgeSessionSnapshot>(
    createEmptySession('unavailable', 'No Mission Control WS sidecar descriptor is available for this preview.'),
  );
  const [entries, setEntries] = useState<RuntimeBridgeTranscriptEntry[]>(seededEntries);
  const [sendState, setSendState] = useState<RuntimeBridgeSendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(() => chooseTargetSession(initialSummary).key);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const mountedRef = useRef(true);
  const entriesRef = useRef<RuntimeBridgeTranscriptEntry[]>(seededEntries);
  const activeSessionKeyRef = useRef<string | null>(chooseTargetSession(initialSummary).key);
  const sessionGenerationRef = useRef(0);
  const hydratedSessionKeyRef = useRef<string | null>(initialTranscriptHistory?.sessionKey ?? null);
  const noticeSignaturesRef = useRef<Set<string>>(new Set());
  const instanceIdRef = useRef(getOrCreateInstanceId());
  const socketRef = useRef<WebSocket | null>(null);
  const websocketGenerationRef = useRef(0);
  const handleGatewayEventRef = useRef<(message: GatewayEventMessage) => void>(() => {});
  const pendingRef = useRef<Record<string, PendingRequest>>({});
  const pendingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSessionStateRef = useRef<RuntimeBridgeSessionState>('unavailable');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const bootstrapSessionPromisesRef = useRef<Partial<Record<string, Promise<void>>>>({});

  const defaultTargetSession = useMemo(() => chooseTargetSession(summary), [summary]);
  const liveTargetSession = useMemo<RuntimeBridgeLiveSessionTarget>(() => {
    const resolvedKey = activeSessionKey ?? defaultTargetSession.key;
    return { key: resolvedKey, label: shortenSessionKey(resolvedKey) };
  }, [activeSessionKey, defaultTargetSession.key]);
  const liveEntries = useMemo(() => scopedTranscriptEntries(entries, liveTargetSession.key), [entries, liveTargetSession.key]);
  const messages = useMemo(() => transcriptEntriesToLiveMessages(liveEntries), [liveEntries]);
  const events = useMemo(() => transcriptEntriesToLiveEvents(liveEntries), [liveEntries]);
  const notices = useMemo(() => transcriptEntriesToTransientNotices(liveEntries), [liveEntries]);

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
      setEntries((current) => {
        const firstNotice = current.find((entry) => entry.kind === 'notice');
        if (!firstNotice) return current;
        return current.filter((entry) => entry.id !== firstNotice.id);
      });
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [notices]);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    const initialSessionKey = chooseTargetSession(initialSummary).key;
    if (!initialSessionKey) return;
    if (initialTranscriptHistory?.sessionKey !== initialSessionKey) return;

    hydratedSessionKeyRef.current = initialTranscriptHistory.sessionKey;
    setEntries((current) =>
      mergeTranscriptEntries(current, initialTranscriptHistory.entries ?? [], {
        sessionKey: initialSessionKey,
        limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
      }),
    );
  }, [initialSummary, initialTranscriptHistory]);

  useEffect(() => {
    activeSessionKeyRef.current = activeSessionKey;
  }, [activeSessionKey]);

  useEffect(() => {
    if (activeSessionKey) return;
    if (defaultTargetSession.key) {
      setActiveSessionKey(defaultTargetSession.key);
    }
  }, [activeSessionKey, defaultTargetSession.key]);

  const applyHydratedHistory = useCallback((
    requestedSessionKey: string | null,
    incomingHistory: RuntimeBridgeTranscriptHistory,
    capturedGeneration: number,
  ) => {
    if (!requestedSessionKey) return;
    if (capturedGeneration !== sessionGenerationRef.current) return;
    if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== requestedSessionKey) return;
    if (incomingHistory.sessionKey !== requestedSessionKey) return;

    const hydratedSessionKey = incomingHistory.sessionKey ?? null;
    const incomingEntries = incomingHistory.entries ?? [];

    setEntries((current) => {
      if (capturedGeneration !== sessionGenerationRef.current) return current;
      if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== requestedSessionKey) return current;

      const hasScopedTranscript = hasScopedTranscriptEntries(current, hydratedSessionKey);
      const sessionChanged = hydratedSessionKeyRef.current !== hydratedSessionKey;
      const shouldHydrate = incomingEntries.length > 0 && (sessionChanged || !hasScopedTranscript);
      hydratedSessionKeyRef.current = hydratedSessionKey;
      if (!shouldHydrate) return current;

      return mergeTranscriptEntries(current, incomingEntries, {
        sessionKey: hydratedSessionKey,
        limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
      });
    });
  }, [defaultTargetSession.key]);

  const hydrateHistory = useCallback(async (sessionKey: string | null, options?: { force?: boolean }) => {
    if (!sessionKey) return;

    const hasScopedTranscript = hasScopedTranscriptEntries(entriesRef.current, sessionKey);
    if (!options?.force && hydratedSessionKeyRef.current === sessionKey && hasScopedTranscript) {
      return;
    }

    const capturedGeneration = sessionGenerationRef.current;

    try {
      const res = await fetch(`/api/runtime-bridge/history?sessionKey=${encodeURIComponent(sessionKey)}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Runtime bridge history request failed (${res.status})`);
      }

      const payload = (await res.json()) as RuntimeBridgeTranscriptHistory;
      if (!mountedRef.current) return;
      applyHydratedHistory(sessionKey, payload, capturedGeneration);
    } catch (cause) {
      if (!mountedRef.current) return;
      console.error('[mission-control-runtime] transcript hydration failed', {
        sessionKey,
        error: cause instanceof Error ? cause.message : cause,
      });
    }
  }, [applyHydratedHistory]);

  const load = useCallback(async (isBackgroundRefresh: boolean) => {
    const requestedSessionKey = activeSessionKeyRef.current ?? defaultTargetSession.key;
    const capturedGeneration = sessionGenerationRef.current;

    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch('/api/runtime-bridge', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Runtime bridge request failed (${res.status})`);
      }

      const payload = (await res.json()) as OrchestratorIntegrationSummary;
      if (!mountedRef.current) return;
      if (capturedGeneration !== sessionGenerationRef.current) return;
      if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== requestedSessionKey) return;

      setSummary(payload);
      setError(null);
    } catch (cause) {
      if (!mountedRef.current) return;
      if (capturedGeneration !== sessionGenerationRef.current) return;
      if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== requestedSessionKey) return;

      setError(cause instanceof Error ? cause.message : 'Runtime bridge request failed');
    } finally {
      if (!mountedRef.current) return;
      if (capturedGeneration !== sessionGenerationRef.current) return;
      if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== requestedSessionKey) return;

      setLoading(false);
      setRefreshing(false);
    }
  }, [defaultTargetSession.key]);

  useEffect(() => {
    const requestedSessionKey = activeSessionKeyRef.current ?? defaultTargetSession.key;
    void load(true);
    void hydrateHistory(requestedSessionKey);
  }, [defaultTargetSession.key, hydrateHistory, load]);

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

  const ensureSessionExists = useCallback(
    async (sessionKey: string) => {
      if (!sessionKey) return;

      const existsInSummary =
        (sessionKey === MAIN_SESSION_KEY && summary.sessionContext.mainSession.exists) ||
        summary.sessionContext.roots.some((candidate) => candidate.key === sessionKey) ||
        summary.sessionContext.recent.some((candidate) => candidate.key === sessionKey);

      if (existsInSummary) return;

      const activeBootstraps = bootstrapSessionPromisesRef.current;
      if (activeBootstraps[sessionKey]) {
        await activeBootstraps[sessionKey];
        return;
      }

      const bootstrapPromise = (async () => {
        await rpc('sessions.patch', { key: sessionKey });
        if (!mountedRef.current) return;
        await load(true);
      })();

      activeBootstraps[sessionKey] = bootstrapPromise;
      try {
        await bootstrapPromise;
      } finally {
        delete activeBootstraps[sessionKey];
      }
    },
    [load, rpc, summary.sessionContext.mainSession.exists, summary.sessionContext.recent, summary.sessionContext.roots],
  );

  // Auto-refresh removed — refresh is now manual-only via bridge.refresh()

  useEffect(() => {
    if (session.state !== 'connected') return;
    if (liveTargetSession.key !== MAIN_SESSION_KEY) return;
    if (summary.sessionContext.mainSession.exists) return;

    void ensureSessionExists(MAIN_SESSION_KEY).catch((cause) => {
      console.error('[mission-control-runtime] failed to bootstrap canonical main session', cause);
    });
  }, [ensureSessionExists, liveTargetSession.key, session.state, summary.sessionContext.mainSession.exists]);

  const handleGatewayEvent = useCallback(
    (message: GatewayEventMessage) => {
      const eventName = message.event ?? null;
      const payload = asRecord(message.payload);
      const eventRunId = typeof payload?.runId === 'string' ? payload.runId : null;
      const eventSessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : null;
      const targetSessionKey = activeSessionKeyRef.current ?? defaultTargetSession.key;
      const at = Date.now();
      const evidence = {
        runId: eventRunId,
        sessionKey: eventSessionKey,
        seq: typeof message.seq === 'number' ? message.seq : null,
        sourceEvent: eventName,
      };

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
        const nextEntries: RuntimeBridgeTranscriptEntry[] = [];
        if (tool) {
          nextEntries.push(
            createToolEntry({
              id: generateId('mc-tool'),
              name: tool.name,
              phase: tool.phase,
              status: tool.isError ? 'failed' : tool.phase === 'result' ? 'completed' : 'running',
              toolCallId: tool.toolCallId,
              args: tool.args,
              meta: tool.meta,
              isError: tool.isError,
              sessionKey: eventSessionKey,
              runId: eventRunId,
              at,
              evidence: {
                ...evidence,
                toolCallId: tool.toolCallId,
              },
            }),
          );
        } else if (eventName === 'agent' && agentStream === 'lifecycle' && (lifecyclePhase === 'start' || lifecyclePhase === 'end')) {
          const processEntry = createProcessEntry({
            id: generateId('mc-process'),
            stage: 'lifecycle',
            label: lifecyclePhase === 'start' ? 'Run started' : 'Run finished',
            body: describeGatewayEvent(eventName, payload),
            sessionKey: eventSessionKey,
            runId: eventRunId,
            at,
            evidence,
          });
          if (processEntry) nextEntries.push(processEntry);
        } else {
          const eventEntry = createEventEntry({
            id: generateId('mc-event'),
            name: eventName ?? 'event',
            detail: describeGatewayEvent(eventName, payload),
            sessionKey: eventSessionKey,
            runId: eventRunId,
            at,
            evidence,
          });
          if (eventEntry) nextEntries.push(eventEntry);
        }

        if (nextEntries.length > 0) {
          setEntries((current) =>
            mergeTranscriptEntries(current, nextEntries, {
              sessionKey: targetSessionKey,
              limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
            }),
          );
        }
      }

      if (runtimeNotice) {
        const signature = `${runtimeNotice.kind}:${eventSessionKey ?? 'none'}:${eventRunId ?? 'none'}:${JSON.stringify(payload)}`;
        if (!noticeSignaturesRef.current.has(signature)) {
          noticeSignaturesRef.current.add(signature);
          const noticeEntry = createNoticeEntry({
            id: generateId('mc-notice'),
            noticeKind: runtimeNotice.kind,
            message: runtimeNotice.message,
            sessionKey: eventSessionKey,
            runId: eventRunId,
            at,
            evidence,
          });
          if (noticeEntry) {
            setEntries((current) =>
              mergeTranscriptEntries(current, [noticeEntry], {
                sessionKey: targetSessionKey,
                limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
              }),
            );
          }
        }
      }

      const isLifecycleEndEvent = eventName === 'agent' && agentStream === 'lifecycle' && lifecyclePhase === 'end';
      const sessionMatchesTarget = !eventSessionKey || !targetSessionKey || eventSessionKey === targetSessionKey;
      const runMatchesActive = !activeRunId || !eventRunId || eventRunId === activeRunId;
      if (isLifecycleEndEvent && sessionMatchesTarget && runMatchesActive) {
        if (sendState === 'sending' || sendState === 'streaming') {
          setSendState('idle');
          setSendError(null);
        }
        if (!eventRunId || !activeRunId || eventRunId === activeRunId) {
          setActiveRunId(null);
        }
        // Some specialist seats do not emit reliable chat.final events, so treat lifecycle end
        // as a completion signal and force-hydrate transcript history for the active session.
        void Promise.all([
          load(true),
          hydrateHistory(targetSessionKey, { force: true }),
        ]);
      }

      if (eventName !== 'chat') return;
      if (eventSessionKey && targetSessionKey && eventSessionKey !== targetSessionKey) return;

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
        setEntries((current) =>
          upsertAssistantEntry({
            entries: current,
            sessionKey: eventSessionKey ?? targetSessionKey,
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
          setEntries((current) =>
            upsertAssistantEntry({
              entries: current,
              sessionKey: eventSessionKey ?? targetSessionKey,
              runId: eventRunId,
              text: finalText,
              status: 'final',
            }),
          );
        }
        setSendState('idle');
        setActiveRunId(null);
        // Refresh snapshot after chat completion to pick up cross-device messages
        void Promise.all([
          load(true),
          hydrateHistory(targetSessionKey, { force: true }),
        ]);
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
        setActiveRunId(null);
        const errorEntry = createMessageEntry({
          id: generateId('mc-system'),
          role: 'system',
          body: problem,
          status: 'error',
          sessionKey: eventSessionKey ?? targetSessionKey,
          runId: eventRunId,
          at,
          evidence,
        });
        if (errorEntry) {
          setEntries((current) =>
            mergeTranscriptEntries(current, [errorEntry], {
              sessionKey: targetSessionKey,
              limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
            }),
          );
        }
        // Also refresh on error to keep snapshot in sync
        void Promise.all([
          load(true),
          hydrateHistory(targetSessionKey, { force: true }),
        ]);
        return;
      }

      if (chatState === 'aborted') {
        setSendState('idle');
        setSendError(null);
        setActiveRunId(null);
        const abortedEntry = createEventEntry({
          id: generateId('mc-event'),
          name: 'chat.aborted',
          detail: 'Chat run aborted.',
          sessionKey: eventSessionKey ?? targetSessionKey,
          runId: eventRunId,
          at,
          evidence,
        });
        if (abortedEntry) {
          setEntries((current) =>
            mergeTranscriptEntries(current, [abortedEntry], {
              sessionKey: targetSessionKey,
              limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
            }),
          );
        }
        // Refresh after abort so snapshot stays aligned, but do not surface it as a fatal UI error.
        void Promise.all([
          load(true),
          hydrateHistory(targetSessionKey, { force: true }),
        ]);
      }
    },
    [activeRunId, defaultTargetSession.key, hydrateHistory, load, sendState],
  );

  useEffect(() => {
    handleGatewayEventRef.current = handleGatewayEvent;
  }, [handleGatewayEvent]);

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
    const websocketGeneration = ++websocketGenerationRef.current;

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
    let handshakeEstablished = false;
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
      if (cancelled || websocketGeneration !== websocketGenerationRef.current) return;
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
      if (cancelled || websocketGeneration !== websocketGenerationRef.current || typeof event.data !== 'string') return;

      let message: GatewayMessage;
      try {
        message = JSON.parse(event.data) as GatewayMessage;
      } catch {
        return;
      }

      if (message.type === 'event') {
        const eventName = message.event ?? null;

        if (eventName === 'connect.challenge') {
          if (handshakeEstablished) {
            setSession((current) => ({
              ...current,
              challengeSeen: true,
              lastEvent: eventName,
              eventCount: current.eventCount + 1,
            }));
            handleGatewayEventRef.current(message);
            return;
          }

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
            handleGatewayEventRef.current(message);
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
          handleGatewayEventRef.current(message);
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
        handleGatewayEventRef.current(message);
        return;
      }

      if (message.type === 'res' && message.id === connectRequestId) {
        connectRequestId = null;

        if (message.ok) {
          handshakeEstablished = true;
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
      if (cancelled || websocketGeneration !== websocketGenerationRef.current) return;
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
      if (cancelled || websocketGeneration !== websocketGenerationRef.current) return;
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

      const capturedGeneration = sessionGenerationRef.current;

      await ensureSessionExists(sessionKey);

      if (capturedGeneration !== sessionGenerationRef.current) return;
      if (activeSessionKeyRef.current !== sessionKey) return;

      setActiveSessionKey(sessionKey);
      setSendState('sending');
      setSendError(null);
      const userEntry = createMessageEntry({
        id: generateId('mc-user'),
        role: 'user',
        body: trimmed,
        status: 'final',
        sessionKey,
        runId: null,
        at: Date.now(),
        evidence: {
          sessionKey,
        },
      });
      if (userEntry) {
        setEntries((current) =>
          mergeTranscriptEntries(current, [userEntry], {
            sessionKey,
            limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
          }),
        );
      }

      try {
        const ack = (await rpc('chat.send', {
          sessionKey,
          message: trimmed,
          deliver: false,
          idempotencyKey: generateId('mc-chat-send'),
        })) as Record<string, unknown> | null;
        if (capturedGeneration !== sessionGenerationRef.current) return;
        if (activeSessionKeyRef.current !== sessionKey) return;

        const runId = typeof ack?.runId === 'string' ? ack.runId : null;
        const status = typeof ack?.status === 'string' ? ack.status : null;
        setActiveRunId(runId);
        const sendEvent = createEventEntry({
          id: generateId('mc-event'),
          name: 'chat.send',
          detail: status ? `chat.send acknowledged as ${status}.` : 'chat.send acknowledged.',
          sessionKey,
          runId,
          at: Date.now(),
          evidence: {
            sessionKey,
            runId,
            sourceEvent: 'chat.send',
          },
        });
        if (sendEvent) {
          setEntries((current) =>
            mergeTranscriptEntries(current, [sendEvent], {
              sessionKey,
              limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
            }),
          );
        }
        // chat.send ack confirms acceptance, not completion. Keep the run in-flight until
        // a completion signal (chat.final/chat.error/chat.aborted or lifecycle end) arrives.
        setSendState('streaming');
      } catch (cause) {
        if (capturedGeneration !== sessionGenerationRef.current) return;
        if (activeSessionKeyRef.current !== sessionKey) return;

        const message = cause instanceof Error ? cause.message : 'Mission Control could not send the prompt.';
        setSendState('error');
        setSendError(message);
        setActiveRunId(null);
        const systemEntry = createMessageEntry({
          id: generateId('mc-system'),
          role: 'system',
          body: message,
          status: 'error',
          sessionKey,
          runId: null,
          at: Date.now(),
          evidence: {
            sessionKey,
          },
        });
        if (systemEntry) {
          setEntries((current) =>
            mergeTranscriptEntries(current, [systemEntry], {
              sessionKey,
              limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
            }),
          );
        }
        throw cause;
      }
    },
    [ensureSessionExists, liveTargetSession.key, rpc, session.state],
  );

  const abortPrompt = useCallback(async () => {
    const sessionKey = liveTargetSession.key;
    if (session.state !== 'connected') {
      throw new Error('Mission Control can only stop while the gateway session is connected.');
    }
    if (!sessionKey) {
      throw new Error('No visible runtime session is available for Mission Control to stop.');
    }

    const capturedGeneration = sessionGenerationRef.current;

    try {
      await rpc('chat.abort', { sessionKey });
      if (capturedGeneration !== sessionGenerationRef.current) return;
      if (activeSessionKeyRef.current !== sessionKey) return;

      setSendError(null);
      setSendState('idle');
      setActiveRunId(null);
      const abortEvent = createEventEntry({
        id: generateId('mc-event'),
        name: 'chat.abort',
        detail: 'chat.abort requested.',
        sessionKey,
        runId: null,
        at: Date.now(),
        evidence: {
          sessionKey,
          sourceEvent: 'chat.abort',
        },
      });
      if (abortEvent) {
        setEntries((current) =>
          mergeTranscriptEntries(current, [abortEvent], {
            sessionKey,
            limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
          }),
        );
      }
    } catch (cause) {
      if (capturedGeneration !== sessionGenerationRef.current) return;
      if (activeSessionKeyRef.current !== sessionKey) return;

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
      entries: liveEntries,
      messages,
      events,
      notices,
      sendPrompt,
      abortPrompt,
    },
    refresh: async () => {
      await Promise.all([
        load(true),
        hydrateHistory(activeSessionKeyRef.current ?? defaultTargetSession.key, { force: true }),
      ]);
    },
    switchSession: async (sessionKey: string) => {
      sessionGenerationRef.current += 1;
      activeSessionKeyRef.current = sessionKey;
      hydratedSessionKeyRef.current = null;
      setActiveSessionKey(sessionKey);
      setEntries([]);
      noticeSignaturesRef.current.clear();
      setSendError(null);
      setSendState('idle');
      setActiveRunId(null);
      const historyPromise = hydrateHistory(sessionKey, { force: true });
      await ensureSessionExists(sessionKey);
      await Promise.all([historyPromise, load(true)]);
    },
  };
}
