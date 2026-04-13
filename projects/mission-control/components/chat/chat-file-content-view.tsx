'use client';

import { useState } from 'react';
import { monoFont } from '@/components/chat/chat-rich-text';

function lineCount(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}

function previewContent(content: string, lines: number): string {
  return content.split('\n').slice(0, lines).join('\n');
}

export function ChatFileContentView({
  title,
  filePath,
  content,
  defaultExpanded = false,
}: {
  title: string;
  filePath: string;
  content: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalLines = lineCount(content);
  const preview = previewContent(content, 10);

  return (
    <div
      style={{
        border: '1px solid rgba(194, 187, 177, 0.28)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.9)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '10px 12px',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {title}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-body)' }}>{filePath}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
          {totalLines} lines · {expanded ? 'Hide' : 'Show'} content
        </span>
      </button>
      <pre
        style={{
          margin: 0,
          padding: '0 14px 14px',
          fontFamily: monoFont,
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          color: 'var(--text-body)',
          maxHeight: expanded ? 'none' : 220,
          overflow: 'hidden',
        }}
      >
        {expanded ? content : preview}
      </pre>
      {!expanded && totalLines > 10 ? (
        <div style={{ padding: '0 14px 14px', fontSize: 11, color: 'var(--text-ghost)' }}>
          Previewing first 10 lines.
        </div>
      ) : null}
    </div>
  );
}
