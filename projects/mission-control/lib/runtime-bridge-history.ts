import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RuntimeBridgeTranscriptHistory, RuntimeBridgeTranscriptMessage } from '@/lib/types/contracts';

const SESSION_ROOT = '/data/.openclaw/agents/main/sessions';
const SESSIONS_INDEX = path.join(SESSION_ROOT, 'sessions.json');
const MAX_HISTORY_MESSAGES = 80;

function sanitizeTranscriptBody(input: string): string {
  let body = input.trim();

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

function extractText(content: unknown): string {
  if (typeof content === 'string') return sanitizeTranscriptBody(content);
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    const typed = item as Record<string, unknown>;
    if (typed.type === 'text' && typeof typed.text === 'string') {
      parts.push(typed.text);
    }
  }
  return sanitizeTranscriptBody(parts.join('\n').trim());
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

export async function loadRuntimeBridgeSessionHistory(
  sessionKey: string | null | undefined,
): Promise<RuntimeBridgeTranscriptHistory> {
  if (!sessionKey) {
    return {
      sessionKey: null,
      messages: [],
    };
  }

  try {
    const indexRaw = await fs.readFile(SESSIONS_INDEX, 'utf8');
    const index = JSON.parse(indexRaw) as Record<string, unknown>;
    const sessionEntry = index[sessionKey];
    if (!sessionEntry || typeof sessionEntry !== 'object') {
      return { sessionKey, messages: [] };
    }

    const typedSessionEntry = sessionEntry as Record<string, unknown>;
    const sessionId =
      typeof typedSessionEntry.sessionId === 'string'
        ? typedSessionEntry.sessionId
        : typeof typedSessionEntry.id === 'string'
          ? typedSessionEntry.id
          : null;
    if (!sessionId) {
      return { sessionKey, messages: [] };
    }

    const logPath = path.join(SESSION_ROOT, `${sessionId}.jsonl`);
    const logRaw = await fs.readFile(logPath, 'utf8');
    const lines = logRaw.split('\n').filter(Boolean);
    const messages: RuntimeBridgeTranscriptMessage[] = [];

    for (const line of lines) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      const message = parsed?.message;
      if (!message || typeof message !== 'object') continue;
      const typedMessage = message as Record<string, unknown>;
      const role = typedMessage.role;
      if (role !== 'user' && role !== 'assistant') continue;

      const body = extractText(typedMessage.content);
      if (!body) continue;

      const typedTimestamp =
        toTimestamp((typedMessage as Record<string, unknown>).timestamp) ??
        toTimestamp(parsed.timestamp) ??
        Date.now();

      messages.push({
        id: String(parsed.id ?? `${sessionId}-${messages.length}`),
        role,
        body,
        status: 'final',
        sessionKey,
        runId: null,
        at: typedTimestamp,
      });
    }

    return {
      sessionKey,
      messages: messages.slice(-MAX_HISTORY_MESSAGES),
    };
  } catch {
    return {
      sessionKey,
      messages: [],
    };
  }
}
