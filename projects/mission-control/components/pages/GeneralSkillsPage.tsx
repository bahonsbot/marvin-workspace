import { PageScaffold } from '@/components/shared/PageScaffold';
import { getSkillsSummary } from '@/lib/adapters/skills';
import { SkillsWorkspaceClient } from '@/components/pages/SkillsWorkspaceClient';

export const dynamic = 'force-dynamic';

export default async function GeneralSkillsPage() {
  const summary = await getSkillsSummary();

  return (
    <div id="page-top">
      <PageScaffold title="Skills" titleVariant="system" hideHeader>
        <SkillsWorkspaceClient initialSummary={summary} />
      </PageScaffold>
    </div>
  );
}
