import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  extractAutonomousArtifactsFromResult,
  summarizeAutonomousResult,
} from '@/lib/autonomous-output';
import {
  appendTaskLifecycleEvent,
  buildTaskLifecycleEventId,
} from '@/lib/task-lifecycle-events';
import { normalizeAutonomousTaskModel, type AutonomousTaskModelAlias } from '@/lib/task-models';

const WORKSPACE_ROOT = '/data/.openclaw/workspace';
const AUTONOMOUS_PATH = path.join(WORKSPACE_ROOT, 'AUTONOMOUS.md');
const TASKS_LOG_PATH = path.join(WORKSPACE_ROOT, 'memory', 'tasks-log.md');
const QUEUE_PATH = path.join(WORKSPACE_ROOT, 'memory', 'executor-subagent-queue.json');
const STORE_PATH = path.join(WORKSPACE_ROOT, 'projects', 'mission-control', 'data', 'autonomous-tasks.json');

export type MCAutoTaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type MCAutoTaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type MCAutoTaskSourceType = 'generated' | 'manual';
export type MCAutoTaskAgentTarget = 'marvin' | 'builder' | 'reviewer' | 'content-creator';
export type MCAutoRunStatus = 'running' | 'done' | 'error' | 'aborted' | 'rejected';
export type MCAutoRunTrigger = 'direct' | 'queue';
export type MCAutoFeedbackAuthor = 'operator' | `agent:${string}`;
export type MCAutoLegacySection = 'open-backlog' | 'in-progress' | 'review' | 'needs-input' | 'done' | 'done-today';
export type MCAutoNeedsInputReason = 'rejected' | 'execution-failed' | 'queue-blocked' | 'missing-web-research-capability';

