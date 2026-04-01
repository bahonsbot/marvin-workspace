import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MCAutoNeedsInputReason, MCAutoTaskStatus } from '@/lib/autonomous';

const STORE_PATH = path.join(
  '/data/.openclaw/workspace/projects/mission-control',
  'data',
  'task-lifecycle-events.json',
);
const MAX_EVENTS = 120;

export type TaskLifecycleEventType = 'task.moved_to_review' | 'task.needs_input';

export interface TaskLifecycleEvent {
  id: string;
  dedupeKey: string;
  type: TaskLifecycleEventType;
  taskId: string;
  title: string;
  at: string;
  fromStatus: MCAutoTaskStatus | null;
  toStatus: MCAutoTaskStatus;
  summary?: string;
  artifactPath?: string;
  needsInputReason?: MCAutoNeedsInputReason;
}

type TaskLifecycleEventStore = {
  events: TaskLifecycleEvent[];
  meta: {
    schemaVersion: 1;
    updatedAt: string;
  };
};

function emptyStore(): TaskLifecycleEventStore {
  return {
    events: [],
    meta: {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function loadStore(): Promise<TaskLifecycleEventStore> {
  await ensureStoreDir();
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TaskLifecycleEventStore>;
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter((event): event is TaskLifecycleEvent => Boolean(event && typeof event === 'object' && typeof event.id === 'string'))
      : [];
    return {
      events,
      meta: {
        schemaVersion: 1,
        updatedAt: typeof parsed.meta?.updatedAt === 'string' ? parsed.meta.updatedAt : new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyStore();
    }
    throw error;
  }
}

async function saveStore(store: TaskLifecycleEventStore): Promise<void> {
  await ensureStoreDir();
  const next: TaskLifecycleEventStore = {
    events: store.events.slice(-MAX_EVENTS),
    meta: {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    },
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

export function buildTaskLifecycleEventId(input: {
  type: TaskLifecycleEventType;
  taskId: string;
  dedupeKey: string;
}): string {
  return `${input.type}:${input.taskId}:${input.dedupeKey}`;
}

export async function appendTaskLifecycleEvent(event: TaskLifecycleEvent): Promise<boolean> {
  const store = await loadStore();
  if (store.events.some((entry) => entry.id === event.id || entry.dedupeKey === event.dedupeKey)) {
    return false;
  }
  store.events.push(event);
  await saveStore(store);
  return true;
}

export async function listTaskLifecycleEvents(limit = 40): Promise<TaskLifecycleEvent[]> {
  const store = await loadStore();
  return store.events
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-Math.max(1, Math.min(limit, MAX_EVENTS)));
}
