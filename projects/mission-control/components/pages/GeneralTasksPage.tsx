import { PageScaffold } from '@/components/shared/PageScaffold';
import { getTaskBoard, getTaskSyncStatus } from '@/lib/adapters/tasks';
import { TasksBoardSwitcher } from './TasksBoardSwitcher';

// ─── Server page ──────────────────────────────────────────────────────────────

export default async function TasksPage() {
  const [board, sync] = await Promise.all([getTaskBoard(), getTaskSyncStatus()]);

  return (
    <PageScaffold
      title="Tasks"
      titleVariant="system"
    >
      <TasksBoardSwitcher
        autonomousColumns={board.columns}
        syncState={sync.state}
        syncDetails={sync.details}
      />
    </PageScaffold>
  );
}
