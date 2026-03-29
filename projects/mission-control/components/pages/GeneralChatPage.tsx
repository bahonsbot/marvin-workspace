import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const summary = await getOrchestratorIntegrationSummary();

  return (
    <PageScaffold
      title="Chat"
      titleVariant="system"
    >
      <MissionControlChatRuntime initialSummary={summary} />
    </PageScaffold>
  );
}
