import { PageScaffold } from '@/components/shared/PageScaffold';
import { getTaskBoard, getTaskSyncStatus } from '@/lib/adapters/tasks';
import { TasksBoardSwitcher } from './TasksBoardSwitcher';

// ─── Server page ──────────────────────────────────────────────────────────────

export default async function TasksPage() {
  const [board, sync] = await Promise.all([getTaskBoard(), getTaskSyncStatus()]);

  return (
    <PageScaffold
      title="Tasks"
      description="Multi-board workspace for active work. Switch between boards to see different task domains."
    >
      <TasksBoardSwitcher
        autonomousColumns={board.columns}
        syncState={sync.state}
        syncDetails={sync.details}
      />
    </PageScaffold>
  );
}