export interface MCAutoRun {
  attemptId: string;
  attemptNumber: number;
  trigger: MCAutoRunTrigger;
  model?: AutonomousTaskModelAlias;
  sessionKey: string;
  childSessionKey?: string;
  sessionId?: string;
  runId?: string;
  sourceLabel?: string;
  startedAt: number;
  endedAt?: number;
  status: MCAutoRunStatus;
  summary?: string;
  result?: string;
  error?: string;
  feedbackAt?: number;
  feedbackNote?: string;
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

export interface MCAutoExecutionEnvelope {
  schema: 'mission-control-autonomous-run-v1';
  summary?: string;
  warnings?: string[];
  artifacts?: MCAutoArtifact[];
  proof?: string;
  rawOutput?: string;
}

export interface MCAutoNeedsInput {
  reason: MCAutoNeedsInputReason;
  at: number;
  note?: string;
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
  model?: AutonomousTaskModelAlias;
  createdAt: number;
  updatedAt: number;
  version: number;
  columnOrder: number;
  editable: boolean;
  chatAnnouncementSent: boolean;
  run?: MCAutoRun;
  needsInput?: MCAutoNeedsInput;
  feedback: MCAutoFeedback[];
  artifacts: MCAutoArtifact[];
  linkedAutonomyRef?: MCAutoLegacyLink;
  sourceMeta?: MCAutoSourceMeta;
}

export interface MCAutoTaskStore {
  tasks: MCAutoTask[];
  meta: {
    schemaVersion: 2;
    updatedAt: number;
    suppressedLegacyTaskKeys: string[];
  };
}

async function emitTaskMovedToReviewEvent(input: {
  taskId: string;
  title: string;
  fromStatus: MCAutoTaskStatus | null;
  summary?: string;
  artifactPath?: string;
  occurredAt: number;
  dedupeKey: string;
}): Promise<void> {
  await appendTaskLifecycleEvent({
    id: buildTaskLifecycleEventId({
      type: 'task.moved_to_review',
      taskId: input.taskId,
      dedupeKey: input.dedupeKey,
    }),
    dedupeKey: input.dedupeKey,
    type: 'task.moved_to_review',
    taskId: input.taskId,
    title: input.title,
    at: new Date(input.occurredAt).toISOString(),
    fromStatus: input.fromStatus,
    toStatus: 'review',
    summary: input.summary,
    artifactPath: input.artifactPath,
  });
}

async function emitTaskNeedsInputEvent(input: {
  taskId: string;
  title: string;
  fromStatus: MCAutoTaskStatus | null;
  reason: MCAutoNeedsInputReason;
  note?: string;
  occurredAt: number;
  dedupeKey: string;
}): Promise<void> {
  await appendTaskLifecycleEvent({
    id: buildTaskLifecycleEventId({
      type: 'task.needs_input',
      taskId: input.taskId,
      dedupeKey: input.dedupeKey,
    }),
    dedupeKey: input.dedupeKey,
    type: 'task.needs_input',
    taskId: input.taskId,
    title: input.title,
    at: new Date(input.occurredAt).toISOString(),
    fromStatus: input.fromStatus,
    toStatus: 'todo',
    summary: input.note,
    needsInputReason: input.reason,
  });
}

export interface LegacyTaskEntry {
  section: MCAutoLegacySection;
  text: string;
  description?: string;
  normalizedText: string;
  lineIndex: number;
}

interface QueueTaskEntry {
  task?: string;
  label?: string;
  status?: string;
  note?: string;
  outputPath?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  reviewStatus?: string;
}

const ACTIVE_LEGACY_SECTIONS: MCAutoLegacySection[] = ['open-backlog', 'in-progress', 'review', 'needs-input'];

const SECTION_HEADERS: Record<MCAutoLegacySection, string> = {
  'open-backlog': '## Open Backlog',
  'in-progress': '## In Progress',
  review: '## Review',
  'needs-input': '## Needs Input',
  done: '## Done',
  'done-today': '## Done Today',
};

function emptyStore(): MCAutoTaskStore {
  return {
    tasks: [],
    meta: {
      schemaVersion: 2,
      updatedAt: Date.now(),
      suppressedLegacyTaskKeys: [],
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
  return value.trim().replace(/^[-*]\s+/, '').replace(/\s+/g, ' ').toLowerCase();
}

export function isMeaningfulRetryFeedback(entry: MCAutoFeedback | null | undefined): entry is MCAutoFeedback {
  const note = String(entry?.note ?? '').trim();
  if (!note) return false;
  if (entry?.by !== 'operator') return false;
  if (note === 'Rejected without note.') return false;
  if (/^Execution failed:/i.test(note)) return false;
  if (/^Imported from AUTONOMOUS\.md/i.test(note)) return false;
  if (/^Queue execution blocked\.?$/i.test(note)) return false;
  if (/^(approved|accepted|looks good|lgtm|done|completed|ship it|works as is)\b/i.test(note)) return false;
  return true;
}

export function latestMeaningfulRetryFeedback(task: Pick<MCAutoTask, 'feedback'>): MCAutoFeedback | null {
  const feedback = Array.isArray(task.feedback) ? [...task.feedback] : [];
  return feedback
    .reverse()
    .find((entry) => isMeaningfulRetryFeedback(entry)) ?? null;
}

export function summarizeAutonomousOutput(result: string | undefined): string | undefined {
  return summarizeAutonomousResult(result);
}

export function extractAutonomousArtifacts(result: string | undefined): MCAutoArtifact[] {
  return extractAutonomousArtifactsFromResult(result);
}

export function parseAutonomousExecutionEnvelope(result: string | undefined): MCAutoExecutionEnvelope | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as MCAutoExecutionEnvelope;
    return parsed?.schema === 'mission-control-autonomous-run-v1' ? parsed : null;
  } catch {
    return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeArtifacts(value: unknown): MCAutoArtifact[] {
  if (!Array.isArray(value)) return [];
  const artifacts: MCAutoArtifact[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      artifacts.push({ path: entry, kind: 'file' });
      continue;
    }
    if (!entry || typeof entry !== 'object' || typeof (entry as { path?: unknown }).path !== 'string') {
      continue;
    }
    const artifact = entry as MCAutoArtifact;
    artifacts.push({
      path: artifact.path,
      label: artifact.label,
      kind: artifact.kind,
    });
  }
  return artifacts;
}

function normalizeFeedback(value: unknown): MCAutoFeedback[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Partial<MCAutoFeedback>;
      if (typeof item.note !== 'string' || typeof item.by !== 'string') return null;
      return {
        at: typeof item.at === 'number' ? item.at : Date.now(),
        by: item.by as MCAutoFeedbackAuthor,
        note: item.note,
      };
    })
    .filter((entry): entry is MCAutoFeedback => Boolean(entry));
}

