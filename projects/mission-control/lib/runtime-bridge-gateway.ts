import 'server-only';

import { reconstructTranscriptFromGatewayHistoryMessages } from '@/lib/chat/runtime-bridge-transcript';
import { runShellCommand } from '@/lib/adapters/runtime';
import type { RuntimeBridgeTranscriptHistory } from '@/lib/types/contracts';

const DEFAULT_HISTORY_LIMIT = 160;
const GATEWAY_HISTORY_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [150, 400, 900] as const;
const RETRYABLE_HISTORY_ERROR = /(\bUNAVAILABLE\b|startup-unavailable|temporarily unavailable|becomes available after gateway sidecars start)/i;

type GatewayHistoryResponse = {
  sessionKey?: string | null;
  sessionId?: string | null;
  messages?: Array<Record<string, unknown>>;
  thinkingLevel?: string | null;
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function clampHistoryLimit(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_HISTORY_LIMIT;
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function extractErrorText(cause: unknown): string {
  if (!cause || typeof cause !== 'object') {
    return String(cause ?? 'Unknown gateway history error');
  }

  const error = cause as {
    message?: string;
    stdout?: string;
    stderr?: string;
    shortMessage?: string;
  };

  return [error.message, error.shortMessage, error.stderr, error.stdout].filter(Boolean).join('\n');
}

function shouldRetryGatewayHistory(cause: unknown): boolean {
  return RETRYABLE_HISTORY_ERROR.test(extractErrorText(cause));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadRuntimeBridgeSessionHistoryFromGateway(
  sessionKey: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<RuntimeBridgeTranscriptHistory | null> {
  const limit = clampHistoryLimit(options?.limit);
  const params: Record<string, unknown> = {
    sessionKey,
    limit,
  };

  if (typeof options?.cursor === 'string' && options.cursor.trim()) {
    params.cursor = options.cursor.trim();
  }

  const command = `openclaw gateway call chat.history --json --params ${shellQuote(JSON.stringify(params))}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const { stdout } = await runShellCommand(command, GATEWAY_HISTORY_TIMEOUT_MS);
      const payload = JSON.parse(stdout) as GatewayHistoryResponse;
      const history = reconstructTranscriptFromGatewayHistoryMessages(payload.messages ?? [], payload.sessionKey ?? sessionKey, limit);
      return {
        ...history,
        source: 'gateway',
        sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null,
        thinkingLevel: typeof payload.thinkingLevel === 'string' && payload.thinkingLevel.trim() ? payload.thinkingLevel.trim() : null,
      };
    } catch (cause) {
      lastError = cause;
      if (attempt >= RETRY_DELAYS_MS.length || !shouldRetryGatewayHistory(cause)) {
        break;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  console.warn('[mission-control-runtime] gateway history load failed', {
    sessionKey,
    error: extractErrorText(lastError),
  });

  return null;
}
