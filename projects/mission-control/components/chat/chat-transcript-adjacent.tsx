'use client';

import type { RefObject } from 'react';
import { monoFont } from '@/components/chat/chat-rich-text';
import { LiveEventBlock, LiveMessageBlock } from '@/components/chat/chat-message-blocks';
import { ToolGroupBlock, type ToolGroupRow } from '@/components/chat/chat-tool-groups';
import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { RuntimeBridgeChatMessage, RuntimeBridgeLiveEvent, RuntimeBridgeTransientNotice } from '@/hooks/useRuntimeBridge';

function InfoIcon() {
  return <span aria-hidden="true">ⓘ</span>;
}

export type ChatTranscriptItem =
  | { type: 'message'; id: string; at: number; message: RuntimeBridgeChatMessage }
  | { type: 'tools'; id: string; at: number; rows: ToolGroupRow[]; keepOpen: boolean };

export function LiveTranscriptSection({
  liveTargetLabel,
  bridgeEventsOpen,
  setBridgeEventsOpen,
  bridgeEventsRef,
  liveEvents,
  liveNotices,
  transcriptItems,
  assistantSeatLabel,
  showJumpToLatest,
  onJumpToLatest,
  transcriptBottomRef,
}: {
  liveTargetLabel: string;
  bridgeEventsOpen: boolean;
  setBridgeEventsOpen: (updater: (value: boolean) => boolean) => void;
  bridgeEventsRef: RefObject<HTMLDivElement>;
  liveEvents: RuntimeBridgeLiveEvent[];
  liveNotices: RuntimeBridgeTransientNotice[];
  transcriptItems: ChatTranscriptItem[];
  assistantSeatLabel: string;
  showJumpToLatest: boolean;
  onJumpToLatest: () => void;
  transcriptBottomRef: RefObject<HTMLDivElement>;
}) {
  return (
    <>
      <section style={{ border: '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: 'rgba(255, 255, 255, 0.84)', padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>Live bridge session</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pillStyle()}>{liveTargetLabel}</span>
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
                    liveEvents.slice().reverse().map((eventItem) => <LiveEventBlock key={eventItem.id} event={eventItem} />)
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
          {liveNotices.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {liveNotices.slice().reverse().map((notice) => (
                <div
                  key={notice.id}
                  style={{
                    border: '1px solid rgba(121, 166, 148, 0.28)',
                    borderRadius: 12,
                    background: 'rgba(240, 248, 244, 0.9)',
                    color: '#163b31',
                    padding: '8px 10px',
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  SYSTEM NOTICE · {notice.message}
                </div>
              ))}
            </div>
          ) : null}
          {transcriptItems.length > 0 ? (
            transcriptItems.map((item) =>
              item.type === 'message' ? (
                <LiveMessageBlock key={item.id} message={item.message} assistantLabel={assistantSeatLabel} />
              ) : (
                <ToolGroupBlock key={item.id} rows={item.rows} keepOpen={item.keepOpen} />
              ),
            )
          ) : (
            <div style={{ padding: '6px 2px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              No live transcript yet. Send one prompt after the gateway session is connected to this target: <span style={{ fontFamily: monoFont }}>{liveTargetLabel}</span>.
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