function normalizeRun(taskId: string, value: unknown): MCAutoRun | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const run = value as Partial<MCAutoRun> & { sessionKey?: string; startedAt?: number; status?: string };
  if (typeof run.sessionKey !== 'string' || typeof run.startedAt !== 'number' || typeof run.status !== 'string') {
    return undefined;
  }
  const attemptNumber = typeof run.attemptNumber === 'number' && Number.isFinite(run.attemptNumber) ? run.attemptNumber : 1;
  return {
    attemptId: typeof run.attemptId === 'string' ? run.attemptId : `${taskId}-attempt-${attemptNumber}`,
    attemptNumber,
    trigger: run.trigger === 'queue' ? 'queue' : 'direct',
    model: normalizeAutonomousTaskModel(run.model),
    sessionKey: run.sessionKey,
    childSessionKey: typeof run.childSessionKey === 'string' ? run.childSessionKey : undefined,
    sessionId: typeof run.sessionId === 'string' ? run.sessionId : undefined,
    runId: typeof run.runId === 'string' ? run.runId : undefined,
    sourceLabel: typeof run.sourceLabel === 'string' ? run.sourceLabel : undefined,
    startedAt: run.startedAt,
    endedAt: typeof run.endedAt === 'number' ? run.endedAt : undefined,
    status: run.status === 'done' || run.status === 'error' || run.status === 'aborted' || run.status === 'rejected'
      ? run.status
      : 'running',
    summary: typeof run.summary === 'string' ? run.summary : undefined,
    result: typeof run.result === 'string' ? run.result : undefined,
    error: typeof run.error === 'string' ? run.error : undefined,
    feedbackAt: typeof run.feedbackAt === 'number' ? run.feedbackAt : undefined,
    feedbackNote: typeof run.feedbackNote === 'string' ? run.feedbackNote : undefined,
  };
}

function normalizeNeedsInput(value: unknown): MCAutoNeedsInput | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const needsInput = value as Partial<MCAutoNeedsInput>;
  if (
    needsInput.reason !== 'rejected'
    && needsInput.reason !== 'execution-failed'
    && needsInput.reason !== 'queue-blocked'
    && needsInput.reason !== 'missing-web-research-capability'
  ) {
    return undefined;
  }
  return {
    reason: needsInput.reason,
    at: typeof needsInput.at === 'number' ? needsInput.at : Date.now(),
    note: typeof needsInput.note === 'string' ? needsInput.note : undefined,
  };
}

function normalizeTask(task: Partial<MCAutoTask>): MCAutoTask {
  return {
    id: typeof task.id === 'string' ? task.id : slugify(String(task.title ?? 'task')),
    title: typeof task.title === 'string' ? task.title : 'Untitled task',
    description: typeof task.description === 'string' ? task.description : undefined,
    status: task.status === 'backlog' || task.status === 'todo' || task.status === 'in-progress' || task.status === 'review' || task.status === 'done'
      ? task.status
      : 'backlog',
    priority: task.priority === 'critical' || task.priority === 'high' || task.priority === 'low' ? task.priority : 'normal',
    sourceType: task.sourceType === 'manual' ? 'manual' : 'generated',
    agentTarget: task.agentTarget === 'builder' || task.agentTarget === 'reviewer' || task.agentTarget === 'content-creator' ? task.agentTarget : 'marvin',
    model: normalizeAutonomousTaskModel(task.model),
    createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
    updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : Date.now(),
    version: typeof task.version === 'number' ? task.version : 1,
    columnOrder: typeof task.columnOrder === 'number' ? task.columnOrder : 0,
    editable: task.editable !== false,
    chatAnnouncementSent: task.chatAnnouncementSent === true,
    run: normalizeRun(String(task.id ?? ''), task.run),
    needsInput: normalizeNeedsInput(task.needsInput),
    feedback: normalizeFeedback(task.feedback),
    artifacts: normalizeArtifacts(task.artifacts),
    linkedAutonomyRef: task.linkedAutonomyRef?.kind === 'autonomous-md'
      ? {
          ...task.linkedAutonomyRef,
          queueLinked: task.linkedAutonomyRef.queueLinked === true,
          queueLabel: typeof task.linkedAutonomyRef.queueLabel === 'string' ? task.linkedAutonomyRef.queueLabel : undefined,
          completedInTasksLog: task.linkedAutonomyRef.completedInTasksLog === true,
          completedOutputPath: typeof task.linkedAutonomyRef.completedOutputPath === 'string' ? task.linkedAutonomyRef.completedOutputPath : undefined,
        }
      : undefined,
    sourceMeta: task.sourceMeta,
  };
}

