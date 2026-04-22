import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { reconstructTranscriptFromHistoryRecords } from '@/lib/chat/runtime-bridge-transcript';
import { loadRuntimeBridgeSessionHistoryFromGateway } from '@/lib/runtime-bridge-gateway';
import type { RuntimeBridgeTranscriptHistory } from '@/lib/types/contracts';

const AGENTS_ROOT = '/data/.openclaw/agents';
const MAX_HISTORY_ENTRIES = 160;

function sessionRootForAgent(agentSlug: string): string {
  return path.join(AGENTS_ROOT, agentSlug, 'sessions');
}

function candidateSessionRoots(sessionKey: string): string[] {
  const candidates = new Set<string>();
  const agentMatch = sessionKey.match(/^agent:([^:]+):/i);
  const agentSlug = agentMatch?.[1]?.trim();
  if (agentSlug) {
    candidates.add(sessionRootForAgent(agentSlug));
  }
  candidates.add(sessionRootForAgent('main'));
  return Array.from(candidates);
}

async function readSessionRecordsFromRoot(
  sessionRoot: string,
  sessionKey: string,
): Promise<Record<string, unknown>[] | null> {
  const sessionsIndex = path.join(sessionRoot, 'sessions.json');
  const indexRaw = await fs.readFile(sessionsIndex, 'utf8');
  const index = JSON.parse(indexRaw) as Record<string, unknown>;
  const sessionEntry = index[sessionKey];
  if (!sessionEntry || typeof sessionEntry !== 'object') {
    return null;
  }

  const typedSessionEntry = sessionEntry as Record<string, unknown>;
  const sessionId =
    typeof typedSessionEntry.sessionId === 'string'
      ? typedSessionEntry.sessionId
      : typeof typedSessionEntry.id === 'string'
        ? typedSessionEntry.id
        : null;
  if (!sessionId) {
    return null;
  }

  const logPath = path.join(sessionRoot, `${sessionId}.jsonl`);
  const logRaw = await fs.readFile(logPath, 'utf8');
  return logRaw
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

async function loadRuntimeBridgeSessionHistoryFromJsonl(
  sessionKey: string,
): Promise<RuntimeBridgeTranscriptHistory | null> {
  for (const sessionRoot of candidateSessionRoots(sessionKey)) {
    try {
      const records = await readSessionRecordsFromRoot(sessionRoot, sessionKey);
      if (!records) continue;
      return {
        ...reconstructTranscriptFromHistoryRecords(records, sessionKey, MAX_HISTORY_ENTRIES),
        source: 'jsonl',
        note: 'Loaded from local session JSONL fallback rather than gateway history.',
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadRuntimeBridgeSessionHistory(
  sessionKey: string | null | undefined,
): Promise<RuntimeBridgeTranscriptHistory> {
  if (!sessionKey) {
    return {
      sessionKey: null,
      entries: [],
      messages: [],
      source: 'unavailable',
      note: 'No session key was provided for transcript history bootstrap.',
    };
  }

  const gatewayHistory = await loadRuntimeBridgeSessionHistoryFromGateway(sessionKey, {
    limit: MAX_HISTORY_ENTRIES,
  });
  if (gatewayHistory) {
    return gatewayHistory;
  }

  const fallbackHistory = await loadRuntimeBridgeSessionHistoryFromJsonl(sessionKey);
  if (fallbackHistory) {
    return fallbackHistory;
  }

  return {
    sessionKey,
    entries: [],
    messages: [],
    source: 'unavailable',
    note: 'Neither gateway history nor local session JSONL history was available for this session.',
    retryable: true,
  };
}
