import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEventEntry,
  createMessageEntry,
  mergeTranscriptEntries,
  normalizeHistoryRecord,
  reconstructTranscriptFromHistoryRecords,
} from '../lib/chat/runtime-bridge-transcript';

test('normalizeHistoryRecord reconstructs assistant tool usage and visible process summaries', () => {
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

  const entries = normalizeHistoryRecord(record, 'agent:main:main');

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ['process', 'tool', 'message'],
  );

  const processEntry = entries[0];
  assert.equal(processEntry.kind, 'process');
  assert.equal(processEntry.body, 'Checked task board before choosing the next step.');

  const toolEntry = entries[1];
  assert.equal(toolEntry.kind, 'tool');
  assert.equal(toolEntry.toolCallId, 'call-123');
  assert.equal(toolEntry.artifacts[0]?.kind, 'file-edit');

  const messageEntry = entries[2];
  assert.equal(messageEntry.kind, 'message');
  assert.equal(messageEntry.body, 'Implemented the change and kept the chat surface stable.');
});

test('mergeTranscriptEntries dedupes optimistic and hydrated transcript messages', () => {
  const optimistic = createMessageEntry({
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
  const hydrated = createMessageEntry({
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

  assert.ok(optimistic);
  assert.ok(hydrated);

  const merged = mergeTranscriptEntries([optimistic], [hydrated], {
    sessionKey: 'agent:main:main',
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.kind, 'message');
  if (merged[0]?.kind === 'message') {
    assert.equal(merged[0].body, 'Implement the transcript foundation.');
  }
});

test('mergeTranscriptEntries prefers seq keys for repeated runtime events', () => {
  const older = createEventEntry({
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
  const newer = createEventEntry({
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

  assert.ok(older);
  assert.ok(newer);

  const merged = mergeTranscriptEntries([older], [newer], {
    sessionKey: 'agent:main:main',
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.kind, 'event');
  if (merged[0]?.kind === 'event') {
    assert.equal(merged[0].detail, 'Chat final for agent:main:main.');
  }
});

test('reconstructTranscriptFromHistoryRecords preserves structured tool results', () => {
  const history = reconstructTranscriptFromHistoryRecords(
    [
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
    ],
    'agent:main:main',
    50,
  );

  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0]?.body, 'Write the file.');

  const toolEntries = history.entries.filter((entry) => entry.kind === 'tool');
  assert.equal(toolEntries.length, 2);
  assert.equal(toolEntries[0]?.kind, 'tool');
  if (toolEntries[0]?.kind === 'tool') {
    assert.equal(toolEntries[0].artifacts[0]?.kind, 'file-write');
  }
  if (toolEntries[1]?.kind === 'tool') {
    assert.equal(toolEntries[1].status, 'completed');
    assert.equal(toolEntries[1].meta, 'Wrote /repo/new-file.ts');
  }
});
