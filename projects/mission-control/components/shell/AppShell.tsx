import type { ReactNode } from 'react';
import { AppShellClient } from './AppShellClient';
import { ShellProvider } from './ShellContext';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <AppShellClient>{children}</AppShellClient>
    </ShellProvider>
  );
}
