import type {
  RuntimeBridgeTranscriptArtifact,
  RuntimeBridgeTranscriptEntry,
  RuntimeBridgeTranscriptEvidence,
  RuntimeBridgeTranscriptHistory,
  RuntimeBridgeTranscriptMessage,
} from '../types/contracts';

type HistoryLogRecord = Record<string, unknown>;
type HistoryContentBlock = Record<string, unknown>;

type BaseEntryInput = {
  id?: string | null;
  sessionKey?: string | null;
  runId?: string | null;
  at?: number | null;
  evidence?: RuntimeBridgeTranscriptEvidence;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: string): string {
  let body = value.trim();
  let previous = '';

  while (body !== previous) {
    previous = body;
    body = body.replace(/^\[\[\s*reply_to_current\s*\]\]\s*/i, '');
    body = body.replace(/^\[\[\s*reply_to\s*:\s*[^\]]+\]\]\s*/i, '');
    body = body.replace(/^(?:System:\s*\[[^\]]+\]\s*.*(?:\n|$))+/i, '');
    body = body.replace(/^\s*Sender \(untrusted metadata\):\s*```json\s*[\s\S]*?```\s*/i, '');
    body = body.replace(/^\s*Sender \(untrusted metadata\):\s*\{[\s\S]*?\}\s*/i, '');
    body = body.replace(/^\s*\[[A-Za-z]{3} [^\]]*GMT\+\d+\]\s*/i, '');
  }

  return body.trim();
}

export function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function extractTextFromContentBlocks(content: unknown): string {
  if (typeof content === 'string') return normalizeText(content);
  if (!Array.isArray(content)) return '';

  const parts: string[] = [];
  for (const block of content) {
    const record = asRecord(block);
    if (!record) continue;
    if (record.type === 'text' && typeof record.text === 'string') {
      parts.push(record.text);
    }
  }

  return normalizeText(parts.join('\n'));
}

