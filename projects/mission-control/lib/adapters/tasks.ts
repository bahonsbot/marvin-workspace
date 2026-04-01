import { promises as fs } from 'node:fs';
import type { TaskBoardSummary, TaskSyncStatus } from '@/lib/types/contracts';
import {
  normalizeAutonomousRunResult,
  selectPreferredArtifactPath,
  summarizeAutonomousResult,
} from '@/lib/autonomous-output';
import {
  loadStructuredTasks,
  normalizeLegacyTaskText,
  parseAutonomousExecutionEnvelope,
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
    model?: string;
    sourceType?: string;
    runStatus?: string;
    feedback?: string[];
    needsInputReason?: string;
    needsInputNote?: string;
    runError?: string;
    createdAt?: number;
    artifactPath?: string;
    resultSummary?: string;
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

function parseDoneTodayEntries(markdown: string): string[] {
  return markdown
    .split('\n')
    .reduce<{ entries: string[]; inDoneToday: boolean }>((state, line) => {
      if (line.startsWith('## Done Today')) return { ...state, inDoneToday: true };
      if (line.startsWith('## ')) return { ...state, inDoneToday: false };
      if (!state.inDoneToday) return state;
      const trimmed = line.trim();
      if (!trimmed.startsWith('- ')) return state;
      state.entries.push(normalizeLegacyTaskText(trimmed.slice(2)));
      return state;
    }, { entries: [], inDoneToday: false }).entries;
}

function removeStaleDoneTodayEntries(markdown: string, structuredDoneKeys: Set<string>): { markdown: string; removed: number } {
  const lines = markdown.split('\n');
  const nextLines: string[] = [];
  let inDoneToday = false;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith('## Done Today')) {
      inDoneToday = true;
      nextLines.push(line);
      continue;
    }
    if (line.startsWith('## ')) {
      inDoneToday = false;
      nextLines.push(line);
      continue;
    }
    if (!inDoneToday) {
      nextLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) {
      nextLines.push(line);
      continue;
    }
    const normalized = normalizeLegacyTaskText(trimmed.slice(2));
    if (!structuredDoneKeys.has(normalized)) {
      removed += 1;
      continue;
    }
    nextLines.push(line);
  }

  return { markdown: nextLines.join('\n'), removed };
}

function parseCompletedEntries(tasksLog: string): number {
  return tasksLog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ✅')).length;
}

async function resolveExistingArtifactPath(paths: string[]): Promise<string | undefined> {
  const preferredPath = selectPreferredArtifactPath(paths.map((path) => ({ path })));
  const orderedPaths = preferredPath ? [preferredPath, ...paths.filter((path) => path !== preferredPath)] : paths;

  for (const path of orderedPaths) {
    const candidate = selectPreferredArtifactPath([{ path }]);
    if (!candidate) continue;
    const absolutePath = candidate.startsWith('/data/.openclaw/workspace/') ? candidate : `/data/.openclaw/workspace/${candidate}`;
    try {
      await fs.stat(absolutePath);
      return candidate.startsWith('/data/.openclaw/workspace/') ? candidate.replace('/data/.openclaw/workspace/', '') : candidate;
    } catch {}
  }
  return undefined;
}

async function summarizeRunResult(task: MCAutoTask): Promise<{ summary?: string; artifactPath?: string; proof?: string }> {
  const result = task.run?.result;
  if (!result) return {};

  const envelope = parseAutonomousExecutionEnvelope(result);
  const normalized = normalizeAutonomousRunResult(result, [
    ...task.artifacts.map((artifact) => ({ path: artifact.path, kind: artifact.kind, label: artifact.label })),
    ...(envelope?.artifacts ?? []).map((artifact) => ({ path: artifact.path, kind: artifact.kind, label: artifact.label })),
  ]);
  const artifactPath = normalized.artifactPath ? await resolveExistingArtifactPath([normalized.artifactPath]) : undefined;

  return {
    summary: normalized.summary ? (normalized.summary.length > 180 ? `${normalized.summary.slice(0, 177).trimEnd()}…` : normalized.summary) : undefined,
    artifactPath,
    proof: normalized.proof,
  };
}

