import { MissionControlChatRuntime } from '@/components/chat/MissionControlChatRuntime';
import { resolveChatSeatActivation } from '@/lib/agents/chat-activation';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';

export const dynamic = 'force-dynamic';

export default async function GeneralChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ seat?: string | string[] | undefined }>;
}) {
  const summary = await getOrchestratorIntegrationSummary();
  const params = await searchParams;
  const seatParam = Array.isArray(params?.seat) ? params.seat[0] : params?.seat;
  const activation = resolveChatSeatActivation(seatParam);

  return (
    <MissionControlChatRuntime
      initialSummary={summary}
      activation={activation}
    />
  );
}
