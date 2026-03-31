import { promises as fs } from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = '/data/.openclaw/workspace';
const AUTONOMOUS_PATH = path.join(WORKSPACE_ROOT, 'AUTONOMOUS.md');
const TASKS_LOG_PATH = path.join(WORKSPACE_ROOT, 'memory', 'tasks-log.md');
const STORE_PATH = path.join(WORKSPACE_ROOT, 'projects', 'mission-control', 'data', 'autonomous-tasks.json');

export type MCAutoTaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type MCAutoTaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type MCAutoTaskSourceType = 'generated' | 'manual';
export type MCAutoTaskAgentTarget = 'marvin' | 'builder' | 'reviewer' | 'content-creator';
export type MCAutoRunStatus = 'running' | 'done' | 'error' | 'aborted';
export type MCAutoFeedbackAuthor = 'operator' | `agent:${string}`;
export type MCAutoLegacySection = 'open-backlog' | 'in-progress' | 'needs-input' | 'done' | 'done-today';

export interface MCAutoRun {
  sessionKey: string;
  childSessionKey?: string;
  sessionId?: string;
  runId?: string;
  startedAt: number;
  endedAt?: number;
  status: MCAutoRunStatus;
  summary?: string;
  result?: string;
  error?: string;
}

export interface MCAutoFeedback {
  at: number;
  by: MCAutoFeedbackAuthor;
  note: string;
}

export interface MCAutoArtifact {
  path: string;
  label?: string;
  kind?: 'file' | 'dir' | 'url' | 'log';
}

export interface MCAutoLegacyLink {
  kind: 'autonomous-md';
  sourceFile: string;
  section: MCAutoLegacySection;
  taskText: string;
  taskTextNormalized: string;
  queueLinked?: boolean;
  queueLabel?: string;
  completedInTasksLog?: boolean;
  completedOutputPath?: string;
}

export interface MCAutoSourceMeta {
  generator?: {
    createdBy: 'daily-task-generator';
    createdAt?: number;
    suggestionBatchId?: string;
  };
  manual?: {
    createdBy: 'operator';
    sourceSessionKey?: string;
  };
}

export interface MCAutoTask {
  id: string;
  title: string;
  description?: string;
  status: MCAutoTaskStatus;
  priority: MCAutoTaskPriority;
  sourceType: MCAutoTaskSourceType;
  agentTarget: MCAutoTaskAgentTarget;
  createdAt: number;
  updatedAt: number;
  version: number;
  columnOrder: number;
  editable: boolean;
  chatAnnouncementSent: boolean;
  run?: MCAutoRun;
  feedback: MCAutoFeedback[];
  artifacts: MCAutoArtifact[];
  linkedAutonomyRef?: MCAutoLegacyLink;
  sourceMeta?: MCAutoSourceMeta;
}

export interface MCAutoTaskStore {
  tasks: MCAutoTask[];
  meta: {
    schemaVersion: 1;
    updatedAt: number;
  };
}

export interface LegacyTaskEntry {
  section: MCAutoLegacySection;
  text: string;
  normalizedText: string;
  lineIndex: number;
}

const SECTION_TO_STATUS: Record<MCAutoLegacySection, MCAutoTaskStatus> = {
  'open-backlog': 'backlog',
  'in-progress': 'in-progress',
  'needs-input': 'todo',
  done: 'done',
  'done-today': 'done',
};

const SECTION_HEADERS: Record<MCAutoLegacySection, string> = {
  'open-backlog': '## Open Backlog',
  'in-progress': '## In Progress',
  'needs-input': '## Needs Input',
  done: '## Done',
  'done-today': '## Done Today',
};

function emptyStore(): MCAutoTaskStore {
  return {
    tasks: [],
    meta: {
      schemaVersion: 1,
      updatedAt: Date.now(),
    },
  };
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'task';
}

function uniqueTaskId(title: string, existingIds: Set<string>): string {
  const base = slugify(title);
  if (!existingIds.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

export function normalizeLegacyTaskText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
}

export async function loadStructuredTasks(): Promise<MCAutoTaskStore> {
  await ensureStoreDir();
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as MCAutoTaskStore;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      meta: {
        schemaVersion: 1,
        updatedAt: parsed.meta?.updatedAt ?? Date.now(),
      },
    };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyStore();
    }
    throw error;
  }
}

