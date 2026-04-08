import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { cache } from 'react';
import type {
  HomeMarketSignalsSummary,
  HomeQuickAccessItem,
  HomeSummary,
  HomeWorkspaceHealthSummary,
} from '@/lib/types/contracts';
import { getCronJobs } from '@/lib/adapters/cron';
import { getRecentActivity } from '@/lib/adapters/activity';
import { getSessions } from '@/lib/adapters/sessions';

const execFileAsync = promisify(execFile);

const SIGNALS_PATH = '/data/.openclaw/workspace/projects/market-intel/data/tracked_signals.json';
const TASKS_PATH = '/data/.openclaw/workspace/projects/mission-control/data/autonomous-tasks.json';
const CRON_RUN_LOG_PATH = '/data/.openclaw/workspace/memory/cron-run-log.jsonl';

function weatherCodeLabel(code: number | null | undefined) {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Heavy rain showers',
    82: 'Violent rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Heavy thunderstorm with hail',
  };
  return code === null || code === undefined ? 'Weather unavailable' : map[code] ?? 'Weather unavailable';
}

async function getWeather() {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=15.8801&longitude=108.3380&current=temperature_2m,weather_code&timezone=Asia%2FBangkok',
      { next: { revalidate: 900 } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const temperature = data?.current?.temperature_2m;
    const weatherCode = data?.current?.weather_code;
    return {
      location: 'Hoi An',
      temperatureC: typeof temperature === 'number' ? temperature : null,
      condition: weatherCodeLabel(typeof weatherCode === 'number' ? weatherCode : null),
    };
  } catch {
    return null;
  }
}

function getGreeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(now),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFocusLine(params: { activeSessions: number; dueCron: number; activityCount: number }) {
  const { activeSessions, dueCron, activityCount } = params;
  if (activeSessions > 0) return `${activeSessions} sessions are active. Stay close to the moving parts.`;
  if (dueCron > 0) return `${dueCron} cron jobs are due soon. Good moment for a quick systems check.`;
  if (activityCount > 0) return 'The board is quiet enough to plan the next deliberate move.';
  return 'Quiet surface, clean slate.';
}

type TrackedSignalRecord = {
  signal?: {
    confidence_level?: string;
    title?: string;
    timestamp?: string;
  };
  added_at?: string;
};

type AutonomousTaskStore = {
  tasks?: Array<{
    status?: string;
    updatedAt?: number;
    run?: {
      endedAt?: number;
    };
  }>;
};

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

async function readAutonomousTaskStore(): Promise<AutonomousTaskStore | null> {
  try {
    const raw = await fs.readFile(TASKS_PATH, 'utf8');
    return JSON.parse(raw) as AutonomousTaskStore;
  } catch {
    return null;
  }
}

async function getInProgressTaskCount(): Promise<number> {
  const store = await readAutonomousTaskStore();
  if (!store?.tasks) return 0;
  return store.tasks.filter((task) => task.status === 'in-progress').length;
}

export const getQuickAccessItems = cache(async function getQuickAccessItems(): Promise<HomeQuickAccessItem[]> {
  const activeTasks = await getInProgressTaskCount();

  return [
    { href: '/general/chat', icon: '💬', label: 'Chat' },
    { href: '/general/tasks', icon: '✅', label: 'Tasks', badge: activeTasks > 0 ? activeTasks : undefined },
    { href: '/general/agents', icon: '🧠', label: 'Agents' },
    { href: '/general/memory', icon: '🗂️', label: 'Memory' },
    { href: '/general/crons', icon: '⏱️', label: 'Crons' },
    { href: '/general/files', icon: '📁', label: 'Files' },
    { href: '/general/skills', icon: '🛠️', label: 'Skills' },
    { href: '/trading/signals', icon: '📈', label: 'Trading' },
  ];
});

