import { headers } from 'next/headers';
import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { resolveChatSeatActivation } from '@/lib/agents/chat-activation';
import { primeOrchestratorIntegrationSummary, readOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { resolveRuntimeBridgeLaneFromHeaders } from '@/lib/runtime-bridge-lane';
import type { RuntimeBridgeTranscriptHistory } from '@/lib/types/contracts';

export const dynamic = 'force-dynamic';

export default async function GeneralChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ seat?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const seatParam = Array.isArray(params?.seat) ? params.seat[0] : params?.seat;
  const activation = resolveChatSeatActivation(seatParam);
  const runtimeBridgeLane = resolveRuntimeBridgeLaneFromHeaders(requestHeaders);
  primeOrchestratorIntegrationSummary(runtimeBridgeLane);
  const initialSummary = await readOrchestratorIntegrationSummary(runtimeBridgeLane);
  const initialTranscriptHistory: RuntimeBridgeTranscriptHistory = {
    sessionKey: activation?.targetSessionKey ?? 'agent:main:main',
    entries: [],
    messages: [],
    source: 'unavailable',
    note: 'Transcript history loads after the Chat page appears.',
    retryable: false,
  };

  return (
    <MissionControlChatRuntime
      initialSummary={initialSummary}
      initialTranscriptHistory={initialTranscriptHistory}
      activation={activation}
    />
  );
}
