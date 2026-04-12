'use client';

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { MissionControlChatSurface } from '@/components/chat/MissionControlChatSurface';
import { useMissionControlRuntime } from '@/components/chat/MissionControlRuntimeProvider';
import type { ChatSeatActivation } from '@/lib/agents/chat-activation';
import type { OrchestratorIntegrationSummary, RuntimeBridgeTranscriptHistory } from '@/lib/types/contracts';

function MissionControlChatRuntimeInner({
  initialSummary,
  initialTranscriptHistory,
  activation,
}: {
  initialSummary: OrchestratorIntegrationSummary;
  initialTranscriptHistory: RuntimeBridgeTranscriptHistory;
  activation: ChatSeatActivation | null;
}) {
  const { bridge, summary, hydrateSummary, hydrateTranscriptHistory } = useMissionControlRuntime();

  useEffect(() => {
    hydrateSummary(initialSummary);
    hydrateTranscriptHistory(initialTranscriptHistory);
  }, [hydrateSummary, hydrateTranscriptHistory, initialSummary, initialTranscriptHistory]);

  return (
    <MissionControlChatSurface
      summary={bridge?.summary ?? summary ?? initialSummary}
      bridge={bridge ?? undefined}
      activation={activation}
    />
  );
}

type BoundaryProps = {
  initialSummary: OrchestratorIntegrationSummary;
  initialTranscriptHistory: RuntimeBridgeTranscriptHistory;
  activation: ChatSeatActivation | null;
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
          activation={this.props.activation}
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

export function MissionControlChatRuntime({
  initialSummary,
  initialTranscriptHistory,
  activation = null,
}: {
  initialSummary: OrchestratorIntegrationSummary;
  initialTranscriptHistory: RuntimeBridgeTranscriptHistory;
  activation?: ChatSeatActivation | null;
}) {
  return (
    <MissionControlChatErrorBoundary
      initialSummary={initialSummary}
      initialTranscriptHistory={initialTranscriptHistory}
      activation={activation}
    >
      <MissionControlChatRuntimeInner
        initialSummary={initialSummary}
        initialTranscriptHistory={initialTranscriptHistory}
        activation={activation}
      />
    </MissionControlChatErrorBoundary>
  );
}
