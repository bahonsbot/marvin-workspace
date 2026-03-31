'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { CSSProperties } from 'react';
import type { RuntimeBridgeChatMessage, RuntimeBridgeLiveEvent, RuntimeBridgeToolEvent, RuntimeBridgeState } from '@/hooks/useRuntimeBridge';
import { buildChatSurfaceModel } from '@/lib/chat/thread-model';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

const monoFont =
  '"SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

function pillStyle({ active = false, dark = false }: { active?: boolean; dark?: boolean } = {}): CSSProperties {
  if (dark) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 11px',
      borderRadius: 999,
      border: active ? '1px solid rgba(122, 168, 149, 0.42)' : '1px solid rgba(255, 255, 255, 0.12)',
      background: active ? 'rgba(18, 52, 42, 0.88)' : 'rgba(255, 255, 255, 0.06)',
      color: active ? '#ddeadf' : 'rgba(238, 242, 239, 0.9)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    };
  }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 999,
    border: active ? '1px solid rgba(121, 166, 148, 0.4)' : '1px solid rgba(200, 195, 188, 0.42)',
    background: active ? 'rgba(212, 231, 221, 0.66)' : 'rgba(255, 255, 255, 0.72)',
    color: active ? '#1a3d32' : 'var(--text-body)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
}

function actionButtonStyle(enabled: boolean, emphasis?: boolean): CSSProperties {
  return {
    border: emphasis ? '1px solid rgba(122, 168, 149, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
    background: emphasis
      ? 'linear-gradient(135deg, rgba(18, 52, 42, 0.96) 0%, rgba(28, 77, 63, 0.92) 100%)'
      : 'rgba(255, 255, 255, 0.06)',
    color: emphasis ? '#f7f3ec' : enabled ? 'rgba(241, 245, 242, 0.94)' : 'rgba(202, 210, 206, 0.72)',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.72,
    boxShadow: emphasis ? '0 10px 24px rgba(0, 0, 0, 0.18)' : 'none',
    textDecoration: 'none',
  };
}

function contextTone(percent: number | null) {
  if (percent === null) return { bar: 'rgba(255, 255, 255, 0.18)', text: 'rgba(227, 233, 229, 0.72)' };
  if (percent >= 85) return { bar: 'linear-gradient(90deg, #cc8842 0%, #b34949 100%)', text: '#f0b08e' };
  if (percent >= 65) return { bar: 'linear-gradient(90deg, #7ba796 0%, #cc8842 100%)', text: '#e0c08b' };
  return { bar: 'linear-gradient(90deg, #7ba796 0%, #3f695b 100%)', text: '#b8d7ca' };
}

function normalizeWorkspacePath(candidate: string): string | null {
  const trimmed = candidate.trim();
  const workspacePrefix = '/data/.openclaw/workspace/';
  const normalized = trimmed.startsWith(workspacePrefix) ? trimmed.slice(workspacePrefix.length) : trimmed;
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) return null;
  return normalized;
}

