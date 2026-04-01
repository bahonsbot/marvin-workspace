'use client';

import type { SearchScope } from '@/lib/types/contracts';

const scopeItems: Array<{ key: SearchScope; label: string; hint: string }> = [
  { key: 'all', label: 'All', hint: 'Everything in V1 scope' },
  { key: 'memory', label: 'Memory', hint: 'All memory files' },
  { key: 'files', label: 'Files', hint: 'Top-level operational files' },
  { key: 'docs', label: 'Docs', hint: 'docs/**' },
  { key: 'projects', label: 'Projects', hint: 'projects/**' },
  { key: 'scripts', label: 'Scripts', hint: 'scripts/**' },
];

export function SearchScopeRail({ scope, onScopeChange }: { scope: SearchScope; onScopeChange: (scope: SearchScope) => void }) {
  return (
    <aside
      style={{
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 12,
        background: 'rgba(8, 14, 24, 0.64)',
        display: 'grid',
        gap: 10,
        alignContent: 'start',
      }}
    >
      <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 8px' }}>Scope</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {scopeItems.map((item) => {
          const active = item.key === scope;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onScopeChange(item.key)}
              style={{
                textAlign: 'left',
                border: `1px solid ${active ? 'rgba(94, 234, 212, 0.28)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '10px 10px',
                background: active ? 'rgba(94, 234, 212, 0.12)' : 'rgba(12, 20, 33, 0.68)',
                display: 'grid',
                gap: 4,
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? '#5eead4' : 'var(--text)' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.hint}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
