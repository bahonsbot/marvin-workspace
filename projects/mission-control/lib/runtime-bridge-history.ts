import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { reconstructTranscriptFromHistoryRecords } from '@/lib/chat/runtime-bridge-transcript';
import type { RuntimeBridgeTranscriptHistory } from '@/lib/types/contracts';

const SESSION_ROOT = '/data/.openclaw/agents/main/sessions';
const SESSIONS_INDEX = path.join(SESSION_ROOT, 'sessions.json');
const MAX_HISTORY_ENTRIES = 160;

export async function loadRuntimeBridgeSessionHistory(
  sessionKey: string | null | undefined,
): Promise<RuntimeBridgeTranscriptHistory> {
  if (!sessionKey) {
    return {
      sessionKey: null,
      entries: [],
      messages: [],
    };
  }

  try {
    const indexRaw = await fs.readFile(SESSIONS_INDEX, 'utf8');
    const index = JSON.parse(indexRaw) as Record<string, unknown>;
    const sessionEntry = index[sessionKey];
    if (!sessionEntry || typeof sessionEntry !== 'object') {
      return { sessionKey, entries: [], messages: [] };
    }

    const typedSessionEntry = sessionEntry as Record<string, unknown>;
    const sessionId =
      typeof typedSessionEntry.sessionId === 'string'
        ? typedSessionEntry.sessionId
        : typeof typedSessionEntry.id === 'string'
          ? typedSessionEntry.id
          : null;
    if (!sessionId) {
      return { sessionKey, entries: [], messages: [] };
    }

    const logPath = path.join(SESSION_ROOT, `${sessionId}.jsonl`);
    const logRaw = await fs.readFile(logPath, 'utf8');
    const records = logRaw
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, unknown>];
        } catch {
          return [];
        }
      });

    return reconstructTranscriptFromHistoryRecords(records, sessionKey, MAX_HISTORY_ENTRIES);
  } catch {
    return {
      sessionKey,
      entries: [],
      messages: [],
    };
  }
}
