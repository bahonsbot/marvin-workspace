'use client';

import { useState } from 'react';
import { ChatActivityStrip } from '@/components/chat/chat-activity-strip';
import { ReadAloudButton } from '@/components/chat/chat-read-aloud';
import { LiveEventBlock } from '@/components/chat/chat-message-blocks';
import { renderRichText } from '@/components/chat/chat-rich-text';
import { ChatThinkingBlock } from '@/components/chat/chat-thinking-block';
import { ArtifactGroupBlock, ToolGroupBlock, type ToolGroupRow } from '@/components/chat/chat-tool-groups';
import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { RuntimeBridgeLiveEvent } from '@/hooks/useRuntimeBridge';
import type { RuntimeBridgeTranscriptRenderItem } from '@/lib/chat/runtime-bridge-transcript';

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function copyTextToClipboard(text: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function messageTone(item: Extract<RuntimeBridgeTranscriptRenderItem, { type: 'message' }>) {
  if (item.entry.role === 'user') {
    return {
      justify: 'end' as const,
      bubbleBackground: 'rgba(236, 244, 240, 0.74)',
      bubbleBorder: '1px solid rgba(200, 195, 188, 0.24)',
      label: 'Philippe',
    };
  }
  if (item.presentation === 'streaming') {
    return {
      justify: 'start' as const,
      bubbleBackground: 'rgba(244, 241, 235, 0.92)',
      bubbleBorder: '1px solid rgba(177, 138, 73, 0.24)',
    };
  }
  if (item.presentation === 'intermediate') {
    return {
      justify: 'start' as const,
      bubbleBackground: 'rgba(246, 244, 240, 0.9)',
      bubbleBorder: '1px solid rgba(194, 187, 177, 0.24)',
    };
  }

  return {
    justify: 'start' as const,
    bubbleBackground: 'rgba(250, 246, 240, 0.95)',
    bubbleBorder: '1px solid rgba(255, 255, 255, 0.92)',
  };
}

function noticeStyle(item: Extract<RuntimeBridgeTranscriptRenderItem, { type: 'notice' }>) {
  if (item.tone === 'error') {
    return {
      background: 'rgba(244, 224, 220, 0.88)',
      border: '1px solid rgba(181, 88, 74, 0.24)',
      color: '#7c2e24',
      accent: '#8f4237',
    };
  }

  return {
    background: 'rgba(232, 239, 235, 0.84)',
    border: '1px solid rgba(111, 140, 126, 0.2)',
    color: '#4a5f55',
    accent: '#60796d',
  };
}

function MessageEntryBlock({
  item,
  assistantSeatLabel,
}: {
  item: Extract<RuntimeBridgeTranscriptRenderItem, { type: 'message' }>;
  assistantSeatLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const tone = messageTone(item);
  const isOperator = item.entry.role === 'user';
  const isSecondary = item.entry.role === 'assistant' && item.presentation !== 'final';
  const showActivity = !isOperator && isSecondary && item.activity.length > 0;
  const speaker = isOperator ? 'Philippe' : assistantSeatLabel;

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: tone.justify,
        gap: 10,
        marginTop: 2,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'grid', gap: 10, maxWidth: 'min(78ch, 82%)', justifyItems: tone.justify }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-mid)' }}>
              {speaker}
            </div>
            {!isOperator && isSecondary ? (
              <span style={pillStyle()}>
                {item.presentation === 'streaming' ? 'In progress' : 'Runtime note'}
              </span>
            ) : null}
          </div>
          {!isOperator ? (
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              {item.presentation === 'final' ? <ReadAloudButton text={item.entry.body} /> : null}
              <button
                type="button"
                onClick={() => {
                  const ok = copyTextToClipboard(item.entry.body);
                  setCopied(ok);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
                aria-label="Copy message"
                title={copied ? 'Copied' : 'Copy'}
                style={{
                  border: '1px solid rgba(200, 195, 188, 0.28)',
                  background: 'rgba(255, 255, 255, 0.72)',
                  color: copied ? '#163b31' : 'var(--text-muted)',
                  borderRadius: 999,
                  minWidth: 34,
                  height: 34,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CopyIcon />
              </button>
            </div>
          ) : null}
        </div>
        <div
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            borderRadius: isSecondary ? 18 : 24,
            padding: isSecondary ? '12px 14px' : '14px 16px',
            color: 'var(--text-body)',
            fontSize: isSecondary ? 14 : 15,
            lineHeight: 1.8,
            textAlign: 'left',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            background: tone.bubbleBackground,
            border: tone.bubbleBorder,
          }}
        >
          {renderRichText(item.entry.body)}
        </div>
        {showActivity ? <ChatActivityStrip items={item.activity} /> : null}
      </div>
    </div>
  );
}

function NoticeEntryBlock({ item }: { item: Extract<RuntimeBridgeTranscriptRenderItem, { type: 'notice' }> }) {
  const tone = noticeStyle(item);

  return (
    <div style={{ display: 'grid', justifyItems: 'center', marginBottom: 10 }}>
      <section
        style={{
          maxWidth: 'min(74ch, 82%)',
          borderRadius: 999,
          padding: '9px 14px',
          background: tone.background,
          border: tone.border,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          color: tone.color,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: tone.accent }}>
          {item.title}
        </span>
        <span style={{ fontSize: 13, lineHeight: 1.45 }}>{item.body}</span>
      </section>
    </div>
  );
}

export function ChatTranscriptEntry({
  item,
  assistantSeatLabel,
}: {
  item:
    | RuntimeBridgeTranscriptRenderItem
    | { type: 'bridge-event'; id: string; event: RuntimeBridgeLiveEvent };
  assistantSeatLabel: string;
}) {
  if (item.type === 'bridge-event') {
    return <LiveEventBlock event={item.event} />;
  }

  if (item.type === 'message') {
    return <MessageEntryBlock item={item} assistantSeatLabel={assistantSeatLabel} />;
  }

  if (item.type === 'process') {
    return <ChatThinkingBlock item={item} />;
  }

  if (item.type === 'notice') {
    return <NoticeEntryBlock item={item} />;
  }

  if (item.type === 'artifacts') {
    return <ArtifactGroupBlock group={item.group} />;
  }

  const rows: ToolGroupRow[] = item.burst.rows.map((entry) => ({ id: entry.id, entry }));
  return <ToolGroupBlock rows={rows} keepOpen={item.keepOpen} />;
}