function parseThinkingSummary(block: HistoryContentBlock): string[] {
  const signature = typeof block.thinkingSignature === 'string' ? block.thinkingSignature : null;
  if (!signature) return [];

  try {
    const parsed = JSON.parse(signature) as Record<string, unknown>;
    const summary = Array.isArray(parsed.summary) ? parsed.summary : [];
    return summary
      .map((item) => {
        const record = asRecord(item);
        return typeof record?.text === 'string' ? normalizeText(record.text) : '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildArtifactFromArgs(name: string, args: Record<string, unknown> | null): RuntimeBridgeTranscriptArtifact[] {
  if (!args) return [];

  const filePath =
    typeof args.file_path === 'string'
      ? args.file_path
      : typeof args.path === 'string'
        ? args.path
        : null;

  if (!filePath) return [];

  if (name === 'write' && typeof args.content === 'string') {
    return [{ kind: 'file-write', filePath, content: args.content }];
  }

  const oldText =
    typeof args.old_string === 'string'
      ? args.old_string
      : typeof args.oldText === 'string'
        ? args.oldText
        : null;
  const newText =
    typeof args.new_string === 'string'
      ? args.new_string
      : typeof args.newText === 'string'
        ? args.newText
        : null;

  if (name === 'edit' && oldText !== null && newText !== null) {
    return [{ kind: 'file-edit', filePath, oldText, newText }];
  }

  return [];
}

function fallbackBodySignature(entry: RuntimeBridgeTranscriptEntry): string | null {
  if (entry.kind === 'message' || entry.kind === 'process') {
    const body = normalizeText(entry.body);
    return body ? body.toLowerCase() : null;
  }
  if (entry.kind === 'notice') {
    const body = normalizeText(entry.message);
    return body ? body.toLowerCase() : null;
  }
  return null;
}

type EntryWithoutStableKey = Omit<RuntimeBridgeTranscriptEntry, 'stableKey'>;

function buildStableKey(entry: EntryWithoutStableKey): string {
  const evidence = entry.evidence ?? {};

  if (entry.kind === 'message' && evidence.messageId) {
    return `message:${evidence.messageId}`;
  }

  if (entry.kind === 'process' && evidence.messageId) {
    const processEntry = entry as ProcessEntry;
    return `process:${evidence.messageId}:${processEntry.stage}:${processEntry.label}`;
  }

  if (entry.kind === 'tool' && (entry as ToolEntry).toolCallId) {
    const toolEntry = entry as ToolEntry;
    return `tool:${toolEntry.toolCallId}:${toolEntry.phase}`;
  }

  if (entry.kind === 'event' && (entry as EventEntry).seq !== null) {
    const eventEntry = entry as EventEntry;
    return `event:${eventEntry.name}:${evidence.runId ?? eventEntry.runId ?? 'none'}:${eventEntry.seq}`;
  }

  if (entry.kind === 'notice') {
    const noticeEntry = entry as NoticeEntry;
    return `notice:${noticeEntry.noticeKind}:${noticeEntry.runId ?? 'none'}:${normalizeText(noticeEntry.message).toLowerCase()}`;
  }

  if (evidence.runId && evidence.seq !== null) {
    return `${entry.kind}:${evidence.runId}:${evidence.seq}`;
  }

  const bodySignature = fallbackBodySignature(entry as RuntimeBridgeTranscriptEntry);
  const bucket = Math.floor((entry.at || Date.now()) / 30000);
  return `${entry.kind}:${entry.sessionKey ?? 'none'}:${entry.runId ?? 'none'}:${bucket}:${bodySignature ?? entry.id}`;
}

type MessageEntry = Extract<RuntimeBridgeTranscriptEntry, { kind: 'message' }>;
type ProcessEntry = Extract<RuntimeBridgeTranscriptEntry, { kind: 'process' }>;
type ToolEntry = Extract<RuntimeBridgeTranscriptEntry, { kind: 'tool' }>;
type EventEntry = Extract<RuntimeBridgeTranscriptEntry, { kind: 'event' }>;
type NoticeEntry = Extract<RuntimeBridgeTranscriptEntry, { kind: 'notice' }>;
type ToolStatus = ToolEntry['status'];

export type TranscriptToolBurst = {
  id: string;
  at: number;
  endAt: number;
  runId: string | null;
  sessionKey: string | null;
  rows: ToolEntry[];
  artifacts: RuntimeBridgeTranscriptArtifact[];
  status: ToolStatus;
};

export type TranscriptArtifactGroup = {
  id: string;
  at: number;
  runId: string | null;
  sessionKey: string | null;
  artifacts: RuntimeBridgeTranscriptArtifact[];
  toolNames: string[];
};

export type RuntimeBridgeTranscriptRenderItem =
  | {
      type: 'message';
      id: string;
      at: number;
      entry: MessageEntry & { role: 'user' | 'assistant' };
    }
  | {
      type: 'process';
      id: string;
      at: number;
      entry: ProcessEntry;
    }
  | {
      type: 'notice';
      id: string;
      at: number;
      tone: 'info' | 'error';
      title: string;
      body: string;
      runId: string | null;
      sessionKey: string | null;
    }
  | {
      type: 'tools';
      id: string;
      at: number;
      burst: TranscriptToolBurst;
      keepOpen: boolean;
    }
  | {
      type: 'artifacts';
      id: string;
      at: number;
      group: TranscriptArtifactGroup;
    };

function withStableKey<T extends EntryWithoutStableKey>(entry: T): T & { stableKey: string } {
  return {
    ...entry,
    stableKey: buildStableKey(entry),
  };
}

export function createMessageEntry(
  input: BaseEntryInput & {
    role: 'user' | 'assistant' | 'system';
    body: string;
    status: 'final' | 'streaming' | 'error';
  },
): MessageEntry | null {
  const body = normalizeText(input.body);
  if (!body) return null;

  return withStableKey({
    id: input.id ?? `message-${input.role}-${input.at ?? Date.now()}`,
    kind: 'message',
    role: input.role,
    body,
    status: input.status,
    sessionKey: input.sessionKey ?? null,
    runId: input.runId ?? null,
    at: input.at ?? Date.now(),
    evidence: input.evidence ?? {},
  });
}

export function createProcessEntry(
  input: BaseEntryInput & {
    stage: 'thinking' | 'lifecycle';
    label: string;
    body: string;
  },
): ProcessEntry | null {
  const body = normalizeText(input.body);
  if (!body) return null;

  return withStableKey({
    id: input.id ?? `process-${input.stage}-${input.at ?? Date.now()}`,
    kind: 'process',
    stage: input.stage,
    label: input.label,
    body,
    sessionKey: input.sessionKey ?? null,
    runId: input.runId ?? null,
    at: input.at ?? Date.now(),
    evidence: input.evidence ?? {},
  });
}

export function createToolEntry(
  input: BaseEntryInput & {
    name: string;
    phase: 'start' | 'update' | 'result';
    status: 'running' | 'completed' | 'failed';
    toolCallId: string | null;
    args?: Record<string, unknown> | null;
    meta?: string | null;
    isError?: boolean;
  },
): ToolEntry {
  const args = input.args ?? null;
  return withStableKey({
    id: input.id ?? `tool-${input.toolCallId ?? input.name}-${input.phase}-${input.at ?? Date.now()}`,
    kind: 'tool',
    name: input.name,
    phase: input.phase,
    status: input.status,
    sessionKey: input.sessionKey ?? null,
    runId: input.runId ?? null,
    toolCallId: input.toolCallId,
    args,
    meta: input.meta ? normalizeText(input.meta) : null,
    isError: Boolean(input.isError),
    artifacts: buildArtifactFromArgs(input.name, args),
    at: input.at ?? Date.now(),
    evidence: input.evidence ?? {},
  });
}

export function createEventEntry(
  input: BaseEntryInput & {
    name: string;
    detail: string;
    seq?: number | null;
  },
): EventEntry | null {
  const detail = normalizeText(input.detail);
  if (!detail) return null;

  return withStableKey({
    id: input.id ?? `event-${input.name}-${input.at ?? Date.now()}`,
    kind: 'event',
    name: input.name,
    detail,
    sessionKey: input.sessionKey ?? null,
    runId: input.runId ?? null,
    seq: input.evidence?.seq ?? input.seq ?? null,
    at: input.at ?? Date.now(),
    evidence: input.evidence ?? {},
  });
}

export function createNoticeEntry(
  input: BaseEntryInput & {
    noticeKind: 'context-compression' | 'fallback-model' | 'system' | 'event';
    message: string;
  },
): NoticeEntry | null {
  const message = normalizeText(input.message);
  if (!message) return null;

  return withStableKey({
    id: input.id ?? `notice-${input.noticeKind}-${input.at ?? Date.now()}`,
    kind: 'notice',
    noticeKind: input.noticeKind,
    message,
    sessionKey: input.sessionKey ?? null,
    runId: input.runId ?? null,
    at: input.at ?? Date.now(),
    evidence: input.evidence ?? {},
  });
}

function buildMergeAliases(entry: RuntimeBridgeTranscriptEntry): string[] {
  const aliases = new Set<string>([entry.stableKey]);
  const evidence = entry.evidence ?? {};

  if (entry.kind === 'message') {
    const normalizedBody = normalizeText(entry.body).toLowerCase();
    if (normalizedBody) {
      aliases.add(`message-body:${entry.role}:${entry.sessionKey ?? 'none'}:${entry.runId ?? 'none'}:${normalizedBody}`);
      aliases.add(`message-bucket:${entry.role}:${entry.sessionKey ?? 'none'}:${Math.floor(entry.at / 30000)}:${normalizedBody}`);
    }
  }

  if (entry.kind === 'event' && entry.seq !== null) {
    aliases.add(`event-seq:${entry.name}:${entry.runId ?? 'none'}:${entry.seq}`);
  }

  if (evidence.messageId) aliases.add(`message-id:${evidence.messageId}`);
  if (evidence.runId && evidence.seq !== null) aliases.add(`run-seq:${evidence.runId}:${evidence.seq}`);

  return Array.from(aliases);
}

function mergeArtifacts(
  current: RuntimeBridgeTranscriptArtifact[],
  incoming: RuntimeBridgeTranscriptArtifact[],
): RuntimeBridgeTranscriptArtifact[] {
  const keyed = new Map<string, RuntimeBridgeTranscriptArtifact>();
  for (const artifact of [...current, ...incoming]) {
    const key =
      artifact.kind === 'file-edit'
        ? `${artifact.kind}:${artifact.filePath}:${artifact.oldText}:${artifact.newText}`
        : `${artifact.kind}:${artifact.filePath}:${artifact.content}`;
    keyed.set(key, artifact);
  }
  return Array.from(keyed.values());
}

function choosePreferredString(current: string | null, incoming: string | null): string | null {
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming.length >= current.length ? incoming : current;
}

function mergeEntries(current: RuntimeBridgeTranscriptEntry, incoming: RuntimeBridgeTranscriptEntry): RuntimeBridgeTranscriptEntry {
  if (current.kind !== incoming.kind) {
    return incoming.at >= current.at ? incoming : current;
  }

  if (current.kind === 'message') {
    const incomingMessage = incoming as MessageEntry;
    const winner = incomingMessage.at >= current.at ? incomingMessage : current;
    return {
      ...current,
      ...winner,
      body: choosePreferredString(current.body, incomingMessage.body) ?? winner.body,
      status:
        current.status === 'final' || incomingMessage.status !== 'final'
          ? current.status === 'final' && incomingMessage.status !== 'error'
            ? current.status
            : winner.status
          : incomingMessage.status,
      evidence: { ...current.evidence, ...incomingMessage.evidence },
      stableKey: current.stableKey,
    };
  }

  if (current.kind === 'process') {
    const incomingProcess = incoming as ProcessEntry;
    const winner = incomingProcess.at >= current.at ? incomingProcess : current;
    return {
      ...current,
      ...winner,
      body: choosePreferredString(current.body, incomingProcess.body) ?? winner.body,
      evidence: { ...current.evidence, ...incomingProcess.evidence },
      stableKey: current.stableKey,
    };
  }

  if (current.kind === 'tool') {
    const incomingTool = incoming as ToolEntry;
    const winner = incomingTool.at >= current.at ? incomingTool : current;
    return {
      ...current,
      ...winner,
      args: incomingTool.args ?? current.args,
      meta: choosePreferredString(current.meta, incomingTool.meta),
      isError: current.isError || incomingTool.isError,
      status:
        incomingTool.status === 'failed' || current.status === 'failed'
          ? 'failed'
          : incomingTool.status === 'completed' || current.status === 'completed'
            ? 'completed'
            : winner.status,
      artifacts: mergeArtifacts(current.artifacts, incomingTool.artifacts),
      evidence: { ...current.evidence, ...incomingTool.evidence },
      stableKey: current.stableKey,
    };
  }

  if (current.kind === 'event') {
    const incomingEvent = incoming as EventEntry;
    const winner = incomingEvent.at >= current.at ? incomingEvent : current;
    return {
      ...current,
      ...winner,
      detail: choosePreferredString(current.detail, incomingEvent.detail) ?? winner.detail,
      evidence: { ...current.evidence, ...incomingEvent.evidence },
      stableKey: current.stableKey,
    };
  }

  const incomingNotice = incoming as NoticeEntry;
  const winner = incomingNotice.at >= current.at ? incomingNotice : current;
  return {
    ...current,
    ...winner,
    message: choosePreferredString(current.message, incomingNotice.message) ?? winner.message,
    evidence: { ...current.evidence, ...incomingNotice.evidence },
    stableKey: current.stableKey,
  };
}

export function mergeTranscriptEntries(
  current: RuntimeBridgeTranscriptEntry[],
  incoming: RuntimeBridgeTranscriptEntry[],
  options?: { sessionKey?: string | null; limit?: number },
): RuntimeBridgeTranscriptEntry[] {
  const scopedCurrent = options?.sessionKey
    ? current.filter((entry) => entry.sessionKey === options.sessionKey || entry.sessionKey === null)
    : current;
  const records: RuntimeBridgeTranscriptEntry[] = [];
  const aliases = new Map<string, number>();

  const upsert = (entry: RuntimeBridgeTranscriptEntry) => {
    const keys = buildMergeAliases(entry);
    const existingIndex = keys.map((key) => aliases.get(key)).find((value): value is number => value !== undefined);
    if (existingIndex === undefined) {
      const nextIndex = records.push(entry) - 1;
      for (const key of keys) aliases.set(key, nextIndex);
      return;
    }

    const merged = mergeEntries(records[existingIndex], entry);
    records[existingIndex] = merged;
    for (const key of buildMergeAliases(merged)) aliases.set(key, existingIndex);
  };

  for (const entry of scopedCurrent) upsert(entry);
  for (const entry of incoming) upsert(entry);

  records.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const limit = options?.limit ?? records.length;
  return limit >= records.length ? records : records.slice(-limit);
}

export function transcriptEntriesToMessages(entries: RuntimeBridgeTranscriptEntry[]): RuntimeBridgeTranscriptMessage[] {
  return entries
    .filter((entry): entry is Extract<RuntimeBridgeTranscriptEntry, { kind: 'message' }> => entry.kind === 'message')
    .filter((entry): entry is MessageEntry & { role: 'user' | 'assistant' } => entry.role === 'user' || entry.role === 'assistant')
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      body: entry.body,
      status: entry.status,
      sessionKey: entry.sessionKey,
      runId: entry.runId,
      at: entry.at,
    }));
}

