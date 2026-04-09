'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';

type ShellContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === '1' || stored === 'true') setSidebarCollapsed(true);
    } catch {
      // ignore storage availability errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore storage availability errors
    }
  }, [sidebarCollapsed]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed: () => setSidebarCollapsed((value) => !value),
    }),
    [sidebarCollapsed],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShellContext() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShellContext must be used inside ShellProvider');
  }
  return context;
}
