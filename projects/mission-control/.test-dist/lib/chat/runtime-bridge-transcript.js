"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTimestamp = toTimestamp;
exports.createMessageEntry = createMessageEntry;
exports.createProcessEntry = createProcessEntry;
exports.createToolEntry = createToolEntry;
exports.createEventEntry = createEventEntry;
exports.createNoticeEntry = createNoticeEntry;
exports.mergeTranscriptEntries = mergeTranscriptEntries;
exports.transcriptEntriesToMessages = transcriptEntriesToMessages;
exports.buildTranscriptHistory = buildTranscriptHistory;
exports.shapeTranscriptEntriesForRender = shapeTranscriptEntriesForRender;
exports.normalizeHistoryRecord = normalizeHistoryRecord;
exports.reconstructTranscriptFromHistoryRecords = reconstructTranscriptFromHistoryRecords;
function asRecord(value) {
    return value && typeof value === 'object' ? value : null;
}
function normalizeText(value) {
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
function toTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed))
            return parsed;
    }
    return null;
}
function extractTextFromContentBlocks(content) {
    if (typeof content === 'string')
        return normalizeText(content);
    if (!Array.isArray(content))
        return '';
    const parts = [];
    for (const block of content) {
        const record = asRecord(block);
        if (!record)
            continue;
        if (record.type === 'text' && typeof record.text === 'string') {
            parts.push(record.text);
        }
    }
    return normalizeText(parts.join('\n'));
}
function parseThinkingSummary(block) {
    const signature = typeof block.thinkingSignature === 'string' ? block.thinkingSignature : null;
    if (!signature)
        return [];
    try {
        const parsed = JSON.parse(signature);
        const summary = Array.isArray(parsed.summary) ? parsed.summary : [];
        return summary
            .map((item) => {
            const record = asRecord(item);
            return typeof record?.text === 'string' ? normalizeText(record.text) : '';
        })
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
function buildArtifactFromArgs(name, args) {
    if (!args)
        return [];
    const filePath = typeof args.file_path === 'string'
        ? args.file_path
        : typeof args.path === 'string'
            ? args.path
            : null;
    if (!filePath)
        return [];
    if (name === 'write' && typeof args.content === 'string') {
        return [{ kind: 'file-write', filePath, content: args.content }];
    }
    const oldText = typeof args.old_string === 'string'
        ? args.old_string
        : typeof args.oldText === 'string'
            ? args.oldText
            : null;
    const newText = typeof args.new_string === 'string'
        ? args.new_string
        : typeof args.newText === 'string'
            ? args.newText
            : null;
    if (name === 'edit' && oldText !== null && newText !== null) {
        return [{ kind: 'file-edit', filePath, oldText, newText }];
    }
    return [];
}
function fallbackBodySignature(entry) {
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
function buildStableKey(entry) {
    const evidence = entry.evidence ?? {};
    if (entry.kind === 'message' && evidence.messageId) {
        return `message:${evidence.messageId}`;
    }
    if (entry.kind === 'process' && evidence.messageId) {
        const processEntry = entry;
        return `process:${evidence.messageId}:${processEntry.stage}:${processEntry.label}`;
    }
    if (entry.kind === 'tool' && entry.toolCallId) {
        const toolEntry = entry;
        return `tool:${toolEntry.toolCallId}:${toolEntry.phase}`;
    }
    if (entry.kind === 'event' && entry.seq !== null) {
        const eventEntry = entry;
        return `event:${eventEntry.name}:${evidence.runId ?? eventEntry.runId ?? 'none'}:${eventEntry.seq}`;
    }
    if (entry.kind === 'notice') {
        const noticeEntry = entry;
        return `notice:${noticeEntry.noticeKind}:${noticeEntry.runId ?? 'none'}:${normalizeText(noticeEntry.message).toLowerCase()}`;
    }
    if (evidence.runId && evidence.seq !== null) {
        return `${entry.kind}:${evidence.runId}:${evidence.seq}`;
    }
    const bodySignature = fallbackBodySignature(entry);
    const bucket = Math.floor((entry.at || Date.now()) / 30000);
    return `${entry.kind}:${entry.sessionKey ?? 'none'}:${entry.runId ?? 'none'}:${bucket}:${bodySignature ?? entry.id}`;
}
function withStableKey(entry) {
    return {
        ...entry,
        stableKey: buildStableKey(entry),
    };
}
function createMessageEntry(input) {
    const body = normalizeText(input.body);
    if (!body)
        return null;
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
function createProcessEntry(input) {
    const body = normalizeText(input.body);
    if (!body)
        return null;
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
function createToolEntry(input) {
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
function createEventEntry(input) {
    const detail = normalizeText(input.detail);
    if (!detail)
        return null;
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
function createNoticeEntry(input) {
    const message = normalizeText(input.message);
    if (!message)
        return null;
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
function buildMergeAliases(entry) {
    const aliases = new Set([entry.stableKey]);
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
    if (evidence.messageId)
        aliases.add(`message-id:${evidence.messageId}`);
    if (evidence.runId && evidence.seq !== null)
        aliases.add(`run-seq:${evidence.runId}:${evidence.seq}`);
    return Array.from(aliases);
}
function mergeArtifacts(current, incoming) {
    const keyed = new Map();
    for (const artifact of [...current, ...incoming]) {
        const key = artifact.kind === 'file-edit'
            ? `${artifact.kind}:${artifact.filePath}:${artifact.oldText}:${artifact.newText}`
            : `${artifact.kind}:${artifact.filePath}:${artifact.content}`;
        keyed.set(key, artifact);
    }
    return Array.from(keyed.values());
}
function choosePreferredString(current, incoming) {
    if (!current)
        return incoming;
    if (!incoming)
        return current;
    return incoming.length >= current.length ? incoming : current;
}
function mergeEntries(current, incoming) {
    if (current.kind !== incoming.kind) {
        return incoming.at >= current.at ? incoming : current;
    }
    if (current.kind === 'message') {
        const incomingMessage = incoming;
        const winner = incomingMessage.at >= current.at ? incomingMessage : current;
        return {
            ...current,
            ...winner,
            body: choosePreferredString(current.body, incomingMessage.body) ?? winner.body,
            status: current.status === 'final' || incomingMessage.status !== 'final'
                ? current.status === 'final' && incomingMessage.status !== 'error'
                    ? current.status
                    : winner.status
                : incomingMessage.status,
            evidence: { ...current.evidence, ...incomingMessage.evidence },
            stableKey: current.stableKey,
        };
    }
    if (current.kind === 'process') {
        const incomingProcess = incoming;
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
        const incomingTool = incoming;
        const winner = incomingTool.at >= current.at ? incomingTool : current;
        return {
            ...current,
            ...winner,
            args: incomingTool.args ?? current.args,
            meta: choosePreferredString(current.meta, incomingTool.meta),
            isError: current.isError || incomingTool.isError,
            status: incomingTool.status === 'failed' || current.status === 'failed'
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
        const incomingEvent = incoming;
        const winner = incomingEvent.at >= current.at ? incomingEvent : current;
        return {
            ...current,
            ...winner,
            detail: choosePreferredString(current.detail, incomingEvent.detail) ?? winner.detail,
            evidence: { ...current.evidence, ...incomingEvent.evidence },
            stableKey: current.stableKey,
        };
    }
    const incomingNotice = incoming;
    const winner = incomingNotice.at >= current.at ? incomingNotice : current;
    return {
        ...current,
        ...winner,
        message: choosePreferredString(current.message, incomingNotice.message) ?? winner.message,
        evidence: { ...current.evidence, ...incomingNotice.evidence },
        stableKey: current.stableKey,
    };
}
function mergeTranscriptEntries(current, incoming, options) {
    const scopedCurrent = options?.sessionKey
        ? current.filter((entry) => entry.sessionKey === options.sessionKey || entry.sessionKey === null)
        : current;
    const records = [];
    const aliases = new Map();
    const upsert = (entry) => {
        const keys = buildMergeAliases(entry);
        const existingIndex = keys.map((key) => aliases.get(key)).find((value) => value !== undefined);
        if (existingIndex === undefined) {
            const nextIndex = records.push(entry) - 1;
            for (const key of keys)
                aliases.set(key, nextIndex);
            return;
        }
        const merged = mergeEntries(records[existingIndex], entry);
        records[existingIndex] = merged;
        for (const key of buildMergeAliases(merged))
            aliases.set(key, existingIndex);
    };
    for (const entry of scopedCurrent)
        upsert(entry);
    for (const entry of incoming)
        upsert(entry);
    records.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    const limit = options?.limit ?? records.length;
    return limit >= records.length ? records : records.slice(-limit);
}
function transcriptEntriesToMessages(entries) {
    return entries
        .filter((entry) => entry.kind === 'message')
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
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
function buildTranscriptHistory(sessionKey, entries) {
    return {
        sessionKey,
        entries,
        messages: transcriptEntriesToMessages(entries),
    };
}
function compareEntries(a, b) {
    return a.at - b.at || a.id.localeCompare(b.id);
}
function dedupeArtifacts(artifacts) {
    const keyed = new Map();
    for (const artifact of artifacts) {
        const key = artifact.kind === 'file-edit'
            ? `${artifact.kind}:${artifact.filePath}:${artifact.oldText}:${artifact.newText}`
            : `${artifact.kind}:${artifact.filePath}:${artifact.content}`;
        keyed.set(key, artifact);
    }
    return Array.from(keyed.values());
}
function burstStatus(rows) {
    if (rows.some((row) => row.status === 'failed' || row.isError))
        return 'failed';
    if (rows.every((row) => row.status === 'completed'))
        return 'completed';
    return 'running';
}
function groupToolBursts(entries, burstWindowMs) {
    const toolCallGroups = new Map();
    for (const entry of entries) {
        const key = `${entry.runId ?? 'runless'}:${entry.toolCallId ?? entry.id}`;
        const group = toolCallGroups.get(key) ?? [];
        group.push(entry);
        toolCallGroups.set(key, group);
    }
    const sortedToolCallGroups = Array.from(toolCallGroups.values())
        .map((rows) => rows.slice().sort(compareEntries))
        .sort((a, b) => (a[0]?.at ?? 0) - (b[0]?.at ?? 0));
    const bursts = [];
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
function noticeTitle(entry) {
    if (entry.noticeKind === 'context-compression')
        return 'Context updated';
    if (entry.noticeKind === 'fallback-model')
        return 'Fallback model';
    if (entry.noticeKind === 'event')
        return 'Runtime event';
    return 'System notice';
}
function latestToolRows(rows) {
    const latestRowsMap = new Map();
    for (const row of rows) {
        const key = row.toolCallId ?? row.id;
        const existing = latestRowsMap.get(key);
        if (!existing || existing.at <= row.at) {
            latestRowsMap.set(key, row);
        }
    }
    return Array.from(latestRowsMap.values()).sort(compareEntries);
}
function summarizeToolDetail(tool) {
    const filePath = typeof tool.args?.file_path === 'string'
        ? tool.args.file_path
        : typeof tool.args?.path === 'string'
            ? tool.args.path
            : null;
    const command = typeof tool.args?.command === 'string' ? tool.args.command : null;
    if ((tool.name === 'read' || tool.name === 'write' || tool.name === 'edit') && filePath)
        return filePath;
    if (tool.name === 'exec' && command)
        return command;
    return tool.meta || tool.name;
}
function messagePresentation(entry, index, entries) {
    if (entry.role !== 'assistant')
        return 'final';
    if (entry.status === 'streaming')
        return 'streaming';
    if (!entry.runId)
        return 'final';
    for (let cursor = index + 1; cursor < entries.length; cursor += 1) {
        const candidate = entries[cursor];
        if (candidate.sessionKey !== entry.sessionKey)
            continue;
        if (candidate.kind === 'message' && candidate.role === 'user')
            break;
        if (candidate.runId !== entry.runId)
            continue;
        if (candidate.kind === 'tool')
            return 'intermediate';
        if (candidate.kind === 'message' && candidate.role === 'assistant')
            break;
    }
    return 'final';
}
function buildMessageActivity(entry, entries) {
    if (entry.role !== 'assistant' || !entry.runId)
        return [];
    const runEntries = entries.filter((candidate) => candidate.runId === entry.runId &&
        candidate.sessionKey === entry.sessionKey &&
        candidate.at <= entry.at);
    const runningTools = latestToolRows(runEntries.filter((candidate) => candidate.kind === 'tool')).filter((candidate) => candidate.status === 'running' && !candidate.isError);
    const activities = runningTools.map((tool) => ({
        id: `activity:${tool.toolCallId ?? tool.id}`,
        kind: 'tool',
        label: tool.name,
        detail: summarizeToolDetail(tool),
        status: tool.status,
        at: tool.at,
    }));
    const lifecycleEntries = runEntries.filter((candidate) => candidate.kind === 'process' && candidate.stage === 'lifecycle');
    const latestLifecycle = lifecycleEntries[lifecycleEntries.length - 1] ?? null;
    if (latestLifecycle && latestLifecycle.label !== 'Run finished') {
        activities.unshift({
            id: `activity:${latestLifecycle.id}`,
            kind: 'process',
            label: latestLifecycle.label,
            detail: latestLifecycle.body,
            status: 'running',
            at: latestLifecycle.at,
        });
    }
    return activities
        .sort((a, b) => b.at - a.at)
        .slice(0, 4)
        .sort((a, b) => a.at - b.at);
}
function shapeTranscriptEntriesForRender(entries, options) {
    const burstWindowMs = options?.burstWindowMs ?? 10000;
    const sortedEntries = entries.slice().sort(compareEntries);
    const toolBursts = groupToolBursts(sortedEntries.filter((entry) => entry.kind === 'tool'), burstWindowMs);
    const items = [];
    let order = 0;
    sortedEntries.forEach((entry, index) => {
        if (entry.kind === 'message') {
            if (entry.role === 'user' || entry.role === 'assistant') {
                const assistantEntry = entry;
                items.push({
                    type: 'message',
                    id: entry.id,
                    at: entry.at,
                    entry: assistantEntry,
                    presentation: messagePresentation(assistantEntry, index, sortedEntries),
                    activity: buildMessageActivity(assistantEntry, sortedEntries),
                    order: order++,
                });
                return;
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
            return;
        }
        if (entry.kind === 'process') {
            items.push({
                type: 'process',
                id: entry.id,
                at: entry.at,
                entry,
                order: order++,
            });
            return;
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
    });
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
function normalizeHistoryRecord(record, sessionKey) {
    const type = typeof record.type === 'string' ? record.type : null;
    if (type !== 'message')
        return [];
    const message = asRecord(record.message);
    if (!message)
        return [];
    const role = typeof message.role === 'string' ? message.role : null;
    const at = toTimestamp(message.timestamp) ?? toTimestamp(record.timestamp) ?? Date.now();
    const messageId = typeof record.id === 'string' ? record.id : null;
    const parentId = typeof record.parentId === 'string' ? record.parentId : null;
    const runId = typeof record.runId === 'string'
        ? record.runId
        : typeof message.runId === 'string'
            ? message.runId
            : null;
    const evidence = {
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
        const entries = [];
        content.forEach((block, index) => {
            const recordBlock = asRecord(block);
            if (!recordBlock)
                return;
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
                    if (entry)
                        entries.push(entry);
                });
            }
            if (recordBlock.type === 'toolCall') {
                const name = typeof recordBlock.name === 'string' ? recordBlock.name : 'tool';
                const toolCallId = typeof recordBlock.id === 'string' ? recordBlock.id : null;
                entries.push(createToolEntry({
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
                }));
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
        if (textEntry)
            entries.push(textEntry);
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
function reconstructTranscriptFromHistoryRecords(records, sessionKey, maxEntries) {
    const entries = mergeTranscriptEntries([], records.flatMap((record) => normalizeHistoryRecord(record, sessionKey)), { sessionKey, limit: maxEntries });
    return buildTranscriptHistory(sessionKey, entries);
}
