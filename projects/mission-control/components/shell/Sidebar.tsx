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
  horizon: string;
  celestialCore: string;
  celestialGlow: string;
  sceneMode: 'sun' | 'moon';
  starsOpacity: number;
};

const TIME_SLOT_THEMES: Record<string, TimeSlotTheme> = {
  dawn: {
    background: 'linear-gradient(180deg, #1f355f 0%, #5f6ca6 38%, #f3b47d 72%, #f7e6c6 100%)',
    accent: 'rgba(255, 183, 122, 0.42)',
    shadow: 'rgba(95, 94, 190, 0.32)',
    rim: 'rgba(255, 231, 204, 0.56)',
    text: '#fffaf2',
    subtext: 'rgba(107, 90, 74, 0.84)',
    horizon: 'linear-gradient(180deg, rgba(255,189,126,0) 0%, rgba(255,182,118,0.16) 52%, rgba(255,212,166,0.52) 100%)',
    celestialCore: '#ffd993',
    celestialGlow: 'rgba(255, 196, 116, 0.55)',
    sceneMode: 'sun',
    starsOpacity: 0.38,
  },
  morning: {
    background: 'linear-gradient(180deg, #87b7ff 0%, #9fd2ff 42%, #d7efff 100%)',
    accent: 'rgba(126, 196, 255, 0.36)',
    shadow: 'rgba(86, 152, 214, 0.26)',
    rim: 'rgba(240, 250, 255, 0.62)',
    text: '#fffefb',
    subtext: 'rgba(74, 89, 112, 0.84)',
    horizon: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,243,212,0.14) 58%, rgba(255,241,205,0.34) 100%)',
    celestialCore: '#ffd86f',
    celestialGlow: 'rgba(255, 216, 111, 0.54)',
    sceneMode: 'sun',
    starsOpacity: 0,
  },
  midday: {
    background: 'linear-gradient(180deg, #66b7ff 0%, #9fe1ff 48%, #def7ff 100%)',
    accent: 'rgba(111, 202, 255, 0.38)',
    shadow: 'rgba(69, 144, 224, 0.24)',
    rim: 'rgba(239, 251, 255, 0.66)',
    text: '#fffefb',
    subtext: 'rgba(72, 98, 118, 0.84)',
    horizon: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,249,226,0.08) 60%, rgba(255,247,222,0.24) 100%)',
    celestialCore: '#ffe36f',
    celestialGlow: 'rgba(255, 227, 111, 0.58)',
    sceneMode: 'sun',
    starsOpacity: 0,
  },
  afternoon: {
    background: 'linear-gradient(180deg, #58a8f1 0%, #89c7ff 44%, #f3d7aa 100%)',
    accent: 'rgba(115, 182, 255, 0.36)',
    shadow: 'rgba(81, 130, 195, 0.24)',
    rim: 'rgba(241, 236, 224, 0.58)',
    text: '#fffefb',
    subtext: 'rgba(99, 87, 77, 0.82)',
    horizon: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,209,153,0.12) 58%, rgba(243,186,117,0.36) 100%)',
    celestialCore: '#ffd36b',
    celestialGlow: 'rgba(255, 211, 107, 0.5)',
    sceneMode: 'sun',
    starsOpacity: 0,
  },
  evening: {
    background: 'linear-gradient(180deg, #334b86 0%, #8263a8 40%, #ef9a68 74%, #f6d5ae 100%)',
    accent: 'rgba(235, 147, 104, 0.42)',
    shadow: 'rgba(104, 74, 150, 0.3)',
    rim: 'rgba(248, 214, 191, 0.56)',
    text: '#fff9f0',
    subtext: 'rgba(107, 82, 67, 0.84)',
    horizon: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,170,109,0.12) 58%, rgba(247,174,112,0.46) 100%)',
    celestialCore: '#ffbf68',
    celestialGlow: 'rgba(255, 161, 90, 0.58)',
    sceneMode: 'sun',
    starsOpacity: 0.22,
  },
  night: {
    background: 'linear-gradient(180deg, #07152e 0%, #132b5b 42%, #26437a 100%)',
    accent: 'rgba(106, 156, 255, 0.34)',
    shadow: 'rgba(20, 37, 78, 0.42)',
    rim: 'rgba(163, 198, 255, 0.34)',
    text: '#f5f9ff',
    subtext: 'rgba(189, 208, 240, 0.82)',
    horizon: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(77,114,189,0.08) 54%, rgba(52,86,156,0.32) 100%)',
    celestialCore: '#f2f7ff',
    celestialGlow: 'rgba(183, 214, 255, 0.46)',
    sceneMode: 'moon',
    starsOpacity: 0.92,
  },
  lateNight: {
    background: 'linear-gradient(180deg, #030d1f 0%, #102447 42%, #18386b 100%)',
    accent: 'rgba(95, 132, 220, 0.34)',
    shadow: 'rgba(11, 25, 52, 0.48)',
    rim: 'rgba(149, 180, 238, 0.3)',
    text: '#f4f8ff',
    subtext: 'rgba(185, 204, 236, 0.8)',
    horizon: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(55,84,140,0.06) 54%, rgba(35,62,113,0.32) 100%)',
    celestialCore: '#f7fbff',
    celestialGlow: 'rgba(164, 195, 255, 0.42)',
    sceneMode: 'moon',
    starsOpacity: 1,
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
          width: 122,
          height: 122,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.accent} 0%, rgba(255,255,255,0.05) 42%, transparent 72%)`,
            filter: 'blur(18px)',
            opacity: 0.95,
            animation: 'sidebarAmbientHalo 4s ease-in-out infinite',
            transition: 'background 2s ease',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: `1px solid ${theme.rim}`,
            opacity: 0.42,
            transform: 'scale(1.05)',
            transition: 'border-color 2s ease, opacity 2s ease',
          }}
        />
        <div
          style={{
            width: 102,
            height: 102,
            borderRadius: '50%',
            display: 'grid',
            justifyItems: 'center',
            alignContent: 'center',
            gap: 4,
            position: 'relative',
            overflow: 'hidden',
            background: theme.background,
            border: `1px solid ${theme.rim}`,
            boxShadow: `0 22px 46px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.14) inset`,
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
              background: theme.horizon,
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 44%, rgba(0,0,0,0.08) 100%)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              opacity: theme.starsOpacity,
              transition: 'opacity 2s ease',
              pointerEvents: 'none',
            }}
          >
            {[
              { top: '18%', left: '24%', size: 2.2, delay: '0s' },
              { top: '26%', left: '68%', size: 1.8, delay: '1.3s' },
              { top: '38%', left: '18%', size: 1.7, delay: '0.7s' },
              { top: '22%', left: '52%', size: 2.4, delay: '2.1s' },
              { top: '46%', left: '76%', size: 1.6, delay: '1.7s' },
              { top: '56%', left: '26%', size: 1.5, delay: '2.8s' },
            ].map((star, index) => (
              <span
                key={index}
                style={{
                  position: 'absolute',
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)',
                  boxShadow: '0 0 6px rgba(255,255,255,0.9)',
                  animation: `sidebarAmbientStarTwinkle 3.8s ease-in-out ${star.delay} infinite`,
                }}
              />
            ))}
          </div>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: theme.sceneMode === 'moon' ? 20 : 22,
              right: theme.sceneMode === 'moon' ? 22 : 24,
              width: theme.sceneMode === 'moon' ? 24 : 28,
              height: theme.sceneMode === 'moon' ? 24 : 28,
              borderRadius: '50%',
              background: theme.celestialCore,
              boxShadow: `0 0 0 8px ${theme.celestialGlow}, 0 0 22px ${theme.celestialGlow}`,
              transition: 'all 2s ease',
              animation: theme.sceneMode === 'moon' ? 'sidebarAmbientMoonDrift 10s ease-in-out infinite' : 'sidebarAmbientSunGlow 5s ease-in-out infinite',
            }}
          >
            {theme.sceneMode === 'moon' ? (
              <span
                style={{
                  position: 'absolute',
                  top: -1,
                  left: 8,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: theme.background,
                  opacity: 0.95,
                }}
              />
            ) : null}
          </div>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: 18,
              left: 16,
              width: 72,
              height: 20,
              borderRadius: 999,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 100%)',
              filter: 'blur(10px)',
              opacity: theme.sceneMode === 'moon' ? 0.18 : 0.3,
              transform: 'rotate(-6deg)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '33%',
              background: theme.sceneMode === 'moon'
                ? 'linear-gradient(180deg, rgba(17,34,68,0.1) 0%, rgba(8,22,47,0.92) 100%)'
                : 'linear-gradient(180deg, rgba(222,169,110,0.08) 0%, rgba(133,92,60,0.92) 100%)',
              clipPath: 'ellipse(70% 78% at 50% 100%)',
              pointerEvents: 'none',
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
              textShadow: theme.sceneMode === 'moon' ? '0 1px 10px rgba(0,0,0,0.28)' : '0 1px 10px rgba(255,179,91,0.18)',
              zIndex: 1,
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
              opacity: 0.96,
              zIndex: 1,
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
            box-shadow: 0 22px 46px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.14) inset;
          }
          50% {
            box-shadow: 0 28px 58px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.2) inset;
          }
        }

        @keyframes sidebarAmbientHalo {
          0%, 100% {
            opacity: 0.56;
            transform: scale(0.98);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @keyframes sidebarAmbientStarTwinkle {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }

        @keyframes sidebarAmbientMoonDrift {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(-2px, 1px, 0);
          }
        }

        @keyframes sidebarAmbientSunGlow {
          0%, 100% {
            transform: scale(1);
            filter: saturate(1);
          }
          50% {
            transform: scale(1.06);
            filter: saturate(1.08);
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
