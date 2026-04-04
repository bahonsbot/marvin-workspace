import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  LearningKind,
  MemoryDocument,
  MemoryDocumentKind,
  MemoryOverview,
  MemoryOverviewItem,
  MemorySection,
} from '@/lib/types/contracts';

const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';
const DURABLE_PATH = path.join(WORKSPACE_ROOT, 'MEMORY.md');
const DAILY_DIR = path.join(WORKSPACE_ROOT, 'memory');
const LEARNINGS_DIR = path.join(WORKSPACE_ROOT, '.learnings');

const learningFileMap: Record<LearningKind, { filename: string; title: string }> = {
  corrections: { filename: 'corrections.md', title: 'Corrections' },
  errors: { filename: 'errors.md', title: 'Errors' },
  requests: { filename: 'requests.md', title: 'Requests' },
};

function hoChiMinhToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

async function safeReadDocument(params: {
  filePath: string;
  kind: MemoryDocumentKind;
  title: string;
}): Promise<MemoryDocument> {
  const { filePath, kind, title } = params;

  try {
    const [content, stat] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)]);
    return {
      path: filePath,
      title,
      kind,
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      mtimeMs: stat.mtimeMs,
      writable: true,
      content,
      exists: true,
    };
  } catch {
    return {
      path: filePath,
      title,
      kind,
      updatedAt: null,
      mtimeMs: null,
      writable: true,
      content: '',
      exists: false,
    };
  }
}

async function listDailyFiles(): Promise<MemoryOverviewItem[]> {
  try {
    const entries = await fs.readdir(DAILY_DIR, { withFileTypes: true });
    const matches = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
        if (!match) return null;
        return {
          date: match[1],
          path: path.join(DAILY_DIR, entry.name),
        };
      })
      .filter(Boolean) as Array<{ date: string; path: string }>;

    const withStats = await Promise.all(
      matches.map(async (item) => {
        try {
          const stat = await fs.stat(item.path);
          return {
            path: item.path,
            title: item.date,
            kind: 'daily' as const,
            updatedAt: new Date(stat.mtimeMs).toISOString(),
          };
        } catch {
          return {
            path: item.path,
            title: item.date,
            kind: 'daily' as const,
            updatedAt: null,
          };
        }
      }),
    );

    return withStats.sort((a, b) => b.title.localeCompare(a.title));
  } catch {
    return [];
  }
}

async function listLearningFiles(): Promise<MemoryOverviewItem[]> {
  return Promise.all(
    (Object.keys(learningFileMap) as LearningKind[]).map(async (kind) => {
      const config = learningFileMap[kind];
      const filePath = path.join(LEARNINGS_DIR, config.filename);
      try {
        const stat = await fs.stat(filePath);
        return {
          path: filePath,
          title: config.title,
          kind,
          updatedAt: new Date(stat.mtimeMs).toISOString(),
        };
      } catch {
        return {
          path: filePath,
          title: config.title,
          kind,
          updatedAt: null,
        };
      }
    }),
  );
}

function resolveSection(section: string | null | undefined): MemorySection {
  if (section === 'daily') return 'daily';
  if (section === 'learnings') return 'learnings';
  return 'durable';
}

export function resolveLearningKind(input: string | null | undefined): LearningKind {
  if (input === 'errors') return 'errors';
  if (input === 'requests') return 'requests';
  return 'corrections';
}

export async function getMemoryOverview(): Promise<MemoryOverview> {
  const [durable, dailyFiles, learningFiles] = await Promise.all([
    safeReadDocument({ filePath: DURABLE_PATH, kind: 'durable', title: 'Durable Memory' }),
    listDailyFiles(),
    listLearningFiles(),
  ]);

  const today = hoChiMinhToday();
  const todayExists = dailyFiles.some((file) => file.title === today);

  return {
    status: durable.exists || dailyFiles.length > 0 || learningFiles.some((file) => file.updatedAt) ? 'partial' : 'stub',
    refreshedAt: new Date().toISOString(),
    durable: {
      path: durable.path,
      updatedAt: durable.updatedAt,
      exists: durable.exists,
    },
    daily: {
      files: dailyFiles,
      today,
      defaultDate: todayExists ? today : dailyFiles[0]?.title ?? null,
    },
    learnings: {
      files: learningFiles,
      defaultKind: 'corrections',
    },
  };
}

