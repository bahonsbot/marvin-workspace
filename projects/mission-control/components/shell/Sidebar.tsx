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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(now);
  }, [now]);

  const tempLabel = weather?.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : '—';
  const conditionLabel = formatCondition(weather?.condition ?? null);
  const icon = weatherIcon(weather?.condition ?? null);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(251, 248, 243, 0.94) 0%, rgba(243, 238, 230, 0.9) 100%)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(200, 195, 188, 0.42)',
        borderRadius: 'calc(var(--radius-lg) + 2px)',
        padding: '16px 16px 18px',
        boxShadow: '0 18px 38px rgba(16, 38, 31, 0.12), 0 6px 14px rgba(16, 38, 31, 0.08), inset 0 1px 0 rgba(255,255,255,0.62)',
        display: 'grid',
        gap: 14,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 'auto -24px -36px auto',
          width: 110,
          height: 110,
          background: 'radial-gradient(circle, rgba(121,166,148,0.22) 0%, rgba(121,166,148,0) 72%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'grid', gap: 4, position: 'relative' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
          Hoi An
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ fontSize: 22, color: 'var(--accent-mid)', lineHeight: 1 }}>{icon}</div>
          <div style={{ fontSize: 14, color: 'var(--text-body)', fontWeight: 600, lineHeight: 1.4 }}>
            {conditionLabel}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, position: 'relative' }}>
        <div style={{ fontSize: 46, lineHeight: 0.92, fontWeight: 500, letterSpacing: -1.2, color: 'var(--accent-deep)', fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {tempLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {dateLabel} · {timeLabel}
        </div>
      </div>
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
