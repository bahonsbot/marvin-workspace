'use client';

import { monoFont } from '@/components/chat/chat-rich-text';

function diffStats(beforeText: string, afterText: string) {
  const beforeLines = beforeText.split('\n');
  const afterLines = afterText.split('\n');
  let changed = 0;
  const total = Math.max(beforeLines.length, afterLines.length);

  for (let index = 0; index < total; index += 1) {
    if ((beforeLines[index] ?? '') !== (afterLines[index] ?? '')) changed += 1;
  }

  return { before: beforeLines.length, after: afterLines.length, changed };
}

export function ChatDiffView({
  filePath,
  beforeText,
  afterText,
}: {
  filePath: string;
  beforeText: string;
  afterText: string;
}) {
  const stats = diffStats(beforeText, afterText);

  return (
    <div
      style={{
        border: '1px solid rgba(194, 187, 177, 0.28)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.88)',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(194, 187, 177, 0.2)',
          background: 'rgba(247, 243, 238, 0.94)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-body)' }}>{filePath}</span>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
          {stats.changed} changed lines · {stats.before} → {stats.after}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <section style={{ borderRight: '1px solid rgba(194, 187, 177, 0.2)' }}>
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8d4f45',
              background: 'rgba(190, 91, 91, 0.06)',
            }}
          >
            Before
          </div>
          <pre
            style={{
              margin: 0,
              padding: '12px 14px',
              fontFamily: monoFont,
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              background: 'rgba(255, 251, 250, 0.9)',
              color: 'var(--text-body)',
            }}
          >
            {beforeText}
          </pre>
        </section>
        <section>
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#355d4f',
              background: 'rgba(66, 124, 93, 0.08)',
            }}
          >
            After
          </div>
          <pre
            style={{
              margin: 0,
              padding: '12px 14px',
              fontFamily: monoFont,
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              background: 'rgba(250, 255, 252, 0.92)',
              color: 'var(--text-body)',
            }}
          >
            {afterText}
          </pre>
        </section>
      </div>
    </div>
  );
}