function taskNeedsInputSection(task: MCAutoTask): MCAutoLegacySection {
  if (task.status === 'in-progress') return 'in-progress';
  if (task.status === 'review') return 'review';
  if (task.status === 'done') return 'done-today';
  if (task.status === 'todo' && task.needsInput) return 'needs-input';
  return 'open-backlog';
}

function nextColumnOrder(tasks: MCAutoTask[], status: MCAutoTaskStatus): number {
  return tasks
    .filter((task) => task.status === status)
    .reduce((max, task) => Math.max(max, task.columnOrder), -1) + 1;
}

function addArtifact(task: MCAutoTask, artifact: MCAutoArtifact): void {
  if (task.artifacts.some((entry) => entry.path === artifact.path)) return;
  task.artifacts.push(artifact);
}

function ensureSuppressedKey(store: MCAutoTaskStore, normalizedText: string): void {
  if (store.meta.suppressedLegacyTaskKeys.includes(normalizedText)) return;
  store.meta.suppressedLegacyTaskKeys.push(normalizedText);
}

function clearSuppressedKey(store: MCAutoTaskStore, normalizedText: string): void {
  store.meta.suppressedLegacyTaskKeys = store.meta.suppressedLegacyTaskKeys.filter((entry) => entry !== normalizedText);
}

function parseQueueTimestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.replace(' ', 'T'));
  return Number.isNaN(parsed) ? null : parsed;
}

function queueSnapshotAt(entry: QueueTaskEntry): number {
  return (
    parseQueueTimestamp(entry.completedAt)
    ?? parseQueueTimestamp(entry.updatedAt)
    ?? parseQueueTimestamp(entry.startedAt)
    ?? parseQueueTimestamp(entry.queuedAt)
    ?? Date.now()
  );
}

function queueSummary(entry: QueueTaskEntry): string | undefined {
  return entry.note?.trim() || entry.outputPath?.trim() || undefined;
}

function queueRunStatus(entry: QueueTaskEntry): MCAutoRunStatus | null {
  switch (entry.status) {
    case 'spawned':
      return 'running';
    case 'completed':
      return 'done';
    case 'blocked':
      return 'error';
    default:
      return null;
  }
}

function matchesActiveQueueRun(task: MCAutoTask, entry: QueueTaskEntry): boolean {
  if (task.run?.trigger !== 'queue') return false;
  if (!entry.label) return false;
  if (task.run.sourceLabel === entry.label) return true;
  if (task.linkedAutonomyRef?.queueLabel === entry.label) return true;
  return false;
}