export function buildTranscriptHistory(
  sessionKey: string | null,
  entries: RuntimeBridgeTranscriptEntry[],
): RuntimeBridgeTranscriptHistory {
  return {
    sessionKey,
    entries,
    messages: transcriptEntriesToMessages(entries),
  };
}

function compareEntries(a: RuntimeBridgeTranscriptEntry, b: RuntimeBridgeTranscriptEntry): number {
  return a.at - b.at || a.id.localeCompare(b.id);
}

function dedupeArtifacts(artifacts: RuntimeBridgeTranscriptArtifact[]): RuntimeBridgeTranscriptArtifact[] {
  const keyed = new Map<string, RuntimeBridgeTranscriptArtifact>();
  for (const artifact of artifacts) {
    const key =
      artifact.kind === 'file-edit'
        ? `${artifact.kind}:${artifact.filePath}:${artifact.oldText}:${artifact.newText}`
        : `${artifact.kind}:${artifact.filePath}:${artifact.content}`;
    keyed.set(key, artifact);
  }
  return Array.from(keyed.values());
}

function burstStatus(rows: ToolEntry[]): ToolStatus {
  if (rows.some((row) => row.status === 'failed' || row.isError)) return 'failed';
  if (rows.every((row) => row.status === 'completed')) return 'completed';
  return 'running';
}

