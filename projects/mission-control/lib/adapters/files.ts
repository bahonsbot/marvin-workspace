import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FilesEntry, FilesListing, FilesPreview, FilesRoot } from '@/lib/types/contracts';

const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';

const CURATED_ROOTS: Array<{ id: string; label: string; path: string }> = [
  { id: 'workspace', label: 'Workspace', path: '.' },
  { id: 'memory', label: 'Memory Files', path: 'memory' },
  { id: 'agent-workspaces', label: 'Agent Workspaces', path: 'agent-workspaces' },
  { id: 'docs', label: 'Docs', path: 'docs' },
  { id: 'projects', label: 'Projects', path: 'projects' },
  { id: 'scripts', label: 'Scripts', path: 'scripts' },
  { id: 'config', label: 'Config', path: 'config' },
];

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

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

const HIDDEN_EXACT = new Set(['.learnings']);
const HIDDEN_PREFIXES = ['.learnings/'];
const WRITE_BLOCKED_EXACT = new Set(['MEMORY.md', 'memory', '.learnings']);
const WRITE_BLOCKED_PREFIXES = ['memory/', '.learnings/'];

function normalizeRelative(input: string | null | undefined): string {
  if (!input || input === '.') return '.';
  const decoded = decodeURIComponent(input);
  const normalized = path.posix.normalize(decoded.replace(/\\/g, '/'));
  const trimmed = normalized.replace(/^\/+/, '');
  if (!trimmed || trimmed === '.') return '.';
  return trimmed;
}

