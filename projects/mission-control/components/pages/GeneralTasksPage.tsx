import { PageScaffold } from '@/components/shared/PageScaffold';
import { resolveWebResearchProvider } from '@/lib/autonomous-preflight';
import { getTaskBoard, getTaskSyncStatus } from '@/lib/adapters/tasks';
import { TasksBoardSwitcher } from './TasksBoardSwitcher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Server page ──────────────────────────────────────────────────────────────

export default async function TasksPage() {
  const [board, sync] = await Promise.all([getTaskBoard(), getTaskSyncStatus()]);
  const webResearchEnabled = Boolean(resolveWebResearchProvider());

  return (
    <PageScaffold
      title="Tasks"
      titleVariant="system"
      hideHeader
    >
      <TasksBoardSwitcher
        autonomousColumns={board.columns}
        syncState={sync.state}
        syncDetails={sync.details}
        webResearchEnabled={webResearchEnabled}
      />
    </PageScaffold>
  );
}