async function loadQueueEntries(): Promise<QueueTaskEntry[]> {
  try {
    const raw = await fs.readFile(QUEUE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as QueueTaskEntry[] : [];
  } catch {
    return [];
  }
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
}

export async function loadStructuredTasks(): Promise<MCAutoTaskStore> {
  await ensureStoreDir();
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MCAutoTaskStore>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((task) => normalizeTask(task)) : [],
      meta: {
        schemaVersion: 2,
        updatedAt: parsed.meta?.updatedAt ?? Date.now(),
        suppressedLegacyTaskKeys: Array.isArray(parsed.meta?.suppressedLegacyTaskKeys)
          ? parsed.meta.suppressedLegacyTaskKeys.filter((entry): entry is string => typeof entry === 'string')
          : [],
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
    tasks: store.tasks.map((task) => normalizeTask(task)),
    meta: {
      schemaVersion: 2,
      updatedAt: Date.now(),
      suppressedLegacyTaskKeys: [...new Set(store.meta.suppressedLegacyTaskKeys)].sort(),
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
    case '## Review':
      return 'review';
    case '## Done':
      return 'done';
    case '## Done Today':
      return 'done-today';
    default:
      return null;
  }
}

function extractBriefDescription(taskLines: string[]): string | undefined {
  const briefIndex = taskLines.findIndex((line) => line.trim().startsWith('**Brief:**'));
  if (briefIndex === -1) return undefined;

  const firstLine = taskLines[briefIndex].trim();
  const inline = firstLine.replace(/^\*\*Brief:\*\*\s*/i, '').trim();
  if (inline) {
    return inline;
  }

  const continuation: string[] = [];
  for (let i = briefIndex + 1; i < taskLines.length; i += 1) {
    const candidate = taskLines[i].trim();
    if (!candidate) continue;
    if (candidate.startsWith('| ')) break;
    if (/^\*\*[^*]+:\*\*/.test(candidate)) break;
    continuation.push(candidate);
  }

  return continuation.length > 0 ? continuation.join(' ') : undefined;
}

export function parseLegacyAutonomousTasks(markdown: string): LegacyTaskEntry[] {
  const lines = markdown.split('\n');
  const tasks: LegacyTaskEntry[] = [];
  let currentSection: MCAutoLegacySection | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith('## ')) {
      currentSection = parseSectionName(line);
      continue;
    }
    if (!currentSection) continue;

    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) continue;

    const text = trimmed.slice(2).trim();
    if (!text || text.startsWith('*(')) continue;

    const taskLines: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (nextLine.startsWith('## ')) break;
      if (nextLine.trim().startsWith('- ')) break;
      taskLines.push(nextLine);
      cursor += 1;
    }

    tasks.push({
      section: currentSection,
      text,
      description: extractBriefDescription(taskLines),
      normalizedText: normalizeLegacyTaskText(text),
      lineIndex: index,
    });
  }

  return tasks;
}

function findLinkedTask(store: MCAutoTaskStore, entry: LegacyTaskEntry): MCAutoTask | undefined {
  return store.tasks.find((task) =>
    task.linkedAutonomyRef?.kind === 'autonomous-md'
    && task.linkedAutonomyRef.sourceFile === AUTONOMOUS_PATH
    && task.linkedAutonomyRef.taskTextNormalized === entry.normalizedText,
  );
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

function removeLegacyTaskLine(markdown: string, link: MCAutoLegacyLink): string {
  const lines = markdown.split('\n');
  let currentSection: MCAutoLegacySection | null = null;
  const nextLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('## ')) {
      currentSection = parseSectionName(line);
      nextLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) {
      nextLines.push(line);
      continue;
    }

    const text = trimmed.slice(2).trim();
    const normalizedText = normalizeLegacyTaskText(text);
    const completedPrefix = normalizeLegacyTaskText(`${link.taskText} | ✅`);
    const isMatchingTask = normalizedText === link.taskTextNormalized || normalizedText.startsWith(completedPrefix);
    const isManagedSection = currentSection === link.section
      || currentSection === 'open-backlog'
      || currentSection === 'in-progress'
      || currentSection === 'review'
      || currentSection === 'needs-input'
      || currentSection === 'done'
      || currentSection === 'done-today';

    if (isMatchingTask && isManagedSection) {
      while (index + 1 < lines.length) {
        const next = lines[index + 1];
        if (next.startsWith('## ') || next.trim().startsWith('- ')) break;
        index += 1;
      }
      continue;
    }

    nextLines.push(line);
  }

  return nextLines.join('\n');
}
async function safelyReadAutonomousMarkdown(): Promise<string | null> {
  try {
    return await readAutonomousMarkdown();
  } catch {
    return null;
  }
}

