import { AgentSection } from '@/components/agents/AgentSection';
import { QuietSessionsPanel } from '@/components/agents/QuietSessionsPanel';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { getAgentsPageData } from '@/lib/adapters/agents';

export default async function GeneralAgentsPage() {
  const data = await getAgentsPageData();

  return (
    <PageScaffold
      title="Agents"
      description=""
      titleVariant="system"
      hideHeader
    >
      <div style={{ display: 'grid', gap: 30 }}>
        {data.sections.map((section) => (
          <AgentSection key={section.id} section={section} />
        ))}

        <QuietSessionsPanel sessions={data.quietSessions} />
      </div>
    </PageScaffold>
  );
}
