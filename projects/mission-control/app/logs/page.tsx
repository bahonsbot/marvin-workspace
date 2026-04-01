import { PageScaffold } from '@/components/shared/PageScaffold';
import { getRecentActivity } from '@/lib/adapters/activity';

function formatRelative(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function formatDuration(durationMs?: number | null) {
  if (durationMs === null || durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function cardStyle(accent = 'var(--border)') {
  return {
    border: `1px solid ${accent}`,
    borderRadius: 14,
    padding: 14,
    background: 'rgba(12, 20, 33, 0.76)',
  } as const;
}

function DetailLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-strong)', lineHeight: 1.45, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

export default async function LogsPage() {
  const activity = await getRecentActivity();

  return (
    <PageScaffold title="Logs">
      <div style={{ display: 'grid', gap: 12 }}>
        {activity.items.length === 0 ? (
          <div style={{ ...cardStyle(), color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
            No recent activity. The feed is quiet or the log file is not available.
          </div>
        ) : (
          activity.items.slice(0, 40).map((item) => {
            const statusColor = item.state === 'failed' ? '#f87171' : item.state === 'running' ? '#6ea8ff' : '#5eead4';

            return (
              <details
                key={item.id}
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'rgba(12, 20, 33, 0.76)',
                  overflow: 'hidden',
                }}
              >
                <summary
                  style={{
                    listStyle: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 12px',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                  <span style={{ fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>{item.message}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatRelative(item.at)}</span>
                </summary>

                <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'grid', gap: 10, background: 'rgba(8, 14, 24, 0.55)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    <DetailLine label="Source" value={item.source} />
                    <DetailLine label="Started" value={item.startedAt ? formatRelative(item.startedAt) : null} />
                    <DetailLine label="Finished" value={item.finishedAt ? formatRelative(item.finishedAt) : null} />
                    <DetailLine label="Duration" value={formatDuration(item.durationMs)} />
                  </div>
                  <DetailLine label="Summary" value={item.summary} />
                  <DetailLine label="Notes" value={item.notes} />
                </div>
              </details>
            );
          })
        )}
      </div>
    </PageScaffold>
  );
}