export async function saveStructuredTasks(store: MCAutoTaskStore): Promise<void> {
  await ensureStoreDir();
  const next: MCAutoTaskStore = {
    tasks: store.tasks,
    meta: {
      schemaVersion: 1,
      updatedAt: Date.now(),
    },
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

export async function readAutonomousMarkdown(): Promise<string> {
  return fs.readFile(AUTONOMOUS_PATH, 'utf8');
}

function parseSectionName(header: string): MCAutoLegacySection | null {
  switch (header.trim()) {
    case '## Open Backlog':
      return 'open-backlog';
    case '## In Progress':
      return 'in-progress';
    case '## Needs Input':
      return 'needs-input';
    case '## Done':
      return 'done';
    case '## Done Today':
      return 'done-today';
    default:
      return null;
  }
}

export function parseLegacyAutonomousTasks(markdown: string): LegacyTaskEntry[] {
  const lines = markdown.split('\n');
  const tasks: LegacyTaskEntry[] = [];
  let currentSection: MCAutoLegacySection | null = null;

  lines.forEach((line, index) => {
    if (line.startsWith('## ')) {
      currentSection = parseSectionName(line);
      return;
    }
    if (!currentSection) return;
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) return;
    const text = trimmed.slice(2).trim();
    if (!text || text.startsWith('*(')) return;
    tasks.push({
      section: currentSection,
      text,
      normalizedText: normalizeLegacyTaskText(text),
      lineIndex: index,
    });
  });

  return tasks;
}

function findLinkedTask(store: MCAutoTaskStore, entry: LegacyTaskEntry): MCAutoTask | undefined {
  return store.tasks.find((task) =>
    task.linkedAutonomyRef?.kind === 'autonomous-md'
    && task.linkedAutonomyRef.sourceFile === AUTONOMOUS_PATH
    && task.linkedAutonomyRef.taskTextNormalized === entry.normalizedText,
  );
}

function nextColumnOrder(tasks: MCAutoTask[], status: MCAutoTaskStatus): number {
  return tasks.filter((task) => task.status === status).reduce((max, task) => Math.max(max, task.columnOrder), -1) + 1;
}

export async function importLegacyAutonomousTasks(): Promise<{ imported: number; updated: number; store: MCAutoTaskStore }> {
  const [store, markdown] = await Promise.all([loadStructuredTasks(), readAutonomousMarkdown()]);
  const legacyTasks = parseLegacyAutonomousTasks(markdown).filter((entry) => entry.section === 'open-backlog' || entry.section === 'in-progress');
  const existingIds = new Set(store.tasks.map((task) => task.id));

  let imported = 0;
  let updated = 0;

  for (const entry of legacyTasks) {
    const linked = findLinkedTask(store, entry);
    const targetStatus = SECTION_TO_STATUS[entry.section];

    if (linked) {
      let changed = false;
      if (linked.status !== targetStatus) {
        linked.status = targetStatus;
        linked.columnOrder = nextColumnOrder(store.tasks.filter((task) => task.id !== linked.id), targetStatus);
        changed = true;
      }
      if (linked.linkedAutonomyRef) {
        if (linked.linkedAutonomyRef.section !== entry.section) {
          linked.linkedAutonomyRef.section = entry.section;
          changed = true;
        }
        if (linked.linkedAutonomyRef.taskText !== entry.text) {
          linked.linkedAutonomyRef.taskText = entry.text;
          linked.linkedAutonomyRef.taskTextNormalized = entry.normalizedText;
          changed = true;
        }
      }
      if (changed) {
        linked.updatedAt = Date.now();
        linked.version += 1;
        updated += 1;
      }
      continue;
    }

    const task: MCAutoTask = {
      id: uniqueTaskId(entry.text, existingIds),
      title: entry.text,
      status: targetStatus,
      priority: 'normal',
      sourceType: 'generated',
      agentTarget: 'marvin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      columnOrder: nextColumnOrder(store.tasks, targetStatus),
      editable: true,
      chatAnnouncementSent: false,
      feedback: [],
      artifacts: [],
      linkedAutonomyRef: {
        kind: 'autonomous-md',
        sourceFile: AUTONOMOUS_PATH,
        section: entry.section,
        taskText: entry.text,
        taskTextNormalized: entry.normalizedText,
      },
      sourceMeta: {
        generator: {
          createdBy: 'daily-task-generator',
        },
      },
    };
    existingIds.add(task.id);
    store.tasks.push(task);
    imported += 1;
  }

  const dedupeMap = new Map<string, MCAutoTask>();
  const dedupedTasks: MCAutoTask[] = [];
  let deduped = 0;
  for (const task of store.tasks) {
    const normalized = task.linkedAutonomyRef?.kind === 'autonomous-md' ? task.linkedAutonomyRef.taskTextNormalized : null;
    if (!normalized) {
      dedupedTasks.push(task);
      continue;
    }
    const existing = dedupeMap.get(normalized);
    if (!existing) {
      dedupeMap.set(normalized, task);
      dedupedTasks.push(task);
      continue;
    }
    const keepCurrent = (task.updatedAt ?? 0) >= (existing.updatedAt ?? 0);
    if (keepCurrent) {
      const replaceIndex = dedupedTasks.findIndex((candidate) => candidate.id === existing.id);
      if (replaceIndex !== -1) dedupedTasks[replaceIndex] = task;
      dedupeMap.set(normalized, task);
    }
    deduped += 1;
  }
  if (deduped > 0) {
    store.tasks = dedupedTasks;
    updated += deduped;
  }

  if (imported > 0 || updated > 0) {
    await saveStructuredTasks(store);
  }

  return { imported, updated, store };
}

function insertTaskIntoSection(markdown: string, section: MCAutoLegacySection, taskText: string): string {
  const lines = markdown.split('\n');
  const header = SECTION_HEADERS[section];
  const headerIndex = lines.findIndex((line) => line.trim() === header);
  if (headerIndex === -1) {
    const suffix = markdown.endsWith('\n') ? '' : '\n';
    return `${markdown}${suffix}\n${header}\n- ${taskText}\n`;
  }

  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length && !lines[insertIndex].startsWith('## ')) {
    insertIndex += 1;
  }

  lines.splice(insertIndex, 0, `- ${taskText}`);
  return lines.join('\n');
}

