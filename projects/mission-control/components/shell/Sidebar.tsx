'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  GENERAL_NAV_ITEMS,
  TRADING_NAV_ITEMS,
  getShellDomain,
  isItemActive,
} from './navigation';

function weatherIcon(condition: string | null) {
  const text = (condition ?? '').toLowerCase();
  if (text.includes('thunder')) return '⛈';
  if (text.includes('rain') || text.includes('drizzle')) return '☔';
  if (text.includes('cloud') || text.includes('overcast') || text.includes('fog')) return '☁';
  if (text.includes('snow')) return '❄';
  return '☼';
}

function formatCondition(condition: string | null) {
  if (!condition) return 'Quiet skies';
  return condition;
}

type TimeSlotTheme = {
  background: string;
  accent: string;
  shadow: string;
  rim: string;
  text: string;
  subtext: string;
};

const TIME_SLOT_THEMES: Record<string, TimeSlotTheme> = {
  dawn: {
    background: 'linear-gradient(180deg, #f4ede6 0%, #f9f5f0 100%)',
    accent: 'rgba(188, 134, 113, 0.30)',
    shadow: 'rgba(188, 134, 113, 0.22)',
    rim: 'rgba(214, 194, 181, 0.72)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(73, 81, 78, 0.72)',
  },
  morning: {
    background: 'linear-gradient(180deg, #f9f5f0 0%, #f5f0eb 100%)',
    accent: 'rgba(140, 152, 92, 0.26)',
    shadow: 'rgba(148, 124, 64, 0.20)',
    rim: 'rgba(224, 214, 197, 0.78)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(72, 86, 76, 0.72)',
  },
  midday: {
    background: 'linear-gradient(180deg, #f5f0eb 0%, #f0ece6 100%)',
    accent: 'rgba(165, 156, 136, 0.22)',
    shadow: 'rgba(108, 120, 116, 0.16)',
    rim: 'rgba(220, 212, 201, 0.76)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(88, 92, 92, 0.72)',
  },
  afternoon: {
    background: 'linear-gradient(180deg, #f0ece6 0%, #eae6de 100%)',
    accent: 'rgba(156, 146, 128, 0.24)',
    shadow: 'rgba(95, 109, 103, 0.18)',
    rim: 'rgba(214, 205, 192, 0.78)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(83, 88, 87, 0.7)',
  },
  evening: {
    background: 'linear-gradient(180deg, #e8e0d8 0%, #ddd6cc 100%)',
    accent: 'rgba(171, 132, 92, 0.30)',
    shadow: 'rgba(121, 88, 58, 0.22)',
    rim: 'rgba(203, 190, 176, 0.78)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(89, 79, 72, 0.72)',
  },
  night: {
    background: 'linear-gradient(180deg, #ddd6cc 0%, #d4cdc4 100%)',
    accent: 'rgba(109, 133, 123, 0.28)',
    shadow: 'rgba(73, 96, 88, 0.24)',
    rim: 'rgba(191, 186, 178, 0.78)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(70, 83, 79, 0.74)',
  },
  lateNight: {
    background: 'linear-gradient(180deg, #d4cdc4 0%, #c8c2ba 100%)',
    accent: 'rgba(95, 111, 120, 0.28)',
    shadow: 'rgba(60, 78, 89, 0.24)',
    rim: 'rgba(178, 173, 166, 0.8)',
    text: 'var(--accent-deep)',
    subtext: 'rgba(68, 76, 82, 0.74)',
  },
};

function getTimeSlot(hour: number) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 23) return 'night';
  return 'lateNight';
}

function SidebarAmbientWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<{ temperatureC: number | null; condition: string | null } | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=15.8801&longitude=108.3380&current=temperature_2m,weather_code&timezone=Asia%2FBangkok',
          { cache: 'force-cache' },
        );
        if (!response.ok) return;
        const data = await response.json();
        const code = data?.current?.weather_code;
        const map: Record<number, string> = {
          0: 'Clear sky',
          1: 'Mostly clear',
          2: 'Partly cloudy',
          3: 'Overcast',
          45: 'Fog',
          48: 'Fog',
          51: 'Light drizzle',
          53: 'Drizzle',
          55: 'Dense drizzle',
          61: 'Light rain',
          63: 'Rain',
          65: 'Heavy rain',
          71: 'Light snow',
          73: 'Snow',
          75: 'Heavy snow',
          80: 'Rain showers',
          81: 'Heavy showers',
          82: 'Storm showers',
          95: 'Thunderstorm',
          96: 'Thunderstorm',
          99: 'Thunderstorm',
        };
        if (!cancelled) {
          setWeather({
            temperatureC: typeof data?.current?.temperature_2m === 'number' ? data.current.temperature_2m : null,
            condition: typeof code === 'number' ? map[code] ?? 'Quiet skies' : 'Quiet skies',
          });
        }
      } catch {
        // ignore and keep graceful fallback
      }
    }
    loadWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  const timeLabel = useMemo(() => {
    if (!now) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(now);
  }, [now]);

  const dateLabel = useMemo(() => {
    if (!now) return '—';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(now);
  }, [now]);

  const theme = useMemo(() => {
    if (!now) return TIME_SLOT_THEMES.morning;
    const hourInHcm = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(now),
    );
    return TIME_SLOT_THEMES[getTimeSlot(hourInHcm)] ?? TIME_SLOT_THEMES.morning;
  }, [now]);

  const tempLabel = weather?.temperatureC != null ? `${Math.round(weather.temperatureC)}°` : '—';
  const conditionLabel = formatCondition(weather?.condition ?? null);
  const icon = weatherIcon(weather?.condition ?? null);

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        gap: 8,
        padding: '0 2px 6px',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: theme.subtext,
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        Hoi An, Vietnam
      </div>
      <div
        style={{
          position: 'relative',
          width: 112,
          height: 112,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.accent} 0%, rgba(255,255,255,0.06) 48%, transparent 72%)`,
            filter: 'blur(16px)',
            opacity: 0.9,
            animation: 'sidebarAmbientHalo 4s ease-in-out infinite',
            transition: 'background 2s ease',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 7,
            borderRadius: '50%',
            border: `1px solid ${theme.rim}`,
            opacity: 0.8,
            transform: 'scale(1.04)',
            transition: 'border-color 2s ease, opacity 2s ease',
          }}
        />
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            display: 'grid',
            justifyItems: 'center',
            alignContent: 'center',
            gap: 4,
            position: 'relative',
            overflow: 'hidden',
            background: theme.background,
            border: `1px solid ${theme.rim}`,
            backdropFilter: 'blur(18px)',
            boxShadow: `0 18px 38px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.34) inset, 0 10px 24px rgba(255,255,255,0.12) inset`,
            transition: 'background 2s ease, box-shadow 2s ease, border-color 2s ease',
            animation: 'sidebarAmbientOrbFloat 4s ease-in-out infinite, sidebarAmbientOrbShadow 4s ease-in-out infinite',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 34%, rgba(255,255,255,0.02) 100%)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 9,
              borderRadius: '50%',
              background: `radial-gradient(circle at 34% 26%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.22) 26%, transparent 58%)`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -18,
              left: -34,
              width: 64,
              height: 132,
              transform: 'rotate(22deg)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 48%, rgba(255,255,255,0) 100%)',
              opacity: 0.55,
              filter: 'blur(2px)',
              pointerEvents: 'none',
              animation: 'sidebarAmbientShimmer 7s ease-in-out infinite',
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              position: 'relative',
              textShadow: '0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            {timeLabel}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--font-sans)',
              position: 'relative',
              opacity: 0.92,
            }}
          >
            {tempLabel}
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 4,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 18,
            padding: '4px 9px',
            borderRadius: 999,
            fontSize: 10.5,
            lineHeight: 1.1,
            color: theme.subtext,
            background: 'rgba(255,255,255,0.38)',
            border: '1px solid rgba(255,255,255,0.42)',
            backdropFilter: 'blur(12px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)',
            maxWidth: 150,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--accent-mid)' }}>{icon}</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conditionLabel}</span>
        </div>
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.2,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: theme.subtext,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dateLabel}
        </div>
      </div>
      <style jsx>{`
        @keyframes sidebarAmbientOrbFloat {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-2px) scale(1.015);
          }
        }

        @keyframes sidebarAmbientOrbShadow {
          0%, 100% {
            box-shadow: 0 18px 38px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.34) inset, 0 10px 24px rgba(255,255,255,0.12) inset;
          }
          50% {
            box-shadow: 0 22px 46px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.38) inset, 0 12px 28px rgba(255,255,255,0.18) inset;
          }
        }

        @keyframes sidebarAmbientHalo {
          0%, 100% {
            opacity: 0.52;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.06);
          }
        }

        @keyframes sidebarAmbientShimmer {
          0%, 100% {
            transform: translateX(-8px) rotate(22deg);
            opacity: 0.12;
          }
          50% {
            transform: translateX(34px) rotate(22deg);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const domain = getShellDomain(pathname);
  const navItems = domain === 'trading' ? TRADING_NAV_ITEMS : GENERAL_NAV_ITEMS;

  return (
    <aside
      style={{
        position: 'sticky',
        top: 52, // below top tab bar
        height: 'calc(100vh - 52px)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        gap: 4,
        overflowY: 'auto',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}
        >
          {domain === 'trading' ? 'Trading Domain' : 'General Domain'}
        </div>
      </div>

      {navItems.map((item) => {
        const isActive = isItemActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent-surface)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent-mid)' : '3px solid transparent',
              border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
              transition: 'all 0.15s ease',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      <div style={{ flex: 1 }} />
      <SidebarAmbientWidget />
    </aside>
  );
}
