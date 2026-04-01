import { cache } from 'react';
import type { ActivityFeed } from '@/lib/types/contracts';
import { readJsonlFile } from '@/lib/adapters/runtime';

const CRON_RUN_LOG_PATH = '/data/.openclaw/workspace/memory/cron-run-log.jsonl';

type RunnerLogEntry = {
  task?: string;
  status?: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  summary?: string;
  notes?: string | string[];
};

function compactText(value: unknown, maxLength = 220): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function normalizeNotes(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(' · ');
    return compactText(joined, 240);
  }

  return compactText(value, 240);
}

function toRunState(status: string | null): 'success' | 'failed' | 'running' {
  if (status === 'error') return 'failed';
  if (status === 'ok' || status === 'warn') return 'success';
  return 'running';
}

export const getRecentActivity = cache(async function getRecentActivity(): Promise<ActivityFeed> {
  try {
    const entries = await readJsonlFile(CRON_RUN_LOG_PATH, 80);
    const items = entries
      .map((entry, idx) => {
        const record = entry as RunnerLogEntry;
        const task = typeof record.task === 'string' ? record.task : null;
        const status = typeof record.status === 'string' ? record.status : null;
        const startedAt = typeof record.started_at === 'string' ? record.started_at : null;
        if (!task || !startedAt) return null;

        return {
          id: `${task}:${startedAt}:${idx}`,
          source: 'cron-runner',
          message: `${task} (${status ?? 'unknown'})`,
          at: startedAt,
          state: toRunState(status),
          startedAt,
          finishedAt: typeof record.finished_at === 'string' ? record.finished_at : null,
          durationMs: typeof record.duration_ms === 'number' ? record.duration_ms : null,
          summary: compactText(record.summary),
          notes: normalizeNotes(record.notes),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      status: 'partial',
      items,
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'stub',
      items: [],
      refreshedAt: new Date().toISOString(),
    };
  }
});
