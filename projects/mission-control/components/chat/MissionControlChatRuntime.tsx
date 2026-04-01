'use client';

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { MissionControlChatSurface } from '@/components/chat/MissionControlChatSurface';
import { useMissionControlRuntime } from '@/components/chat/MissionControlRuntimeProvider';
import type { RuntimeBridgeChatMessage } from '@/hooks/useRuntimeBridge';
import type { OrchestratorIntegrationSummary, TaskLifecycleEvent } from '@/lib/types/contracts';

function toLifecycleActivityMessages(events: TaskLifecycleEvent[]): RuntimeBridgeChatMessage[] {
  return events
    .filter((event) => event.type === 'task.moved_to_review')
    .map((event) => ({
      id: event.id,
      role: 'system',
      variant: 'activity',
      body: `Autonomous task finished and moved to Review: ${event.title}`,
      sessionKey: null,
      runId: null,
      status: 'final',
      at: Date.parse(event.at),
    }));
}

function MissionControlChatRuntimeInner({ initialSummary }: { initialSummary: OrchestratorIntegrationSummary }) {
  const { bridge, summary, lifecycleEvents, hydrateSummary } = useMissionControlRuntime();

  useEffect(() => {
    hydrateSummary(initialSummary);
  }, [hydrateSummary, initialSummary]);

  return (
    <MissionControlChatSurface
      summary={bridge?.summary ?? summary ?? initialSummary}
      bridge={bridge ?? undefined}
      activityMessages={toLifecycleActivityMessages(lifecycleEvents)}
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
          activityMessages={[]}
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
