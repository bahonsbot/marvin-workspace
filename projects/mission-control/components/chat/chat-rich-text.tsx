'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export const monoFont =
  '"SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export function normalizeWorkspacePath(candidate: string): string | null {
  const trimmed = candidate.trim();
  const workspacePrefix = '/data/.openclaw/workspace/';
  const normalized = trimmed.startsWith(workspacePrefix) ? trimmed.slice(workspacePrefix.length) : trimmed;
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) return null;
  return normalized;
}

export function isLikelyWorkspaceFilePath(candidate: string): boolean {
  const normalized = normalizeWorkspacePath(candidate);
  if (!normalized) return false;
  if (!normalized.includes('/')) return false;
  const allowedRoots = ['projects/', 'docs/', 'scripts/', 'memory/', 'config/', 'skills/', 'model-guidance/', 'uploads/', 'app/', 'components/', 'lib/', 'public/'];
  if (!allowedRoots.some((root) => normalized.startsWith(root))) return false;
  const lastSegment = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (!lastSegment || !lastSegment.includes('.')) return false;
  if (lastSegment.startsWith('.')) return false;
  return /^[A-Za-z0-9._-]+$/.test(lastSegment);
}

export function buildFilesHref(path: string): string {
  const normalized = normalizeWorkspacePath(path) ?? path;
  const parentPath = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
  const params = new URLSearchParams();
  if (parentPath) params.set('path', parentPath);
  params.set('file', normalized);
  return `/general/files?${params.toString()}`;
}

