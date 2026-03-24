import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomSystemStrip } from './BottomSystemStrip';
import { TopTabBar } from './TopTabBar';

export async function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Fixed top tab bar */}
      <TopTabBar />

      {/* Below tab bar: sidebar + main content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr)',
          paddingTop: 52, // height of top bar
          minHeight: '100vh',
        }}
      >
        <Sidebar />
        <div
          style={{
            display: 'grid',
            gridTemplateRows: '1fr auto',
            minWidth: 0,
          }}
        >
          <main style={{ minWidth: 0, padding: '24px 28px' }}>{children}</main>
          <BottomSystemStrip />
        </div>
      </div>
    </div>
  );
}
