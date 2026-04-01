export function MemoryMetaStrip({
  kind,
  updatedAt,
  exists,
}: {
  kind: string;
  updatedAt: string | null;
  exists: boolean;
}) {
  return (
    <div className="floating-meta-strip">
      <MetaItem label="Kind" value={kind} mono={false} />
      <MetaItem label="Updated" value={formatTimestamp(updatedAt)} mono={false} />
      <MetaItem label="Status" value={exists ? 'Available' : 'Missing'} mono={false} tone={exists ? '#315f51' : '#9d6737'} />
    </div>
  );
}

function MetaItem({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: string }) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.35 }}>{label}</span>
      <span
        style={{
          color: tone ?? 'var(--text-body)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: mono ? 'monospace' : 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