function isLikelyWorkspaceFilePath(candidate: string): boolean {
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

function buildFilesHref(path: string): string {
  const normalized = normalizeWorkspacePath(path) ?? path;
  const parentPath = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
  const params = new URLSearchParams();
  if (parentPath) params.set('path', parentPath);
  params.set('file', normalized);
  return `/general/files?${params.toString()}`;
}

function renderPlainTextWithFileLinks(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
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

function renderInlineRichText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
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

function renderRichText(body: string): React.ReactNode {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
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

type ToolGroupRow = {
  id: string;
  event: RuntimeBridgeLiveEvent;
  tool: RuntimeBridgeToolEvent;
};

const TOOL_BURST_WINDOW_MS = 10000;

function toolLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toolPreview(tool: RuntimeBridgeToolEvent): string {
  const args = tool.args;
  const filePath = typeof args?.file_path === 'string' ? args.file_path : typeof args?.path === 'string' ? args.path : null;
  const command = typeof args?.command === 'string' ? args.command : null;
  if ((tool.name === 'read' || tool.name === 'write' || tool.name === 'edit') && filePath) return filePath.split('/').pop() || filePath;
  if (tool.name === 'exec' && command) return command;
  return tool.meta || tool.name;
}

function isLowSignalExecTool(tool: RuntimeBridgeToolEvent): boolean {
  if (tool.name !== 'exec') return false;
  const args = tool.args;
  const command = typeof args?.command === 'string' ? args.command.trim() : '';
  const meta = typeof tool.meta === 'string' ? tool.meta.trim() : '';
  return !command && !meta;
}

function toolPhaseLabel(tool: RuntimeBridgeToolEvent): string {
  if (tool.phase === 'start') return 'Running';
  if (tool.phase === 'update') return 'Working';
  return tool.isError ? 'Failed' : 'Completed';
}

function ToolDetailBlock({ row }: { row: ToolGroupRow }) {
  const { tool } = row;
  const args = tool.args;
  const filePath = typeof args?.file_path === 'string' ? args.file_path : typeof args?.path === 'string' ? args.path : null;
  const command = typeof args?.command === 'string' ? args.command : null;
  const content = typeof args?.content === 'string' ? args.content : null;
  const oldText = typeof args?.old_string === 'string' ? args.old_string : typeof args?.oldText === 'string' ? args.oldText : null;
  const newText = typeof args?.new_string === 'string' ? args.new_string : typeof args?.newText === 'string' ? args.newText : null;
  const offset = typeof args?.offset === 'number' ? args.offset : null;
  const limit = typeof args?.limit === 'number' ? args.limit : null;

  if (tool.name === 'edit' && oldText !== null && newText !== null) {
    return (
      <div style={{ marginTop: 10, border: '1px solid rgba(200, 195, 188, 0.26)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.82)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ borderRight: '1px solid rgba(200,195,188,0.2)' }}>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(190, 91, 91, 0.06)' }}>Before</div>
            <pre style={{ margin: 0, padding: '12px 14px', fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-body)', background: 'rgba(255,255,255,0.78)' }}>{oldText}</pre>
          </div>
          <div>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(66, 124, 93, 0.08)' }}>After</div>
            <pre style={{ margin: 0, padding: '12px 14px', fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-body)', background: 'rgba(255,255,255,0.78)' }}>{newText}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (tool.name === 'write' && content !== null) {
    return (
      <div style={{ marginTop: 10, border: '1px solid rgba(200, 195, 188, 0.26)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.82)' }}>
        <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(250, 248, 245, 0.86)' }}>{filePath ? `${filePath.split('/').pop()} · new file content` : 'New file content'}</div>
        <pre style={{ margin: 0, padding: '12px 14px', fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-body)', background: 'rgba(255,255,255,0.78)' }}>{content}</pre>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
      {filePath ? <div><strong style={{ color: 'var(--text-body)' }}>Path:</strong> <span style={{ fontFamily: monoFont }}>{filePath}</span></div> : null}
      {command ? <div><strong style={{ color: 'var(--text-body)' }}>Command:</strong> <span style={{ fontFamily: monoFont }}>{command}</span></div> : null}
      {offset !== null || limit !== null ? <div><strong style={{ color: 'var(--text-body)' }}>Range:</strong> {offset ?? 1} {limit !== null ? `· ${limit} lines` : ''}</div> : null}
      {tool.meta ? <div><strong style={{ color: 'var(--text-body)' }}>Result:</strong> {tool.meta}</div> : null}
    </div>
  );
}

function ToolGroupBlock({ rows, keepOpen }: { rows: ToolGroupRow[]; keepOpen: boolean }) {
  const latestRowsMap = new Map<string, ToolGroupRow>();
  for (const row of rows) {
    const key = row.tool.toolCallId ?? row.id;
    const existing = latestRowsMap.get(key);
    if (!existing || existing.event.at <= row.event.at) {
      latestRowsMap.set(key, row);
    }
  }
  const latestRows = Array.from(latestRowsMap.values()).sort((a, b) => a.event.at - b.event.at);
  const visibleRows = latestRows.filter((row) => !isLowSignalExecTool(row.tool));
  const [open, setOpen] = useState(keepOpen);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const time = visibleRows[visibleRows.length - 1]?.event.at ?? rows[rows.length - 1]?.event.at ?? Date.now();

  useEffect(() => {
    setOpen(keepOpen);
  }, [keepOpen]);

  if (visibleRows.length === 0) return null;

  return (
    <div style={{ display: 'grid', justifyItems: 'start', gap: 10, marginBottom: 10 }}>
      <section style={{ width: 'min(78ch, 78%)', border: '1px solid rgba(200, 195, 188, 0.28)', borderRadius: 22, background: 'rgba(255, 255, 255, 0.84)', overflow: 'hidden' }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>{open ? '▾' : '▸'}</span>
          <span style={pillStyle({ active: true })}>Tools</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Used {visibleRows.length} tool{visibleRows.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(time)}</span>
        </button>
        {open ? (
          <div style={{ borderTop: '1px solid rgba(200, 195, 188, 0.18)', padding: 8, display: 'grid', gap: 6 }}>
            {visibleRows.map((row) => {
              const expanded = Boolean(expandedRows[row.id]);
              const canExpand = row.tool.name === 'read' || row.tool.name === 'exec' || row.tool.name === 'write' || row.tool.name === 'edit';
              return (
                <div key={row.id} style={{ borderRadius: 16, background: expanded ? 'rgba(250, 248, 245, 0.82)' : 'transparent', border: expanded ? '1px solid rgba(200, 195, 188, 0.22)' : '1px solid transparent', padding: '0 2px' }}>
                  <button type="button" onClick={() => canExpand && setExpandedRows((current) => ({ ...current, [row.id]: !current[row.id] }))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: canExpand ? 'pointer' : 'default', textAlign: 'left' }}>
                    <span style={{ width: 12, color: 'var(--text-ghost)', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>{canExpand ? (expanded ? '▾' : '▸') : ''}</span>
                    <span style={{ color: row.tool.isError ? '#b74c43' : '#3f695b', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>✓</span>
                    <span style={{ ...pillStyle(), flexShrink: 0 }}>{toolLabel(row.tool.name)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{toolPreview(row.tool)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0, lineHeight: 1.4, paddingTop: 2 }}>{toolPhaseLabel(row.tool)}</span>
                  </button>
                  {expanded ? <div style={{ padding: '0 12px 12px 34px' }}><ToolDetailBlock row={row} /></div> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function composerIconButtonStyle(active: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(121, 166, 148, 0.34)' : 'rgba(200, 195, 188, 0.26)'}`,
    background: active ? 'rgba(121, 166, 148, 0.16)' : 'rgba(250, 248, 245, 0.92)',
    color: active ? '#163b31' : 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: active ? 'pointer' : 'not-allowed',
    boxShadow: active ? '0 8px 18px rgba(26, 61, 50, 0.08)' : 'none',
    transition: 'all 140ms ease',
  };
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 3 10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3 14 21l-4-7-7-4 18-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewSessionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3c5 0 9 3.58 9 8s-4 8-9 8a10.6 10.6 0 0 1-4-.77L3 21l1.55-4.12A7.4 7.4 0 0 1 3 11c0-4.42 4.03-8 9-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 5.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 7.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.44 11.05 12 20.5a6 6 0 1 1-8.49-8.49l10.6-10.61a4 4 0 1 1 5.66 5.66L8.46 18.36a2 2 0 1 1-2.83-2.82l9.2-9.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function copyTextToClipboard(text: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function LiveMessageBlock({ message }: { message: RuntimeBridgeChatMessage }) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'system') {
    return (
      <section
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          background: 'rgba(154, 75, 67, 0.08)',
          border: '1px solid rgba(154, 75, 67, 0.22)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={pillStyle()}>Bridge note</span>
          <span style={pillStyle()}>{message.status}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#8a433b' }}>{renderRichText(message.body)}</div>
      </section>
    );
  }

  const isOperator = message.role === 'user';

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: isOperator ? 'end' : 'start',
        gap: 12,
        marginTop: 2,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'grid', gap: 10, maxWidth: 'min(78ch, 78%)', justifyItems: isOperator ? 'end' : 'start' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-mid)' }}>
            {isOperator ? 'Philippe' : 'Marvin'}
          </div>
          {!isOperator ? (
            <button
              type="button"
              onClick={() => {
                const ok = copyTextToClipboard(message.body);
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1400);
              }}
              aria-label="Copy message"
              title={copied ? 'Copied' : 'Copy'}
              style={{
                border: '1px solid rgba(200, 195, 188, 0.28)',
                background: 'rgba(255, 255, 255, 0.72)',
                color: copied ? '#163b31' : 'var(--text-muted)',
                borderRadius: 999,
                minWidth: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <CopyIcon />
            </button>
          ) : null}
        </div>
        <div
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            borderRadius: 24,
            padding: '14px 16px',
            color: 'var(--text-body)',
            fontSize: 15,
            lineHeight: 1.8,
            textAlign: 'left',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            background: isOperator ? 'rgba(236, 244, 240, 0.72)' : 'rgba(250, 246, 240, 0.94)',
            border: isOperator ? '1px solid rgba(200, 195, 188, 0.24)' : '1px solid rgba(255, 255, 255, 0.92)',
          }}
        >
          {renderRichText(message.body)}
        </div>
        {message.status === 'streaming' ? <div style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streaming</div> : null}
      </div>
    </div>
  );
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function LiveEventBlock({ event }: { event: RuntimeBridgeLiveEvent }) {
  return (
    <div
      style={{
        border: '1px solid rgba(200, 195, 188, 0.28)',
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.82)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={pillStyle()}>{event.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(event.at)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{event.detail}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {event.sessionKey ? <span style={pillStyle()}>{shortKey(event.sessionKey)}</span> : null}
        {event.runId ? <span style={pillStyle()}>{`run ${shortKey(event.runId)}`}</span> : null}
        {event.seq !== null ? <span style={pillStyle()}>{`seq ${event.seq}`}</span> : null}
      </div>
    </div>
  );
}

function shortKey(value: string): string {
  if (value.length <= 32) return value;
  return `${value.slice(0, 14)}...${value.slice(-10)}`;
}

type TopControlMenu = 'agent' | 'model' | 'effort' | null;

type AgentMenuOption = {
  id: string;
  label: string;
  note?: string;
  disabled?: boolean;
};

type ModelMenuOption = {
  id: 'codex5.4' | 'codex' | 'minimax2.7' | 'qwenplus';
  label: string;
  command: string;
};

const agentMenuOptions: AgentMenuOption[] = [
  { id: 'marvin', label: 'Marvin' },
  { id: 'rafa', label: 'Rafa', note: 'Planned seat', disabled: true },
  { id: 'sloane', label: 'Sloane', note: 'Planned seat', disabled: true },
  { id: 'pico', label: 'Pico', note: 'Planned seat', disabled: true },
];

const modelMenuOptions: ModelMenuOption[] = [
  { id: 'codex5.4', label: 'gpt-5.4', command: '/model codex5.4' },
  { id: 'codex', label: 'codex-5.3', command: '/model codex' },
  { id: 'minimax2.7', label: 'minimax-2.7', command: '/model minimax2.7' },
  { id: 'qwenplus', label: 'qwen3.5-plus', command: '/model qwenplus' },
];

const effortMenuOptions = ['low', 'medium', 'high', 'xhigh'] as const;
type EffortMenuOption = (typeof effortMenuOptions)[number];

function formatAge(ageMs: number | null): string {
  if (ageMs === null || Number.isNaN(ageMs)) return 'freshness unavailable';
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function MissionControlChatSurface({
  summary,
  bridge,
  fallbackNotice,
}: {
  summary: OrchestratorIntegrationSummary;
  bridge?: RuntimeBridgeState;
  fallbackNotice?: string;
}) {
  const model = useMemo(() => buildChatSurfaceModel(summary), [summary]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const sessionsRef = useRef<HTMLDivElement | null>(null);
  const contextStyles = contextTone(model.contextPercent);
  const bridgeRefreshing = Boolean(bridge?.refreshing);
  const bridgeError = bridge?.error ?? null;
  const effectiveBridgeError = fallbackNotice ?? bridgeError;
  const wsState = bridge?.wsState ?? 'unavailable';
  const wsDetail = bridge?.wsDetail ?? null;
  const sessionState = bridge?.session.state ?? 'unavailable';
  const sessionDetail = bridge?.session.detail ?? null;
  const sessionId = bridge?.session.sessionId ?? null;
  const sessionLastEvent = bridge?.session.lastEvent ?? null;
  const live = bridge?.live;
  const liveTargetSession = live?.targetSession.key ?? null;
  const liveTargetLabel = live?.targetSession.label ?? 'No target session';
  const liveMessages = live?.messages ?? [];
  const liveEvents = live?.events ?? [];
  const liveCanSend = Boolean(live?.canSend);
  const liveSendState = live?.sendState ?? 'idle';
  const liveSendError = live?.sendError ?? null;
  const [composerValue, setComposerValue] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; path: string; size: number; mimeType: string }>>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [bridgeEventsOpen, setBridgeEventsOpen] = useState(false);
  const [topControlMenu, setTopControlMenu] = useState<TopControlMenu>(null);
  const [modelSwitchError, setModelSwitchError] = useState<string | null>(null);
  const [modelSwitchBusy, setModelSwitchBusy] = useState(false);
  const [effortSwitchBusy, setEffortSwitchBusy] = useState(false);
  const [optimisticModelLabel, setOptimisticModelLabel] = useState<string | null>(null);
  const [lastRequestedEffort, setLastRequestedEffort] = useState<EffortMenuOption | null>(null);
  const [pendingModelLabel, setPendingModelLabel] = useState<string | null>(null);
  const [pendingEffortLabel, setPendingEffortLabel] = useState<EffortMenuOption | null>(null);
  const [isNearTranscriptBottom, setIsNearTranscriptBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const bridgeEventsRef = useRef<HTMLDivElement | null>(null);
  const topControlMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (sessionsRef.current && !sessionsRef.current.contains(event.target as Node)) {
        setSessionsOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (bridgeEventsRef.current && !bridgeEventsRef.current.contains(event.target as Node)) {
        setBridgeEventsOpen(false);
      }
      if (topControlMenuRef.current && !topControlMenuRef.current.contains(event.target as Node)) {
        setTopControlMenu(null);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const runtimeModelLabel = model.modelLabel.includes('gpt-5.4')
    ? 'gpt-5.4'
    : model.modelLabel.toLowerCase().includes('qwen')
      ? 'qwen3.5-plus'
      : model.modelLabel.toLowerCase().includes('minimax')
        ? 'minimax-2.7'
        : model.modelLabel.toLowerCase().includes('codex') || model.modelLabel.toLowerCase().includes('5.3')
          ? 'codex-5.3'
          : model.modelLabel;
  const modelMenuLabel = optimisticModelLabel ?? pendingModelLabel ?? runtimeModelLabel;
  const xhighCapable = modelMenuLabel === 'gpt-5.4' || modelMenuLabel === 'codex-5.3';
  const boundedThinkCapable = modelMenuLabel === 'minimax-2.7' || modelMenuLabel === 'qwen3.5-plus';
  const effortInteractive = xhighCapable || boundedThinkCapable;
  const availableEffortOptions = xhighCapable ? effortMenuOptions : boundedThinkCapable ? effortMenuOptions.filter((level) => level !== 'xhigh') : [];
  const confirmedEffortLabel = model.effortLabel && model.effortLabel !== 'Not exposed yet' ? model.effortLabel : null;
  const effortMenuLabel = effortInteractive
    ? pendingEffortLabel
      ? `Last requested: ${pendingEffortLabel}`
      : lastRequestedEffort
        ? `Last requested: ${lastRequestedEffort}`
        : confirmedEffortLabel
          ? confirmedEffortLabel
          : 'Last requested: low'
    : 'Last requested: low';
  const visibleModelMenuOptions = modelMenuOptions.filter((option) => option.label !== modelMenuLabel);

  const lastRealAgentRef = useRef(model.agentLabel !== 'Mission Control' ? model.agentLabel : 'Marvin');
  const lastRealModelRef = useRef(model.modelLabel.toLowerCase() !== 'runtime controlled' ? model.modelLabel : 'MiniMax-M2.7');

  if (model.agentLabel && model.agentLabel !== 'Mission Control') {
    lastRealAgentRef.current = model.agentLabel;
  }
  if (model.modelLabel && model.modelLabel.toLowerCase() !== 'runtime controlled') {
    lastRealModelRef.current = model.modelLabel;
  }

  const displayAgentLabel = model.agentLabel === 'Mission Control' ? lastRealAgentRef.current : model.agentLabel;
  const displayModelLabel = model.modelLabel.toLowerCase() === 'runtime controlled' ? lastRealModelRef.current : model.modelLabel;

  async function handleModelSwitch(option: ModelMenuOption) {
    if (!live?.sendPrompt) {
      setModelSwitchError('Live bridge is unavailable for model switching right now.');
      return;
    }

    const previousLabel = modelMenuLabel;
    const previousEffort = lastRequestedEffort;
    setTopControlMenu(null);
    setOptimisticModelLabel(option.label);
    setPendingModelLabel(option.label);
    setLastRequestedEffort(null);
    setPendingEffortLabel(null);
    setModelSwitchBusy(true);
    setModelSwitchError(null);

    try {
      await live.sendPrompt(option.command);
      void bridge?.refresh();
    } catch (cause) {
      setOptimisticModelLabel(previousLabel);
      setPendingModelLabel(null);
      setLastRequestedEffort(previousEffort);
      setPendingEffortLabel(previousEffort);
      setModelSwitchError(cause instanceof Error ? cause.message : 'Mission Control could not switch models.');
    } finally {
      setModelSwitchBusy(false);
    }
  }

  async function handleEffortSwitch(option: EffortMenuOption) {
    if (!effortInteractive || !live?.sendPrompt) return;

    const previousEffort = lastRequestedEffort;
    setTopControlMenu(null);
    setLastRequestedEffort(option);
    setPendingEffortLabel(option);
    setEffortSwitchBusy(true);
    setModelSwitchError(null);

    try {
      await live.sendPrompt(`/think:${option}`);
      void bridge?.refresh();
    } catch (cause) {
      setLastRequestedEffort(previousEffort);
      setPendingEffortLabel(previousEffort);
      setModelSwitchError(cause instanceof Error ? cause.message : 'Mission Control could not change effort.');
    } finally {
      setEffortSwitchBusy(false);
    }
  }

  useEffect(() => {
    if (pendingModelLabel && runtimeModelLabel === pendingModelLabel) {
      setOptimisticModelLabel(null);
      setPendingModelLabel(null);
    }
  }, [pendingModelLabel, runtimeModelLabel]);

  useEffect(() => {
    if (!confirmedEffortLabel) return;
    const normalizedConfirmed = confirmedEffortLabel.toLowerCase();
    if (pendingEffortLabel && normalizedConfirmed === pendingEffortLabel) {
      setPendingEffortLabel(null);
      setLastRequestedEffort(null);
      return;
    }
    if (!pendingEffortLabel && lastRequestedEffort && normalizedConfirmed === lastRequestedEffort) {
      setLastRequestedEffort(null);
    }
  }, [confirmedEffortLabel, lastRequestedEffort, pendingEffortLabel]);

  async function handleResetToDefaults() {
    setTopControlMenu(null);
    setOptimisticModelLabel('minimax-2.7');
    setPendingModelLabel('minimax-2.7');
    setLastRequestedEffort('low');
    setPendingEffortLabel('low');
    if (!live?.sendPrompt) {
      window.location.reload();
      return;
    }
    try {
      setModelSwitchBusy(true);
      setEffortSwitchBusy(true);
      setModelSwitchError(null);
      await live.sendPrompt('/model minimax2.7');
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      await live.sendPrompt('/think:low');
      void bridge?.refresh();
    } catch {
      window.location.reload();
    } finally {
      setModelSwitchBusy(false);
      setEffortSwitchBusy(false);
    }
  }

  async function uploadSelectedFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadBusy(true);
    setComposerError(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const response = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const payload = (await response.json()) as { uploaded?: Array<{ name: string; path: string; size: number; mimeType: string }>; error?: string };
      if (!response.ok || !payload.uploaded) {
        throw new Error(payload.error || 'Upload failed.');
      }
      setAttachedFiles((current) => [...current, ...payload.uploaded!]);
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not upload the selected files.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function submitComposerPrompt(nextPrompt: string) {
    if (!live?.sendPrompt) return;
    if (!nextPrompt && attachedFiles.length === 0) return;

    const attachmentNote = attachedFiles.length
      ? `\n\nAttached files uploaded to workspace:\n${attachedFiles.map((file) => `- ${file.path}`).join('\n')}`
      : '';
    const finalPrompt = `${nextPrompt}${attachmentNote}`.trim();

    try {
      setComposerError(null);
      await live.sendPrompt(finalPrompt);
      setComposerValue('');
      setAttachedFiles([]);
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not send the prompt.');
    }
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitComposerPrompt(composerValue.trim());
  }

  async function handleNewSession() {
    await submitComposerPrompt('/new');
  }

  async function handleStop() {
    if (!live?.abortPrompt) return;

    try {
      setComposerError(null);
      await live.abortPrompt();
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not stop the active response.');
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    void submitComposerPrompt(composerValue.trim());
  }

  function handleComposerDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(true);
  }

  function handleComposerDragLeave(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
  }

  function handleComposerDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length > 0) {
      void uploadSelectedFiles(event.dataTransfer.files);
    }
  }

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) return;

    const updateBottomState = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distanceFromBottom < 96;
      setIsNearTranscriptBottom(nearBottom);
      if (nearBottom) {
        setShowJumpToLatest(false);
      }
    };

    updateBottomState();
    container.addEventListener('scroll', updateBottomState, { passive: true });
    return () => container.removeEventListener('scroll', updateBottomState);
  }, []);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    const bottom = transcriptBottomRef.current;
    if (!container || !bottom) return;

    requestAnimationFrame(() => {
      if (isNearTranscriptBottom) {
        bottom.scrollIntoView({ block: 'end' });
        setShowJumpToLatest(false);
      } else {
        setShowJumpToLatest(true);
      }
    });
  }, [isNearTranscriptBottom, liveMessages.length, liveEvents.length, liveSendState]);

  const toolRows = liveEvents
    .filter((event): event is RuntimeBridgeLiveEvent & { tool: RuntimeBridgeToolEvent } => Boolean(event.tool))
    .map((event) => ({ id: `${event.id}-${event.tool.toolCallId ?? 'tool'}`, event, tool: event.tool }));

  const transcriptItems: Array<
    | { type: 'message'; id: string; at: number; message: RuntimeBridgeChatMessage }
    | { type: 'tools'; id: string; at: number; rows: ToolGroupRow[]; keepOpen: boolean }
  > = [];

  const toolCallGroups = new Map<string, ToolGroupRow[]>();
  for (const row of toolRows) {
    const key = `${row.event.runId ?? 'runless'}:${row.tool.toolCallId ?? row.id}`;
    const group = toolCallGroups.get(key) ?? [];
    group.push(row);
    toolCallGroups.set(key, group);
  }

  const sortedToolCallGroups = Array.from(toolCallGroups.values())
    .map((rows) => rows.slice().sort((a, b) => a.event.at - b.event.at))
    .sort((a, b) => (a[0]?.event.at ?? 0) - (b[0]?.event.at ?? 0));

  const toolBursts: Array<{ id: string; at: number; endAt: number; runId: string | null; rows: ToolGroupRow[] }> = [];

  for (const rows of sortedToolCallGroups) {
    const startAt = rows[0]?.event.at ?? Date.now();
    const endAt = rows[rows.length - 1]?.event.at ?? startAt;
    const runId = rows[0]?.event.runId ?? null;
    const previous = toolBursts[toolBursts.length - 1];

    if (previous && previous.runId === runId && startAt - previous.endAt <= TOOL_BURST_WINDOW_MS) {
      previous.rows.push(...rows);
      previous.endAt = Math.max(previous.endAt, endAt);
      continue;
    }

    toolBursts.push({
      id: `tools-${rows[0]?.id ?? 'group'}`,
      at: startAt,
      endAt,
      runId,
      rows: [...rows],
    });
  }

  toolBursts.forEach((burst, index) => {
    transcriptItems.push({
      type: 'tools',
      id: burst.id,
      at: burst.at,
      rows: burst.rows,
      keepOpen: index === toolBursts.length - 1,
    });
  });

  for (const message of liveMessages) {
    transcriptItems.push({ type: 'message', id: message.id, at: message.at ?? Date.now(), message });
  }

  transcriptItems.sort((a, b) => a.at - b.at);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', gap: 8, minHeight: '100%', height: '100%' }}>
      <section
        style={{
          border: '1px solid rgba(200, 195, 188, 0.42)',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(255, 253, 251, 0.94) 0%, rgba(245, 240, 235, 0.92) 54%, rgba(233, 244, 238, 0.88) 100%)',
          boxShadow: '0 14px 38px rgba(26, 61, 50, 0.08)',
          padding: '10px 16px',
          display: 'grid',
          gap: 10,
          position: 'sticky',
          top: 4,
          zIndex: 12,
        }}
      >
        {/* Row 1: WS + Session status (left) / Refresh, Stop, Context Meter (right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Left: WS OPEN / SESSION CONNECTED / Status dropdown */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pillStyle({ active: wsState === 'open' })}>{`ws ${wsState}`}</span>
            <span style={pillStyle({ active: sessionState === 'connected' })}>{`session ${sessionState}`}</span>
            
            {/* Status dropdown trigger */}
            <div ref={statusDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((v) => !v)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(200, 195, 188, 0.4)',
                  background: effectiveBridgeError ? 'rgba(248, 113, 113, 0.14)' : 'rgba(255, 255, 255, 0.7)',
                  color: effectiveBridgeError ? '#f87171' : 'var(--text-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
                title={effectiveBridgeError ? 'Bridge error' : wsDetail || 'WS status'}
              >
                {effectiveBridgeError ? '!' : 'ⓘ'}
              </button>
              {statusDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: 'min(320px, 92vw)',
                    border: '1px solid rgba(200, 195, 188, 0.4)',
                    borderRadius: 14,
                    background: 'rgba(255, 253, 251, 0.98)',
                    boxShadow: '0 12px 32px rgba(26, 61, 50, 0.12)',
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                    zIndex: 20,
                  }}
                >
                  {effectiveBridgeError ? (
                    <div style={{ fontSize: 12, color: '#9a4b43', lineHeight: 1.6 }}>
                      Bridge refresh failed: {effectiveBridgeError}
                    </div>
                  ) : wsDetail ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {wsDetail}
                    </div>
                  ) : sessionDetail ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {sessionDetail}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      WS sidecar socket is open. Waiting for gateway handshake.
                    </div>
                  )}
                  {sessionId && (
                    <div style={{ fontSize: 11, fontFamily: monoFont, color: 'var(--text-ghost)' }}>
                      Session: {sessionId}
                    </div>
                  )}
                  {sessionLastEvent && (
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                      Last event: {sessionLastEvent}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Refresh / Stop / Context Meter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {bridge ? (
              <button
                type="button"
                onClick={() => void bridge.refresh()}
                disabled={bridgeRefreshing}
                title="Refresh the bounded runtime bridge snapshot."
                style={{
                  ...actionButtonStyle(true),
                  border: '1px solid rgba(200, 195, 188, 0.46)',
                  background: 'rgba(255, 255, 255, 0.78)',
                  color: 'var(--text-body)',
                  cursor: bridgeRefreshing ? 'progress' : 'pointer',
                  padding: '8px 12px',
                  fontSize: 11,
                }}
              >
                {bridgeRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={!live?.canAbort}
              title={live?.canAbort ? 'Stop the active Mission Control chat response.' : 'Stop becomes available while a Mission Control chat response is active.'}
              style={{ ...actionButtonStyle(Boolean(live?.canAbort)), border: '1px solid rgba(200, 195, 188, 0.46)', background: 'rgba(255, 255, 255, 0.78)', color: live?.canAbort ? 'var(--text-body)' : 'var(--text-muted)', padding: '8px 12px', fontSize: 11 }}
            >
              Stop
            </button>
            {/* Context Meter inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 999, background: 'rgba(255, 255, 255, 0.7)' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Context</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: contextStyles.text }}>{model.contextPercent !== null ? `${model.contextPercent}%` : 'n/a'}</span>
              <div style={{ width: 48, height: 6, borderRadius: 999, background: 'rgba(221, 215, 209, 0.62)', overflow: 'hidden' }}>
                <div style={{ width: `${model.contextPercent ?? 18}%`, minWidth: model.contextPercent === null ? 24 : undefined, height: '100%', borderRadius: 999, background: contextStyles.bar }} />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: SESSION/AGENT / MODEL / EFFORT / RESET / RECENT SESSIONS */}
        <div ref={topControlMenuRef} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setTopControlMenu((current) => (current === 'agent' ? null : 'agent'))}
              style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.7)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 188, minHeight: 32, textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Session / Agent</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayAgentLabel}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0 }}>▾</span>
            </button>
            {topControlMenu === 'agent' ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 220, border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 8, display: 'grid', gap: 6, zIndex: 20 }}>
                {agentMenuOptions.map((option) => (
                  <div key={option.id} style={{ borderRadius: 12, background: option.label === displayAgentLabel ? 'rgba(212, 231, 221, 0.66)' : 'transparent', padding: '10px 12px', display: 'grid', gap: 2, opacity: option.disabled ? 0.62 : 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>{option.label}</span>
                    {option.note ? <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{option.note}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setTopControlMenu((current) => (current === 'model' ? null : 'model'))}
              disabled={modelSwitchBusy}
              style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.7)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 188, minHeight: 32, textAlign: 'left', cursor: modelSwitchBusy ? 'progress' : 'pointer', opacity: modelSwitchBusy ? 0.82 : 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Model</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optimisticModelLabel ?? displayModelLabel}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0 }}>▾</span>
            </button>
            {topControlMenu === 'model' ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 220, border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 8, display: 'grid', gap: 6, zIndex: 20 }}>
                {visibleModelMenuOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void handleModelSwitch(option)}
                    disabled={modelSwitchBusy}
                    style={{ border: 'none', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 2, textAlign: 'left', background: 'transparent', cursor: modelSwitchBusy ? 'progress' : 'pointer', opacity: modelSwitchBusy ? 0.76 : 1 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>{option.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{option.command}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => effortInteractive && setTopControlMenu((current) => (current === 'effort' ? null : 'effort'))}
              disabled={!effortInteractive || effortSwitchBusy}
              style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: effortInteractive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(247, 242, 236, 0.82)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 188, minHeight: 32, textAlign: 'left', cursor: effortInteractive && !effortSwitchBusy ? 'pointer' : 'not-allowed', opacity: effortInteractive ? 1 : 0.72 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Effort</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effortMenuLabel}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0 }}>{effortInteractive ? '▾' : '—'}</span>
            </button>
            {topControlMenu === 'effort' ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 220, border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 8, display: 'grid', gap: 6, zIndex: 20 }}>
                {availableEffortOptions.filter((label) => label !== lastRequestedEffort).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void handleEffortSwitch(label)}
                    disabled={effortSwitchBusy}
                    style={{ border: 'none', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 2, textAlign: 'left', background: 'transparent', cursor: effortSwitchBusy ? 'progress' : 'pointer', opacity: effortSwitchBusy ? 0.76 : 1 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', textTransform: 'capitalize' }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{`/think:${label}`}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            title="Reset to defaults: Marvin / MiniMax-M2.7 / None"
            style={{
              ...actionButtonStyle(true),
              border: '1px solid rgba(200, 195, 188, 0.46)',
              background: 'rgba(255, 255, 255, 0.78)',
              color: 'var(--text-body)',
              cursor: 'pointer',
              padding: '8px 14px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Reset
          </button>
          <div ref={sessionsRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setSessionsOpen((value) => !value)}
              style={{
                border: '1px solid rgba(200, 195, 188, 0.34)',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 32,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Recent Sessions</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', lineHeight: 1 }}>{model.recentSessions.length}</span>
            </button>
            {sessionsOpen ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 'min(360px, 92vw)',
                  border: '1px solid rgba(200, 195, 188, 0.4)',
                  borderRadius: 18,
                  background: 'rgba(255, 253, 251, 0.96)',
                  boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)',
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                  zIndex: 10,
                }}
              >
                {model.recentSessions.length > 0 ? (
                  model.recentSessions.slice(0, 6).map((session) => {
                    const isActive = session.key === liveTargetSession;
                    return (
                      <button
                        key={session.key}
                        type="button"
                        onClick={() => {
                          setSessionsOpen(false);
                          if (session.key !== liveTargetSession) {
                            void bridge?.switchSession(session.key);
                          }
                        }}
                        style={{ border: `1px solid ${isActive ? 'rgba(121, 166, 148, 0.42)' : 'rgba(200, 195, 188, 0.34)'}`, borderRadius: 14, background: isActive ? 'rgba(212, 231, 221, 0.52)' : 'rgba(255, 255, 255, 0.78)', padding: 12, display: 'grid', gap: 8, textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>{session.key.includes('builder') ? 'Builder' : session.key.includes('reviewer') ? 'Reviewer' : session.kind}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{isActive ? 'Current' : formatAge(session.ageMs)}</span>
                        </div>
                        <div style={{ fontFamily: monoFont, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.key}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={pillStyle()}>{session.model ?? 'runtime controlled'}</span>
                          <span style={pillStyle()}>{session.tokenUsage?.percentUsed != null ? `${session.tokenUsage.percentUsed}% ctx` : 'ctx unknown'}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    No recent sessions were exposed by the adapter in this environment.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {modelSwitchError ? (
          <div style={{ fontSize: 12, color: '#9a4b43', lineHeight: 1.6, paddingLeft: 4 }}>
            {modelSwitchError}
          </div>
        ) : null}
      </section>

      <section
        ref={transcriptScrollRef}
        style={{
          border: 'none',
          borderRadius: 0,
          background: 'transparent',
          boxShadow: 'none',
          padding: '6px 0 2px',
          display: 'grid',
          gap: 14,
          minHeight: 0,
          overflow: 'auto',
          overflowAnchor: 'none',
          scrollPaddingBottom: 8,
        }}
      >
        <section style={{ border: '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: 'rgba(255, 255, 255, 0.84)', padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>Live bridge session</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={pillStyle()}>{liveTargetLabel}</span>
              <div ref={bridgeEventsRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setBridgeEventsOpen((value) => !value)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid rgba(200, 195, 188, 0.38)',
                    background: 'rgba(255, 255, 255, 0.76)',
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                  }}
                  title="Recent bridge events"
                >
                  ⓘ
                </button>
                {bridgeEventsOpen ? (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(360px, 92vw)', border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 10, display: 'grid', gap: 8, zIndex: 20 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Recent bridge events</div>
                    {liveEvents.length > 0 ? (
                      liveEvents.slice().reverse().map((eventItem) => <LiveEventBlock key={eventItem.id} event={eventItem} />)
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                        No bridge events observed yet beyond the connection handshake.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {transcriptItems.length > 0 ? (
              transcriptItems.map((item) =>
                item.type === 'message'
                  ? <LiveMessageBlock key={item.id} message={item.message} />
                  : <ToolGroupBlock key={item.id} rows={item.rows} keepOpen={item.keepOpen} />,
              )
            ) : (
              <div style={{ padding: '6px 2px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                No live transcript yet. Send one prompt after the gateway session is connected to this target: <span style={{ fontFamily: monoFont }}>{liveTargetLabel}</span>.
              </div>
            )}
          </div>
          {showJumpToLatest ? (
            <div style={{ position: 'sticky', bottom: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <button
                type="button"
                onClick={() => {
                  transcriptBottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
                  setShowJumpToLatest(false);
                }}
                style={{ pointerEvents: 'auto', border: '1px solid rgba(121, 166, 148, 0.28)', borderRadius: 999, background: 'rgba(255, 253, 251, 0.96)', color: 'var(--text-body)', boxShadow: '0 10px 26px rgba(26, 61, 50, 0.12)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Jump to latest ↓
              </button>
            </div>
          ) : null}
        </section>
        <div ref={transcriptBottomRef} style={{ height: 1, width: '100%' }} />
      </section>

      <form onSubmit={handleComposerSubmit} onDragOver={handleComposerDragOver} onDragLeave={handleComposerDragLeave} onDrop={handleComposerDrop} style={{ border: isDraggingFiles ? '1px solid rgba(121, 166, 148, 0.54)' : '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: isDraggingFiles ? 'rgba(244, 249, 246, 0.96)' : 'rgba(255, 255, 255, 0.9)', padding: 12, display: 'grid', gap: 8, zIndex: 11, boxShadow: '0 -8px 24px rgba(26, 61, 50, 0.08)' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(event) => {
              if (event.target.files?.length) {
                void uploadSelectedFiles(event.target.files);
                event.target.value = '';
              }
            }}
            style={{ display: 'none' }}
          />
          {attachedFiles.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachedFiles.map((file) => (
                <div key={`${file.path}-${file.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(200, 195, 188, 0.28)', background: 'rgba(250, 248, 245, 0.92)', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span style={{ fontFamily: monoFont }}>{file.name}</span>
                  <button type="button" onClick={() => setAttachedFiles((current) => current.filter((entry) => entry.path !== file.path))} style={{ border: 'none', background: 'transparent', color: 'var(--text-ghost)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          ) : null}
          {isDraggingFiles ? <div style={{ fontSize: 12, color: '#163b31', padding: '2px 2px 0' }}>Drop files here to upload them into <span style={{ fontFamily: monoFont }}>uploads/mission-control/</span>.</div> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end' }}>
            <textarea
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={2}
              disabled={!liveTargetSession || sessionState !== 'connected' || liveSendState === 'sending' || liveSendState === 'streaming'}
              placeholder={
                sessionState === 'connected'
                  ? liveTargetSession
                    ? `Message to ${liveTargetLabel}.`
                    : 'A connected bridge still needs one visible runtime session key before Mission Control can send.'
                  : 'Composer unlocks after the real gateway session connects.'
              }
              aria-label="Composer"
              style={{
                width: '100%',
                minHeight: 64,
                maxHeight: 120,
                resize: 'none',
                borderRadius: 16,
                border: '1px solid rgba(200, 195, 188, 0.32)',
                background: 'rgba(250, 248, 245, 0.94)',
                padding: '12px 14px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 2 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadBusy}
                aria-label="Add attachment"
                title={uploadBusy ? 'Uploading...' : 'Add attachment'}
                style={composerIconButtonStyle(!uploadBusy)}
              >
                <PaperclipIcon />
              </button>
              <button
                type="button"
                disabled
                aria-label="Voice input coming later"
                title="Voice input coming later"
                style={composerIconButtonStyle(false)}
              >
                <MicIcon />
              </button>
              <button
                type="button"
                onClick={() => void handleNewSession()}
                disabled={!liveCanSend || liveSendState === 'sending' || liveSendState === 'streaming'}
                aria-label="New session"
                title="New session"
                style={composerIconButtonStyle(liveCanSend && liveSendState !== 'sending' && liveSendState !== 'streaming')}
              >
                <NewSessionIcon />
              </button>
              <button
                type="submit"
                disabled={!liveCanSend || (composerValue.trim().length === 0 && attachedFiles.length === 0)}
                aria-label={liveSendState === 'sending' ? 'Sending' : liveSendState === 'streaming' ? 'Waiting' : 'Send'}
                title={liveSendState === 'sending' ? 'Sending...' : liveSendState === 'streaming' ? 'Waiting...' : 'Send'}
                style={composerIconButtonStyle(liveCanSend && (composerValue.trim().length > 0 || attachedFiles.length > 0))}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        {(composerError || liveSendError || effectiveBridgeError || (!liveTargetSession && sessionState === 'connected')) ? (
          <div style={{ fontSize: 12, color: composerError || liveSendError || effectiveBridgeError ? '#9a4b43' : 'var(--text-muted)', maxWidth: 720 }}>
            {composerError || liveSendError || (effectiveBridgeError ? `Last refresh error: ${effectiveBridgeError}` : 'The gateway session is live, but Mission Control still needs one visible runtime session key before it can issue a real prompt.')}
          </div>
        ) : null}
      </form>
    </div>
  );
}
