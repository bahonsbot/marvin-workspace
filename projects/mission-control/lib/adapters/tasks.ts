import { promises as fs } from 'node:fs';
import type { TaskBoardSummary, TaskSyncStatus } from '@/lib/types/contracts';
import {
  importLegacyAutonomousTasks,
  normalizeLegacyTaskText,
  readAutonomousMarkdown,
  type MCAutoTask,
} from '@/lib/autonomous';

const AUTONOMOUS_PATH = '/data/.openclaw/workspace/AUTONOMOUS.md';
const TASKS_LOG_PATH = '/data/.openclaw/workspace/memory/tasks-log.md';

type BoardTask = {
  id: string;
  text: string;
  column: 'backlog' | 'todo' | 'inprogress' | 'review' | 'done';
  detail: {
    summary: string;
    why?: string;
    proof?: string;
    unlocks?: string;
    completed?: string;
  };
  meta?: {
    priority?: string;
    agentTarget?: string;
    sourceType?: string;
    runStatus?: string;
    createdAt?: number;
  };
};

function safeIsoFromMtime(ms: number | null): string | null {
  if (!ms || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

async function safeStatMtime(path: string): Promise<string | null> {
  try {
    const stat = await fs.stat(path);
    return safeIsoFromMtime(stat.mtimeMs);
  } catch {
    return null;
  }
}

function parseAutonomousCounts(markdown: string): { backlog: number; inProgress: number; doneToday: number } | null {
  const lines = markdown.split('\n');
  const sections: Record<'In Progress' | 'Done Today' | 'Open Backlog', number> = {
    'In Progress': 0,
    'Done Today': 0,
    'Open Backlog': 0,
  };

  let current: keyof typeof sections | null = null;
  for (const line of lines) {
    if (line.startsWith('## In Progress')) {
      current = 'In Progress';
      continue;
    }
    if (line.startsWith('## Done Today')) {
      current = 'Done Today';
      continue;
    }
    if (line.startsWith('## Open Backlog')) {
      current = 'Open Backlog';
      continue;
    }
    if (line.startsWith('## ')) {
      current = null;
      continue;
    }

    if (!current) continue;
    if (line.trim().startsWith('- ')) sections[current] += 1;
  }

  return {
    backlog: sections['Open Backlog'],
    inProgress: sections['In Progress'],
    doneToday: sections['Done Today'],
  };
}

function parseCompletedEntries(tasksLog: string): number {
  return tasksLog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ✅')).length;
}

function taskToBoardTask(task: MCAutoTask): BoardTask {
  let column: BoardTask['column'];
  if (task.status === 'backlog') column = 'backlog';
  else if (task.status === 'todo') column = 'todo';
  else if (task.status === 'in-progress') column = 'inprogress';
  else if (task.status === 'review') column = 'review';
  else column = 'done';

  const detail: BoardTask['detail'] = {
    summary: task.title,
    ...(task.description ? { why: task.description } : {}),
    ...(task.run?.summary ? { completed: task.run.summary } : {}),
  };

  const textParts = [task.title];
  if (detail.why) textParts.push(`Why: ${detail.why}`);
  if (detail.completed && column === 'done') textParts.push(`Completed: ${detail.completed}`);

  return {
    id: task.id,
    text: textParts.join(' | '),
    column,
    detail,
    meta: {
      priority: task.priority,
      agentTarget: task.agentTarget,
      sourceType: task.sourceType,
      runStatus: task.run?.status,
      createdAt: task.createdAt,
    },
  };
}

async function loadTaskSources() {
  const [{ store }, autonomousRaw, tasksLogRaw, autonomousMtime, tasksLogMtime] = await Promise.all([
    importLegacyAutonomousTasks(),
    readAutonomousMarkdown().catch(() => null),
    fs.readFile(TASKS_LOG_PATH, 'utf8').catch(() => null),
    safeStatMtime(AUTONOMOUS_PATH),
    safeStatMtime(TASKS_LOG_PATH),
  ]);

  const boardTasks = store.tasks.map(taskToBoardTask);
  const todo = boardTasks.filter((task) => task.column === 'todo');
  const inProgress = boardTasks.filter((task) => task.column === 'inprogress');
  const done = boardTasks.filter((task) => task.column === 'done');

  const autonomousCounts = autonomousRaw ? parseAutonomousCounts(autonomousRaw) : null;
  const completedEntries = tasksLogRaw ? parseCompletedEntries(tasksLogRaw) : null;

  return {
    boardUpdatedAt: safeIsoFromMtime(store.meta.updatedAt),
    columns: { backlog: boardTasks.filter((task) => task.column === 'backlog'), todo, inProgress, review: boardTasks.filter((task) => task.column === 'review'), done },
    structured: {
      path: '/data/.openclaw/workspace/projects/mission-control/data/autonomous-tasks.json',
      taskCount: store.tasks.length,
      counts: {
        backlog: store.tasks.filter((task) => task.status === 'backlog').length,
        todo: store.tasks.filter((task) => task.status === 'todo').length,
        inProgress: store.tasks.filter((task) => task.status === 'in-progress').length,
        review: store.tasks.filter((task) => task.status === 'review').length,
        done: store.tasks.filter((task) => task.status === 'done').length,
      },
    },
    autonomous: {
      path: AUTONOMOUS_PATH,
      mtime: autonomousMtime,
      counts: autonomousCounts,
    },
    tasksLog: {
      path: TASKS_LOG_PATH,
      mtime: tasksLogMtime,
      completedEntries,
    },
  };
}

export async function getTaskBoard(): Promise<TaskBoardSummary> {
  try {
    const source = await loadTaskSources();

    return {
      status: 'partial',
      columns: [
        { id: 'backlog', title: 'Backlog', count: source.columns.backlog.length, tasks: source.columns.backlog },
        { id: 'todo', title: 'To Do', count: source.columns.todo.length, tasks: source.columns.todo },
        {
          id: 'inprogress',
          title: 'In Progress',
          count: source.columns.inProgress.length,
          tasks: source.columns.inProgress,
        },
        { id: 'review', title: 'Review', count: source.columns.review.length, tasks: source.columns.review },
        { id: 'done', title: 'Done', count: source.columns.done.length, tasks: source.columns.done },
      ],
      boardUpdatedAt: source.boardUpdatedAt,
      sourceContext: {
        autonomous: source.autonomous,
        tasksLog: source.tasksLog,
      },
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'stub',
      columns: [],
      boardUpdatedAt: null,
      sourceContext: {
        autonomous: { path: AUTONOMOUS_PATH, mtime: null, counts: null },
        tasksLog: { path: TASKS_LOG_PATH, mtime: null, completedEntries: null },
      },
      refreshedAt: new Date().toISOString(),
    };
  }
}

export async function getTaskSyncStatus(): Promise<TaskSyncStatus> {
  try {
    const source = await loadTaskSources();
    const issues: string[] = [];

    const boardCounts = {
      backlog: source.columns.backlog.length,
      todo: source.columns.todo.length,
      inProgress: source.columns.inProgress.length,
      review: source.columns.review.length,
      done: source.columns.done.length,
    };

    if (!source.boardUpdatedAt) {
      issues.push('structured autonomous task store updatedAt missing');
    }

    if (source.autonomous.counts) {
      if (source.structured.counts.backlog < source.autonomous.counts.backlog) {
        issues.push(`Backlog count lower than AUTONOMOUS Open Backlog (structured=${source.structured.counts.backlog}, AUTONOMOUS=${source.autonomous.counts.backlog})`);
      }
      if (source.structured.counts.inProgress !== source.autonomous.counts.inProgress) {
        issues.push(
          `In Progress mismatch (structured=${source.structured.counts.inProgress}, AUTONOMOUS=${source.autonomous.counts.inProgress})`,
        );
      }
      if (source.structured.counts.review !== boardCounts.review) {
        issues.push(
          `Review lane mismatch (structured=${source.structured.counts.review}, board=${boardCounts.review})`,
        );
      }
      if (source.structured.counts.done < source.autonomous.counts.doneToday) {
        issues.push(`Done count lower than AUTONOMOUS Done Today (structured=${source.structured.counts.done}, AUTONOMOUS=${source.autonomous.counts.doneToday})`);
      }
    } else {
      issues.push('AUTONOMOUS.md counts unavailable');
    }

    // tasks-log.md is an append-only historical completion log, not a current-state lane.
    // Do not treat higher historical completion counts as active sync drift.

    const state: TaskSyncStatus['state'] = issues.length > 0 ? 'drift' : 'ok';

    let details = 'Structured Autonomous store and legacy autonomy files look aligned enough for current Tasks UI.';
    if (issues.length > 0) {
      details = issues.join(' ');
    }

    return {
      status: 'partial',
      state,
      details,
      boardUpdatedAt: source.boardUpdatedAt,
      sourceContext: {
        autonomousMtime: source.autonomous.mtime,
        tasksLogMtime: source.tasksLog.mtime,
        countComparison: source.autonomous.counts
          ? {
              board: boardCounts,
              autonomous: {
                backlog: source.autonomous.counts.backlog,
                todo: source.structured.counts.todo,
                inProgress: source.autonomous.counts.inProgress,
                review: source.structured.counts.review,
                doneToday: source.autonomous.counts.doneToday,
              },
            }
          : undefined,
      },
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'stub',
      state: 'unknown',
      details: 'Task sync status unavailable because source reads failed.',
      boardUpdatedAt: null,
      sourceContext: {
        autonomousMtime: null,
        tasksLogMtime: null,
      },
      refreshedAt: new Date().toISOString(),
    };
  }
}

export { normalizeLegacyTaskText };
