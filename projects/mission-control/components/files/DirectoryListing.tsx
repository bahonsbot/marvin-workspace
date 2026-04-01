import Link from 'next/link';
import type { FilesEntry } from '@/lib/types/contracts';

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

function formatBytes(bytes: number | null) {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getParentPath(currentDirectory: string) {
  if (currentDirectory === '.') return null;
  const parts = currentDirectory.split('/').filter(Boolean);
  if (parts.length <= 1) return '.';
  return parts.slice(0, -1).join('/');
}

export function DirectoryListing({ entries, currentDirectory, selectedFilePath }: { entries: FilesEntry[]; currentDirectory: string; selectedFilePath: string | null }) {
  const parentPath = getParentPath(currentDirectory);

  if (entries.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 18,
          padding: 20,
          color: 'var(--muted)',
          fontSize: 14,
          background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.92) 0%, rgba(245, 239, 232, 0.82) 100%)',
        }}
      >
        This directory is empty or unavailable.
      </div>
    );
  }

  return (
    <div className="directory-table-shell" style={{ border: '1px solid var(--border)', borderRadius: 18, background: 'rgba(255, 253, 251, 0.74)' }}>
      <div className="directory-table" style={{ overflow: 'hidden', maxHeight: 'min(52vh, 560px)', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px 110px 150px', gap: 10, padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.32, background: 'rgba(244, 237, 229, 0.9)', borderBottom: '1px solid var(--border)' }}>
          <span>Name</span>
          <span>Kind</span>
          <span>Size</span>
          <span>Updated</span>
        </div>
        <div style={{ display: 'grid', overflow: 'auto' }}>
        {parentPath ? (
          <Link
            href={`/general/files?path=${encodeURIComponent(parentPath)}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 100px 110px 150px',
              gap: 10,
              padding: '12px 14px',
              background: 'rgba(248, 243, 237, 0.8)',
              color: 'var(--muted-strong)',
              fontSize: 13,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↩ 📁 ..</span>
            <span style={{ color: 'var(--muted-strong)' }}>parent</span>
            <span style={{ color: 'var(--muted-strong)', fontFamily: 'monospace' }}>—</span>
            <span style={{ color: 'var(--muted)' }}>Up one level</span>
          </Link>
        ) : null}
        {entries.map((entry) => {
          const isFile = entry.kind === 'file';
          const active = isFile && selectedFilePath === entry.path;
          const href = isFile
            ? `/general/files?path=${encodeURIComponent(currentDirectory)}&file=${encodeURIComponent(entry.path)}#file-preview`
            : `/general/files?path=${encodeURIComponent(entry.path)}`;

          return (
            <Link
              key={entry.path}
              href={href}
              style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 100px 110px 150px',
              gap: 10,
              padding: '12px 14px',
              borderTop: '1px solid var(--border)',
              background: active ? 'rgba(212, 231, 221, 0.72)' : 'rgba(255, 255, 255, 0.58)',
              color: 'var(--text-body)',
              fontSize: 13,
            }}
          >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.kind === 'directory' ? '📁' : '📄'} {entry.name}
              </span>
              <span style={{ color: 'var(--muted-strong)', textTransform: 'capitalize' }}>{entry.kind}</span>
              <span style={{ color: 'var(--muted-strong)', fontFamily: 'monospace' }}>{formatBytes(entry.size)}</span>
              <span style={{ color: 'var(--muted)' }}>{formatTimestamp(entry.updatedAt)}</span>
            </Link>
          );
        })}
        </div>
      </div>
    </div>
  );
}
