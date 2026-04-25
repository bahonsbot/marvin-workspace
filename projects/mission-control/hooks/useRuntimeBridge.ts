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

type RuntimeBridgeHistoryStatus = {
  source: 'gateway' | 'jsonl' | 'unavailable';
  note: string | null;
  retryable: boolean;
  thinkingLevel: string | null;
  sessionId: string | null;
};

type RuntimeBridgeSendPollOutcome = 'completed' | 'expired' | 'cancelled';

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

type RuntimeBridgeConnectionTiming = {
  generation: number;
  connectStartedAt: number | null;
  socketOpenedAt: number | null;
  challengeReceivedAt: number | null;
  connectedAt: number | null;
  lastClosedAt: number | null;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
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
  timing: RuntimeBridgeConnectionTiming;
  history: RuntimeBridgeHistoryStatus;
  live: RuntimeBridgeLiveState;
  refresh: () => Promise<void>;
  switchSession: (sessionKey: string) => Promise<void>;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

type PendingSubscribeState = {
  sessionEvents: boolean;
  messageSessionKey: string | null;
};

const CLIENT_ID = 'openclaw-control-ui';
const CLIENT_VERSION = '0.1.0';
const CLIENT_MODE = 'webchat';
const INSTANCE_ID_STORAGE_KEY = 'mission-control-runtime-bridge-instance-id';
const CONNECT_PROTOCOL_VERSION = 3;
const CONNECT_SCOPES = ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'];
const SERVER_CONNECT_REQUEST_ID = 'mc-server-connect';
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

function createEmptyTiming(generation = 0): RuntimeBridgeConnectionTiming {
  return {
    generation,
    connectStartedAt: null,
    socketOpenedAt: null,
    challengeReceivedAt: null,
    connectedAt: null,
    lastClosedAt: null,
    lastCloseCode: null,
    lastCloseReason: null,
  };
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

function replaceTranscriptEntriesForSession(
  current: RuntimeBridgeTranscriptEntry[],
  incoming: RuntimeBridgeTranscriptEntry[],
  options: { sessionKey: string | null; limit?: number },
): RuntimeBridgeTranscriptEntry[] {
  const rebuilt = mergeTranscriptEntries([], incoming, {
    sessionKey: options.sessionKey,
    limit: options.limit,
  });

  const preserved = current.filter(
    (entry) => entry.sessionKey !== options.sessionKey && entry.sessionKey !== null,
  );

  return [...preserved, ...rebuilt].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

function hasTerminalHistoryEntryForRun(entries: RuntimeBridgeTranscriptEntry[], runId: string | null): boolean {
  if (!runId) return false;
  return entries.some((entry) => {
    if (entry.runId !== runId) return false;
    if (entry.kind === 'message') {
      return (
        (entry.role === 'assistant' && entry.status === 'final' && entry.body.trim().length > 0) ||
        (entry.role === 'system' && entry.status === 'error')
      );
    }
    return false;
  });
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
  const [timing, setTiming] = useState<RuntimeBridgeConnectionTiming>(createEmptyTiming());
  const [history, setHistory] = useState<RuntimeBridgeHistoryStatus>({
    source: initialTranscriptHistory?.source ?? 'unavailable',
    note: initialTranscriptHistory?.note ?? null,
    retryable: Boolean(initialTranscriptHistory?.retryable),
    thinkingLevel: initialTranscriptHistory?.thinkingLevel ?? null,
    sessionId: initialTranscriptHistory?.sessionId ?? null,
  });
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
  const loadRef = useRef<(isBackgroundRefresh: boolean) => Promise<void>>(async () => {});
  const hydrateHistoryRef = useRef<(sessionKey: string | null, options?: { force?: boolean }) => Promise<void>>(async () => {});
  const subscribeToActiveSessionRef = useRef<(sessionKey: string | null) => Promise<void>>(async () => {});
  const pendingRef = useRef<Record<string, PendingRequest>>({});
  const pendingTimeoutsRef = useRef<Record<string, number>>({});
  const subscribedSessionKeyRef = useRef<string | null>(null);
  const pendingSubscribeStateRef = useRef<PendingSubscribeState>({
    sessionEvents: false,
    messageSessionKey: null,
  });
  const lastSessionStateRef = useRef<RuntimeBridgeSessionState>('unavailable');
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const bootstrapSessionPromisesRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const latestSessionStateRef = useRef<RuntimeBridgeSessionState>('unavailable');
  const latestSendStateRef = useRef<RuntimeBridgeSendState>('idle');
  const sendPollGenerationRef = useRef(0);

  const defaultTargetSession = useMemo(() => chooseTargetSession(summary), [summary]);
  const liveTargetSession = useMemo<RuntimeBridgeLiveSessionTarget>(() => {
    const resolvedKey = activeSessionKey ?? defaultTargetSession.key;
    return { key: resolvedKey, label: shortenSessionKey(resolvedKey) };
  }, [activeSessionKey, defaultTargetSession.key]);
  const liveEntries = useMemo(() => scopedTranscriptEntries(entries, liveTargetSession.key), [entries, liveTargetSession.key]);
  const messages = useMemo(() => transcriptEntriesToLiveMessages(liveEntries), [liveEntries]);
  const events = useMemo(() => transcriptEntriesToLiveEvents(liveEntries), [liveEntries]);
  const notices = useMemo(() => transcriptEntriesToTransientNotices(liveEntries), [liveEntries]);
  const runtimeBridgeSessionPatchEndpoint = summary.runtimeBridge.endpoints.sessionPatch;
  const runtimeBridgeSendEndpoint = summary.runtimeBridge.endpoints.send;
  const runtimeBridgeStopEndpoint = summary.runtimeBridge.endpoints.stop;

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
    setHistory({
      source: initialTranscriptHistory.source ?? 'unavailable',
      note: initialTranscriptHistory.note ?? null,
      retryable: Boolean(initialTranscriptHistory.retryable),
      thinkingLevel: initialTranscriptHistory.thinkingLevel ?? null,
      sessionId: initialTranscriptHistory.sessionId ?? null,
    });
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
    options?: { force?: boolean },
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
      const shouldHydrate = options?.force
        ? sessionChanged || incomingEntries.length > 0 || !hasScopedTranscript
        : incomingEntries.length > 0 && (sessionChanged || !hasScopedTranscript);
      hydratedSessionKeyRef.current = hydratedSessionKey;
      if (!shouldHydrate) return current;

      if (options?.force && incomingEntries.length > 0) {
        return replaceTranscriptEntriesForSession(current, incomingEntries, {
          sessionKey: hydratedSessionKey,
          limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
        });
      }

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
    const retryDelaysMs = [180, 500, 1100];

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
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
        if (capturedGeneration !== sessionGenerationRef.current) return;
        if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== sessionKey) return;

        const shouldRetryUnavailablePayload =
          attempt < retryDelaysMs.length &&
          payload.source === 'unavailable' &&
          Boolean(payload.retryable);

        if (shouldRetryUnavailablePayload) {
          setHistory({
            source: payload.source ?? 'unavailable',
            note: payload.note
              ? `${payload.note} Retrying transcript bootstrap...`
              : 'Runtime transcript history is temporarily unavailable. Retrying transcript bootstrap...',
            retryable: true,
            thinkingLevel: payload.thinkingLevel ?? null,
            sessionId: payload.sessionId ?? null,
          });
          await new Promise((resolve) => window.setTimeout(resolve, retryDelaysMs[attempt]));
          continue;
        }

        setHistory({
          source: payload.source ?? 'unavailable',
          note: payload.note ?? null,
          retryable: Boolean(payload.retryable),
          thinkingLevel: payload.thinkingLevel ?? null,
          sessionId: payload.sessionId ?? null,
        });
        applyHydratedHistory(sessionKey, payload, capturedGeneration, options);
        return;
      } catch (cause) {
        if (!mountedRef.current) return;
        if (capturedGeneration !== sessionGenerationRef.current) return;
        if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== sessionKey) return;

        const message = cause instanceof Error ? cause.message : String(cause);
        const canRetry = attempt < retryDelaysMs.length && /\b(502|503|504)\b/.test(message);
        if (canRetry) {
          setHistory({
            source: 'unavailable',
            note: `${message} Retrying transcript bootstrap...`,
            retryable: true,
            thinkingLevel: null,
            sessionId: null,
          });
          await new Promise((resolve) => window.setTimeout(resolve, retryDelaysMs[attempt]));
          continue;
        }

        setHistory({
          source: 'unavailable',
          note: message,
          retryable: false,
          thinkingLevel: null,
          sessionId: null,
        });
        console.error('[mission-control-runtime] transcript hydration failed', {
          sessionKey,
          error: message,
        });
        return;
      }
    }
  }, [applyHydratedHistory, defaultTargetSession.key]);

  const load = useCallback(async (isBackgroundRefresh: boolean) => {
    const requestedSessionKey = activeSessionKeyRef.current ?? defaultTargetSession.key;
    const capturedGeneration = sessionGenerationRef.current;

    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/runtime-bridge${isBackgroundRefresh ? '' : '?fresh=1'}`, {
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
    void load(false);
    void hydrateHistory(requestedSessionKey);
  }, [defaultTargetSession.key, hydrateHistory, load]);

  useEffect(() => {
    latestSessionStateRef.current = session.state;
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

  useEffect(() => {
    latestSendStateRef.current = sendState;
  }, [sendState]);

  const scheduleReconnect = useCallback((reason: string) => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) return;

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    const delayMs = Math.min(500 * 2 ** Math.min(attempt - 1, 4), 8000);

    console.info('[mission-control-runtime] scheduling reconnect', {
      reason,
      attempt,
      delayMs,
    });

    reconnectTimerRef.current = window.setTimeout(() => {
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
        const endpoint = runtimeBridgeSessionPatchEndpoint;
        if (!endpoint) {
          throw new Error('Mission Control session bootstrap endpoint is not configured.');
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ key: sessionKey }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Runtime bridge session bootstrap failed (${response.status})`);
        }

        await response.json().catch(() => null);
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
    [load, runtimeBridgeSessionPatchEndpoint, summary.sessionContext.mainSession.exists, summary.sessionContext.recent, summary.sessionContext.roots],
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
        eventName === 'session.message' ||
        eventName === 'sessions.changed' ||
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

      const sessionMatchesTarget = !eventSessionKey || !targetSessionKey || eventSessionKey === targetSessionKey;

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

          if (runtimeNotice.kind === 'context-compression' && sessionMatchesTarget) {
            void Promise.all([
              load(true),
              hydrateHistory(targetSessionKey, { force: true }),
            ]).catch((cause) => {
              console.error('[mission-control-runtime] compaction resync failed', cause);
            });
          }
        }
      }

      const isLifecycleEndEvent = eventName === 'agent' && agentStream === 'lifecycle' && lifecyclePhase === 'end';
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

      if (eventName === 'session.message' || eventName === 'sessions.changed') {
        if (!sessionMatchesTarget) return;

        if (eventName === 'session.message') {
          void hydrateHistory(targetSessionKey, { force: true }).catch((cause) => {
            console.error('[mission-control-runtime] session.message hydrate failed', cause);
          });
          return;
        }

        void Promise.all([
          load(true),
          hydrateHistory(targetSessionKey, { force: true }),
        ]).catch((cause) => {
          console.error('[mission-control-runtime] sessions.changed resync failed', cause);
        });
        return;
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

  const sendGatewayRequest = useCallback(
    (method: string, params: Record<string, unknown>, options?: { timeoutMs?: number }) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('Mission Control websocket transport is not connected.'));
      }

      const requestId = generateId('mc-req');
      const timeoutMs = options?.timeoutMs ?? 8000;

      return new Promise<unknown>((resolve, reject) => {
        pendingRef.current[requestId] = { resolve, reject };
        pendingTimeoutsRef.current[requestId] = window.setTimeout(() => {
          delete pendingRef.current[requestId];
          delete pendingTimeoutsRef.current[requestId];
          reject(new Error(`Gateway request timed out: ${method}`));
        }, timeoutMs);

        try {
          socket.send(
            JSON.stringify({
              type: 'req',
              id: requestId,
              method,
              params,
            }),
          );
        } catch (cause) {
          const timeout = pendingTimeoutsRef.current[requestId];
          if (timeout) {
            clearTimeout(timeout);
            delete pendingTimeoutsRef.current[requestId];
          }
          delete pendingRef.current[requestId];
          reject(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });
    },
    [],
  );

  const subscribeToActiveSession = useCallback(
    async (sessionKey: string | null) => {
      if (!sessionKey) return;
      if (latestSessionStateRef.current !== 'connected') return;
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

      const pending = pendingSubscribeStateRef.current;
      const needsSessionEvents = !pending.sessionEvents;
      const currentMessageSessionKey = pending.messageSessionKey;
      const currentSubscribedSessionKey = subscribedSessionKeyRef.current;
      const needsMessageSwitch = currentMessageSessionKey !== sessionKey || currentSubscribedSessionKey !== sessionKey;

      if (!needsSessionEvents && !needsMessageSwitch) {
        return;
      }

      if (needsSessionEvents) {
        await sendGatewayRequest('sessions.subscribe', {}, { timeoutMs: 6000 });
        pending.sessionEvents = true;
      }

      if (currentMessageSessionKey && currentMessageSessionKey !== sessionKey) {
        await sendGatewayRequest('sessions.messages.unsubscribe', { key: currentMessageSessionKey }, { timeoutMs: 6000 }).catch(() => undefined);
      }

      if (needsMessageSwitch) {
        await sendGatewayRequest('sessions.messages.subscribe', { key: sessionKey }, { timeoutMs: 6000 });
        pending.messageSessionKey = sessionKey;
        subscribedSessionKeyRef.current = sessionKey;
      }
    },
    [sendGatewayRequest],
  );

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    hydrateHistoryRef.current = hydrateHistory;
  }, [hydrateHistory]);

  useEffect(() => {
    subscribeToActiveSessionRef.current = subscribeToActiveSession;
  }, [subscribeToActiveSession]);

  const runtimeBridgeWebsocketConfigured = summary.runtimeBridge.transport.websocket.configured;
  const runtimeBridgeBrowserReachability = summary.runtimeBridge.transport.websocket.browserReachability;
  const runtimeBridgeWebsocketBridgeToken = summary.runtimeBridge.endpoints.websocketBridgeToken;
  const runtimeBridgeWebsocketBaseUrl = summary.runtimeBridge.endpoints.websocket;
  const runtimeBridgeGatewaySessionToken = summary.runtimeBridge.endpoints.gatewaySessionToken;
  const runtimeBridgeDescriptorVersion = summary.runtimeBridge.descriptorVersion;
  const runtimeBridgeBrowserTokenRelay = summary.runtimeBridge.auth.browserTokenRelay;
  const runtimeBridgeComposerSendEnabled = summary.runtimeBridge.capabilities.composerSend;
  const runtimeBridgeStopEnabled = summary.runtimeBridge.capabilities.stop;
  const runtimeBridgeLiveEventsEnabled = summary.runtimeBridge.capabilities.eventStream;
  const runtimeBridgeHttpActionMode =
    runtimeBridgeComposerSendEnabled &&
    Boolean(runtimeBridgeSendEndpoint) &&
    Boolean(runtimeBridgeSessionPatchEndpoint);

  const isInteractiveSessionReady =
    session.state === 'connected' ||
    (runtimeBridgeHttpActionMode && session.state !== 'rejected' && session.state !== 'unavailable');

  const hydrateHistoryAndReturn = useCallback(async (sessionKey: string | null, options?: { force?: boolean }) => {
    if (!sessionKey) return null;

    const hasScopedTranscript = hasScopedTranscriptEntries(entriesRef.current, sessionKey);
    if (!options?.force && hydratedSessionKeyRef.current === sessionKey && hasScopedTranscript) {
      return {
        sessionKey,
        entries: scopedTranscriptEntries(entriesRef.current, sessionKey),
        messages: [],
        source: history.source,
        note: history.note,
        retryable: history.retryable,
        thinkingLevel: history.thinkingLevel,
        sessionId: history.sessionId,
      } satisfies RuntimeBridgeTranscriptHistory;
    }

    const capturedGeneration = sessionGenerationRef.current;
    const retryDelaysMs = [180, 500, 1100];

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
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
        if (!mountedRef.current) return null;
        if (capturedGeneration !== sessionGenerationRef.current) return null;
        if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== sessionKey) return null;

        const shouldRetryUnavailablePayload =
          attempt < retryDelaysMs.length &&
          payload.source === 'unavailable' &&
          Boolean(payload.retryable);

        if (shouldRetryUnavailablePayload) {
          setHistory({
            source: payload.source ?? 'unavailable',
            note: payload.note
              ? `${payload.note} Retrying transcript bootstrap...`
              : 'Runtime transcript history is temporarily unavailable. Retrying transcript bootstrap...',
            retryable: true,
            thinkingLevel: payload.thinkingLevel ?? null,
            sessionId: payload.sessionId ?? null,
          });
          await new Promise((resolve) => window.setTimeout(resolve, retryDelaysMs[attempt]));
          continue;
        }

        setHistory({
          source: payload.source ?? 'unavailable',
          note: payload.note ?? null,
          retryable: Boolean(payload.retryable),
          thinkingLevel: payload.thinkingLevel ?? null,
          sessionId: payload.sessionId ?? null,
        });
        applyHydratedHistory(sessionKey, payload, capturedGeneration, options);
        return payload;
      } catch (cause) {
        if (!mountedRef.current) return null;
        if (capturedGeneration !== sessionGenerationRef.current) return null;
        if ((activeSessionKeyRef.current ?? defaultTargetSession.key) !== sessionKey) return null;

        const message = cause instanceof Error ? cause.message : String(cause);
        const canRetry = attempt < retryDelaysMs.length && /\b(502|503|504)\b/.test(message);
        if (canRetry) {
          setHistory({
            source: 'unavailable',
            note: `${message} Retrying transcript bootstrap...`,
            retryable: true,
            thinkingLevel: null,
            sessionId: null,
          });
          await new Promise((resolve) => window.setTimeout(resolve, retryDelaysMs[attempt]));
          continue;
        }

        setHistory({
          source: 'unavailable',
          note: message,
          retryable: false,
          thinkingLevel: null,
          sessionId: null,
        });
        console.error('[mission-control-runtime] transcript hydration failed', {
          sessionKey,
          error: message,
        });
        return null;
      }
    }

    return null;
  }, [applyHydratedHistory, defaultTargetSession.key, history.note, history.retryable, history.sessionId, history.source, history.thinkingLevel]);

  useEffect(() => {
    const transportConfigured = runtimeBridgeWebsocketConfigured;
    const browserReachability = runtimeBridgeBrowserReachability;
    const bridgeToken = runtimeBridgeWebsocketBridgeToken;
    const baseUrl = runtimeBridgeWebsocketBaseUrl;
    const gatewaySessionToken = runtimeBridgeGatewaySessionToken;
    const secretFreeDescriptor = runtimeBridgeDescriptorVersion === 'v3' || !runtimeBridgeBrowserTokenRelay;
    const serverOwnedConnect = summary.runtimeBridge.auth.serverConnectConfigured === true;
    const websocketGeneration = ++websocketGenerationRef.current;

    if (!transportConfigured || !baseUrl || (!serverOwnedConnect && !bridgeToken)) {
      const unavailableDetail = secretFreeDescriptor
        ? runtimeBridgeHttpActionMode
          ? 'Server-owned HTTP runtime bridge is active. Live websocket events are unavailable, so Mission Control uses same-origin actions and history refresh.'
          : 'Live runtime transport is intentionally unavailable in this secret-free dashboard slice. History remains available while send/connect move behind a server-owned bridge.'
        : 'No Mission Control WS sidecar descriptor is available for this preview.';
      socketRef.current = null;
      setTiming(createEmptyTiming(websocketGeneration));
      setWsState('unavailable');
      setWsDetail(unavailableDetail);
      setSession(
        runtimeBridgeHttpActionMode
          ? createEmptySession('connected', unavailableDetail)
          : createEmptySession('unavailable', unavailableDetail),
      );
      setSendState('idle');
      pendingSubscribeStateRef.current = {
        sessionEvents: false,
        messageSessionKey: null,
      };
      subscribedSessionKeyRef.current = null;
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let connectRequestId: string | null = null;
    let handshakeEstablished = false;
    let url: URL;

    try {
      url = resolveWebSocketUrl(baseUrl);
      if (bridgeToken) {
        url.searchParams.set('bridgeToken', bridgeToken);
      }
      setTiming({
        ...createEmptyTiming(websocketGeneration),
        connectStartedAt: Date.now(),
      });
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
      const openedAt = Date.now();
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setTiming((current) => ({
        ...current,
        generation: websocketGeneration,
        socketOpenedAt: openedAt,
        lastClosedAt: null,
        lastCloseCode: null,
        lastCloseReason: null,
      }));
      setWsState('open');
      setWsDetail('Runtime socket is open. Waiting for gateway handshake.');
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
          const challengeAt = Date.now();
          setTiming((current) => ({
            ...current,
            generation: websocketGeneration,
            challengeReceivedAt: current.challengeReceivedAt ?? challengeAt,
          }));
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

          const connectDetail = serverOwnedConnect
            ? 'Gateway challenge received. Waiting for the server-owned bridge to establish the session.'
            : gatewaySessionToken
              ? 'Gateway challenge received. Sending connect request.'
              : 'Gateway challenge reached the browser, but Mission Control has no configured gateway auth token for a real connect request.';

          setSession((current) => ({
            ...current,
            state: serverOwnedConnect || gatewaySessionToken ? 'connecting' : 'challenged',
            detail: connectDetail,
            challengeSeen: true,
            lastEvent: eventName,
            eventCount: current.eventCount + 1,
          }));

          if (serverOwnedConnect) {
            if (!connectRequestId) {
              connectRequestId = SERVER_CONNECT_REQUEST_ID;
            }
            handleGatewayEventRef.current(message);
            return;
          }

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
          const connectedAt = Date.now();
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

          setTiming((current) => ({
            ...current,
            generation: websocketGeneration,
            connectedAt,
          }));
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

          const reconnectSessionKey = activeSessionKeyRef.current ?? MAIN_SESSION_KEY;
          void Promise.all([
            subscribeToActiveSessionRef.current(reconnectSessionKey),
            loadRef.current(true),
            hydrateHistoryRef.current(reconnectSessionKey, { force: true }),
          ]).catch((cause) => {
            console.error('[mission-control-runtime] reconnect resync failed', cause);
          });
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
        state: runtimeBridgeHttpActionMode ? 'connecting' : 'error',
        detail: runtimeBridgeHttpActionMode
          ? 'Live websocket transport dropped. Retrying shortly while the server-owned HTTP bridge stays available.'
          : 'Transport error while negotiating or maintaining the gateway session. Retrying shortly.',
      }));
      scheduleReconnect('socket-error');
    };

    socket.onclose = (event) => {
      if (cancelled || websocketGeneration !== websocketGenerationRef.current) return;
      const closedAt = Date.now();
      socketRef.current = null;
      pendingSubscribeStateRef.current = {
        sessionEvents: false,
        messageSessionKey: null,
      };
      subscribedSessionKeyRef.current = null;
      const latestSessionState = latestSessionStateRef.current;
      const latestSendState = latestSendStateRef.current;
      const shouldRetry = latestSessionState !== 'rejected';
      const preserveInteractiveSession = runtimeBridgeHttpActionMode && shouldRetry;
      const hadActiveSend = latestSendState === 'streaming' || latestSendState === 'sending';
      rejectPending(new Error('Mission Control gateway transport closed.'));
      setTiming((current) => ({
        ...current,
        generation: websocketGeneration,
        lastClosedAt: closedAt,
        lastCloseCode: event.code || null,
        lastCloseReason: event.reason || null,
      }));
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
        state: current.state === 'rejected'
          ? 'rejected'
          : preserveInteractiveSession
            ? 'connecting'
            : event.wasClean
              ? 'closed'
              : 'error',
        detail: preserveInteractiveSession
          ? 'Live websocket transport closed. Reconnecting now while the server-owned HTTP bridge remains available.'
          : event.reason
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
      if (hadActiveSend) {
        setSendError((current) => current ?? 'Bridge transport closed before the live response completed.');
      }
      if (shouldRetry) {
        scheduleReconnect(`socket-close-${event.code || 'unknown'}`);
      }
    };

    return () => {
      cancelled = true;
      socketRef.current = null;
      pendingSubscribeStateRef.current = {
        sessionEvents: false,
        messageSessionKey: null,
      };
      subscribedSessionKeyRef.current = null;
      socket?.close();
    };
  }, [
    reconnectNonce,
    rejectPending,
    runtimeBridgeWebsocketBaseUrl,
    runtimeBridgeWebsocketBridgeToken,
    runtimeBridgeGatewaySessionToken,
    runtimeBridgeDescriptorVersion,
    runtimeBridgeBrowserTokenRelay,
    runtimeBridgeBrowserReachability,
    runtimeBridgeWebsocketConfigured,
    runtimeBridgeHttpActionMode,
    summary.runtimeBridge.auth.serverConnectConfigured,
    scheduleReconnect,
  ]);

  useEffect(() => {
    if (session.state !== 'connected') return;
    const sessionKey = activeSessionKeyRef.current ?? defaultTargetSession.key;
    void subscribeToActiveSession(sessionKey).catch((cause) => {
      console.error('[mission-control-runtime] subscribe/resubscribe failed', cause);
    });
  }, [defaultTargetSession.key, session.state, subscribeToActiveSession, liveTargetSession.key]);

  const pollForHttpRunCompletion = useCallback(async (
    sessionKey: string,
    runId: string | null,
    capturedGeneration: number,
  ): Promise<RuntimeBridgeSendPollOutcome> => {
    const pollGeneration = ++sendPollGenerationRef.current;
    const delaysMs = [600, ...Array.from({ length: 39 }, () => 1200)];

    for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delaysMs[attempt]));

      if (!mountedRef.current) return 'cancelled';
      if (capturedGeneration !== sessionGenerationRef.current) return 'cancelled';
      if (pollGeneration !== sendPollGenerationRef.current) return 'cancelled';
      if (activeSessionKeyRef.current !== sessionKey) return 'cancelled';
      if (latestSendStateRef.current !== 'streaming' && latestSendStateRef.current !== 'sending') return 'cancelled';

      const payload = await hydrateHistoryAndReturn(sessionKey, { force: true });
      if (!payload) continue;

      if (hasTerminalHistoryEntryForRun(payload.entries ?? [], runId)) {
        if (capturedGeneration !== sessionGenerationRef.current) return 'cancelled';
        if (pollGeneration !== sendPollGenerationRef.current) return 'cancelled';
        setSendState('idle');
        setSendError(null);
        setActiveRunId(null);
        void load(true);
        return 'completed';
      }
    }

    if (capturedGeneration === sessionGenerationRef.current && pollGeneration === sendPollGenerationRef.current) {
      setSendState('idle');
      setActiveRunId(null);
      const noticeEntry = createNoticeEntry({
        id: generateId('mc-notice'),
        noticeKind: 'system',
        message: 'Live response is still syncing. Use refresh if the final reply does not appear yet.',
        sessionKey,
        runId,
        at: Date.now(),
        evidence: {
          sessionKey,
          runId,
        },
      });
      if (noticeEntry) {
        setEntries((current) =>
          mergeTranscriptEntries(current, [noticeEntry], {
            sessionKey,
            limit: MAX_LIVE_MESSAGES + MAX_LIVE_EVENTS + MAX_TRANSIENT_NOTICES + 80,
          }),
        );
      }
      void load(true);
    }
    return 'expired';
  }, [hydrateHistoryAndReturn, load]);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      if (!runtimeBridgeComposerSendEnabled) {
        throw new Error('Mission Control send is not enabled for this runtime bridge yet.');
      }
      if (!isInteractiveSessionReady) {
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
        if (!runtimeBridgeSendEndpoint) {
          throw new Error('Mission Control send endpoint is not configured for this runtime bridge.');
        }

        const sendResponse = await fetch(runtimeBridgeSendEndpoint, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sessionKey,
            message: trimmed,
            deliver: false,
            idempotencyKey: generateId('mc-chat-send'),
          }),
        });

        if (!sendResponse.ok) {
          const payload = (await sendResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Mission Control send failed (${sendResponse.status})`);
        }

        const ack = (await sendResponse.json()) as Record<string, unknown> | null;
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
        if (!runtimeBridgeLiveEventsEnabled) {
          void pollForHttpRunCompletion(sessionKey, runId, capturedGeneration).catch((cause) => {
            console.error('[mission-control-runtime] http run completion polling failed', cause);
          });
        }
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
    [ensureSessionExists, isInteractiveSessionReady, liveTargetSession.key, pollForHttpRunCompletion, runtimeBridgeComposerSendEnabled, runtimeBridgeLiveEventsEnabled, runtimeBridgeSendEndpoint],
  );

  const abortPrompt = useCallback(async () => {
    const sessionKey = liveTargetSession.key;
    if (!runtimeBridgeStopEnabled) {
      throw new Error('Mission Control stop is not enabled for this runtime bridge yet.');
    }
    if (!isInteractiveSessionReady) {
      throw new Error('Mission Control can only stop while the gateway session is connected.');
    }
    if (!sessionKey) {
      throw new Error('No visible runtime session is available for Mission Control to stop.');
    }

    const capturedGeneration = sessionGenerationRef.current;

    try {
      if (!runtimeBridgeStopEndpoint) {
        throw new Error('Mission Control stop endpoint is not configured for this runtime bridge.');
      }

      const stopResponse = await fetch(runtimeBridgeStopEndpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ sessionKey, runId: activeRunId }),
      });

      if (!stopResponse.ok) {
        const payload = (await stopResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Mission Control stop failed (${stopResponse.status})`);
      }

      await stopResponse.json().catch(() => null);
      if (capturedGeneration !== sessionGenerationRef.current) return;
      if (activeSessionKeyRef.current !== sessionKey) return;

      sendPollGenerationRef.current += 1;
      setSendError(null);
      setSendState('idle');
      setActiveRunId(null);
      void Promise.all([
        load(true),
        hydrateHistoryAndReturn(sessionKey, { force: true }),
      ]).catch((cause) => {
        console.error('[mission-control-runtime] abort resync failed', cause);
      });
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
  }, [activeRunId, hydrateHistoryAndReturn, isInteractiveSessionReady, liveTargetSession.key, load, runtimeBridgeStopEnabled, runtimeBridgeStopEndpoint]);

  return {
    summary,
    loading,
    refreshing,
    error,
    wsState,
    wsDetail,
    session,
    timing,
    history,
    live: {
      targetSession: liveTargetSession,
      canSend:
        runtimeBridgeComposerSendEnabled &&
        isInteractiveSessionReady &&
        Boolean(liveTargetSession.key) &&
        sendState !== 'sending' &&
        sendState !== 'streaming',
      canAbort:
        runtimeBridgeStopEnabled &&
        isInteractiveSessionReady &&
        Boolean(liveTargetSession.key) &&
        (sendState === 'sending' || sendState === 'streaming' || Boolean(activeRunId)),
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
        hydrateHistoryAndReturn(activeSessionKeyRef.current ?? defaultTargetSession.key, { force: true }),
      ]);
    },
    switchSession: async (sessionKey: string) => {
      sessionGenerationRef.current += 1;
      activeSessionKeyRef.current = sessionKey;
      hydratedSessionKeyRef.current = null;
      subscribedSessionKeyRef.current = null;
      setActiveSessionKey(sessionKey);
      setEntries([]);
      setHistory({
        source: 'unavailable',
        note: 'Loading transcript history for the selected session.',
        retryable: false,
        thinkingLevel: null,
        sessionId: null,
      });
      noticeSignaturesRef.current.clear();
      setSendError(null);
      setSendState('idle');
      setActiveRunId(null);
      sendPollGenerationRef.current += 1;
      const historyPromise = hydrateHistoryAndReturn(sessionKey, { force: true });
      await ensureSessionExists(sessionKey);
      await Promise.all([historyPromise, load(true)]);
    },
  };
}