export async function getMemoryDocument(params: {
  section?: string | null;
  date?: string | null;
  learning?: string | null;
}): Promise<{ section: MemorySection; selectedDate: string | null; selectedLearning: LearningKind | null; document: MemoryDocument }> {
  const section = resolveSection(params.section);

  if (section === 'durable') {
    return {
      section,
      selectedDate: null,
      selectedLearning: null,
      document: await safeReadDocument({ filePath: DURABLE_PATH, kind: 'durable', title: 'Durable Memory' }),
    };
  }

  if (section === 'daily') {
    const overview = await getMemoryOverview();
    const requested = params.date;
    const hasRequested = requested ? overview.daily.files.some((file) => file.title === requested) : false;
    const selectedDate = hasRequested ? requested : overview.daily.defaultDate;

    const filePath = selectedDate ? path.join(DAILY_DIR, `${selectedDate}.md`) : path.join(DAILY_DIR, 'missing.md');
    return {
      section,
      selectedDate: selectedDate ?? null,
      selectedLearning: null,
      document: await safeReadDocument({
        filePath,
        kind: 'daily',
        title: selectedDate ? `Daily Memory · ${selectedDate}` : 'Daily Memory',
      }),
    };
  }

  const selectedLearning = resolveLearningKind(params.learning);
  const target = learningFileMap[selectedLearning];
  const filePath = path.join(LEARNINGS_DIR, target.filename);

  return {
    section,
    selectedDate: null,
    selectedLearning,
    document: await safeReadDocument({
      filePath,
      kind: selectedLearning,
      title: `Learnings · ${target.title}`,
    }),
  };
}

function resolveMemoryTarget(params: {
  section?: string | null;
  date?: string | null;
  learning?: string | null;
}): {
  section: MemorySection;
  selectedDate: string | null;
  selectedLearning: LearningKind | null;
  filePath: string;
  title: string;
  kind: MemoryDocumentKind;
} {
  const section = resolveSection(params.section);

  if (section === 'durable') {
    return {
      section,
      selectedDate: null,
      selectedLearning: null,
      filePath: DURABLE_PATH,
      title: 'Durable Memory',
      kind: 'durable',
    };
  }

  if (section === 'daily') {
    const selectedDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : hoChiMinhToday();
    return {
      section,
      selectedDate,
      selectedLearning: null,
      filePath: path.join(DAILY_DIR, `${selectedDate}.md`),
      title: `Daily Memory · ${selectedDate}`,
      kind: 'daily',
    };
  }

  const selectedLearning = resolveLearningKind(params.learning);
  const target = learningFileMap[selectedLearning];

  return {
    section,
    selectedDate: null,
    selectedLearning,
    filePath: path.join(LEARNINGS_DIR, target.filename),
    title: `Learnings · ${target.title}`,
    kind: selectedLearning,
  };
}

export async function writeMemoryDocument(params: {
  section?: string | null;
  date?: string | null;
  learning?: string | null;
  content: string;
  expectedMtimeMs: number | null;
}): Promise<{ section: MemorySection; selectedDate: string | null; selectedLearning: LearningKind | null; document: MemoryDocument }> {
  const target = resolveMemoryTarget(params);

  let existingStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    existingStat = await fs.stat(target.filePath);
    if (!existingStat.isFile()) {
      throw new Error('UNSUPPORTED');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  if (existingStat) {
    if (params.expectedMtimeMs == null || Math.abs(existingStat.mtimeMs - params.expectedMtimeMs) > 1) {
      throw new Error('CONFLICT');
    }
  } else if (params.expectedMtimeMs != null) {
    throw new Error('CONFLICT');
  }

  await fs.mkdir(path.dirname(target.filePath), { recursive: true });
  await fs.writeFile(target.filePath, params.content, 'utf8');

  return {
    section: target.section,
    selectedDate: target.selectedDate,
    selectedLearning: target.selectedLearning,
    document: await safeReadDocument({
      filePath: target.filePath,
      title: target.title,
      kind: target.kind,
    }),
  };
}
