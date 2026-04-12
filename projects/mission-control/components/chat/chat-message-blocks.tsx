'use client';

import { useState } from 'react';
import type { RuntimeBridgeChatMessage, RuntimeBridgeLiveEvent } from '@/hooks/useRuntimeBridge';
import { renderRichText } from '@/components/chat/chat-rich-text';
import { formatEventTime } from '@/components/chat/chat-tool-groups';
import { pillStyle } from '@/components/chat/chat-ui-helpers';

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

function shortKey(value: string): string {
  if (value.length <= 32) return value;
  return `${value.slice(0, 14)}...${value.slice(-10)}`;
}

export function assistantLabelForSeat(seatSlug: string | null | undefined) {
  if (seatSlug === 'language-tutor') return 'Japin';
  if (seatSlug === 'trading-advisor') return 'Milou';
  if (seatSlug === 'sportsbet-advisor') return 'Johan';
  if (seatSlug === 'job-advisor') return 'Link';
  if (seatSlug === 'content-seo-team') return 'Vantage';
  if (seatSlug === 'dev-team') return 'Sudo';
  return 'Marvin';
}

export function LiveMessageBlock({ message, assistantLabel }: { message: RuntimeBridgeChatMessage; assistantLabel: string }) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'system') {
    if (message.variant === 'activity') {
      return (
        <div style={{ display: 'grid', justifyItems: 'center', marginBottom: 10 }}>
          <section
            style={{
              maxWidth: 'min(74ch, 82%)',
              borderRadius: 999,
              padding: '9px 14px',
              background: 'rgba(232, 239, 235, 0.84)',
              border: '1px solid rgba(111, 140, 126, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              color: '#4a5f55',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#60796d' }}>
              Activity
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.45 }}>{message.body}</span>
          </section>
        </div>
      );
    }

    return (
      <section
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          background: 'rgba(154, 75, 67, 0.08)',
          border: '1px solid rgba(154, 75, 67, 0.22)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={pillStyle()}>Bridge note</span>
          <span style={pillStyle()}>{message.status}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#8a433b' }}>{renderRichText(message.body)}</div>
      </section>
    );
  }

  const isOperator = message.role === 'user';

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: isOperator ? 'end' : 'start',
        gap: 12,
        marginTop: 2,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'grid', gap: 10, maxWidth: 'min(78ch, 78%)', justifyItems: isOperator ? 'end' : 'start' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-mid)' }}>
            {isOperator ? 'Philippe' : assistantLabel}
          </div>
          {!isOperator ? (
            <button
              type="button"
              onClick={() => {
                const ok = copyTextToClipboard(message.body);
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
          ) : null}
        </div>
        <div
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            borderRadius: 24,
            padding: '14px 16px',
            color: 'var(--text-body)',
            fontSize: 15,
            lineHeight: 1.8,
            textAlign: 'left',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            background: isOperator ? 'rgba(236, 244, 240, 0.72)' : 'rgba(250, 246, 240, 0.94)',
            border: isOperator ? '1px solid rgba(200, 195, 188, 0.24)' : '1px solid rgba(255, 255, 255, 0.92)',
          }}
        >
          {renderRichText(message.body)}
        </div>
        {message.status === 'streaming' ? <div style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streaming</div> : null}
      </div>
    </div>
  );
}

export function LiveEventBlock({ event }: { event: RuntimeBridgeLiveEvent }) {
  return (
    <div
      style={{
        border: '1px solid rgba(200, 195, 188, 0.28)',
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.82)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={pillStyle()}>{event.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(event.at)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{event.detail}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {event.sessionKey ? <span style={pillStyle()}>{shortKey(event.sessionKey)}</span> : null}
        {event.runId ? <span style={pillStyle()}>{`run ${shortKey(event.runId)}`}</span> : null}
        {event.seq !== null ? <span style={pillStyle()}>{`seq ${event.seq}`}</span> : null}
      </div>
    </div>
  );
}
