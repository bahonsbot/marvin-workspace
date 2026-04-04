'use client';

import type { ReactNode } from 'react';

export function DocumentContent({
  content,
  exists,
  controls,
  editor,
}: {
  content: string;
  exists: boolean;
  controls?: ReactNode;
  editor?: ReactNode;
}) {
  if (!exists && !editor) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 18,
          padding: 28,
          color: 'var(--text-muted)',
          background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.92) 0%, rgba(245, 239, 232, 0.82) 100%)',
          textAlign: 'center',
        }}
      >
        Source file not found yet. This view stays truthful and read-only.
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 16,
        background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.96) 0%, rgba(247, 241, 235, 0.9) 100%)',
        display: 'grid',
        gap: 14,
      }}
    >
      {!exists ? (
        <div
          style={{
            border: '1px dashed rgba(157, 103, 55, 0.35)',
            borderRadius: 14,
            padding: '12px 14px',
            color: '#8a6338',
            background: 'rgba(255, 248, 240, 0.82)',
            fontSize: 13,
          }}
        >
          Source file does not exist yet. Saving here will create it.
        </div>
      ) : null}
      {controls}
      {editor ? (
        <div style={{ minHeight: 520, maxHeight: 720, overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(200, 195, 188, 0.55)', background: 'rgba(255, 253, 251, 0.76)' }}>
          {editor}
        </div>
      ) : (
        <pre
          style={{
            margin: 0,
            padding: '8px 10px',
            color: 'var(--text-body)',
            fontSize: 14,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </pre>
      )}
    </div>
  );
}
