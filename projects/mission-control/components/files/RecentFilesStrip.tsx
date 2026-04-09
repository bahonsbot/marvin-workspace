'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mission-control:files:recent';
const MAX_RECENT_FILES = 8;

function dirname(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length <= 1) return '.';
  return parts.slice(0, -1).join('/');
}

function basename(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  return parts[parts.length - 1] || filePath;
}

function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [];
  }
}

function persistRecentFiles(paths: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(0, MAX_RECENT_FILES)));
  } catch {
    // ignore storage errors
  }
}

export function RecentFilesStrip({ activeFilePath }: { activeFilePath: string | null }) {
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  useEffect(() => {
    setRecentFiles(loadRecentFiles());
  }, []);

  useEffect(() => {
    if (!activeFilePath) return;

    setRecentFiles((current) => {
      const next = [activeFilePath, ...current.filter((item) => item !== activeFilePath)].slice(0, MAX_RECENT_FILES);
      persistRecentFiles(next);
      return next;
    });
  }, [activeFilePath]);

  const visibleFiles = useMemo(() => recentFiles.filter(Boolean).slice(0, MAX_RECENT_FILES), [recentFiles]);

  if (visibleFiles.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.35, textTransform: 'uppercase', color: 'var(--muted)' }}>Recent files</div>
      <div className="floating-pill-row">
        {visibleFiles.map((filePath) => {
          const active = filePath === activeFilePath;
          return (
            <Link
              key={filePath}
              href={`/general/files?path=${encodeURIComponent(dirname(filePath))}&file=${encodeURIComponent(filePath)}#file-preview`}
              className={`floating-pill${active ? ' floating-pill-active' : ''}`}
              style={{ fontFamily: 'monospace', maxWidth: 260 }}
              title={filePath}
            >
              {basename(filePath)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
