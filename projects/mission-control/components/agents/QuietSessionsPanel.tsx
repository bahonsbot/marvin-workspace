import { floatingInsetStyle } from '@/components/shared/floating';
import type { QuietSessionPayload } from '@/lib/agents/definitions';

function stateLabel(state: QuietSessionPayload['state']) {
  if (state === 'running') return 'Running';
  if (state === 'idle') return 'Idle';
  return 'Unknown';
}

function formatLastActive(value?: string | null) {
  if (!value) return 'No recent signal';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export function QuietSessionsPanel({ sessions }: { sessions: QuietSessionPayload[] }) {
  return (
    <details
      style={{
        borderRadius: 24,
        border: '1px solid rgba(190, 188, 181, 0.38)',
        background: 'linear-gradient(180deg, rgba(246, 241, 233, 0.72) 0%, rgba(255,255,255,0.56) 100%)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          color: '#274238',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 14, letterSpacing: '-0.01em' }}>Internal activity</strong>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Background helper, cron, and system lanes. Useful for ops context, not the main story.</span>
        </div>
        <span
          style={{
            ...floatingInsetStyle({ padding: '8px 10px', radius: 999, background: 'rgba(255,255,255,0.58)' }),
            fontSize: 12,
            fontWeight: 700,
            color: '#47655c',
            whiteSpace: 'nowrap',
          }}
        >
          {sessions.length} visible
        </span>
      </summary>

      <div style={{ display: 'grid', gap: 10, padding: '0 18px 18px' }}>
        {sessions.length === 0 ? (
          <div style={{ ...floatingInsetStyle({ padding: 14, radius: 18, background: 'rgba(255,255,255,0.55)' }), fontSize: 13, color: 'var(--text-muted)' }}>
            No unmatched cron, system, or helper sessions are visible right now.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              style={{
                ...floatingInsetStyle({ padding: '12px 14px', radius: 18, background: 'rgba(255,255,255,0.55)' }),
                display: 'grid',
                gap: 6,
                opacity: 0.9,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14, color: '#244137' }}>{session.label || 'internal session'}</strong>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#61716b' }}>
                  {stateLabel(session.state)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {session.kind ?? 'unknown kind'} · {session.model ?? 'model unknown'} · {formatLastActive(session.lastActiveAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
