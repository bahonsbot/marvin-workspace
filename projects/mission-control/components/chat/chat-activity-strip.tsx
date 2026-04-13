'use client';

import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { TranscriptActivityItem } from '@/lib/chat/runtime-bridge-transcript';

function activityLabel(item: TranscriptActivityItem): string {
  if (item.kind === 'process') return item.label;
  return item.label.charAt(0).toUpperCase() + item.label.slice(1);
}

function activityTone(item: TranscriptActivityItem) {
  if (item.status === 'failed') return { border: '1px solid rgba(181, 88, 74, 0.24)', background: 'rgba(244, 224, 220, 0.82)', color: '#8f4237' };
  if (item.status === 'completed') return { border: '1px solid rgba(114, 150, 133, 0.2)', background: 'rgba(236, 242, 239, 0.82)', color: '#355d4f' };
  return { border: '1px solid rgba(177, 138, 73, 0.24)', background: 'rgba(247, 241, 219, 0.84)', color: '#6b4d19' };
}

export function ChatActivityStrip({ items }: { items: TranscriptActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'stretch',
      }}
    >
      {items.map((item) => {
        const tone = activityTone(item);
        return (
          <div
            key={item.id}
            style={{
              ...tone,
              borderRadius: 999,
              padding: '7px 11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: '100%',
            }}
          >
            <span style={pillStyle()}>{activityLabel(item)}</span>
            <span style={{ fontSize: 12, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.detail}
            </span>
          </div>
        );
      })}
    </div>
  );
}
