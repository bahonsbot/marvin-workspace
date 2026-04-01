import { cache } from 'react';
import type { SessionSummary } from '@/lib/types/contracts';
import { runJsonCommand } from '@/lib/adapters/runtime';

type SessionRaw = {
  key?: string;
  kind?: string;
  model?: string;
  updatedAt?: number;
  ageMs?: number;
};

const ACTIVE_AGE_MS = 5 * 60 * 1000;

function toLabel(key: string): string {
  const parts = key.split(':');
  return parts.slice(-2).join(':');
}

export const getSessions = cache(async function getSessions(): Promise<SessionSummary> {
  try {
    const data = (await runJsonCommand('openclaw sessions --all-agents --json')) as {
      sessions?: SessionRaw[];
    };

    const sessions = (data.sessions ?? [])
      .filter((session) => typeof session.key === 'string')
      .filter((session) => !String(session.key).includes(':run:'))
      .slice(0, 250)
      .map((session) => {
        const key = session.key as string;
        const ageMs = typeof session.ageMs === 'number' ? session.ageMs : null;
        const updatedAt = typeof session.updatedAt === 'number' ? new Date(session.updatedAt).toISOString() : null;

        return {
          id: key,
          rawKey: key,
          label: toLabel(key),
          state:
            ageMs === null ? ('unknown' as const) : ageMs <= ACTIVE_AGE_MS ? ('running' as const) : ('idle' as const),
          kind: session.kind ?? 'unknown',
          model: session.model ?? null,
          lastActiveAt: updatedAt,
          ageMs,
        };
      });

    return {
      status: 'partial',
      sessions,
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'stub',
      sessions: [],
      refreshedAt: new Date().toISOString(),
    };
  }
});
