'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopTabBar } from './TopTabBar';

export function AppShellClient({
  children,
  bottomStrip,
}: {
  children: ReactNode;
  bottomStrip: ReactNode;
}) {
  const pathname = usePathname();
  const hideBottomStrip = pathname === '/general/chat' || pathname === '/chat';

  return (
    <div style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <TopTabBar />
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
          <main className="app-shell-main" style={{ minHeight: 0, overflow: 'hidden' }}>{children}</main>
          {hideBottomStrip ? null : bottomStrip}
        </div>
      </div>
    </div>
  );
}
