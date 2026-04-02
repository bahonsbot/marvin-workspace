'use client';

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { MissionControlChatSurface } from '@/components/chat/MissionControlChatSurface';
import { useMissionControlRuntime } from '@/components/chat/MissionControlRuntimeProvider';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

function MissionControlChatRuntimeInner({ initialSummary }: { initialSummary: OrchestratorIntegrationSummary }) {
  const { bridge, summary, hydrateSummary } = useMissionControlRuntime();

  useEffect(() => {
    hydrateSummary(initialSummary);
  }, [hydrateSummary, initialSummary]);

  return (
    <MissionControlChatSurface
      summary={bridge?.summary ?? summary ?? initialSummary}
      bridge={bridge ?? undefined}
    />
  );
}

type BoundaryProps = {
  initialSummary: OrchestratorIntegrationSummary;
  children: ReactNode;
};

type BoundaryState = {
  hasError: boolean;
  message: string | null;
};

class MissionControlChatErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      message: error?.message ?? 'Mission Control chat bridge crashed in the browser.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Mission Control chat runtime crashed, falling back to static surface.', {
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <MissionControlChatSurface
          summary={this.props.initialSummary}
          fallbackNotice={
            this.state.message
              ? `Live bridge crashed in the browser, so Mission Control fell back to the static surface: ${this.state.message}`
              : 'Live bridge crashed in the browser, so Mission Control fell back to the static surface.'
          }
        />
      );
    }

    return this.props.children;
  }
}

export function MissionControlChatRuntime({ initialSummary }: { initialSummary: OrchestratorIntegrationSummary }) {
  return (
    <MissionControlChatErrorBoundary initialSummary={initialSummary}>
      <MissionControlChatRuntimeInner initialSummary={initialSummary} />
    </MissionControlChatErrorBoundary>
  );
}
