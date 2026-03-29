import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const summary = await getOrchestratorIntegrationSummary();

  return <MissionControlChatRuntime initialSummary={summary} />;
}
