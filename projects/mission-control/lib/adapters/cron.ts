import { cache } from 'react';
import type { CronJobsSummary, CronRunsSummary } from '@/lib/types/contracts';
import { readJsonlFile, runJsonCommand } from '@/lib/adapters/runtime';

const CRON_RUN_LOG_PATH = '/data/.openclaw/workspace/memory/cron-run-log.jsonl';
const HOST_DETERMINISTIC_JOB_META: Record<string, { schedule: string; enabled: boolean }> = {
  'trading-daily-report': { schedule: '0 8 * * 1-5', enabled: true },
  'pre-market-brief': { schedule: '0 20 * * 1-5', enabled: true },
  'auto-signal-dispatcher': { schedule: '*/15 * * * 1-5', enabled: true },
  'rss-feed-monitor': { schedule: '10 * * * 1-5', enabled: true },
  'rss-feed-monitor-weekend-light': { schedule: '10 */4 * * 0,6', enabled: true },
  'custom-news-feed-monitor': { schedule: '20,50 * * * *', enabled: true },
  'reddit-monitor': { schedule: '40 * * * 1-5', enabled: true },
  'reddit-monitor-weekend-light': { schedule: '40 */4 * * 0,6', enabled: true },
  'weekly-test-suite': { schedule: '15 2 * * 0', enabled: true },
  'dependency-update-audit': { schedule: '30 10 * * 1', enabled: true },
  'entity-lifecycle-manager': { schedule: '0 5 * * 0', enabled: true },
  'audit-sensitive-snapshot': { schedule: '15 3 * * 0', enabled: true },
  'enrichment-ab-review': { schedule: '0 10 * * 1', enabled: true },
};

const HOST_DETERMINISTIC_TASKS = new Set(Object.keys(HOST_DETERMINISTIC_JOB_META));

type CronJobRaw = {
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { expr?: string };
  payload?: { kind?: string; message?: string; model?: string; timeoutSeconds?: number };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
  };
};

function classifyJobType(job: CronJobRaw): 'runner-backed' | 'mixed' | 'model-backed' {
  const message = job.payload?.message ?? '';
  const kind = job.payload?.kind ?? '';
  const jobName = job.name ?? job.id ?? '';

  if (HOST_DETERMINISTIC_TASKS.has(jobName)) return 'runner-backed';

  const isRunnerBacked = /\bscripts\/cron_runner\.py\b/.test(message);
  if (isRunnerBacked) return 'runner-backed';

  const isSystemEvent = kind === 'systemEvent';
  const isCommandDrivenAgentTurn =
    kind === 'agentTurn' &&
    /(\bpython3\b|\bbash\b|\bnode\b|\bnpm\b|\bopenclaw\b|\bcd\s+\/)/.test(message) &&
    /(Run only this command|Run only these commands|Reply with NO_REPLY)/.test(message);

  if (isSystemEvent || isCommandDrivenAgentTurn) return 'mixed';

  return 'model-backed';
}

function getExecutionPath(job: CronJobRaw): 'host-deterministic' | 'openclaw-cron' | 'mixed' {
  const jobName = job.name ?? job.id ?? '';
  const kind = job.payload?.kind ?? '';

  if (HOST_DETERMINISTIC_TASKS.has(jobName)) return 'host-deterministic';
  if (kind === 'systemEvent') return 'mixed';
  return 'openclaw-cron';
}

function getSourceMeta(job: CronJobRaw): { sourceLabel: string; sourceNote: string } {
  const executionPath = getExecutionPath(job);

  if (executionPath === 'host-deterministic') {
    return {
      sourceLabel: 'Host deterministic scheduler',
      sourceNote: 'Runs via the host-managed deterministic scheduler service; recent run truth comes from cron-run-log.jsonl.',
    };
  }

  if (executionPath === 'mixed') {
    return {
      sourceLabel: 'OpenClaw system event',
      sourceNote: 'Scheduled by OpenClaw, but execution is routed through a system event rather than a model-backed cron turn.',
    };
  }

  return {
    sourceLabel: 'OpenClaw cron',
    sourceNote: 'Scheduled and triggered through the OpenClaw cron layer.',
  };
}

