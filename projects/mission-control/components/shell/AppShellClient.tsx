'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMissionControlRuntime } from '@/components/chat/MissionControlRuntimeProvider';
import { Sidebar } from './Sidebar';
import { TopTabBar } from './TopTabBar';
import { useShellContext } from './ShellContext';
import styles from './shell.module.css';

function toastSummary(event: { summary?: string; artifactPath?: string; type: string }) {
  const raw = String(event.summary || '').trim();
  const looksInternal = /^[\[{]/.test(raw) || /"runId"\s*:/.test(raw) || /systemPromptReport|injectedWorkspaceFiles|openclaw|bash|timeoutSeconds|command=/i.test(raw);
  if (raw && !looksInternal) {
    return raw.length > 96 ? `${raw.slice(0, 93)}…` : raw;
  }
  if (event.artifactPath) return 'Created an output artifact.';
  if (event.type === 'task.moved_to_review') return 'Task completed and moved to Review.';
  if (event.type === 'task.needs_input') return 'Open Tasks to review the requested input.';
  return undefined;
}

function ToastRail() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomeRoute = pathname === '/general/home' || pathname === '/home';
  const { visibleToasts, dismissToast } = useMissionControlRuntime();
  const orderedToasts = useMemo(
    () => visibleToasts.slice().sort((a, b) => Date.parse(b.event.at) - Date.parse(a.event.at)),
    [visibleToasts],
  );

  if (orderedToasts.length === 0) return null;

  return (
    <div className={`${styles.toastRail} ${isHomeRoute ? 'home-toast-rail' : ''}`}>
      {orderedToasts.map(({ event }) => {
        const title =
          event.type === 'task.moved_to_review'
            ? 'Task moved to Review'
            : 'Task needs input';
        const detail =
          event.type === 'task.moved_to_review'
            ? `Autonomous task finished and moved to Review: ${event.title}`
            : `Autonomous task needs input: ${event.title}`;

        const summary = toastSummary(event);

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
              padding: '10px 12px',
              display: 'grid',
              gap: 5,
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
                <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.35, color: 'var(--text-body)' }}>{detail}</div>
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
            {summary ? (
              <div style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--text-muted)' }}>{summary}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AppShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = pathname === '/general/chat' || pathname === '/chat';
  const isTasksRoute = pathname === '/general/tasks' || pathname === '/tasks';
  const isAgentsRoute = pathname === '/general/agents' || pathname === '/agents';
  const isMobileWorkspaceRoute = ['/general/skills', '/general/crons', '/general/memory', '/general/files', '/skills', '/cron', '/memory', '/files'].includes(pathname);
  const isHomeRoute = pathname === '/general/home' || pathname === '/home';
  const compactTopRoutes = new Set(['/general/chat', '/chat', '/general/tasks', '/general/agents', '/general/skills', '/general/crons', '/general/memory', '/general/files']);
  const isCompactTopRoute = compactTopRoutes.has(pathname);
  const { sidebarCollapsed } = useShellContext();

  return (
    <div className={styles.appShellRoot}>
      <TopTabBar />
      <ToastRail />
      <div
        className={`app-shell-grid ${isChatRoute ? 'chat-shell-grid' : ''} ${isTasksRoute ? 'tasks-shell-grid' : ''} ${isAgentsRoute ? 'agents-shell-grid' : ''} ${isMobileWorkspaceRoute ? 'mobile-workspace-shell-grid' : ''} ${isHomeRoute ? 'home-shell-grid' : ''}`}
        style={{
          height: 'calc(100vh - 72px)',
          ['--sidebar-width' as string]: sidebarCollapsed ? '76px' : '220px',
        }}
      >
        <Sidebar />
        <div className={styles.appShellContentColumn}>
          <main
            className={`app-shell-main ${styles.appShellMain} ${isChatRoute ? `${styles.chatShellMain} chat-shell-main` : ''} ${isTasksRoute ? 'tasks-shell-main' : ''} ${isAgentsRoute ? 'agents-shell-main' : ''} ${isMobileWorkspaceRoute ? 'mobile-workspace-shell-main' : ''} ${isHomeRoute ? 'home-shell-main' : ''}`}
            style={{
              overflow: isChatRoute ? 'hidden' : 'auto',
              padding: isCompactTopRoute ? '14px 32px 12px' : undefined,
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
