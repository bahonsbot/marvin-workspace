import type { ReactNode } from 'react';
import { BottomSystemStrip } from './BottomSystemStrip';
import { AppShellClient } from './AppShellClient';
import { ShellProvider } from './ShellContext';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <AppShellClient bottomStrip={<BottomSystemStrip />}>{children}</AppShellClient>
    </ShellProvider>
  );
}
