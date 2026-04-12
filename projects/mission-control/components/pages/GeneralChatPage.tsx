import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { loadRuntimeBridgeSessionHistory } from '@/lib/runtime-bridge-history';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const [summary, initialTranscriptHistory] = await Promise.all([
    getOrchestratorIntegrationSummary(),
    loadRuntimeBridgeSessionHistory('agent:main:main'),
  ]);

  return (
    <MissionControlChatRuntime
      initialSummary={summary}
      initialTranscriptHistory={initialTranscriptHistory}
    />
  );
}
