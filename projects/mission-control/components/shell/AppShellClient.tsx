'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMissionControlRuntime } from '@/components/chat/MissionControlRuntimeProvider';
import { Sidebar } from './Sidebar';
import { TopTabBar } from './TopTabBar';

function ToastRail() {
  const router = useRouter();
  const { visibleToasts, dismissToast } = useMissionControlRuntime();
  const orderedToasts = useMemo(
    () => visibleToasts.slice().sort((a, b) => Date.parse(b.event.at) - Date.parse(a.event.at)),
    [visibleToasts],
  );

  if (orderedToasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 86,
        right: 20,
        zIndex: 80,
        display: 'grid',
        gap: 10,
        width: 'min(360px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
    >
      {orderedToasts.map(({ event }) => {
        const title =
          event.type === 'task.moved_to_review'
            ? 'Task moved to Review'
            : 'Task needs input';
        const detail =
          event.type === 'task.moved_to_review'
            ? `Autonomous task finished and moved to Review: ${event.title}`
            : `Autonomous task needs input: ${event.title}`;

        return (
          <button
            key={event.id}
            type="button"
            onClick={() => {
              dismissToast(event.id);
              router.push(`/general/tasks?autonomousTaskId=${encodeURIComponent(event.taskId)}&lifecycleEventId=${encodeURIComponent(event.id)}`);
            }}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              borderRadius: 18,
              border: event.type === 'task.needs_input'
                ? '1px solid rgba(181, 126, 77, 0.28)'
                : '1px solid rgba(74, 114, 96, 0.22)',
              background: 'rgba(255, 252, 248, 0.9)',
              boxShadow: '0 18px 42px rgba(17, 32, 26, 0.14)',
              backdropFilter: 'blur(16px)',
              padding: '14px 14px 12px',
              display: 'grid',
              gap: 8,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: event.type === 'task.needs_input' ? '#c07b45' : '#4a7260',
                  boxShadow: event.type === 'task.needs_input' ? '0 0 0 5px rgba(192, 123, 69, 0.12)' : '0 0 0 5px rgba(74, 114, 96, 0.12)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {title}
                </div>
                <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.45, color: 'var(--text-body)' }}>{detail}</div>
              </div>
              <span
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  dismissToast(event.id);
                }}
                style={{
                  fontSize: 16,
                  lineHeight: 1,
                  color: 'var(--text-ghost)',
                  padding: 4,
                }}
                aria-hidden="true"
              >
                ×
              </span>
            </div>
            {event.summary ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{event.summary}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AppShellClient({
  children,
  bottomStrip,
}: {
  children: ReactNode;
  bottomStrip: ReactNode;
}) {
  const pathname = usePathname();
  const isChatRoute = pathname === '/general/chat' || pathname === '/chat';
  const bottomStripEnabled = false;
  const hideBottomStrip = isChatRoute || !bottomStripEnabled;
  const compactTopRoutes = new Set(['/general/chat', '/chat', '/general/tasks', '/general/agents', '/general/crons', '/general/memory', '/general/files']);
  const isCompactTopRoute = compactTopRoutes.has(pathname);

  return (
    <div style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <TopTabBar />
      <ToastRail />
      <div className="app-shell-grid" style={{ height: 'calc(100vh - 72px)' }}>
        <Sidebar />
        <div
          style={{
            display: 'grid',
            gridTemplateRows: hideBottomStrip ? '1fr' : '1fr auto',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
          }}
        >
          <main
            className="app-shell-main"
            style={{
              minHeight: 0,
              overflow: isChatRoute ? 'hidden' : 'auto',
              padding: isCompactTopRoute ? '14px 32px 12px' : undefined,
            }}
          >
            {children}
          </main>
          {hideBottomStrip ? null : bottomStrip}
        </div>
      </div>
    </div>
  );
}
