'use client';

export function FileConflictCompare({
  draft,
  disk,
  onOverwriteDraft,
  onLoadDisk,
}: {
  draft: string;
  disk: string;
  onOverwriteDraft: () => void;
  onLoadDisk: () => void;
}) {
  return (
    <div
      style={{
        border: '1px solid rgba(157, 103, 55, 0.28)',
        borderRadius: 16,
        background: 'rgba(255, 248, 240, 0.72)',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7c4f26' }}>Draft vs on-disk version</div>
          <div style={{ fontSize: 12.5, color: '#8a6338', lineHeight: 1.55 }}>
            Compare your draft against the latest on-disk file, then either overwrite disk immediately with your draft or load the newer disk copy instead.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onOverwriteDraft} className="floating-pill" style={{ cursor: 'pointer' }}>
            Overwrite disk with draft
          </button>
          <button type="button" onClick={onLoadDisk} className="floating-pill" style={{ cursor: 'pointer' }}>
            Load disk version
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <ComparePane title="Your draft" value={draft} />
        <ComparePane title="On disk now" value={disk} />
      </div>
    </div>
  );
}

function ComparePane({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid rgba(200, 195, 188, 0.6)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(255, 253, 251, 0.78)',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(200, 195, 188, 0.55)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-muted)',
          background: 'rgba(255, 253, 251, 0.92)',
        }}
      >
        {title}
      </div>
      <pre
        style={{
          margin: 0,
          minHeight: 180,
          maxHeight: 320,
          overflow: 'auto',
          padding: '14px 16px',
          fontSize: 12.5,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono), SFMono-Regular, ui-monospace, monospace',
          color: 'var(--text-body)',
        }}
      >
        {value}
      </pre>
    </div>
  );
}