async function taskToBoardTask(task: MCAutoTask): Promise<BoardTask> {
  let column: BoardTask['column'];
  if (task.status === 'backlog') column = 'backlog';
  else if (task.status === 'todo') column = 'todo';
  else if (task.status === 'in-progress') column = 'inprogress';
  else if (task.status === 'review') column = 'review';
  else column = 'done';

  const runResult = await summarizeRunResult(task);
  const normalizedRunSummary = summarizeAutonomousResult(task.run?.summary);
  const completionFallback = runResult.artifactPath
    ? `Created output: ${runResult.artifactPath}`
    : 'Task completed and moved to Review.';
  const displaySummary = task.run?.status === 'rejected'
    ? 'Rejected. Waiting for Execute.'
    : task.run?.status === 'error'
      ? task.needsInput?.note ?? normalizedRunSummary ?? task.run?.error
      : runResult.summary ?? normalizedRunSummary ?? (task.run?.status === 'done' ? completionFallback : undefined);
  const detail: BoardTask['detail'] = {
    summary: task.title,
    ...(task.description ? { why: task.description } : {}),
    ...(displaySummary ? { completed: displaySummary } : {}),
    ...(runResult.proof ? { proof: runResult.proof } : {}),
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
      model: task.model,
      sourceType: task.sourceType,
      runStatus: task.run?.status,
      feedback: Array.isArray(task.feedback)
        ? task.feedback
          .filter((item) => item.by === 'operator')
          .map((item) => item.note)
          .filter((note): note is string => Boolean(note))
        : [],
      needsInputReason: task.needsInput?.reason,
      needsInputNote: task.needsInput?.note,
      runError: task.run?.error,
      createdAt: task.createdAt,
      artifactPath: runResult.artifactPath,
      resultSummary: displaySummary,
    },
  };
}

async function loadTaskSources() {
  const [store, autonomousRaw, tasksLogRaw, autonomousMtime, tasksLogMtime] = await Promise.all([
    loadStructuredTasks(),
    readAutonomousMarkdown().catch(() => null),
    fs.readFile(TASKS_LOG_PATH, 'utf8').catch(() => null),
    safeStatMtime(AUTONOMOUS_PATH),
    safeStatMtime(TASKS_LOG_PATH),
  ]);

  const boardTasks = await Promise.all(store.tasks.map((task) => taskToBoardTask(task)));
  const todo = boardTasks.filter((task) => task.column === 'todo');
  const inProgress = boardTasks.filter((task) => task.column === 'inprogress');
  const done = boardTasks.filter((task) => task.column === 'done');

  const autonomousCounts = autonomousRaw ? parseAutonomousCounts(autonomousRaw) : null;
  const doneTodayEntries = autonomousRaw ? parseDoneTodayEntries(autonomousRaw) : [];
  const completedEntries = tasksLogRaw ? parseCompletedEntries(tasksLogRaw) : null;
  const structuredDoneKeys = new Set(
    store.tasks
      .filter((task) => task.status === 'done')
      .flatMap((task) => {
        const keys = [normalizeLegacyTaskText(task.title)];
        const linkedKey = task.linkedAutonomyRef?.taskTextNormalized;
        if (linkedKey) keys.push(linkedKey);
        return keys;
      }),
  );
  const staleDoneTodayCount = doneTodayEntries.filter((entry) => !structuredDoneKeys.has(entry)).length;

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
      staleDoneTodayCount,
    },
    tasksLog: {
      path: TASKS_LOG_PATH,
      mtime: tasksLogMtime,
      completedEntries,
    },
  };
}

export async function cleanupTaskSyncDrift(): Promise<{ removedDoneToday: number; details: string }> {
  const [store, autonomousRaw] = await Promise.all([
    loadStructuredTasks(),
    readAutonomousMarkdown().catch(() => null),
  ]);

  if (!autonomousRaw) {
    return { removedDoneToday: 0, details: 'AUTONOMOUS.md unavailable; nothing cleaned.' };
  }

  const structuredDoneKeys = new Set(
    store.tasks
      .filter((task) => task.status === 'done')
      .flatMap((task) => {
        const keys = [normalizeLegacyTaskText(task.title)];
        const linkedKey = task.linkedAutonomyRef?.taskTextNormalized;
        if (linkedKey) keys.push(linkedKey);
        return keys;
      }),
  );

  const cleaned = removeStaleDoneTodayEntries(autonomousRaw, structuredDoneKeys);
  if (cleaned.removed > 0 && cleaned.markdown !== autonomousRaw) {
    await fs.writeFile(AUTONOMOUS_PATH, cleaned.markdown, 'utf8');
  }

  return {
    removedDoneToday: cleaned.removed,
    details: cleaned.removed > 0
      ? `Removed ${cleaned.removed} stale Done Today entr${cleaned.removed === 1 ? 'y' : 'ies'} from AUTONOMOUS.md.`
      : 'No stale Done Today entries found.',
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
      const liveDoneToday = source.autonomous.counts.doneToday - (source.autonomous.staleDoneTodayCount ?? 0);
      if (source.structured.counts.done < liveDoneToday) {
        issues.push(`Done count lower than live AUTONOMOUS Done Today (structured=${source.structured.counts.done}, live=${liveDoneToday}, staleIgnored=${source.autonomous.staleDoneTodayCount ?? 0})`);
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
    } else if ((source.autonomous.staleDoneTodayCount ?? 0) > 0) {
      details = `Sync aligned. Ignoring ${source.autonomous.staleDoneTodayCount} stale Done Today entr${source.autonomous.staleDoneTodayCount === 1 ? 'y' : 'ies'} left in AUTONOMOUS.md after cleanup.`;
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
