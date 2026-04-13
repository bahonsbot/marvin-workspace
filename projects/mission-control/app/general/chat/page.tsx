import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { resolveChatSeatActivation } from '@/lib/agents/chat-activation';
import { createDeferredOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { loadRuntimeBridgeSessionHistory } from '@/lib/runtime-bridge-history';

export const dynamic = 'force-dynamic';

export default async function GeneralChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ seat?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const seatParam = Array.isArray(params?.seat) ? params.seat[0] : params?.seat;
  const activation = resolveChatSeatActivation(seatParam);
  const initialSessionKey = activation?.targetSessionKey ?? 'agent:main:main';
  const initialTranscriptHistory = await loadRuntimeBridgeSessionHistory(initialSessionKey);

  return (
    <MissionControlChatRuntime
      initialSummary={createDeferredOrchestratorIntegrationSummary()}
      initialTranscriptHistory={initialTranscriptHistory}
      activation={activation}
    />
  );
}