export async function createManualAutonomousTask(input: {
  title: string;
  description?: string;
  priority: MCAutoTaskPriority;
  agentTarget: MCAutoTaskAgentTarget;
  sourceSessionKey?: string;
}): Promise<MCAutoTask> {
  const [store, markdown] = await Promise.all([loadStructuredTasks(), readAutonomousMarkdown()]);
  const existingIds = new Set(store.tasks.map((task) => task.id));
  const now = Date.now();
  const normalized = normalizeLegacyTaskText(input.title);

  const duplicate = store.tasks.find((task) =>
    task.linkedAutonomyRef?.sourceFile === AUTONOMOUS_PATH
    && task.linkedAutonomyRef.taskTextNormalized === normalized,
  );
  if (duplicate) {
    return duplicate;
  }

  const task: MCAutoTask = {
    id: uniqueTaskId(input.title, existingIds),
    title: input.title,
    description: input.description,
    status: 'todo',
    priority: input.priority,
    sourceType: 'manual',
    agentTarget: input.agentTarget,
    createdAt: now,
    updatedAt: now,
    version: 1,
    columnOrder: nextColumnOrder(store.tasks, 'todo'),
    editable: true,
    chatAnnouncementSent: false,
    feedback: [],
    artifacts: [],
    linkedAutonomyRef: {
      kind: 'autonomous-md',
      sourceFile: AUTONOMOUS_PATH,
      section: 'open-backlog',
      taskText: input.title,
      taskTextNormalized: normalized,
    },
    sourceMeta: {
      manual: {
        createdBy: 'operator',
        sourceSessionKey: input.sourceSessionKey,
      },
    },
  };

  store.tasks.push(task);
  const nextMarkdown = insertTaskIntoSection(markdown, 'open-backlog', input.title);

  await Promise.all([
    saveStructuredTasks(store),
    fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8'),
  ]);

  return task;
}

function removeLegacyTaskLine(markdown: string, link: MCAutoLegacyLink): string {
  const lines = markdown.split('\n');
  let currentSection: MCAutoLegacySection | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      currentSection = parseSectionName(lines[i]);
      continue;
    }
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('- ')) continue;
    const text = trimmed.slice(2).trim();
    if (normalizeLegacyTaskText(text) !== link.taskTextNormalized) continue;
    if (currentSection !== link.section && currentSection !== 'open-backlog' && currentSection !== 'in-progress' && currentSection !== 'needs-input') continue;
    lines.splice(i, 1);
    return lines.join('\n');
  }

  return markdown;
}