function groupToolBursts(entries: ToolEntry[], burstWindowMs: number): TranscriptToolBurst[] {
  const toolCallGroups = new Map<string, ToolEntry[]>();

  for (const entry of entries) {
    const key = `${entry.runId ?? 'runless'}:${entry.toolCallId ?? entry.id}`;
    const group = toolCallGroups.get(key) ?? [];
    group.push(entry);
    toolCallGroups.set(key, group);
  }

  const sortedToolCallGroups = Array.from(toolCallGroups.values())
    .map((rows) => rows.slice().sort(compareEntries))
    .sort((a, b) => (a[0]?.at ?? 0) - (b[0]?.at ?? 0));

  const bursts: TranscriptToolBurst[] = [];

  for (const rows of sortedToolCallGroups) {
    const startAt = rows[0]?.at ?? Date.now();
    const endAt = rows[rows.length - 1]?.at ?? startAt;
    const runId = rows[0]?.runId ?? null;
    const previous = bursts[bursts.length - 1];

    if (previous && previous.runId === runId && startAt - previous.endAt <= burstWindowMs) {
      previous.rows.push(...rows);
      previous.endAt = Math.max(previous.endAt, endAt);
      previous.artifacts = dedupeArtifacts([...previous.artifacts, ...rows.flatMap((row) => row.artifacts)]);
      previous.status = burstStatus(previous.rows);
      continue;
    }

    bursts.push({
      id: `tools-${rows[0]?.stableKey ?? rows[0]?.id ?? startAt}`,
      at: startAt,
      endAt,
      runId,
      sessionKey: rows[0]?.sessionKey ?? null,
      rows: [...rows],
      artifacts: dedupeArtifacts(rows.flatMap((row) => row.artifacts)),
      status: burstStatus(rows),
    });
  }

  return bursts;
}