export async function importLegacyAutonomousTasks(): Promise<{ imported: number; updated: number; store: MCAutoTaskStore }> {
  // The structured JSON store is the only current-state authority.
  // Import only seeds missing legacy tasks and refreshes queue-backed tasks that still match the active run identity.
  const [store, markdown, queueEntries] = await Promise.all([
    loadStructuredTasks(),
    safelyReadAutonomousMarkdown(),
    loadQueueEntries(),
  ]);

  const suppressed = new Set(store.meta.suppressedLegacyTaskKeys);
  const parsedLegacyTasks = markdown ? parseLegacyAutonomousTasks(markdown) : [];
  const legacyTasks = parsedLegacyTasks.filter((entry) => ACTIVE_LEGACY_SECTIONS.includes(entry.section));
  const existingIds = new Set(store.tasks.map((task) => task.id));
  let nextMarkdown = markdown;
  let imported = 0;
  let updated = 0;

  for (const entry of legacyTasks) {
    if (findLinkedTask(store, entry)) {
      clearSuppressedKey(store, entry.normalizedText);
      continue;
    }

    if (suppressed.has(entry.normalizedText)) {
      clearSuppressedKey(store, entry.normalizedText);
    }

    const status: MCAutoTaskStatus = entry.section === 'in-progress'
      ? 'in-progress'
      : entry.section === 'review'
        ? 'review'
        : entry.section === 'needs-input'
          ? 'todo'
          : 'backlog';

    const task: MCAutoTask = {
      id: uniqueTaskId(entry.text, existingIds),
      title: entry.text,
      description: entry.description,
      status,
      priority: 'normal',
      sourceType: 'generated',
      agentTarget: 'marvin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      columnOrder: nextColumnOrder(store.tasks, status),
      editable: true,
      chatAnnouncementSent: false,
      run: undefined,
      needsInput: entry.section === 'needs-input'
        ? { reason: 'queue-blocked', at: Date.now(), note: 'Imported from AUTONOMOUS.md Needs Input.' }
        : undefined,
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

  const queueByLabel = new Map(
    queueEntries
      .filter((entry) => typeof entry.label === 'string' && entry.label.trim())
      .map((entry) => [entry.label as string, entry] as const),
  );
  const lifecycleEvents: Array<Promise<void>> = [];

  for (const task of store.tasks) {
    const link = task.linkedAutonomyRef;
    if (!link || !task.run?.sourceLabel) continue;
    const previousStatus = task.status;
    const previousNeedsInputNote = task.needsInput?.note;

    const queueEntry = queueByLabel.get(task.run.sourceLabel);
    if (!queueEntry || !matchesActiveQueueRun(task, queueEntry)) continue;

    const queueStatus = queueRunStatus(queueEntry);
    if (!queueStatus) continue;

    const snapshotAt = queueSnapshotAt(queueEntry);
    if (task.updatedAt > snapshotAt && task.run.endedAt && task.run.endedAt >= snapshotAt) {
      continue;
    }

    let changed = false;

    if (link.queueLabel !== queueEntry.label) {
      link.queueLabel = queueEntry.label;
      link.queueLinked = true;
      changed = true;
    }

    if (queueEntry.outputPath && link.completedOutputPath !== queueEntry.outputPath) {
      link.completedOutputPath = queueEntry.outputPath;
      addArtifact(task, { path: queueEntry.outputPath, label: 'Queue output', kind: 'file' });
      changed = true;
    }

    if (queueStatus === 'running') {
      if (task.status !== 'in-progress') {
        task.status = 'in-progress';
        task.columnOrder = nextColumnOrder(store.tasks.filter((candidate) => candidate.id !== task.id), 'in-progress');
        task.needsInput = undefined;
        changed = true;
      }
      if (task.run.status !== 'running') {
        task.run.status = 'running';
        task.run.summary = queueSummary(queueEntry) ?? task.run.summary;
        changed = true;
      }
    }

    if (queueStatus === 'done') {
      if (task.status !== 'review') {
        task.status = 'review';
        task.columnOrder = nextColumnOrder(store.tasks.filter((candidate) => candidate.id !== task.id), 'review');
        task.needsInput = undefined;
        lifecycleEvents.push(
          emitTaskMovedToReviewEvent({
            taskId: task.id,
            title: task.title,
            fromStatus: previousStatus,
            summary: queueSummary(queueEntry) ?? task.run.summary,
            artifactPath: queueEntry.outputPath,
            occurredAt: snapshotAt,
            dedupeKey: `task.moved_to_review:${task.id}:${task.run.attemptId}:${snapshotAt}`,
          }),
        );
        changed = true;
      }
      if (task.run.status !== 'done' || task.run.summary !== queueSummary(queueEntry)) {
        task.run = {
          ...task.run,
          status: 'done',
          endedAt: snapshotAt,
          summary: queueSummary(queueEntry) ?? task.run.summary,
          result: queueEntry.outputPath ? `Artifact: ${queueEntry.outputPath}` : task.run.result,
          error: undefined,
        };
        changed = true;
      }
    }

    if (queueStatus === 'error') {
      const note = queueEntry.note?.trim() || 'Queue execution blocked.';
      if (task.status !== 'todo') {
        task.status = 'todo';
        task.columnOrder = nextColumnOrder(store.tasks.filter((candidate) => candidate.id !== task.id), 'todo');
        changed = true;
      }
      if (!task.needsInput || task.needsInput.reason !== 'queue-blocked' || task.needsInput.note !== note) {
        task.needsInput = { reason: 'queue-blocked', at: snapshotAt, note };
        changed = true;
      }
      if (!task.feedback.some((entry) => entry.by === 'operator' && entry.note === note)) {
        task.feedback.push({ at: snapshotAt, by: 'operator', note });
        changed = true;
      }
      task.run = {
        ...task.run,
        status: 'error',
        endedAt: snapshotAt,
        summary: queueSummary(queueEntry) ?? task.run.summary,
        error: note,
      };
      if (previousStatus !== 'todo' || previousNeedsInputNote !== note) {
        lifecycleEvents.push(
          emitTaskNeedsInputEvent({
            taskId: task.id,
            title: task.title,
            fromStatus: previousStatus,
            reason: 'queue-blocked',
            note,
            occurredAt: snapshotAt,
            dedupeKey: `task.needs_input:${task.id}:${task.run.attemptId}:${snapshotAt}`,
          }),
        );
      }
      changed = true;
    }

    const targetSection = taskNeedsInputSection(task);
    if (link.section !== targetSection) {
      const previousLink = { ...link };
      link.section = targetSection;
      if (nextMarkdown) {
        nextMarkdown = insertTaskIntoSection(removeLegacyTaskLine(nextMarkdown, previousLink), targetSection, link.taskText);
      }
      changed = true;
    }

    if (changed) {
      task.updatedAt = Date.now();
      task.version += 1;
      updated += 1;
    }
  }

  if (nextMarkdown && markdown && nextMarkdown !== markdown) {
    await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
  }

  if (imported > 0 || updated > 0) {
    await saveStructuredTasks(store);
  }
  if (lifecycleEvents.length > 0) {
    await Promise.all(lifecycleEvents);
  }

  return { imported, updated, store };
}

export async function createManualAutonomousTask(input: {
  title: string;
  description?: string;
  priority: MCAutoTaskPriority;
  agentTarget: MCAutoTaskAgentTarget;
  model?: AutonomousTaskModelAlias;
  sourceSessionKey?: string;
}): Promise<MCAutoTask> {
  const [store, markdown] = await Promise.all([loadStructuredTasks(), safelyReadAutonomousMarkdown()]);
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

  clearSuppressedKey(store, normalized);

  const task: MCAutoTask = {
    id: uniqueTaskId(input.title, existingIds),
    title: input.title,
    description: input.description,
    status: 'backlog',
    priority: input.priority,
    sourceType: 'manual',
    agentTarget: input.agentTarget,
    model: input.model,
    createdAt: now,
    updatedAt: now,
    version: 1,
    columnOrder: nextColumnOrder(store.tasks, 'backlog'),
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
  await saveStructuredTasks(store);

  if (markdown) {
    const nextMarkdown = insertTaskIntoSection(markdown, 'open-backlog', input.title);
    await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
  }

  return task;
}

export async function moveLinkedLegacyTask(task: MCAutoTask, targetSection: MCAutoLegacySection): Promise<void> {
  const link = task.linkedAutonomyRef;
  if (!link || link.kind !== 'autonomous-md') return;

  const markdown = await safelyReadAutonomousMarkdown();
  if (!markdown) return;
  const withoutCurrent = removeLegacyTaskLine(markdown, link);
  const nextMarkdown = insertTaskIntoSection(withoutCurrent, targetSection, link.taskText);
  await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
}

export async function rewriteLinkedLegacyTaskText(link: MCAutoLegacyLink, nextTaskText: string): Promise<void> {
  if (!link || link.kind !== 'autonomous-md') return;

  const markdown = await safelyReadAutonomousMarkdown();
  if (!markdown) return;
  const withoutCurrent = removeLegacyTaskLine(markdown, link);
  const nextMarkdown = insertTaskIntoSection(withoutCurrent, link.section, nextTaskText);
  await fs.writeFile(AUTONOMOUS_PATH, nextMarkdown, 'utf8');
}

export async function markLinkedLegacyTaskComplete(task: MCAutoTask, completionNote?: string): Promise<void> {
  const link = task.linkedAutonomyRef;
  if (!link || link.kind !== 'autonomous-md') return;

  const markdown = await safelyReadAutonomousMarkdown();
  if (!markdown) return;
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
  const [store, markdown] = await Promise.all([loadStructuredTasks(), safelyReadAutonomousMarkdown()]);
  const legacyTasks = markdown ? parseLegacyAutonomousTasks(markdown) : [];

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
  const [store, markdown] = await Promise.all([loadStructuredTasks(), safelyReadAutonomousMarkdown()]);
  const index = store.tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;

  const [task] = store.tasks.splice(index, 1);
  const normalized = task.linkedAutonomyRef?.taskTextNormalized ?? normalizeLegacyTaskText(task.title);
  ensureSuppressedKey(store, normalized);
  store.tasks = store.tasks.filter((candidate) => candidate.linkedAutonomyRef?.taskTextNormalized !== normalized);

  await saveStructuredTasks(store);

  const link = task.linkedAutonomyRef;
  if (link?.kind === 'autonomous-md' && markdown) {
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
  const current = store.tasks[index];
  const next = normalizeTask(updater(current));
  store.tasks[index] = {
    ...next,
    updatedAt: Date.now(),
    version: Math.max((current.version ?? 1) + 1, next.version ?? 1),
  };
  await saveStructuredTasks(store);
  return store.tasks[index];
}

export async function approveAutonomousTask(id: string): Promise<MCAutoTask | null> {
  const task = await updateAutonomousTask(id, (current) => ({
    ...current,
    status: 'done',
    needsInput: undefined,
    chatAnnouncementSent: true,
    linkedAutonomyRef: current.linkedAutonomyRef
      ? {
          ...current.linkedAutonomyRef,
          section: 'done-today',
        }
      : current.linkedAutonomyRef,
  }));
  if (!task) return null;
  await markLinkedLegacyTaskComplete(task, task.run?.summary);
  await appendCompletionToTasksLog(task, task.artifacts[0]?.path);
  return task;
}

export async function rejectAutonomousTask(id: string, note: string): Promise<MCAutoTask | null> {
  const existing = await getAutonomousTaskById(id);
  if (!existing) return null;

  const eventAt = Date.now();
  const task = await updateAutonomousTask(id, (current) => ({
    ...current,
    status: 'todo',
    needsInput: {
      reason: 'rejected',
      at: eventAt,
      note,
    },
    chatAnnouncementSent: false,
    feedback: [
      ...(Array.isArray(current.feedback) ? current.feedback : []),
      { at: Date.now(), by: 'operator', note },
    ],
    artifacts: [],
    linkedAutonomyRef: current.linkedAutonomyRef
      ? {
          ...current.linkedAutonomyRef,
          section: 'needs-input',
          queueLinked: false,
          queueLabel: undefined,
          completedOutputPath: undefined,
        }
      : current.linkedAutonomyRef,
    run: current.run
      ? {
          ...current.run,
          endedAt: eventAt,
          status: 'rejected',
          summary: 'Rejected and waiting for a fresh execute.',
          result: undefined,
          error: undefined,
        }
      : current.run,
  }));
  if (!task) return null;

  if (task.linkedAutonomyRef) {
    await moveLinkedLegacyTask(task, 'needs-input');
  }
  await emitTaskNeedsInputEvent({
    taskId: task.id,
    title: task.title,
    fromStatus: existing.status,
    reason: 'rejected',
    note,
    occurredAt: eventAt,
    dedupeKey: `task.needs_input:${task.id}:${task.run?.attemptId ?? 'rejected'}:${eventAt}`,
  });

  return getAutonomousTaskById(id);
}
