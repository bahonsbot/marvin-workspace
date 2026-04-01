import Link from 'next/link';
import { getHomeSummary } from '@/lib/adapters/home';

function cardStyle() {
  return {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(200, 195, 188, 0.4)',
    borderRadius: 24,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  } as const;
}

function cardInnerStyle() {
  return {
    background: 'rgba(255, 255, 255, 0.52)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(200, 195, 188, 0.4)',
    borderRadius: 14,
  } as const;
}

function formatRelative(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function formatFullTime() {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

function statusTone(statusLabel: string) {
  if (statusLabel === 'adapter-backed') return { color: '#fffdfb', bg: '#0f1f19', border: '#1a3d32', dot: '#79a694' };
  if (statusLabel === 'partial visibility') return { color: '#fffdfb', bg: '#1a3d32', border: '#3c6658', dot: '#a3d0be' };
  return { color: '#fffdfb', bg: '#3c6658', border: '#79a694', dot: '#c4823a' };
}

function weatherIcon(condition: string | undefined) {
  const value = (condition ?? '').toLowerCase();
  if (value.includes('thunder')) return '⛈️';
  if (value.includes('rain') || value.includes('drizzle')) return '🌧️';
  if (value.includes('snow')) return '❄️';
  if (value.includes('fog')) return '🌫️';
  if (value.includes('cloud') || value.includes('overcast')) return '⛅';
  return '☀️';
}

function AccentInfoCard({ icon, label, title, detail }: { icon: string; label: string; title: string; detail: string }) {
  return (
    <div style={{ ...cardInnerStyle(), padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, color: 'var(--text)' }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55 }}>{detail}</div>
    </div>
  );
}

function SignalPlaceholder({ title, body, accent, accentGlow }: { title: string; body: string; accent: string; accentGlow: string }) {
  return (
    <div style={{ ...cardStyle(), padding: 20, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent, boxShadow: `0 0 14px ${accentGlow}88` }} />
      </div>
      <div style={{ height: 138, borderRadius: 16, background: `linear-gradient(180deg, ${accent}14 0%, rgba(250, 248, 245, 0.6) 100%)`, border: '1px solid rgba(200, 195, 188, 0.4)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(180deg, transparent, transparent 16px, rgba(200, 195, 188, 0.25) 16px, rgba(200, 195, 188, 0.25) 17px)' }} />
        <svg viewBox="0 0 220 138" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'relative', zIndex: 1 }}>
          <polyline fill="none" stroke={accent} strokeWidth="3" points="0,100 28,94 56,72 84,78 112,52 140,60 168,40 196,48 220,26" />
        </svg>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

export default async function HomePage() {
  const summary = await getHomeSummary();
  const attentionItems: string[] = [];

  if (!summary.sessions) attentionItems.push('Session data unavailable.');
  if (!summary.cron) attentionItems.push('Cron data unavailable.');
  if ((summary.cron?.dueOrRunning ?? 0) > 0) attentionItems.push(`${summary.cron?.dueOrRunning} cron jobs are due or currently running.`);
  if (summary.activity.length === 0) attentionItems.push('Recent activity feed is quiet or unavailable.');

  const tone = statusTone(summary.statusLabel);
  const weather = summary.ambient.weather;

  return (
    <section style={{ display: 'grid', gap: 20, background: 'var(--bg)', minHeight: '100vh', padding: 24 }}>
      {/* Greeting Banner */}
      <div
        style={{
          ...cardStyle(),
          padding: 28,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.82) 0%, rgba(250, 248, 245, 0.88) 100%)',
        }}
      >
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>Mission Control</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone.dot }} />
              {summary.statusLabel}
            </div>
          </div>

          {/* Greeting */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, color: 'var(--text)' }}>{summary.ambient.greeting}, Philippe.</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{summary.ambient.focusLine}</div>
          </div>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/general/chat"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 180,
                padding: '12px 20px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #0f1f19 0%, #1a3d32 100%)',
                color: '#fffdfb',
                fontWeight: 700,
                fontSize: 14,
                boxShadow: '0 4px 16px rgba(15, 31, 25, 0.25)',
              }}
            >
              Open Chat
            </Link>
            <Link
              href="/general/agents"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 150,
                padding: '12px 20px',
                borderRadius: 16,
                border: '1px solid rgba(200, 195, 188, 0.5)',
                background: 'rgba(255, 255, 255, 0.6)',
                color: 'var(--text-body)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              View agents
            </Link>
          </div>

          {/* Info cards row */}
          <div className="general-home-top-cards">
            <AccentInfoCard icon="🕒" label="Local time" title={formatFullTime()} detail="Asia/Ho_Chi_Minh" />
            <AccentInfoCard
              icon={weatherIcon(weather?.condition)}
              label="Weather"
              title={weather ? `${weather.temperatureC ?? '—'}°C · ${weather.location}` : 'Weather unavailable'}
              detail={weather ? weather.condition : 'Open-Meteo unavailable right now'}
            />
            <AccentInfoCard icon="✍️" label="Today&apos;s note" title={summary.ambient.quote} detail="A small anchor for the mood of the workspace." />
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="general-home-main-grid">
        {/* Left column */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Session + Cron Overview */}
          <div style={{ ...cardStyle(), padding: 24, display: 'grid', gap: 14 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>Right now</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ ...cardInnerStyle(), padding: 16, display: 'grid', gap: 6 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Active sessions</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{summary.sessions?.active ?? '—'}</div>
              </div>
              <div style={{ ...cardInnerStyle(), padding: 16, display: 'grid', gap: 6 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Cron pressure</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{summary.cron?.dueOrRunning ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Signal Radar Cards */}
          <div className="general-home-signal-grid">
            <SignalPlaceholder
              title="System rhythm"
              body="Placeholder for a future useful trend view: sessions, cron pressure, or combined operational pulse."
              accent="#3c6658"
              accentGlow="rgba(60, 102, 88)"
            />
            <SignalPlaceholder
              title="Work momentum"
              body="Placeholder for a future chart tying recent activity, board movement, and useful output into one readable signal."
              accent="#79a694"
              accentGlow="rgba(121, 166, 148)"
            />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Attention */}
          <div style={{ ...cardStyle(), padding: 24, display: 'grid', gap: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Attention</h3>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>What deserves your eye first.</p>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {attentionItems.map((item) => (
                <div key={item} style={{ ...cardInnerStyle(), padding: 14, display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-body)' }}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ ...cardStyle(), padding: 24, display: 'grid', gap: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Recent activity</h3>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Latest movement from the real workspace.</p>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {summary.activity.slice(0, 6).map((item) => (
                <div key={item.id} style={{ ...cardInnerStyle(), padding: 14, display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6, color: 'var(--text-body)' }}>{item.message}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatRelative(item.at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
