import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';
import { cache } from 'react';
import type {
  HomeCustomNewsSummary,
  HomeMarketSignalsSummary,
  HomeMarketWatchHeadline,
  HomeMarketWatchSummary,
  HomeQuickAccessItem,
  HomeSummary,
  HomeSystemMetricsSummary,
  HomeWorkspaceHealthSummary,
} from '@/lib/types/contracts';
import { getCronJobs } from '@/lib/adapters/cron';
import { getRecentActivity } from '@/lib/adapters/activity';
import { getSessions } from '@/lib/adapters/sessions';

const execFileAsync = promisify(execFile);

const SIGNALS_PATH = '/data/.openclaw/workspace/projects/market-intel/data/tracked_signals.json';
const TASKS_PATH = '/data/.openclaw/workspace/projects/mission-control/data/autonomous-tasks.json';
const CRON_RUN_LOG_PATH = '/data/.openclaw/workspace/memory/cron-run-log.jsonl';
const HOME_RSS_SOURCES = [
  '/data/.openclaw/workspace/projects/market-intel/data/news_alerts.json',
  '/data/.openclaw/workspace/projects/market-intel/data/rss_alerts.json',
] as const;
const CUSTOM_NEWS_PATH = '/data/.openclaw/workspace/projects/mission-control/data/custom-news-briefings.json';
const HOME_QUOTES = [
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'The details are not the details. They make the design.', author: 'Charles Eames' },
  { text: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Make it simple, but significant.', author: 'Don Draper' },
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'What we do every day matters more than what we do once in a while.', author: 'Gretchen Rubin' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
  { text: 'Luck is what happens when preparation meets opportunity.', author: 'Seneca' },
  { text: 'Quality means doing it right when no one is looking.', author: 'Henry Ford' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'To improve is to change; to be perfect is to change often.', author: 'Winston Churchill' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'If I had more time, I would have written a shorter letter.', author: 'Blaise Pascal' },
  { text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', author: 'Stephen King' },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  { text: 'First solve the problem. Then write the code.', author: 'John Johnson' },
  { text: 'Nothing is particularly hard if you divide it into small jobs.', author: 'Henry Ford' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
  { text: 'Focus is saying no to the hundred other good ideas.', author: 'Steve Jobs' },
  { text: 'Do less, then obsess.', author: 'Twyla Tharp' },
] as const;

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

type RawRssAlert = {
  feed?: string;
  title?: string;
  link?: string;
  source_type?: string;
  timestamp?: string;
  published?: string;
};

type RssSourceCandidate = {
  path: string;
  headlines: HomeMarketWatchHeadline[];
  latestAt: string | null;
  usableCount: number;
};

function getDailyQuote(now = new Date()): { text: string; author: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1');
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '1');
  const utcDayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return HOME_QUOTES[utcDayNumber % HOME_QUOTES.length] ?? HOME_QUOTES[0];
}

function normalizeRssItems(parsed: unknown): RawRssAlert[] {
  if (Array.isArray(parsed)) return parsed as RawRssAlert[];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { alerts?: unknown }).alerts)) {
    return (parsed as { alerts: RawRssAlert[] }).alerts;
  }
  return [];
}

function toHeadlineRecord(item: RawRssAlert, index: number, dedupe: Set<string>): HomeMarketWatchHeadline | null {
  if (typeof item.title !== 'string') return null;
  const title = item.title.trim();
  if (!title) return null;

  const sourceType = typeof item.source_type === 'string' ? item.source_type.toLowerCase() : 'rss';
  if (sourceType && sourceType !== 'rss') return null;

  const dedupeKey = title.toLowerCase();
  if (dedupe.has(dedupeKey)) return null;
  dedupe.add(dedupeKey);

  return {
    id: `${dedupeKey}-${index}`,
    title,
    source: typeof item.feed === 'string' && item.feed.trim() ? item.feed.trim() : 'RSS feed',
    link: typeof item.link === 'string' && item.link.trim() ? item.link.trim() : null,
    at: toIsoTimestamp(item.timestamp) ?? toIsoTimestamp(item.published),
  };
}

async function readRssSource(path: string): Promise<RssSourceCandidate | null> {
  try {
    const [raw, stat] = await Promise.all([fs.readFile(path, 'utf8'), fs.stat(path)]);
    const parsed = JSON.parse(raw) as unknown;
    const items = normalizeRssItems(parsed);
    const dedupe = new Set<string>();

    const headlines = items
      .map((item, index) => toHeadlineRecord(item, index, dedupe))
      .filter((item): item is HomeMarketWatchHeadline => Boolean(item))
      .sort((a, b) => (a.at ?? '') < (b.at ?? '') ? 1 : -1)
      .slice(0, 30);

    const latestFromHeadlines = headlines[0]?.at ?? null;
    const latestAt = latestFromHeadlines ?? stat.mtime.toISOString();

    return {
      path,
      headlines,
      latestAt,
      usableCount: headlines.length,
    };
  } catch {
    return null;
  }
}

