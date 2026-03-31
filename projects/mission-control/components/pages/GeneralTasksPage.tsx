import { PageScaffold } from '@/components/shared/PageScaffold';
import { getTaskBoard, getTaskSyncStatus } from '@/lib/adapters/tasks';
import { TasksBoardSwitcher } from './TasksBoardSwitcher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Server page ──────────────────────────────────────────────────────────────

export default async function TasksPage() {
  const [board, sync] = await Promise.all([getTaskBoard(), getTaskSyncStatus()]);

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
      />
    </PageScaffold>
  );
}