function noticeTitle(entry: NoticeEntry): string {
  if (entry.noticeKind === 'context-compression') return 'Context updated';
  if (entry.noticeKind === 'fallback-model') return 'Fallback model';
  if (entry.noticeKind === 'event') return 'Runtime event';
  return 'System notice';
}

export function shapeTranscriptEntriesForRender(
  entries: RuntimeBridgeTranscriptEntry[],
  options?: { burstWindowMs?: number },
): RuntimeBridgeTranscriptRenderItem[] {
  const burstWindowMs = options?.burstWindowMs ?? 10000;
  const sortedEntries = entries.slice().sort(compareEntries);
  const toolBursts = groupToolBursts(
    sortedEntries.filter((entry): entry is ToolEntry => entry.kind === 'tool'),
    burstWindowMs,
  );
  const items: Array<RuntimeBridgeTranscriptRenderItem & { order: number }> = [];
  let order = 0;

  for (const entry of sortedEntries) {
    if (entry.kind === 'message') {
      if (entry.role === 'user' || entry.role === 'assistant') {
        items.push({
          type: 'message',
          id: entry.id,
          at: entry.at,
          entry: entry as MessageEntry & { role: 'user' | 'assistant' },
          order: order++,
        });
        continue;
      }

      items.push({
        type: 'notice',
        id: entry.id,
        at: entry.at,
        tone: entry.status === 'error' ? 'error' : 'info',
        title: entry.status === 'error' ? 'Runtime error' : 'System message',
        body: entry.body,
        runId: entry.runId,
        sessionKey: entry.sessionKey,
        order: order++,
      });
      continue;
    }

    if (entry.kind === 'process') {
      items.push({
        type: 'process',
        id: entry.id,
        at: entry.at,
        entry,
        order: order++,
      });
      continue;
    }

    if (entry.kind === 'notice') {
      items.push({
        type: 'notice',
        id: entry.id,
        at: entry.at,
        tone: entry.noticeKind === 'system' ? 'error' : 'info',
        title: noticeTitle(entry),
        body: entry.message,
        runId: entry.runId,
        sessionKey: entry.sessionKey,
        order: order++,
      });
    }
  }

  toolBursts.forEach((burst, index) => {
    items.push({
      type: 'tools',
      id: burst.id,
      at: burst.at,
      burst,
      keepOpen: index === toolBursts.length - 1,
      order: order++,
    });

    if (burst.artifacts.length > 0) {
      items.push({
        type: 'artifacts',
        id: `${burst.id}-artifacts`,
        at: burst.endAt,
        group: {
          id: `${burst.id}-artifacts`,
          at: burst.endAt,
          runId: burst.runId,
          sessionKey: burst.sessionKey,
          artifacts: burst.artifacts,
          toolNames: Array.from(new Set(burst.rows.map((row) => row.name))),
        },
        order: order++,
      });
    }
  });

  return items
    .sort((a, b) => a.at - b.at || a.order - b.order || a.id.localeCompare(b.id))
    .map((item) => {
      const { order, ...renderItem } = item;
      void order;
      return renderItem;
    });
}