function toIso(ms?: number): string | null {
  if (!ms || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

type RunnerStatus = 'ok' | 'error' | 'warn' | 'skipped' | 'running' | 'unknown';

type RunnerLogEntry = {
  task?: string;
  status?: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  lock_acquired?: boolean;
  summary?: string;
};

function normalizeRunnerStatus(status: string | null | undefined): RunnerStatus {
  if (status === 'ok' || status === 'error' || status === 'warn' || status === 'skipped' || status === 'running') {
    return status;
  }
  return 'unknown';
}

async function getLatestRunnerRunsByTask(): Promise<Map<string, { lastRunAt: string | null; lastRunStatus: RunnerStatus }>> {
  const entries = await readJsonlFile(CRON_RUN_LOG_PATH, 400);
  const latestByTask = new Map<string, { lastRunAt: string | null; lastRunStatus: RunnerStatus }>();

  for (const entry of entries as RunnerLogEntry[]) {
    const task = typeof entry.task === 'string' ? entry.task : null;
    if (!task) continue;

    const lastRunAt = typeof entry.finished_at === 'string'
      ? entry.finished_at
      : typeof entry.started_at === 'string'
        ? entry.started_at
        : null;

    latestByTask.set(task, {
      lastRunAt,
      lastRunStatus: normalizeRunnerStatus(entry.status),
    });
  }

  return latestByTask;
}

export const getCronJobs = cache(async function getCronJobs(): Promise<CronJobsSummary> {
  try {
    const [data, runnerRunsByTask] = await Promise.all([
      runJsonCommand('openclaw cron list --json') as Promise<{ jobs?: CronJobRaw[] }>,
      getLatestRunnerRunsByTask(),
    ]);

    const jobs = (data.jobs ?? []).map((job) => {
      const type = classifyJobType(job);
      const executionPath = getExecutionPath(job);
      const jobName = job.name ?? job.id ?? 'unknown';
      const runnerState = type === 'runner-backed' ? runnerRunsByTask.get(jobName) : null;
      const sourceMeta = getSourceMeta(job);

      return {
        id: job.id ?? 'unknown',
        name: jobName,
        schedule: job.schedule?.expr ?? 'unknown',
        enabled: Boolean(job.enabled),
        type,
        executionPath,
        sourceLabel: sourceMeta.sourceLabel,
        sourceNote: sourceMeta.sourceNote,
        model: job.payload?.model ?? null,
        timeoutSeconds: job.payload?.timeoutSeconds ?? null,
        nextRunAt: toIso(job.state?.nextRunAtMs),
        lastRunAt: runnerState?.lastRunAt ?? toIso(job.state?.lastRunAtMs),
        lastRunStatus: runnerState?.lastRunStatus ?? job.state?.lastRunStatus ?? null,
      };
    });

    const seen = new Set(jobs.map((job) => job.name));

    for (const [jobName, meta] of Object.entries(HOST_DETERMINISTIC_JOB_META)) {
      if (seen.has(jobName)) continue;
      const runnerState = runnerRunsByTask.get(jobName) ?? null;
      jobs.push({
        id: `host-deterministic:${jobName}`,
        name: jobName,
        schedule: meta.schedule,
        enabled: meta.enabled,
        type: 'runner-backed',
        executionPath: 'host-deterministic',
        sourceLabel: 'Host deterministic scheduler',
        sourceNote: 'This job is owned by the host deterministic scheduler service and merged into Mission Control even when OpenClaw cron does not list it directly.',
        model: null,
        timeoutSeconds: null,
        nextRunAt: null,
        lastRunAt: runnerState?.lastRunAt ?? null,
        lastRunStatus: runnerState?.lastRunStatus ?? null,
      });
    }

    jobs.sort((a, b) => a.name.localeCompare(b.name));

    return {
      status: 'partial',
      jobs,
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'stub',
      jobs: [],
      refreshedAt: new Date().toISOString(),
    };
  }
});

export const getCronRuns = cache(async function getCronRuns(): Promise<CronRunsSummary> {
  try {
    const entries = await readJsonlFile(CRON_RUN_LOG_PATH, 240);
    const mapped = entries
      .map((entry, idx) => {
        const task = typeof entry.task === 'string' ? entry.task : null;
        const startedAt = typeof entry.started_at === 'string' ? entry.started_at : null;
        if (!task || !startedAt) return null;

        const status = typeof entry.status === 'string' ? entry.status : 'unknown';
        const state: 'success' | 'failed' | 'running' =
          status === 'error' ? 'failed' : status === 'ok' || status === 'warn' ? 'success' : 'running';

        return {
          id: `${task}:${startedAt}:${idx}`,
          jobId: task,
          state,
          startedAt,
          finishedAt: typeof entry.finished_at === 'string' ? entry.finished_at : null,
          durationMs: typeof entry.duration_ms === 'number' ? entry.duration_ms : null,
          source: 'runner-log' as const,
          lockAcquired: entry.lock_acquired === false ? false : true,
          summary: typeof entry.summary === 'string' ? entry.summary : null,
        };
      })
      .filter((run): run is NonNullable<typeof run> => Boolean(run))
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

    type ClusteredRun = (typeof mapped)[number] & {
      clusterCount: number;
      windowStartAt: string | null;
      windowEndAt: string | null;
      notes: string[];
    };

    const clustered: ClusteredRun[] = [];
    const clusterWindowMs = 90 * 1000;

    for (const run of mapped) {
      const previous = clustered[clustered.length - 1];
      if (previous && previous.jobId === run.jobId) {
        const prevStart = Date.parse(previous.windowStartAt ?? previous.startedAt);
        const prevEnd = Date.parse(previous.windowEndAt ?? previous.startedAt);
        const currentStart = Date.parse(run.startedAt);

        if (!Number.isNaN(prevStart) && !Number.isNaN(prevEnd) && !Number.isNaN(currentStart) && Math.abs(prevStart - currentStart) <= clusterWindowMs) {
          const notes = new Set(previous.notes ?? []);
          if ((previous.clusterCount ?? 1) >= 1 || true) notes.add('clustered');
          if (run.lockAcquired === false || previous.lockAcquired === false) notes.add('lock-skip present');
          if (run.state === 'failed' || previous.state === 'failed') notes.add('failure present');
          if (run.state === 'running' || previous.state === 'running') notes.add('running entry present');

          previous.clusterCount = (previous.clusterCount ?? 1) + 1;
          previous.windowStartAt = run.startedAt < (previous.windowStartAt ?? previous.startedAt) ? run.startedAt : (previous.windowStartAt ?? previous.startedAt);
          previous.windowEndAt = run.startedAt > (previous.windowEndAt ?? previous.startedAt) ? run.startedAt : (previous.windowEndAt ?? previous.startedAt);
          previous.durationMs = Math.max(previous.durationMs ?? 0, run.durationMs ?? 0) || previous.durationMs || run.durationMs;
          previous.notes = Array.from(notes);
          if (previous.state !== 'failed' && run.state === 'failed') previous.state = 'failed';
          else if (previous.state === 'success' && run.state === 'running') previous.state = 'running';
          continue;
        }
      }

      clustered.push({
        ...run,
        clusterCount: 1,
        windowStartAt: run.startedAt,
        windowEndAt: run.startedAt,
        notes: [],
      });
    }

    return {
      status: 'partial',
      runs: clustered,
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'stub',
      runs: [],
      refreshedAt: new Date().toISOString(),
    };
  }
});

export async function triggerCronRun(jobId: string | null): Promise<{ status: 'accepted'; message: string }> {
  return {
    status: 'accepted',
    message: `Run request accepted in scaffold mode${jobId ? ` for ${jobId}` : ''}. No scheduler mutation is performed yet.`,
  };
}
