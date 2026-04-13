'use client';

import { renderRichText } from '@/components/chat/chat-rich-text';
import { formatEventTime } from '@/components/chat/chat-tool-groups';
import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { RuntimeBridgeTranscriptRenderItem } from '@/lib/chat/runtime-bridge-transcript';

export function ChatThinkingBlock({
  item,
}: {
  item: Extract<RuntimeBridgeTranscriptRenderItem, { type: 'process' }>;
}) {
  const isThinking = item.entry.stage === 'thinking';

  return (
    <div style={{ display: 'grid', justifyItems: 'center', marginBottom: 10 }}>
      <section
        style={{
          maxWidth: 'min(72ch, 80%)',
          borderRadius: 16,
          padding: '11px 13px',
          background: isThinking ? 'rgba(243, 240, 235, 0.88)' : 'rgba(236, 242, 239, 0.84)',
          border: isThinking ? '1px solid rgba(194, 187, 177, 0.26)' : '1px solid rgba(114, 150, 133, 0.2)',
          display: 'grid',
          gap: 6,
          color: '#4d5d57',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={pillStyle()}>{isThinking ? 'Visible reasoning' : 'Runtime phase'}</span>
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(item.at)}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {item.entry.label}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{renderRichText(item.entry.body)}</div>
      </section>
    </div>
  );
}
