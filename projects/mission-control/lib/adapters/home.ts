import { cache } from 'react';
import type { HomeSummary } from '@/lib/types/contracts';
import { getCronJobs } from '@/lib/adapters/cron';
import { getRecentActivity } from '@/lib/adapters/activity';
import { getSessions } from '@/lib/adapters/sessions';

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

export const getHomeSummary = cache(async function getHomeSummary(): Promise<HomeSummary> {
  const [sessionsData, cronData, activityData, weather] = await Promise.all([
    getSessions(),
    getCronJobs(),
    getRecentActivity(),
    getWeather(),
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
