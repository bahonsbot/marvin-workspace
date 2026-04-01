import 'server-only';

import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import type { SearchQueryResponse, SearchResultItem, SearchScope } from '@/lib/types/contracts';

const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';

const MAX_RESULTS = 200;
const DEFAULT_RESULTS = 50;
const MAX_FILE_SIZE_BYTES = 768 * 1024;

const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.git',
  '__pycache__',
  '.cache',
  '.turbo',
]);

const EXCLUDED_FILE_SUFFIXES = ['.min.js', '.min.css', '.map', '.lock'];

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.scss',
  '.html',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.sql',
  '.toml',
  '.ini',
  '.env',
  '.xml',
]);

const OPERATIONAL_ROOT_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'USER.md',
  'TOOLS.md',
  'IDENTITY.md',
  'README.md',
  'AUTONOMOUS.md',
  'openclaw.json',
  'openclaw.local.json',
  'package.json',
];

function normalizeScope(scope: string | null | undefined): SearchScope {
  if (scope === 'memory') return 'memory';
  if (scope === 'files') return 'files';
  if (scope === 'docs') return 'docs';
  if (scope === 'projects') return 'projects';
  if (scope === 'scripts') return 'scripts';
  return 'all';
}

function clampLimit(limit: number | null | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_RESULTS;
  return Math.max(1, Math.min(MAX_RESULTS, Math.trunc(limit)));
}

function isTextPath(relativePath: string): boolean {
  const base = path.posix.basename(relativePath).toLowerCase();
  if (base.includes('.min.')) return false;
  if (EXCLUDED_FILE_SUFFIXES.some((suffix) => base.endsWith(suffix))) return false;

  const ext = path.posix.extname(relativePath).toLowerCase();
  if (ext.length === 0) return true;
  return TEXT_EXTENSIONS.has(ext);
}

function classifyScope(relativePath: string): Exclude<SearchScope, 'all'> {
  if (relativePath === 'MEMORY.md' || relativePath.startsWith('memory/') || relativePath.startsWith('.learnings/')) {
    return 'memory';
  }
  if (relativePath.startsWith('docs/')) return 'docs';
  if (relativePath.startsWith('projects/')) return 'projects';
  if (relativePath.startsWith('scripts/')) return 'scripts';
  return 'files';
}

function scoreScopeForOrdering(scope: Exclude<SearchScope, 'all'>) {
  if (scope === 'memory') return 0;
  if (scope === 'docs') return 1;
  if (scope === 'projects') return 2;
  if (scope === 'scripts') return 3;
  return 4;
}

function trimSnippet(line: string, query: string): string {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const queryIndex = cleaned.toLowerCase().indexOf(query.toLowerCase());
  if (queryIndex < 0 && cleaned.length <= 220) return cleaned;
  if (queryIndex < 0) return `${cleaned.slice(0, 217)}…`;

  const radius = 96;
  const start = Math.max(0, queryIndex - radius);
  const end = Math.min(cleaned.length, queryIndex + query.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < cleaned.length ? '…' : '';
  return `${prefix}${cleaned.slice(start, end)}${suffix}`;
}

function resolveTarget(relativePath: string): { targetHref: string; targetModule: 'memory' | 'files' } {
  if (relativePath === 'MEMORY.md') {
    return { targetHref: '/memory?section=durable', targetModule: 'memory' };
  }

  if (relativePath.startsWith('memory/')) {
    const filename = path.posix.basename(relativePath);
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (dateMatch) {
      return { targetHref: `/memory?section=daily&date=${dateMatch[1]}`, targetModule: 'memory' };
    }
    return { targetHref: '/memory?section=daily', targetModule: 'memory' };
  }

  if (relativePath.startsWith('.learnings/')) {
    const filename = path.posix.basename(relativePath);
    if (filename === 'errors.md') return { targetHref: '/memory?section=learnings&learning=errors', targetModule: 'memory' };
    if (filename === 'requests.md') return { targetHref: '/memory?section=learnings&learning=requests', targetModule: 'memory' };
    return { targetHref: '/memory?section=learnings&learning=corrections', targetModule: 'memory' };
  }

  const directory = path.posix.dirname(relativePath);
  return {
    targetHref: `/files?path=${encodeURIComponent(directory === '.' ? '.' : directory)}&file=${encodeURIComponent(relativePath)}#file-preview`,
    targetModule: 'files',
  };
}

async function statIfFile(absolutePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(absolutePath);
    return stat.isFile() && stat.size > 0 && stat.size <= MAX_FILE_SIZE_BYTES;
  } catch {
    return false;
  }
}

async function listOperationalRootFiles(): Promise<string[]> {
  const existing = await Promise.all(
    OPERATIONAL_ROOT_FILES.map(async (filename) => {
      const absolutePath = path.join(WORKSPACE_ROOT, filename);
      const ok = await statIfFile(absolutePath);
      return ok ? filename : null;
    }),
  );

  return existing.filter((entry): entry is string => Boolean(entry));
}

