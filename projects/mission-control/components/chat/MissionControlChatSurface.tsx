'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { CSSProperties } from 'react';
import type { RuntimeBridgeChatMessage, RuntimeBridgeLiveEvent, RuntimeBridgeState } from '@/hooks/useRuntimeBridge';
import { buildChatSurfaceModel, type ChatArtifact, type ChatThreadEntry, type ProcessRail } from '@/lib/chat/thread-model';
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

function railTone(kind: ProcessRail['kind']) {
  return kind === 'thinking'
    ? {
        badge: 'rgba(171, 122, 72, 0.18)',
        border: 'rgba(210, 170, 121, 0.26)',
        text: '#e3c29a',
      }
    : {
        badge: 'rgba(84, 134, 113, 0.18)',
        border: 'rgba(122, 168, 149, 0.26)',
        text: '#c9e2d7',
      };
}

function innerPanelStyle(): CSSProperties {
  return {
    border: '1px solid rgba(200, 195, 188, 0.32)',
    borderRadius: 18,
    background: 'rgba(255, 255, 255, 0.82)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };
}

function DiffArtifact({ artifact }: { artifact: Extract<ChatArtifact, { type: 'diff' }> }) {
  const oldLines = artifact.oldText.split('\n');
  const newLines = artifact.newText.split('\n');
  const rowCount = Math.max(oldLines.length, newLines.length);
  const removed = oldLines.filter((line) => !newLines.includes(line)).length;
  const added = newLines.filter((line) => !oldLines.includes(line)).length;

  return (
    <article style={{ ...innerPanelStyle(), overflow: 'hidden' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(200, 195, 188, 0.28)', background: 'rgba(250, 248, 245, 0.86)' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={pillStyle({ active: true })}>Diff</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-body)' }}>{artifact.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: monoFont }}>{artifact.filePath}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={pillStyle()}>-{removed}</span>
          <span style={pillStyle()}>+{added}</span>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0 }}>
        <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(190, 91, 91, 0.06)' }}>
            {artifact.beforeLabel}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 12, lineHeight: 1.65 }}>
            {Array.from({ length: rowCount }).map((_, index) => (
              <div key={`old-${index}`} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', gap: 12, padding: '0 14px', background: oldLines[index] && !newLines.includes(oldLines[index]) ? 'rgba(124, 47, 47, 0.16)' : 'transparent' }}>
                <span style={{ padding: '8px 0', color: 'var(--text-ghost)', borderRight: '1px solid rgba(200, 195, 188, 0.22)' }}>{oldLines[index] ? index + 1 : ''}</span>
                <span style={{ padding: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-body)' }}>{oldLines[index] ?? ' '}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(66, 124, 93, 0.08)' }}>
            {artifact.afterLabel}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 12, lineHeight: 1.65 }}>
            {Array.from({ length: rowCount }).map((_, index) => (
              <div key={`new-${index}`} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', gap: 12, padding: '0 14px', background: newLines[index] && !oldLines.includes(newLines[index]) ? 'rgba(39, 99, 70, 0.18)' : 'transparent' }}>
                <span style={{ padding: '8px 0', color: 'var(--text-ghost)', borderRight: '1px solid rgba(200, 195, 188, 0.22)' }}>{newLines[index] ? index + 1 : ''}</span>
                <span style={{ padding: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-body)' }}>{newLines[index] ?? ' '}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function FileArtifact({ artifact }: { artifact: Extract<ChatArtifact, { type: 'file' }> }) {
  const lines = artifact.content.split('\n');

  return (
    <article style={{ ...innerPanelStyle(), overflow: 'hidden' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(200, 195, 188, 0.28)', background: 'rgba(250, 248, 245, 0.86)' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={pillStyle({ active: true })}>File</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-body)' }}>{artifact.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: monoFont }}>{artifact.filePath}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={pillStyle()}>{artifact.language}</span>
          <span style={pillStyle()}>{lines.length} lines</span>
        </div>
      </header>
      <div style={{ padding: '10px 0', fontFamily: monoFont, fontSize: 12, lineHeight: 1.7 }}>
        {lines.map((line, index) => (
          <div key={`${artifact.filePath}-${index}`} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr)', gap: 14, padding: '0 16px' }}>
            <span style={{ padding: '6px 0', color: 'var(--text-ghost)', borderRight: '1px solid rgba(200, 195, 188, 0.22)' }}>{index + 1}</span>
            <span style={{ padding: '6px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-body)' }}>{line || ' '}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ChartArtifact({ artifact }: { artifact: Extract<ChatArtifact, { type: 'chart' }> }) {
  const width = 420;
  const height = 180;
  const padding = 18;
  const maxValue = artifact.points.length > 0 ? Math.max(...artifact.points.map((point) => point.value), 100) : 100;
  const step = artifact.points.length > 1 ? (width - padding * 2) / (artifact.points.length - 1) : 0;
  const path = artifact.points
    .map((point, index) => {
      const x = padding + step * index;
      const y = height - padding - (point.value / maxValue) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <article style={{ ...innerPanelStyle(), overflow: 'hidden' }}>
      <header style={{ display: 'grid', gap: 6, padding: '14px 16px', borderBottom: '1px solid rgba(200, 195, 188, 0.28)', background: 'rgba(250, 248, 245, 0.86)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={pillStyle({ active: true })}>Chart</span>
          <span style={pillStyle()}>{artifact.points.length > 0 ? 'runtime fed' : 'waiting on data'}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-body)' }}>{artifact.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{artifact.subtitle}</div>
      </header>
      <div style={{ padding: 18 }}>
        {artifact.points.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', borderRadius: 18, background: 'linear-gradient(180deg, rgba(250, 248, 245, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)', border: '1px solid rgba(200, 195, 188, 0.28)' }} role="img" aria-label={artifact.title}>
              {[0, 25, 50, 75, 100].map((tick) => {
                const y = height - padding - (tick / maxValue) * (height - padding * 2);
                return (
                  <g key={tick}>
                    <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(200, 195, 188, 0.5)" strokeDasharray="4 6" />
                    <text x={padding} y={y - 6} fill="#8f8780" fontSize="10">
                      {tick}%
                    </text>
                  </g>
                );
              })}
              <path d={path} fill="none" stroke="#3f695b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {artifact.points.map((point, index) => {
                const x = padding + step * index;
                const y = height - padding - (point.value / maxValue) * (height - padding * 2);
                return (
                  <g key={point.label}>
                    <circle cx={x} cy={y} r="5" fill="#fffdfb" stroke="#3f695b" strokeWidth="2.5" />
                    <text x={x} y={height - 4} textAnchor="middle" fill="#6f6c68" fontSize="10">
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div style={{ ...innerPanelStyle(), padding: 18, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {artifact.emptyLabel}
          </div>
        )}
      </div>
    </article>
  );
}

function artifactLabel(artifact: ChatArtifact): string {
  if (artifact.type === 'diff') return 'Diff';
  if (artifact.type === 'file') return 'File';
  return 'Chart';
}

function ArtifactBlock({ artifact }: { artifact: ChatArtifact }) {
  const [open, setOpen] = useState(false);

  return (
    <section style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 18, background: 'rgba(250, 248, 245, 0.9)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={pillStyle()}>{artifactLabel(artifact)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-body)', fontWeight: 600 }}>{artifact.title}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{open ? 'Hide artifact' : 'Show artifact'}</span>
      </button>
      {open ? (
        artifact.type === 'diff' ? <DiffArtifact artifact={artifact} /> : artifact.type === 'file' ? <FileArtifact artifact={artifact} /> : <ChartArtifact artifact={artifact} />
      ) : null}
    </section>
  );
}

function ProcessRailBlock({
  rail,
  expanded,
  onToggle,
}: {
  rail: ProcessRail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = railTone(rail.kind);
  const primaryMetric = rail.metrics[0];

  return (
    <section style={{ border: '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: 'rgba(255, 255, 255, 0.82)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '12px 14px',
          display: 'grid',
          gap: 8,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ ...pillStyle(), background: tone.badge, border: `1px solid ${tone.border}`, color: tone.text }}>
              {rail.title}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-body)', fontWeight: 600 }}>{rail.summary}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{expanded ? 'Hide details' : 'Show details'}</span>
        </div>
        {primaryMetric ? (
          <div style={{ fontSize: 12, color: 'var(--text-ghost)', lineHeight: 1.5 }}>{primaryMetric}</div>
        ) : null}
      </button>
      {expanded ? (
        <div style={{ borderTop: '1px solid rgba(200, 195, 188, 0.24)', padding: '0 14px 14px', display: 'grid', gap: 12 }}>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{rail.detail}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {rail.items.slice(0, 2).map((item) => (
              <div key={item.label} style={{ border: '1px solid rgba(200, 195, 188, 0.28)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.86)', padding: 14, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{item.preview}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
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
        normalized
          .slice(lastIndex, match.index)
          .replace(/__ESCAPED_STAR__/g, '*')
          .replace(/__ESCAPED_TICK__/g, '`'),
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
    nodes.push(normalized.slice(lastIndex).replace(/__ESCAPED_STAR__/g, '*').replace(/__ESCAPED_TICK__/g, '`'));
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

function MessageBlock({ entry }: { entry: Extract<ChatThreadEntry, { type: 'user' | 'assistant' }> }) {
  const isUser = entry.type === 'user';

  return (
    <section
      style={{
        borderRadius: 18,
        padding: '16px 18px',
        background: isUser ? 'rgba(255, 255, 255, 0.9)' : 'rgba(250, 248, 245, 0.88)',
        border: '1px solid rgba(200, 195, 188, 0.32)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={pillStyle({ active: isUser })}>{isUser ? 'Operator' : 'Mission Control'}</span>
          {entry.title ? <span style={{ fontSize: 14, color: 'var(--text-body)', fontWeight: 700 }}>{entry.title}</span> : null}
        </div>
        {entry.tone === 'muted' ? <span style={pillStyle()}>Boundary note</span> : null}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: entry.tone === 'muted' ? 'var(--text-muted)' : 'var(--text-body)', whiteSpace: 'pre-wrap' }}>
        {entry.body}
      </div>
      {entry.artifacts?.length ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {entry.artifacts.map((artifact) => (
            <ArtifactBlock key={`${entry.id}-${artifact.type}-${artifact.title}`} artifact={artifact} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LiveMessageBlock({ message }: { message: RuntimeBridgeChatMessage }) {
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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-mid)' }}>
          {isOperator ? 'Philippe' : 'Marvin'}
        </div>
        <div
          style={{
            width: '100%',
            borderRadius: 24,
            padding: '14px 16px',
            color: 'var(--text-body)',
            fontSize: 15,
            lineHeight: 1.8,
            textAlign: 'left',
            background: isOperator ? 'rgba(236, 244, 240, 0.72)' : 'rgba(255, 252, 248, 0.92)',
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
  const [openRails, setOpenRails] = useState<Record<string, boolean>>({});
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

  async function submitComposerPrompt(nextPrompt: string) {
    if (!live?.sendPrompt) return;
    if (!nextPrompt) return;

    try {
      setComposerError(null);
      await live.sendPrompt(nextPrompt);
      setComposerValue('');
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

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

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
  }, [isNearTranscriptBottom, model.thread.length, liveMessages.length, liveEvents.length, liveSendState]);

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
                  model.recentSessions.slice(0, 6).map((session) => (
                    <div key={session.key} style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.78)', padding: 12, display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>{session.key.includes('builder') ? 'Builder' : session.key.includes('reviewer') ? 'Reviewer' : session.kind}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatAge(session.ageMs)}</span>
                      </div>
                      <div style={{ fontFamily: monoFont, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.key}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={pillStyle()}>{session.model ?? 'runtime controlled'}</span>
                        <span style={pillStyle()}>{session.tokenUsage?.percentUsed != null ? `${session.tokenUsage.percentUsed}% ctx` : 'ctx unknown'}</span>
                      </div>
                    </div>
                  ))
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
        {model.thread.map((entry) =>
          entry.type === 'rail' ? (
            <ProcessRailBlock
              key={entry.id}
              rail={entry.rail}
              expanded={Boolean(openRails[entry.id])}
              onToggle={() => setOpenRails((current) => ({ ...current, [entry.id]: !current[entry.id] }))}
            />
          ) : (
            <MessageBlock key={entry.id} entry={entry} />
          ),
        )}

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
            {liveMessages.length > 0 ? (
              liveMessages.map((message) => <LiveMessageBlock key={message.id} message={message} />)
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

      <form onSubmit={handleComposerSubmit} style={{ border: '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: 'rgba(255, 255, 255, 0.9)', padding: 12, display: 'grid', gap: 8, zIndex: 11, boxShadow: '0 -8px 24px rgba(26, 61, 50, 0.08)' }}>
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
            <div style={{ display: 'grid', gap: 10, minWidth: 150 }}>
              <button type="submit" disabled={!liveCanSend || composerValue.trim().length === 0} style={actionButtonStyle(liveCanSend && composerValue.trim().length > 0, true)}>
                {liveSendState === 'sending' ? 'Sending...' : liveSendState === 'streaming' ? 'Waiting...' : 'Send'}
              </button>
              <button
                type="button"
                onClick={() => void handleNewSession()}
                disabled={!liveCanSend || liveSendState === 'sending' || liveSendState === 'streaming'}
                style={{
                  ...actionButtonStyle(liveCanSend && liveSendState !== 'sending' && liveSendState !== 'streaming'),
                  background: 'rgba(121, 166, 148, 0.14)',
                  border: '1px solid rgba(121, 166, 148, 0.32)',
                  color: liveCanSend ? '#1a3d32' : 'rgba(120, 129, 125, 0.72)',
                }}
              >
                New session
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
