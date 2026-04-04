'use client';

import type { ReactNode } from 'react';
import type { FilesPreview } from '@/lib/types/contracts';

export function FilePreviewPanel({
  preview,
  controls,
  editor,
}: {
  preview: FilesPreview | null;
  controls?: ReactNode;
  editor?: ReactNode;
}) {
  if (!preview || !preview.file) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 18,
          padding: 24,
          color: 'var(--muted)',
          background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.92) 0%, rgba(245, 239, 232, 0.82) 100%)',
          textAlign: 'center',
        }}
      >
        Select a file to preview.
      </div>
    );
  }

  if (preview.file.kind === 'text') {
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
        {controls}
        {editor ? (
          <div style={{ minHeight: 520, maxHeight: 680, overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(200, 195, 188, 0.55)', background: 'rgba(255, 253, 251, 0.76)' }}>
            {editor}
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: '6px 8px',
              color: 'var(--text-body)',
              fontSize: 14,
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 520,
              overflow: 'auto',
            }}
          >
            {preview.textContent ?? ''}
          </pre>
        )}
      </div>
    );
  }

  if (preview.file.kind === 'image') {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 20, background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.96) 0%, rgba(247, 241, 235, 0.9) 100%)', padding: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.imageUrl} alt={preview.file.name} style={{ width: '100%', height: 'auto', borderRadius: 8, objectFit: 'contain', maxHeight: 520 }} />
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 18,
        padding: 24,
        color: 'var(--muted)',
        background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.92) 0%, rgba(245, 239, 232, 0.82) 100%)',
      }}
    >
      {preview.message ?? 'Preview not supported for this file type in Files V1.'}
    </div>
  );
}
