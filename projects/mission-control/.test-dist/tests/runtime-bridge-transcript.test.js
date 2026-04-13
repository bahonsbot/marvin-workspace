"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const runtime_bridge_transcript_1 = require("../lib/chat/runtime-bridge-transcript");
(0, node_test_1.default)('normalizeHistoryRecord reconstructs assistant tool usage and visible process summaries', () => {
    const record = {
        type: 'message',
        id: 'assistant-1',
        parentId: 'user-1',
        timestamp: '2026-04-13T04:56:42.072Z',
        message: {
            role: 'assistant',
            content: [
                {
                    type: 'thinking',
                    thinking: 'hidden internal reasoning',
                    thinkingSignature: JSON.stringify({
                        summary: [
                            { type: 'summary_text', text: 'Checked task board before choosing the next step.' },
                        ],
                    }),
                },
                {
                    type: 'toolCall',
                    id: 'call-123',
                    name: 'edit',
                    arguments: {
                        file_path: '/repo/file.ts',
                        old_string: 'before',
                        new_string: 'after',
                    },
                },
                {
                    type: 'text',
                    text: 'Implemented the change and kept the chat surface stable.',
                },
            ],
        },
    };
    const entries = (0, runtime_bridge_transcript_1.normalizeHistoryRecord)(record, 'agent:main:main');
    strict_1.default.equal(entries.length, 3);
    strict_1.default.deepEqual(entries.map((entry) => entry.kind), ['process', 'tool', 'message']);
    const processEntry = entries[0];
    strict_1.default.equal(processEntry.kind, 'process');
    strict_1.default.equal(processEntry.body, 'Checked task board before choosing the next step.');
    const toolEntry = entries[1];
    strict_1.default.equal(toolEntry.kind, 'tool');
    strict_1.default.equal(toolEntry.toolCallId, 'call-123');
    strict_1.default.equal(toolEntry.artifacts[0]?.kind, 'file-edit');
    const messageEntry = entries[2];
    strict_1.default.equal(messageEntry.kind, 'message');
    strict_1.default.equal(messageEntry.body, 'Implemented the change and kept the chat surface stable.');
});
(0, node_test_1.default)('mergeTranscriptEntries dedupes optimistic and hydrated transcript messages', () => {
    const optimistic = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'local-user',
        role: 'user',
        body: 'Implement the transcript foundation.',
        status: 'final',
        sessionKey: 'agent:main:main',
        runId: null,
        at: Date.parse('2026-04-13T05:00:00.000Z'),
        evidence: {
            sessionKey: 'agent:main:main',
        },
    });
    const hydrated = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'history-user',
        role: 'user',
        body: 'Implement the transcript foundation.',
        status: 'final',
        sessionKey: 'agent:main:main',
        runId: null,
        at: Date.parse('2026-04-13T05:00:05.000Z'),
        evidence: {
            messageId: 'history-user',
            sessionKey: 'agent:main:main',
        },
    });
    strict_1.default.ok(optimistic);
    strict_1.default.ok(hydrated);
    const merged = (0, runtime_bridge_transcript_1.mergeTranscriptEntries)([optimistic], [hydrated], {
        sessionKey: 'agent:main:main',
    });
    strict_1.default.equal(merged.length, 1);
    strict_1.default.equal(merged[0]?.kind, 'message');
    if (merged[0]?.kind === 'message') {
        strict_1.default.equal(merged[0].body, 'Implement the transcript foundation.');
    }
});
(0, node_test_1.default)('mergeTranscriptEntries prefers seq keys for repeated runtime events', () => {
    const older = (0, runtime_bridge_transcript_1.createEventEntry)({
        id: 'event-1',
        name: 'chat',
        detail: 'Chat final.',
        sessionKey: 'agent:main:main',
        runId: 'run-1',
        at: 1000,
        evidence: {
            runId: 'run-1',
            sessionKey: 'agent:main:main',
            seq: 17,
            sourceEvent: 'chat',
        },
    });
    const newer = (0, runtime_bridge_transcript_1.createEventEntry)({
        id: 'event-2',
        name: 'chat',
        detail: 'Chat final for agent:main:main.',
        sessionKey: 'agent:main:main',
        runId: 'run-1',
        at: 1200,
        evidence: {
            runId: 'run-1',
            sessionKey: 'agent:main:main',
            seq: 17,
            sourceEvent: 'chat',
        },
    });
    strict_1.default.ok(older);
    strict_1.default.ok(newer);
    const merged = (0, runtime_bridge_transcript_1.mergeTranscriptEntries)([older], [newer], {
        sessionKey: 'agent:main:main',
    });
    strict_1.default.equal(merged.length, 1);
    strict_1.default.equal(merged[0]?.kind, 'event');
    if (merged[0]?.kind === 'event') {
        strict_1.default.equal(merged[0].detail, 'Chat final for agent:main:main.');
    }
});
(0, node_test_1.default)('reconstructTranscriptFromHistoryRecords preserves structured tool results', () => {
    const history = (0, runtime_bridge_transcript_1.reconstructTranscriptFromHistoryRecords)([
        {
            type: 'message',
            id: 'user-1',
            timestamp: '2026-04-13T05:10:00.000Z',
            message: {
                role: 'user',
                content: [{ type: 'text', text: 'Write the file.' }],
            },
        },
        {
            type: 'message',
            id: 'assistant-1',
            parentId: 'user-1',
            timestamp: '2026-04-13T05:10:10.000Z',
            message: {
                role: 'assistant',
                content: [
                    {
                        type: 'toolCall',
                        id: 'call-write-1',
                        name: 'write',
                        arguments: {
                            file_path: '/repo/new-file.ts',
                            content: 'export const ok = true;\n',
                        },
                    },
                ],
            },
        },
        {
            type: 'message',
            id: 'tool-result-1',
            parentId: 'assistant-1',
            timestamp: '2026-04-13T05:10:11.000Z',
            message: {
                role: 'toolResult',
                toolCallId: 'call-write-1',
                toolName: 'write',
                isError: false,
                content: [{ type: 'text', text: 'Wrote /repo/new-file.ts' }],
            },
        },
    ], 'agent:main:main', 50);
    strict_1.default.equal(history.messages.length, 1);
    strict_1.default.equal(history.messages[0]?.body, 'Write the file.');
    const toolEntries = history.entries.filter((entry) => entry.kind === 'tool');
    strict_1.default.equal(toolEntries.length, 2);
    strict_1.default.equal(toolEntries[0]?.kind, 'tool');
    if (toolEntries[0]?.kind === 'tool') {
        strict_1.default.equal(toolEntries[0].artifacts[0]?.kind, 'file-write');
    }
    if (toolEntries[1]?.kind === 'tool') {
        strict_1.default.equal(toolEntries[1].status, 'completed');
        strict_1.default.equal(toolEntries[1].meta, 'Wrote /repo/new-file.ts');
    }
});
(0, node_test_1.default)('shapeTranscriptEntriesForRender keeps process, tool bursts, artifacts, and notices distinct', () => {
    const sessionKey = 'agent:main:main';
    const runId = 'run-42';
    const user = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'user-1',
        role: 'user',
        body: 'Patch the transcript renderer.',
        status: 'final',
        sessionKey,
        runId: null,
        at: 1000,
        evidence: { sessionKey },
    });
    const process = (0, runtime_bridge_transcript_1.createProcessEntry)({
        id: 'process-1',
        stage: 'lifecycle',
        label: 'Run started',
        body: 'Run start.',
        sessionKey,
        runId,
        at: 1100,
        evidence: { sessionKey, runId },
    });
    const toolStart = (0, runtime_bridge_transcript_1.createToolEntry)({
        id: 'tool-1',
        name: 'edit',
        phase: 'start',
        status: 'running',
        toolCallId: 'call-edit-1',
        args: {
            file_path: '/repo/file.ts',
            old_string: 'before',
            new_string: 'after',
        },
        sessionKey,
        runId,
        at: 1200,
        evidence: { sessionKey, runId, toolCallId: 'call-edit-1' },
    });
    const notice = (0, runtime_bridge_transcript_1.createNoticeEntry)({
        id: 'notice-1',
        noticeKind: 'context-compression',
        message: 'Context compression applied for this run.',
        sessionKey,
        runId,
        at: 1300,
        evidence: { sessionKey, runId },
    });
    const assistant = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'assistant-2',
        role: 'assistant',
        body: 'Patched the renderer and kept the transcript unified.',
        status: 'final',
        sessionKey,
        runId,
        at: 1400,
        evidence: { sessionKey, runId },
    });
    strict_1.default.ok(user);
    strict_1.default.ok(process);
    strict_1.default.ok(toolStart);
    strict_1.default.ok(notice);
    strict_1.default.ok(assistant);
    const items = (0, runtime_bridge_transcript_1.shapeTranscriptEntriesForRender)([user, process, toolStart, notice, assistant], {
        burstWindowMs: 10000,
    });
    strict_1.default.deepEqual(items.map((item) => item.type), ['message', 'process', 'tools', 'artifacts', 'notice', 'message']);
    const messageItems = items.filter((item) => item.type === 'message');
    strict_1.default.equal(messageItems[0]?.type, 'message');
    strict_1.default.equal(messageItems[1]?.type, 'message');
    if (messageItems[0]?.type === 'message') {
        strict_1.default.equal(messageItems[0].presentation, 'final');
    }
    if (messageItems[1]?.type === 'message') {
        strict_1.default.equal(messageItems[1].presentation, 'final');
        strict_1.default.equal(messageItems[1].activity.length, 2);
        strict_1.default.deepEqual(messageItems[1].activity.map((activity) => activity.kind), ['process', 'tool']);
    }
    const artifactItem = items.find((item) => item.type === 'artifacts');
    strict_1.default.ok(artifactItem);
    if (artifactItem?.type === 'artifacts') {
        strict_1.default.equal(artifactItem.group.artifacts[0]?.kind, 'file-edit');
        strict_1.default.equal(artifactItem.group.artifacts[0]?.filePath, '/repo/file.ts');
    }
});
(0, node_test_1.default)('shapeTranscriptEntriesForRender marks assistant narration before tools as intermediate', () => {
    const sessionKey = 'agent:main:main';
    const runId = 'run-84';
    const user = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'user-1',
        role: 'user',
        body: 'Do the work.',
        status: 'final',
        sessionKey,
        runId: null,
        at: 1000,
        evidence: { sessionKey },
    });
    const assistantNarration = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'assistant-1',
        role: 'assistant',
        body: 'Checking the files first.',
        status: 'final',
        sessionKey,
        runId,
        at: 1100,
        evidence: { sessionKey, runId },
    });
    const toolStart = (0, runtime_bridge_transcript_1.createToolEntry)({
        id: 'tool-1',
        name: 'read',
        phase: 'start',
        status: 'running',
        toolCallId: 'call-read-1',
        args: { file_path: '/repo/file.ts' },
        sessionKey,
        runId,
        at: 1200,
        evidence: { sessionKey, runId, toolCallId: 'call-read-1' },
    });
    const assistantFinal = (0, runtime_bridge_transcript_1.createMessageEntry)({
        id: 'assistant-2',
        role: 'assistant',
        body: 'Read the file and found the issue.',
        status: 'final',
        sessionKey,
        runId,
        at: 1300,
        evidence: { sessionKey, runId },
    });
    strict_1.default.ok(user);
    strict_1.default.ok(assistantNarration);
    strict_1.default.ok(toolStart);
    strict_1.default.ok(assistantFinal);
    const items = (0, runtime_bridge_transcript_1.shapeTranscriptEntriesForRender)([user, assistantNarration, toolStart, assistantFinal], {
        burstWindowMs: 10000,
    });
    const assistantItems = items.filter((item) => item.type === 'message' && item.entry.role === 'assistant');
    strict_1.default.equal(assistantItems.length, 2);
    if (assistantItems[0]?.type === 'message') {
        strict_1.default.equal(assistantItems[0].presentation, 'intermediate');
    }
    if (assistantItems[1]?.type === 'message') {
        strict_1.default.equal(assistantItems[1].presentation, 'final');
    }
});