export async function moveLinkedLegacyTask(task: MCAutoTask, targetSection: MCAutoLegacySection): Promise<void> {
  const link = task.linkedAutonomyRef;
  if (!link || link.kind !== 'autonomous-md') return;

  const markdown = await readAutonomousMarkdown();
  const withoutCurrent = removeLegacyTaskLine(markdown, link);
  const nextMarkdown = insertTaskIntoSection(withoutCurrent, targetSection, link.taskText);
  await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
}

export async function markLinkedLegacyTaskComplete(task: MCAutoTask, completionNote?: string): Promise<void> {
  const link = task.linkedAutonomyRef;
  if (!link || link.kind !== 'autonomous-md') return;

  const markdown = await readAutonomousMarkdown();
  let nextMarkdown = removeLegacyTaskLine(markdown, link);
  const completedText = completionNote ? `${task.title} | ✅ Completed: ${completionNote}` : task.title;
  nextMarkdown = insertTaskIntoSection(nextMarkdown, 'done-today', completedText);

  await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
}

export async function appendCompletionToTasksLog(task: MCAutoTask, outputPath?: string): Promise<void> {
  const line = `- ✅ [${nowIso()}] ${task.title}${outputPath ? ` | Output: ${outputPath}` : ''}\n`;
  await fs.mkdir(path.dirname(TASKS_LOG_PATH), { recursive: true });
  await fs.appendFile(TASKS_LOG_PATH, line, 'utf8');
}

export async function syncAutonomousTaskLinks(): Promise<{ linked: number; missing: number; store: MCAutoTaskStore }> {
  const [store, markdown] = await Promise.all([loadStructuredTasks(), readAutonomousMarkdown()]);
  const legacyTasks = parseLegacyAutonomousTasks(markdown);

  let linked = 0;
  let missing = 0;

  for (const task of store.tasks) {
    const link = task.linkedAutonomyRef;
    if (!link) continue;
    const exists = legacyTasks.some((entry) =>
      entry.section === link.section
      && entry.normalizedText === link.taskTextNormalized,
    );
    if (exists) linked += 1;
    else missing += 1;
  }

  return { linked, missing, store };
}


export async function getAutonomousTaskById(id: string): Promise<MCAutoTask | null> {
  const store = await loadStructuredTasks();
  return store.tasks.find((task) => task.id === id) ?? null;
}

export async function removeAutonomousTask(id: string): Promise<MCAutoTask | null> {
  const [store, markdown] = await Promise.all([loadStructuredTasks(), readAutonomousMarkdown()]);
  const index = store.tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;

  const [task] = store.tasks.splice(index, 1);

  const normalized = task.linkedAutonomyRef?.taskTextNormalized;
  if (normalized) {
    store.tasks = store.tasks.filter((candidate, candidateIndex) => {
      if (candidateIndex === index) return false;
      return candidate.linkedAutonomyRef?.taskTextNormalized !== normalized;
    });
  }

  await saveStructuredTasks(store);

  const link = task.linkedAutonomyRef;
  if (link?.kind === 'autonomous-md') {
    const nextMarkdown = removeLegacyTaskLine(markdown, link);
    if (nextMarkdown !== markdown) {
      await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
    }
  }

  return task;
}

export async function updateAutonomousTask(
  id: string,
  updater: (task: MCAutoTask) => MCAutoTask,
): Promise<MCAutoTask | null> {
  const store = await loadStructuredTasks();
  const index = store.tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  const next = updater(store.tasks[index]);
  store.tasks[index] = {
    ...next,
    updatedAt: Date.now(),
    version: Math.max((store.tasks[index].version ?? 1) + 1, next.version ?? 1),
  };
  await saveStructuredTasks(store);
  return store.tasks[index];
}


export async function approveAutonomousTask(id: string): Promise<MCAutoTask | null> {
  const task = await updateAutonomousTask(id, (current) => ({
    ...current,
    status: 'done',
    chatAnnouncementSent: true,
  }));
  if (!task) return null;
  await markLinkedLegacyTaskComplete(task, task.run?.summary);
  await appendCompletionToTasksLog(task, task.artifacts[0]?.path);
  return task;
}

export async function rejectAutonomousTask(id: string, note: string): Promise<MCAutoTask | null> {
  return updateAutonomousTask(id, (current) => ({
    ...current,
    status: 'todo',
    feedback: [
      ...(Array.isArray(current.feedback) ? current.feedback : []),
      { at: Date.now(), by: 'operator', note },
    ],
    run: current.run
      ? {
          ...current.run,
          status: current.run.status === 'running' ? 'aborted' : current.run.status,
        }
      : undefined,
  }));
}
