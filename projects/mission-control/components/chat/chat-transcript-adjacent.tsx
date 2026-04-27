'use client';

import type { RefObject } from 'react';
import { ChatTranscriptEntry } from '@/components/chat/chat-transcript-entry';
import { monoFont } from '@/components/chat/chat-rich-text';
import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { RuntimeBridgeLiveEvent } from '@/hooks/useRuntimeBridge';
import type { RuntimeBridgeTranscriptRenderItem } from '@/lib/chat/runtime-bridge-transcript';

function friendlySessionLabel(value: string): string {
  if (value === 'agent:main:main') return 'Marvin';
  if (/^agent:[^:]+:main$/.test(value)) return 'Selected chat';
  return value;
}

function InfoIcon() {
  return <span aria-hidden="true">ⓘ</span>;
}

export type ChatTranscriptItem = RuntimeBridgeTranscriptRenderItem;

export function LiveTranscriptSection({
  liveTargetLabel,
  bridgeEventsOpen,
  setBridgeEventsOpen,
  bridgeEventsRef,
  liveEvents,
  transcriptItems,
  assistantSeatLabel,
  showJumpToLatest,
  onJumpToLatest,
  transcriptBottomRef,
}: {
  liveTargetLabel: string;
  bridgeEventsOpen: boolean;
  setBridgeEventsOpen: (updater: (value: boolean) => boolean) => void;
  bridgeEventsRef: RefObject<HTMLDivElement | null>;
  liveEvents: RuntimeBridgeLiveEvent[];
  transcriptItems: ChatTranscriptItem[];
  assistantSeatLabel: string;
  showJumpToLatest: boolean;
  onJumpToLatest: () => void;
  transcriptBottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <section style={{ border: '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: 'rgba(255, 255, 255, 0.84)', padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>Live bridge session</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pillStyle()}>{friendlySessionLabel(liveTargetLabel)}</span>
            <div ref={bridgeEventsRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setBridgeEventsOpen((value) => !value)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1px solid rgba(200, 195, 188, 0.38)',
                  background: 'rgba(255, 255, 255, 0.76)',
                  color: 'var(--text-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                }}
                title="Recent bridge events"
              >
                <InfoIcon />
              </button>
              {bridgeEventsOpen ? (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(360px, 92vw)', border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 10, display: 'grid', gap: 8, zIndex: 20 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Recent bridge events</div>
                  {liveEvents.length > 0 ? (
                    liveEvents.slice().reverse().map((eventItem) => (
                      <ChatTranscriptEntry
                        key={eventItem.id}
                        item={{ type: 'bridge-event', id: eventItem.id, event: eventItem }}
                        assistantSeatLabel={assistantSeatLabel}
                      />
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      No bridge events observed yet beyond the connection handshake.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          {transcriptItems.length > 0 ? (
            transcriptItems.map((item) => (
              <ChatTranscriptEntry key={item.id} item={item} assistantSeatLabel={assistantSeatLabel} />
            ))
          ) : (
            <div style={{ padding: '6px 2px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              No live transcript yet. Send one prompt after the chat connection is ready for <span style={{ fontFamily: monoFont }}>{friendlySessionLabel(liveTargetLabel)}</span>.
            </div>
          )}
        </div>
        {showJumpToLatest ? (
          <div style={{ position: 'sticky', bottom: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <button
              type="button"
              onClick={onJumpToLatest}
              style={{ pointerEvents: 'auto', border: '1px solid rgba(121, 166, 148, 0.28)', borderRadius: 999, background: 'rgba(255, 253, 251, 0.96)', color: 'var(--text-body)', boxShadow: '0 10px 26px rgba(26, 61, 50, 0.12)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Jump to latest ↓
            </button>
          </div>
        ) : null}
      </section>
      <div ref={transcriptBottomRef} style={{ height: 1, width: '100%' }} />
    </>
  );
}
