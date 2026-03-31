'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRuntimeBridge, type RuntimeBridgeState } from '@/hooks/useRuntimeBridge';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

type MissionControlRuntimeContextValue = {
  bridge: RuntimeBridgeState | null;
  summary: OrchestratorIntegrationSummary | null;
  hydrateSummary: (summary: OrchestratorIntegrationSummary) => void;
};

const MissionControlRuntimeContext = createContext<MissionControlRuntimeContextValue | null>(null);

function shouldReplaceSummary(
  current: OrchestratorIntegrationSummary | null,
  incoming: OrchestratorIntegrationSummary,
): boolean {
  if (!current) return true;
  if (current.refreshedAt !== incoming.refreshedAt) return true;
  if (current.sessionContext.recent.length !== incoming.sessionContext.recent.length) return true;
  if (current.runtimeBridge.status !== incoming.runtimeBridge.status) return true;
  return false;
}

function MissionControlRuntimeBridgeManager({
  summary,
  hydrateSummary,
  children,
}: {
  summary: OrchestratorIntegrationSummary;
  hydrateSummary: (summary: OrchestratorIntegrationSummary) => void;
  children: ReactNode;
}) {
  const bridge = useRuntimeBridge(summary);

  const value = useMemo<MissionControlRuntimeContextValue>(
    () => ({
      bridge,
      summary: bridge.summary,
      hydrateSummary,
    }),
    [bridge, hydrateSummary],
  );

  return <MissionControlRuntimeContext.Provider value={value}>{children}</MissionControlRuntimeContext.Provider>;
}

export function MissionControlRuntimeProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<OrchestratorIntegrationSummary | null>(null);

  const hydrateSummary = useCallback((incoming: OrchestratorIntegrationSummary) => {
    setSummary((current) => (shouldReplaceSummary(current, incoming) ? incoming : current));
  }, []);

  if (!summary) {
    return (
      <MissionControlRuntimeContext.Provider value={{ bridge: null, summary: null, hydrateSummary }}>
        {children}
      </MissionControlRuntimeContext.Provider>
    );
  }

  return (
    <MissionControlRuntimeBridgeManager summary={summary} hydrateSummary={hydrateSummary}>
      {children}
    </MissionControlRuntimeBridgeManager>
  );
}

export function useMissionControlRuntime() {
  const context = useContext(MissionControlRuntimeContext);
  if (!context) {
    throw new Error('useMissionControlRuntime must be used inside MissionControlRuntimeProvider');
  }
  return context;
}
