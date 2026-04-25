import { headers } from 'next/headers';
import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { resolveChatSeatActivation } from '@/lib/agents/chat-activation';
import { getOrchestratorIntegrationSummary, primeOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { resolveRuntimeBridgeLaneFromHeaders } from '@/lib/runtime-bridge-lane';
import { loadRuntimeBridgeSessionHistory } from '@/lib/runtime-bridge-history';

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
  const initialSessionKey = activation?.targetSessionKey ?? 'agent:main:main';
  const runtimeBridgeLane = resolveRuntimeBridgeLaneFromHeaders(requestHeaders);
  primeOrchestratorIntegrationSummary(runtimeBridgeLane);
  const [initialSummary, initialTranscriptHistory] = await Promise.all([
    getOrchestratorIntegrationSummary(runtimeBridgeLane),
    loadRuntimeBridgeSessionHistory(initialSessionKey),
  ]);

  return (
    <MissionControlChatRuntime
      initialSummary={initialSummary}
      initialTranscriptHistory={initialTranscriptHistory}
      activation={activation}
    />
  );
}
