import Link from 'next/link';
import type { SearchQueryResponse } from '@/lib/types/contracts';

function formatScopeLabel(scope: SearchQueryResponse['results'][number]['sourceKind']) {
  if (scope === 'memory') return 'Memory';
  if (scope === 'docs') return 'Docs';
  if (scope === 'projects') return 'Projects';
  if (scope === 'scripts') return 'Scripts';
  return 'Files';
}

export function SearchResultsList({ data }: { data: SearchQueryResponse }) {
  if (data.query.trim().length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 12,
          padding: 14,
          color: 'var(--muted)',
          fontSize: 13,
        }}
      >
        Enter a query to search memory, docs, projects, scripts, and operational files.
      </div>
    );
  }

  if (data.results.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 12,
          padding: 14,
          color: 'var(--muted)',
          fontSize: 13,
          display: 'grid',
          gap: 8,
        }}
      >
        <span>No results found for “{data.query}”.</span>
        <span style={{ fontSize: 12 }}>Try a broader term or switch scope.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {data.results.map((item) => (
        <Link
          key={item.id}
          href={item.targetHref}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 12,
            background: 'rgba(8, 14, 24, 0.45)',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.35,
                color: '#5eead4',
                border: '1px solid rgba(94, 234, 212, 0.3)',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              {formatScopeLabel(item.sourceKind)}
            </span>
            <span style={{ color: 'var(--text)', fontWeight: 650, fontSize: 14 }}>{item.title}</span>
            {typeof item.line === 'number' ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>line {item.line}</span> : null}
          </div>
          <div style={{ color: 'var(--muted-strong)', fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.path}</div>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.55 }}>{item.snippet}</p>
        </Link>
      ))}
    </div>
  );
}