export const getMarketSignalsSummary = cache(async function getMarketSignalsSummary(): Promise<HomeMarketSignalsSummary> {
  try {
    const raw = await fs.readFile(SIGNALS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { total: 0, strongBuy: 0, sell: 0, latestTitle: null, latestAt: null };
    }

    const signals = parsed as TrackedSignalRecord[];
    const total = signals.length;
    const strongBuy = signals.filter((item) => (item.signal?.confidence_level ?? '').toUpperCase() === 'STRONG BUY').length;
    const sell = signals.filter((item) => (item.signal?.confidence_level ?? '').toUpperCase() === 'SELL').length;

    const latest = signals
      .map((item) => ({
        title: typeof item.signal?.title === 'string' ? item.signal.title.trim() : null,
        at: toIsoTimestamp(item.signal?.timestamp ?? item.added_at),
      }))
      .filter((item) => item.at)
      .sort((a, b) => (a.at! < b.at! ? 1 : -1))[0];

    return {
      total,
      strongBuy,
      sell,
      latestTitle: latest?.title ?? null,
      latestAt: latest?.at ?? null,
    };
  } catch {
    return { total: 0, strongBuy: 0, sell: 0, latestTitle: null, latestAt: null };
  }
});

async function getQmdCollectionCount(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('bash', ['-lc', 'qmd collection list'], {
      timeout: 6000,
      maxBuffer: 1024 * 1024,
    });
    const match = stdout.match(/Collections\s*\((\d+)\)/i);
    if (!match) return null;
    const count = Number(match[1]);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

async function getLastCronRunAt(): Promise<string | null> {
  try {
    const raw = await fs.readFile(CRON_RUN_LOG_PATH, 'utf8');
    const lines = raw
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-120)
      .reverse();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as { started_at?: string; finished_at?: string };
        const at = toIsoTimestamp(entry.finished_at ?? entry.started_at);
        if (at) return at;
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function getLastAutonomousTaskAt(): Promise<string | null> {
  const store = await readAutonomousTaskStore();
  if (!store?.tasks || store.tasks.length === 0) return null;

  const timestamps = store.tasks
    .map((task) => toIsoTimestamp(task.run?.endedAt ?? task.updatedAt))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (a < b ? 1 : -1));

  return timestamps[0] ?? null;
}

export const getWorkspaceHealth = cache(async function getWorkspaceHealth(): Promise<HomeWorkspaceHealthSummary> {
  const [qmdCollections, lastCronRunAt, lastAutonomousTaskAt] = await Promise.all([
    getQmdCollectionCount(),
    getLastCronRunAt(),
    getLastAutonomousTaskAt(),
  ]);

  return {
    qmdCollections,
    lastCronRunAt,
    lastAutonomousTaskAt,
  };
});

export const getHomeSummary = cache(async function getHomeSummary(): Promise<HomeSummary> {
  const [sessionsData, cronData, activityData, weather, quickAccess, marketSignals, workspaceHealth] = await Promise.all([
    getSessions(),
    getCronJobs(),
    getRecentActivity(),
    getWeather(),
    getQuickAccessItems(),
    getMarketSignalsSummary(),
    getWorkspaceHealth(),
  ]);

  const sessions =
    sessionsData.status === 'partial'
      ? {
          active: sessionsData.sessions.filter((session) => session.state === 'running').length,
          totalVisible: sessionsData.sessions.length,
        }
      : null;

  const now = Date.now();
  const dueOrRunning = cronData.jobs.filter((job) => {
    if (job.lastRunStatus === 'running') return true;
    if (!job.nextRunAt) return false;
    const nextAt = new Date(job.nextRunAt).getTime();
    return Number.isFinite(nextAt) && nextAt <= now + 15 * 60 * 1000;
  }).length;

  const cron =
    cronData.status === 'partial'
      ? {
          dueOrRunning,
          jobsVisible: cronData.jobs.length,
        }
      : null;

  const status = sessions || cron || activityData.items.length > 0 ? 'partial' : 'stub';
  const statusLabel = status === 'stub' ? 'unavailable' : sessions && cron ? 'adapter-backed' : 'partial visibility';
  const currentDate = new Date();

  return {
    status,
    statusLabel,
    sessions,
    cron,
    activity: activityData.items.slice(0, 10).map((item) => ({ id: item.id, message: item.message, at: item.at })),
    quickAccess,
    marketSignals,
    workspaceHealth,
    ambient: {
      weather,
      greeting: getGreeting(currentDate),
      focusLine: getFocusLine({
        activeSessions: sessions?.active ?? 0,
        dueCron: cron?.dueOrRunning ?? 0,
        activityCount: activityData.items.length,
      }),
      quote: 'Useful before beautiful. Beautiful once useful.',
    },
    refreshedAt: new Date().toISOString(),
  };
});