export function renderPlainTextWithFileLinks(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const filePathPattern = /(^|[\s([{"'])((?:(?:\/data\/\.openclaw\/workspace\/)?(?:projects|docs|scripts|memory|config|skills|model-guidance|uploads|app|components|lib|public)\/[A-Za-z0-9._\-/]+\.[A-Za-z0-9._-]{1,16}))(?=$|[\s)\]}",:;!?'])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = filePathPattern.exec(text)) !== null) {
    const [fullMatch, prefix, rawPath] = match;
    const matchIndex = match.index;
    const pathStart = matchIndex + prefix.length;

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }

    if (prefix) {
      nodes.push(prefix);
    }

    const normalizedPath = normalizeWorkspacePath(rawPath);
    if (normalizedPath && isLikelyWorkspaceFilePath(rawPath)) {
      nodes.push(
        <Link
          key={`${keyPrefix}-file-${pathStart}`}
          href={buildFilesHref(normalizedPath)}
          style={{ color: 'var(--accent-strong)', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {rawPath}
        </Link>,
      );
    } else {
      nodes.push(rawPath);
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function renderInlineRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const normalized = text
    .replace(/\\\*/g, '__ESCAPED_STAR__')
    .replace(/\\`/g, '__ESCAPED_TICK__');
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderPlainTextWithFileLinks(
          normalized
            .slice(lastIndex, match.index)
            .replace(/__ESCAPED_STAR__/g, '*')
            .replace(/__ESCAPED_TICK__/g, '`'),
          `plain-${match.index}`,
        ),
      );
    }
    if (match[2]) {
      nodes.push(
        <strong key={`strong-${match.index}`} style={{ fontWeight: 700, color: 'var(--text-body)' }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <em key={`em-${match.index}`} style={{ fontStyle: 'italic' }}>
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      const normalizedCodePath = normalizeWorkspacePath(match[4]);
      if (normalizedCodePath && isLikelyWorkspaceFilePath(match[4])) {
        nodes.push(
          <Link
            key={`code-link-${match.index}`}
            href={buildFilesHref(normalizedCodePath)}
            style={{ textDecoration: 'none' }}
          >
            <code
              style={{
                fontFamily: monoFont,
                fontSize: '0.92em',
                padding: '0.12em 0.38em',
                borderRadius: 8,
                background: 'rgba(20, 46, 38, 0.08)',
                color: 'var(--accent-strong)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                cursor: 'pointer',
              }}
            >
              {match[4]}
            </code>
          </Link>,
        );
      } else {
        nodes.push(
          <code
            key={`code-${match.index}`}
            style={{
              fontFamily: monoFont,
              fontSize: '0.92em',
              padding: '0.12em 0.38em',
              borderRadius: 8,
              background: 'rgba(20, 46, 38, 0.08)',
              color: 'var(--text-body)',
            }}
          >
            {match[4]}
          </code>,
        );
      }
    } else if (match[5] && match[6]) {
      nodes.push(
        <a key={`link-${match.index}`} href={match[6]} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-strong)', textDecoration: 'underline' }}>
          {match[5]}
        </a>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < normalized.length) {
    nodes.push(
      ...renderPlainTextWithFileLinks(
        normalized.slice(lastIndex).replace(/__ESCAPED_STAR__/g, '*').replace(/__ESCAPED_TICK__/g, '`'),
        `plain-tail-${lastIndex}`,
      ),
    );
  }

  return nodes;
}

export function renderRichText(body: string): ReactNode {
  const lines = body.split('\n');
  const elements: ReactNode[] = [];
  let paragraph: string[] = [];
  let bulletItems: string[] = [];
  let orderedItems: string[] = [];
  let codeFence: string[] = [];
  let inCodeFence = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    elements.push(
      <p key={`p-${elements.length}`} style={{ margin: 0 }}>
        {renderInlineRichText(paragraph.join(' '))}
      </p>,
    );
    paragraph = [];
  };

  const flushBulletList = () => {
    if (!bulletItems.length) return;
    elements.push(
      <ul key={`ul-${elements.length}`} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
        {bulletItems.map((item, index) => (
          <li key={`li-${index}`}>{renderInlineRichText(item)}</li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  const flushOrderedList = () => {
    if (!orderedItems.length) return;
    elements.push(
      <ol key={`ol-${elements.length}`} style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>
        {orderedItems.map((item, index) => (
          <li key={`oli-${index}`}>{renderInlineRichText(item)}</li>
        ))}
      </ol>,
    );
    orderedItems = [];
  };

  const flushCodeFence = () => {
    if (!codeFence.length) return;
    elements.push(
      <pre key={`pre-${elements.length}`} style={{ margin: 0, padding: '14px 16px', borderRadius: 16, background: 'rgba(20, 46, 38, 0.08)', overflowX: 'auto' }}>
        <code style={{ fontFamily: monoFont, fontSize: 13, color: 'var(--text-body)' }}>{codeFence.join('\n')}</code>
      </pre>,
    );
    codeFence = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      if (inCodeFence) {
        flushCodeFence();
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeFence.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      elements.push(<hr key={`hr-${elements.length}`} style={{ width: '100%', border: 'none', borderTop: '1px solid rgba(121, 166, 148, 0.32)', margin: '2px 0' }} />);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const sizes = { 1: 24, 2: 20, 3: 17, 4: 16, 5: 15, 6: 14 } as const;
      elements.push(
        <div key={`h-${elements.length}`} style={{ fontSize: sizes[level as 1 | 2 | 3], fontWeight: 700, lineHeight: 1.3, color: 'var(--text-body)' }}>
          {renderInlineRichText(content)}
        </div>,
      );
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          style={{
            margin: 0,
            paddingLeft: 14,
            borderLeft: '2px solid rgba(121, 166, 148, 0.58)',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          {renderInlineRichText(trimmed.slice(2))}
        </blockquote>,
      );
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      flushParagraph();
      flushOrderedList();
      bulletItems.push(trimmed.replace(/^-\s+/, ''));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushBulletList();
      orderedItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushBulletList();
    flushOrderedList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushBulletList();
  flushOrderedList();
  flushCodeFence();

  return <div style={{ display: 'grid', gap: 12 }}>{elements}</div>;
}