export function normalizeHistoryRecord(
  record: HistoryLogRecord,
  sessionKey: string | null,
): RuntimeBridgeTranscriptEntry[] {
  const type = typeof record.type === 'string' ? record.type : null;
  if (type !== 'message') return [];

  const message = asRecord(record.message);
  if (!message) return [];

  const role = typeof message.role === 'string' ? message.role : null;
  const at = toTimestamp(message.timestamp) ?? toTimestamp(record.timestamp) ?? Date.now();
  const messageId = typeof record.id === 'string' ? record.id : null;
  const parentId = typeof record.parentId === 'string' ? record.parentId : null;
  const runId =
    typeof record.runId === 'string'
      ? record.runId
      : typeof message.runId === 'string'
        ? message.runId
        : null;
  const evidence: RuntimeBridgeTranscriptEvidence = {
    messageId,
    parentId,
    runId,
    sessionKey,
  };

  if (role === 'user') {
    const entry = createMessageEntry({
      id: messageId,
      role: 'user',
      body: extractTextFromContentBlocks(message.content),
      status: 'final',
      sessionKey,
      runId,
      at,
      evidence,
    });
    return entry ? [entry] : [];
  }

  if (role === 'assistant') {
    const content = Array.isArray(message.content) ? message.content : [];
    const entries: RuntimeBridgeTranscriptEntry[] = [];

    content.forEach((block, index) => {
      const recordBlock = asRecord(block);
      if (!recordBlock) return;

      if (recordBlock.type === 'thinking') {
        const summaries = parseThinkingSummary(recordBlock);
        summaries.forEach((summary, summaryIndex) => {
          const entry = createProcessEntry({
            id: `${messageId ?? 'assistant'}-thinking-${index}-${summaryIndex}`,
            stage: 'thinking',
            label: 'Thinking summary',
            body: summary,
            sessionKey,
            runId,
            at,
            evidence,
          });
          if (entry) entries.push(entry);
        });
      }

      if (recordBlock.type === 'toolCall') {
        const name = typeof recordBlock.name === 'string' ? recordBlock.name : 'tool';
        const toolCallId = typeof recordBlock.id === 'string' ? recordBlock.id : null;
        entries.push(
          createToolEntry({
            id: `${messageId ?? 'assistant'}-tool-${index}`,
            name,
            phase: 'start',
            status: 'running',
            toolCallId,
            args: asRecord(recordBlock.arguments),
            sessionKey,
            runId,
            at,
            evidence: {
              ...evidence,
              toolCallId,
            },
          }),
        );
      }
    });

    const textEntry = createMessageEntry({
      id: messageId,
      role: 'assistant',
      body: extractTextFromContentBlocks(message.content),
      status: 'final',
      sessionKey,
      runId,
      at,
      evidence,
    });
    if (textEntry) entries.push(textEntry);
    return entries;
  }

  if (role === 'toolResult') {
    const toolName = typeof message.toolName === 'string' ? message.toolName : 'tool';
    const toolCallId = typeof message.toolCallId === 'string' ? message.toolCallId : null;
    return [
      createToolEntry({
        id: messageId ?? `tool-result-${toolCallId ?? at}`,
        name: toolName,
        phase: 'result',
        status: message.isError ? 'failed' : 'completed',
        toolCallId,
        sessionKey,
        runId,
        at,
        meta: extractTextFromContentBlocks(message.content),
        isError: Boolean(message.isError),
        evidence: {
          ...evidence,
          toolCallId,
        },
      }),
    ];
  }

  return [];
}

export function reconstructTranscriptFromHistoryRecords(
  records: HistoryLogRecord[],
  sessionKey: string | null,
  maxEntries: number,
): RuntimeBridgeTranscriptHistory {
  const entries = mergeTranscriptEntries(
    [],
    records.flatMap((record) => normalizeHistoryRecord(record, sessionKey)),
    { sessionKey, limit: maxEntries },
  );
  return buildTranscriptHistory(sessionKey, entries);
}
