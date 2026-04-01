import { floatingInsetStyle } from '@/components/shared/floating';
import { getSystemStripSummary } from '@/lib/adapters/system';

function formatBytes(value: number) {
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function resolveEnvironmentLabel(hostname: string) {
  return /^[a-f0-9]{12,}$/i.test(hostname) ? 'Preview VPS' : hostname;
}

function clampPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function MetricBar({ value }: { value: number | null }) {
  const width = clampPercent(value);

  return (
    <div
      aria-hidden="true"
      style={{
        width: 54,
        height: 4,
        borderRadius: 999,
        overflow: 'hidden',
        background: 'rgba(60, 102, 88, 0.09)',
      }}
    >
      <div
        style={{
          width: width === null ? '18%' : `${width}%`,
          height: '100%',
          borderRadius: 999,
          background: width === null ? 'rgba(60, 102, 88, 0.18)' : 'linear-gradient(90deg, rgba(121, 166, 148, 0.38) 0%, rgba(60, 102, 88, 0.7) 100%)',
        }}
      />
    </div>
  );
}

function StatusItem({
  label,
  value,
  barValue,
  tone = 'var(--text-body)',
}: {
  label: string;
  value: string;
  barValue?: number | null;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 26,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 650, color: tone }}>{value}</span>
      {typeof barValue !== 'undefined' ? <MetricBar value={barValue} /> : null}
    </div>
  );
}

export async function BottomSystemStrip() {
  const summary = await getSystemStripSummary();
  const environmentLabel = resolveEnvironmentLabel(summary.hostname);
  const refreshedLabel = new Date(summary.refreshedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const cpuLoadPercent = summary.cpuCount > 0 ? clampPercent((summary.loadAverage[0] / summary.cpuCount) * 100) : null;
  const memoryPercent = clampPercent(summary.memory.usedPercent);
  const diskPercent = clampPercent(summary.disk?.usedPercent ?? null);

  return (
    <footer
      style={{
        position: 'relative',
        padding: '10px 0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <div
        style={{
          ...floatingInsetStyle({
            radius: 999,
            padding: '10px 18px',
            background: 'rgba(255, 253, 251, 0.92)',
            borderColor: 'rgba(200, 195, 188, 0.46)',
          }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          maxWidth: 'calc(100% - 32px)',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(25, 31, 28, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-body)' }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent-mid)',
              boxShadow: '0 0 8px rgba(60, 102, 88, 0.45)',
            }}
          />
          <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>VPS</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{environmentLabel}</span>
        </div>
        <StatusItem label="CPU" value={`${formatPercent(cpuLoadPercent)} 1m load`} barValue={cpuLoadPercent} />
        <StatusItem
          label="RAM"
          value={`${formatBytes(summary.memory.usedBytes)} / ${formatBytes(summary.memory.totalBytes)}`}
          barValue={memoryPercent}
        />
        <StatusItem
          label="Disk"
          value={summary.disk ? `${formatPercent(diskPercent)} full` : 'Unavailable'}
          barValue={summary.disk ? diskPercent : undefined}
        />
        <StatusItem label="Refreshed" value={refreshedLabel} />
      </div>
    </footer>
  );
}
