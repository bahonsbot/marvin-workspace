'use client';

import type { RefObject } from 'react';
import { monoFont } from '@/components/chat/chat-rich-text';
import { pillStyle } from '@/components/chat/chat-ui-helpers';

type RecentSession = {
  key: string;
  kind: string;
  ageMs: number | null;
  model?: string | null;
  tokenUsage?: { percentUsed?: number | null } | null;
};

function formatAge(ageMs: number | null): string {
  if (ageMs === null || Number.isNaN(ageMs)) return 'freshness unavailable';
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function sessionLabel(session: RecentSession): string {
  if (session.key.includes('builder')) return 'Builder';
  if (session.key.includes('reviewer')) return 'Reviewer';
  return session.kind;
}

export function ChatSessionRail({
  sessionsRef,
  sessionsOpen,
  setSessionsOpen,
  recentSessions,
  liveTargetSession,
  onSwitchSession,
  compact = false,
}: {
  sessionsRef: RefObject<HTMLDivElement | null>;
  sessionsOpen: boolean;
  setSessionsOpen: (updater: (value: boolean) => boolean) => void;
  recentSessions: RecentSession[];
  liveTargetSession: string | null;
  onSwitchSession: (sessionKey: string) => void;
  compact?: boolean;
}) {
  return (
    <div ref={sessionsRef} style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        type="button"
        onClick={() => setSessionsOpen((value) => !value)}
        style={{
          border: '1px solid rgba(200, 195, 188, 0.34)',
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.7)',
          padding: compact ? '7px 10px' : '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          minHeight: 32,
          cursor: 'pointer',
          maxWidth: compact ? 126 : undefined,
        }}
        title="Recent sessions"
      >
        <span style={{ fontSize: compact ? 12 : 9, textTransform: compact ? 'none' : 'uppercase', letterSpacing: compact ? 'normal' : '0.08em', color: 'var(--text-muted)' }}>
          {compact ? '⏱' : 'Recent Sessions'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', lineHeight: 1 }}>{recentSessions.length}</span>
      </button>
      {sessionsOpen ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(360px, 92vw)',
            border: '1px solid rgba(200, 195, 188, 0.4)',
            borderRadius: 18,
            background: 'rgba(255, 253, 251, 0.96)',
            boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)',
            padding: 12,
            display: 'grid',
            gap: 10,
            zIndex: 10,
          }}
        >
          {recentSessions.length > 0 ? (
            recentSessions.slice(0, 6).map((session) => {
              const isActive = session.key === liveTargetSession;
              return (
                <button
                  key={session.key}
                  type="button"
                  onClick={() => {
                    setSessionsOpen(() => false);
                    if (session.key !== liveTargetSession) {
                      onSwitchSession(session.key);
                    }
                  }}
                  style={{ border: `1px solid ${isActive ? 'rgba(121, 166, 148, 0.42)' : 'rgba(200, 195, 188, 0.34)'}`, borderRadius: 14, background: isActive ? 'rgba(212, 231, 221, 0.52)' : 'rgba(255, 255, 255, 0.78)', padding: 12, display: 'grid', gap: 8, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>{sessionLabel(session)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{isActive ? 'Current' : formatAge(session.ageMs)}</span>
                  </div>
                  <div style={{ fontFamily: monoFont, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.key}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={pillStyle()}>{session.model ?? 'runtime controlled'}</span>
                    <span style={pillStyle()}>{session.tokenUsage?.percentUsed != null ? `${session.tokenUsage.percentUsed}% ctx` : 'ctx unknown'}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              No recent sessions were exposed by the adapter in this environment.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
