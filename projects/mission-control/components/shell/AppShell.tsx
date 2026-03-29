import type { ReactNode } from 'react';
import { BottomSystemStrip } from './BottomSystemStrip';
import { AppShellClient } from './AppShellClient';

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellClient bottomStrip={<BottomSystemStrip />}>{children}</AppShellClient>;
}