const getMarketWatchSummary = cache(async function getMarketWatchSummary(): Promise<HomeMarketWatchSummary> {
  const candidates = (await Promise.all(HOME_RSS_SOURCES.map((sourcePath) => readRssSource(sourcePath)))).filter(
    (item): item is RssSourceCandidate => Boolean(item),
  );

  if (candidates.length === 0) {
    return {
      headlines: [],
      sourcePath: null,
      updatedAt: null,
      selectionNote: 'No local RSS source was readable.',
    };
  }

  const freshestOverall = [...candidates].sort((a, b) => (a.latestAt ?? '') < (b.latestAt ?? '') ? 1 : -1)[0];
  const usableByFreshness = [...candidates]
    .filter((candidate) => candidate.usableCount > 0)
    .sort((a, b) => (a.latestAt ?? '') < (b.latestAt ?? '') ? 1 : -1);

  const selected = usableByFreshness[0] ?? null;

  if (!selected) {
    return {
      headlines: [],
      sourcePath: freshestOverall.path,
      updatedAt: freshestOverall.latestAt,
      selectionNote: 'Freshest source had no usable RSS headlines.',
    };
  }

  const selectionNote =
    freshestOverall.usableCount === 0 && freshestOverall.path !== selected.path
      ? `Freshest source (${freshestOverall.path}) had 0 usable RSS headlines, so fallback used ${selected.path}.`
      : null;

  return {
    headlines: selected.headlines.slice(0, 30),
    sourcePath: selected.path,
    updatedAt: selected.latestAt,
    selectionNote,
  };
});

type RawCustomNewsDigest = {
  generatedAt?: string;
  windowHours?: number;
  items?: Array<{
    id?: string;
    headline?: string;
    sources?: unknown;
    whatHappened?: string;
    whyItMatters?: string;
    differingViews?: string | null;
    links?: Array<{ title?: string; url?: string }>;
    publishedAt?: string;
  }>;
};

const getCustomNewsSummary = cache(async function getCustomNewsSummary(): Promise<HomeCustomNewsSummary> {
  try {
    const raw = await fs.readFile(CUSTOM_NEWS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as RawCustomNewsDigest;

    const items = (parsed.items ?? [])
      .map((item, index) => {
        const headline = typeof item.headline === 'string' ? item.headline.trim() : '';
        if (!headline) return null;

        const sources = Array.isArray(item.sources)
          ? item.sources.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          : [];

        const links = Array.isArray(item.links)
          ? item.links
              .map((link) => {
                const title = typeof link?.title === 'string' ? link.title.trim() : '';
                const url = typeof link?.url === 'string' ? link.url.trim() : '';
                if (!title || !url) return null;
                return { title, url };
              })
              .filter((entry): entry is { title: string; url: string } => Boolean(entry))
              .slice(0, 2)
          : [];

        return {
          id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `custom-news-${index + 1}`,
          headline,
          sources,
          whatHappened: typeof item.whatHappened === 'string' && item.whatHappened.trim() ? item.whatHappened.trim() : 'No summary available.',
          whyItMatters: typeof item.whyItMatters === 'string' && item.whyItMatters.trim() ? item.whyItMatters.trim() : 'No impact summary available.',
          differingViews: typeof item.differingViews === 'string' && item.differingViews.trim() ? item.differingViews.trim() : null,
          links,
          publishedAt: toIsoTimestamp(item.publishedAt),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 30);

    return {
      items,
      updatedAt: toIsoTimestamp(parsed.generatedAt) ?? null,
      windowHours: typeof parsed.windowHours === 'number' && parsed.windowHours > 0 ? parsed.windowHours : 24,
      sourcePath: CUSTOM_NEWS_PATH,
    };
  } catch {
    return {
      items: [],
      updatedAt: null,
      windowHours: 24,
      sourcePath: CUSTOM_NEWS_PATH,
    };
  }
});

const getSystemMetrics = cache(async function getSystemMetrics(): Promise<HomeSystemMetricsSummary> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem > 0 ? totalMem - freeMem : null;
  const ramUsedPercent = usedMem !== null && totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : null;

  let diskUsedPercent: number | null = null;
  try {
    const stat = await fs.statfs('/data/.openclaw/workspace');
    const total = Number(stat.blocks) * Number(stat.bsize);
    const available = Number(stat.bavail) * Number(stat.bsize);
    if (Number.isFinite(total) && total > 0 && Number.isFinite(available)) {
      diskUsedPercent = Math.max(0, Math.min(100, Math.round(((total - available) / total) * 100)));
    }
  } catch {
    diskUsedPercent = null;
  }

  const loadAverage1m = Number.isFinite(os.loadavg()[0]) ? Number(os.loadavg()[0].toFixed(2)) : null;
  const uptimeSeconds = Number.isFinite(os.uptime()) ? Math.floor(os.uptime()) : null;

  return {
    ramUsedPercent,
    diskUsedPercent,
    loadAverage1m,
    uptimeSeconds,
  };
});

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
  const [sessionsData, cronData, activityData, weather, quickAccess, marketSignals, workspaceHealth, marketWatch, customNews, system] =
    await Promise.all([
      getSessions(),
      getCronJobs(),
      getRecentActivity(),
      getWeather(),
      getQuickAccessItems(),
      getMarketSignalsSummary(),
      getWorkspaceHealth(),
      getMarketWatchSummary(),
      getCustomNewsSummary(),
      getSystemMetrics(),
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
    marketWatch,
    customNews,
    system,
    ambient: {
      weather,
      greeting: getGreeting(currentDate),
      focusLine: getFocusLine({
        activeSessions: sessions?.active ?? 0,
        dueCron: cron?.dueOrRunning ?? 0,
        activityCount: activityData.items.length,
      }),
      quote: getDailyQuote(currentDate),
    },
    refreshedAt: new Date().toISOString(),
  };
});