async function collectFilesUnderDirectory(relativeDir: string): Promise<string[]> {
  const startAbsolute = path.resolve(WORKSPACE_ROOT, relativeDir);
  const relativeBack = path.relative(WORKSPACE_ROOT, startAbsolute);
  if (relativeBack.startsWith('..') || path.isAbsolute(relativeBack)) return [];

  const results: string[] = [];
  const queue: string[] = [startAbsolute];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path.relative(WORKSPACE_ROOT, absolutePath).replace(/\\/g, '/');
      const firstSegment = relativePath.split('/')[0] ?? '';

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name) || EXCLUDED_DIRECTORIES.has(firstSegment)) continue;
        if (entry.name.startsWith('.git')) continue;
        queue.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!isTextPath(relativePath)) continue;

      try {
        const stat = await fs.stat(absolutePath);
        if (stat.size <= 0 || stat.size > MAX_FILE_SIZE_BYTES) continue;
      } catch {
        continue;
      }

      results.push(relativePath);
    }
  }

  return results;
}

async function collectCandidateFiles(scope: SearchScope): Promise<string[]> {
  const files = new Set<string>();

  const addIfFile = async (relativePath: string) => {
    const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
    if (!(await statIfFile(absolutePath))) return;
    if (!isTextPath(relativePath)) return;
    files.add(relativePath);
  };

  if (scope === 'memory' || scope === 'all') {
    await addIfFile('MEMORY.md');
    (await collectFilesUnderDirectory('memory')).forEach((item) => files.add(item));
    (await collectFilesUnderDirectory('.learnings')).forEach((item) => files.add(item));
  }

  if (scope === 'docs' || scope === 'all') {
    (await collectFilesUnderDirectory('docs')).forEach((item) => files.add(item));
  }

  if (scope === 'projects' || scope === 'all') {
    (await collectFilesUnderDirectory('projects')).forEach((item) => files.add(item));
  }

  if (scope === 'scripts' || scope === 'all') {
    (await collectFilesUnderDirectory('scripts')).forEach((item) => files.add(item));
  }

  if (scope === 'files' || scope === 'all') {
    (await listOperationalRootFiles()).forEach((item) => files.add(item));
  }

  return Array.from(files).sort((a, b) => {
    const scopeDiff = scoreScopeForOrdering(classifyScope(a)) - scoreScopeForOrdering(classifyScope(b));
    if (scopeDiff !== 0) return scopeDiff;
    return a.localeCompare(b);
  });
}

async function searchFile(params: {
  relativePath: string;
  query: string;
  limitRemaining: number;
}): Promise<SearchResultItem[]> {
  const { relativePath, query, limitRemaining } = params;
  if (limitRemaining <= 0) return [];

  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  let content = '';

  try {
    content = await fs.readFile(absolutePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const lowerQuery = query.toLowerCase();
  const sourceScope = classifyScope(relativePath);
  const { targetHref, targetModule } = resolveTarget(relativePath);
  const title = path.posix.basename(relativePath);

  const hits: SearchResultItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.toLowerCase().includes(lowerQuery)) continue;

    const snippet = trimSnippet(line, query);
    if (!snippet) continue;

    hits.push({
      id: `${relativePath}:${index + 1}`,
      sourceKind: sourceScope,
      title,
      path: relativePath,
      snippet,
      line: index + 1,
      targetHref,
      targetModule,
    });

    if (hits.length >= limitRemaining) break;
  }

  return hits;
}

export async function queryWorkspaceSearch(params: {
  query?: string | null;
  scope?: string | null;
  limit?: number | null;
}): Promise<SearchQueryResponse> {
  const queryRaw = (params.query ?? '').trim();
  const scope = normalizeScope(params.scope);
  const limit = clampLimit(params.limit);

  if (queryRaw.length === 0) {
    return {
      status: 'partial',
      query: '',
      scope,
      limit,
      total: 0,
      scannedFiles: 0,
      truncated: false,
      results: [],
      refreshedAt: new Date().toISOString(),
    };
  }

  const candidates = await collectCandidateFiles(scope);

  const results: SearchResultItem[] = [];
  let scannedFiles = 0;

  for (const relativePath of candidates) {
    if (results.length >= limit) break;
    scannedFiles += 1;

    const fileHits = await searchFile({
      relativePath,
      query: queryRaw,
      limitRemaining: limit - results.length,
    });

    if (fileHits.length > 0) {
      results.push(...fileHits);
    }
  }

  return {
    status: scannedFiles > 0 ? 'partial' : 'stub',
    query: queryRaw,
    scope,
    limit,
    total: results.length,
    scannedFiles,
    truncated: results.length >= limit,
    results,
    refreshedAt: new Date().toISOString(),
  };
}