function isHiddenRelative(relativePath: string): boolean {
  const normalized = normalizeRelative(relativePath);
  if (HIDDEN_EXACT.has(normalized)) return true;
  return HIDDEN_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isWriteBlockedRelative(relativePath: string): boolean {
  const normalized = normalizeRelative(relativePath);
  if (WRITE_BLOCKED_EXACT.has(normalized)) return true;
  return WRITE_BLOCKED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function toAbsolute(relativePath: string): string | null {
  const normalized = normalizeRelative(relativePath);
  if (isHiddenRelative(normalized)) return null;

  const absolute = path.resolve(WORKSPACE_ROOT, normalized);
  const relativeFromRoot = path.relative(WORKSPACE_ROOT, absolute);
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) return null;

  return absolute;
}

function toPublicPath(absolutePath: string): string {
  const relative = path.relative(WORKSPACE_ROOT, absolutePath).replace(/\\/g, '/');
  return relative.length === 0 ? '.' : relative;
}

function formatUpdatedAt(stat: { mtimeMs: number }): string {
  return new Date(stat.mtimeMs).toISOString();
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function isPreviewableFile(filePath: string): boolean {
  return isTextFile(filePath) || isImageFile(filePath);
}

function isWritableFile(filePath: string): boolean {
  return isTextFile(filePath) && !isWriteBlockedRelative(filePath);
}

function buildBreadcrumb(relativePath: string): Array<{ label: string; path: string }> {
  const normalized = normalizeRelative(relativePath);
  if (normalized === '.') return [{ label: 'root', path: '.' }];

  const parts = normalized.split('/').filter(Boolean);
  const crumbs: Array<{ label: string; path: string }> = [{ label: 'root', path: '.' }];

  parts.forEach((part, index) => {
    crumbs.push({
      label: part,
      path: parts.slice(0, index + 1).join('/'),
    });
  });

  return crumbs;
}

async function existsDirectory(relativePath: string): Promise<boolean> {
  const absolute = toAbsolute(relativePath);
  if (!absolute) return false;

  try {
    const stat = await fs.stat(absolute);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function getFilesRoots(): Promise<FilesRoot[]> {
  const checks = await Promise.all(
    CURATED_ROOTS.map(async (root) => ({
      ...root,
      exists: await existsDirectory(root.path),
    })),
  );

  return checks
    .filter((root) => root.exists)
    .map((root) => ({ id: root.id, label: root.label, path: root.path }));
}

export async function getDirectoryListing(requestedPath: string | null | undefined): Promise<FilesListing> {
  const roots = await getFilesRoots();

  const targetPath = normalizeRelative(requestedPath);
  const targetAbsolute = toAbsolute(targetPath);

  const fallbackPath = roots.find((root) => root.path === '.')?.path ?? roots[0]?.path ?? '.';
  let resolvedDirectoryPath = fallbackPath;

  if (targetAbsolute) {
    try {
      const targetStat = await fs.stat(targetAbsolute);
      if (targetStat.isDirectory()) {
        resolvedDirectoryPath = toPublicPath(targetAbsolute);
      } else if (targetStat.isFile()) {
        resolvedDirectoryPath = toPublicPath(path.dirname(targetAbsolute));
      }
    } catch {
      resolvedDirectoryPath = fallbackPath;
    }
  }

  const directoryAbsolute = toAbsolute(resolvedDirectoryPath);
  if (!directoryAbsolute) {
    return {
      status: 'stub',
      refreshedAt: new Date().toISOString(),
      directory: {
        path: '.',
        breadcrumb: [{ label: 'workspace', path: '.' }],
      },
      roots,
      entries: [],
    };
  }

  try {
    const entriesRaw = await fs.readdir(directoryAbsolute, { withFileTypes: true });

    const visibleEntries = await Promise.all(
      entriesRaw
        .filter((entry) => !entry.name.startsWith('.next'))
        .filter((entry) => !entry.name.startsWith('node_modules'))
        .filter((entry) => !isHiddenRelative(path.posix.join(resolvedDirectoryPath === '.' ? '' : resolvedDirectoryPath, entry.name)))
        .map(async (entry): Promise<FilesEntry | null> => {
          const absolute = path.join(directoryAbsolute, entry.name);
          const relative = toPublicPath(absolute);

          try {
            const stat = await fs.stat(absolute);
            const isDir = entry.isDirectory();

            return {
              name: entry.name,
              path: relative,
              kind: isDir ? 'directory' : 'file',
              size: isDir ? null : stat.size,
              updatedAt: formatUpdatedAt(stat),
              previewable: isDir ? false : isPreviewableFile(relative),
            };
          } catch {
            return null;
          }
        }),
    );

    const entries = visibleEntries
      .filter((entry): entry is FilesEntry => Boolean(entry))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return {
      status: entries.length > 0 || roots.length > 0 ? 'partial' : 'stub',
      refreshedAt: new Date().toISOString(),
      directory: {
        path: resolvedDirectoryPath,
        breadcrumb: buildBreadcrumb(resolvedDirectoryPath),
      },
      roots,
      entries,
    };
  } catch {
    return {
      status: 'stub',
      refreshedAt: new Date().toISOString(),
      directory: {
        path: resolvedDirectoryPath,
        breadcrumb: buildBreadcrumb(resolvedDirectoryPath),
      },
      roots,
      entries: [],
    };
  }
}

export async function getFilePreview(requestedPath: string | null | undefined): Promise<FilesPreview> {
  const normalized = normalizeRelative(requestedPath);
  const absolute = toAbsolute(normalized);

  if (!absolute) {
    return {
      status: 'stub',
      refreshedAt: new Date().toISOString(),
      file: null,
      message: 'File is outside the allowed workspace scope.',
    };
  }

  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) {
      return {
        status: 'stub',
        refreshedAt: new Date().toISOString(),
        file: null,
        message: 'Selected path is not a file.',
      };
    }

    const relative = toPublicPath(absolute);
    const ext = path.extname(relative).toLowerCase();
    const mimeType = isImageFile(relative)
      ? ext === '.svg'
        ? 'image/svg+xml'
        : ext === '.png'
          ? 'image/png'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg'
      : isTextFile(relative)
        ? 'text/plain'
        : 'application/octet-stream';

    const base = {
      name: path.basename(relative),
      path: relative,
      mimeType,
      size: stat.size,
      updatedAt: formatUpdatedAt(stat),
      mtimeMs: stat.mtimeMs,
      writable: isWritableFile(relative),
      previewable: isPreviewableFile(relative),
    } as const;

    if (isTextFile(relative)) {
      const content = await fs.readFile(absolute, 'utf8');
      return {
        status: 'partial',
        refreshedAt: new Date().toISOString(),
        file: { ...base, kind: 'text' },
        textContent: content,
      };
    }

    if (isImageFile(relative)) {
      return {
        status: 'partial',
        refreshedAt: new Date().toISOString(),
        file: { ...base, kind: 'image' },
        imageUrl: `/api/files/raw?path=${encodeURIComponent(relative)}`,
      };
    }

    return {
      status: 'partial',
      refreshedAt: new Date().toISOString(),
      file: { ...base, kind: 'unsupported' },
      message: 'Preview is not available for this file type in Files V1.',
    };
  } catch {
    return {
      status: 'stub',
      refreshedAt: new Date().toISOString(),
      file: null,
      message: 'File not found.',
    };
  }
}

export async function writeFileContent(params: {
  requestedPath: string;
  content: string;
  expectedMtimeMs: number | null;
}): Promise<{
  path: string;
  updatedAt: string;
  mtimeMs: number;
}> {
  const normalized = normalizeRelative(params.requestedPath);
  const absolute = toAbsolute(normalized);

  if (!absolute || !isWritableFile(normalized)) {
    throw new Error('OUT_OF_SCOPE');
  }

  let stat;
  try {
    stat = await fs.stat(absolute);
  } catch {
    throw new Error('NOT_FOUND');
  }

  if (!stat.isFile() || !isTextFile(normalized)) {
    throw new Error('UNSUPPORTED');
  }

  if (params.expectedMtimeMs == null || Math.abs(stat.mtimeMs - params.expectedMtimeMs) > 1) {
    throw new Error('CONFLICT');
  }

  await fs.writeFile(absolute, params.content, 'utf8');
  const updatedStat = await fs.stat(absolute);

  return {
    path: normalized,
    updatedAt: formatUpdatedAt(updatedStat),
    mtimeMs: updatedStat.mtimeMs,
  };
}

export async function resolveRawFilePath(requestedPath: string | null | undefined): Promise<{
  absolutePath: string | null;
  mimeType: string;
}> {
  const normalized = normalizeRelative(requestedPath);
  const absolute = toAbsolute(normalized);
  if (!absolute) return { absolutePath: null, mimeType: 'application/octet-stream' };

  const ext = path.extname(normalized).toLowerCase();
  const mimeType = ext === '.svg'
    ? 'image/svg+xml'
    : ext === '.png'
      ? 'image/png'
      : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';

  return { absolutePath: absolute, mimeType };
}
