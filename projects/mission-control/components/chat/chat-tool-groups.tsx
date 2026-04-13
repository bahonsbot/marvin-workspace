'use client';

import { useEffect, useState } from 'react';
import { ChatDiffView } from '@/components/chat/chat-diff-view';
import { ChatFileContentView } from '@/components/chat/chat-file-content-view';
import { monoFont } from '@/components/chat/chat-rich-text';
import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { TranscriptArtifactGroup } from '@/lib/chat/runtime-bridge-transcript';
import type { RuntimeBridgeTranscriptArtifact, RuntimeBridgeTranscriptEntry } from '@/lib/types/contracts';

export type ToolGroupRow = {
  id: string;
  entry: Extract<RuntimeBridgeTranscriptEntry, { kind: 'tool' }>;
};

function toolStatusColor(status: ToolGroupRow['entry']['status'], isError: boolean) {
  if (status === 'failed' || isError) return '#a8473d';
  if (status === 'completed') return '#30584a';
  return '#7a622d';
}

function toolStatusDot(status: ToolGroupRow['entry']['status'], isError: boolean): string {
  if (status === 'failed' || isError) return '!';
  if (status === 'completed') return '•';
  return '…';
}

export function toolLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function lineCount(value: string): number {
  if (!value) return 0;
  return value.split('\n').length;
}

function compactPath(value: string): string {
  const parts = value.split('/').filter(Boolean);
  if (parts.length <= 3) return value;
  return `.../${parts.slice(-3).join('/')}`;
}

function toolPath(tool: ToolGroupRow['entry']): string | null {
  const args = tool.args;
  return typeof args?.file_path === 'string' ? args.file_path : typeof args?.path === 'string' ? args.path : null;
}

function toolCommand(tool: ToolGroupRow['entry']): string | null {
  return typeof tool.args?.command === 'string' ? tool.args.command : null;
}

export function toolPreview(tool: ToolGroupRow['entry']): string {
  const filePath = toolPath(tool);
  const command = toolCommand(tool);
  if ((tool.name === 'read' || tool.name === 'write' || tool.name === 'edit') && filePath) return compactPath(filePath);
  if (tool.name === 'exec' && command) return command;
  return tool.meta || tool.name;
}

export function isLowSignalExecTool(tool: ToolGroupRow['entry']): boolean {
  if (tool.name !== 'exec') return false;
  const command = toolCommand(tool)?.trim() ?? '';
  const meta = typeof tool.meta === 'string' ? tool.meta.trim() : '';
  return !command && !meta;
}

export function toolPhaseLabel(tool: ToolGroupRow['entry']): string {
  if (tool.phase === 'start') return 'Starting';
  if (tool.phase === 'update') return 'Running';
  if (tool.status === 'failed' || tool.isError) return 'Failed';
  return 'Completed';
}

export function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function artifactFromTool(tool: ToolGroupRow['entry']): RuntimeBridgeTranscriptArtifact | null {
  return tool.artifacts[0] ?? null;
}

function toolRange(tool: ToolGroupRow['entry']): string | null {
  const offset = typeof tool.args?.offset === 'number' ? tool.args.offset : null;
  const limit = typeof tool.args?.limit === 'number' ? tool.args.limit : null;
  if (offset === null && limit === null) return null;
  return `${offset ?? 1}${limit !== null ? `, ${limit} lines` : ''}`;
}

function ToolDetailBlock({ row }: { row: ToolGroupRow }) {
  const tool = row.entry;
  const filePath = toolPath(tool);
  const command = toolCommand(tool);
  const artifact = artifactFromTool(tool);
  const content = typeof tool.args?.content === 'string' ? tool.args.content : null;
  const range = toolRange(tool);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {artifact?.kind === 'file-edit' ? (
        <ChatDiffView filePath={artifact.filePath} beforeText={artifact.oldText} afterText={artifact.newText} />
      ) : null}
      {artifact?.kind === 'file-write' ? (
        <ChatFileContentView
          title="Written file"
          filePath={artifact.filePath}
          content={artifact.content}
          defaultExpanded={false}
        />
      ) : null}
      {!artifact && tool.name === 'write' && content !== null && filePath ? (
        <ChatFileContentView title="Written file" filePath={filePath} content={content} defaultExpanded={false} />
      ) : null}
      <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        {filePath ? (
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Path:</strong>{' '}
            <span style={{ fontFamily: monoFont }}>{filePath}</span>
          </div>
        ) : null}
        {command ? (
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Command:</strong>{' '}
            <span style={{ fontFamily: monoFont }}>{command}</span>
          </div>
        ) : null}
        {range ? (
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Range:</strong> {range}
          </div>
        ) : null}
        {tool.meta ? (
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Result:</strong> {tool.meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ToolGroupBlock({ rows, keepOpen }: { rows: ToolGroupRow[]; keepOpen: boolean }) {
  const latestRowsMap = new Map<string, ToolGroupRow>();
  for (const row of rows) {
    const key = row.entry.toolCallId ?? row.id;
    const existing = latestRowsMap.get(key);
    if (!existing || existing.entry.at <= row.entry.at) {
      latestRowsMap.set(key, row);
    }
  }

  const latestRows = Array.from(latestRowsMap.values()).sort((a, b) => a.entry.at - b.entry.at);
  const visibleRows = latestRows.filter((row) => !isLowSignalExecTool(row.entry));
  const [open, setOpen] = useState(keepOpen);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const time = visibleRows[visibleRows.length - 1]?.entry.at ?? rows[rows.length - 1]?.entry.at ?? Date.now();
  const completedCount = visibleRows.filter((row) => row.entry.status === 'completed' && !row.entry.isError).length;
  const runningCount = visibleRows.filter((row) => row.entry.status === 'running' && !row.entry.isError).length;
  const failedCount = visibleRows.filter((row) => row.entry.status === 'failed' || row.entry.isError).length;

  useEffect(() => {
    setOpen(keepOpen);
  }, [keepOpen]);

  if (visibleRows.length === 0) return null;

  return (
    <div style={{ display: 'grid', justifyItems: 'start', gap: 10, marginBottom: 10 }}>
      <section
        style={{
          width: 'min(80ch, 82%)',
          border: '1px solid rgba(194, 187, 177, 0.4)',
          borderRadius: 20,
          background: 'rgba(248, 245, 240, 0.9)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>{open ? '▾' : '▸'}</span>
          <span style={pillStyle({ active: runningCount > 0 })}>Tool run</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            {visibleRows.length} step{visibleRows.length !== 1 ? 's' : ''}
            {runningCount > 0 ? `, ${runningCount} running` : ''}
            {failedCount > 0 ? `, ${failedCount} failed` : ''}
            {completedCount > 0 && runningCount === 0 ? `, ${completedCount} completed` : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(time)}</span>
        </button>
        {open ? (
          <div style={{ borderTop: '1px solid rgba(194, 187, 177, 0.22)', padding: 8, display: 'grid', gap: 6 }}>
            {visibleRows.map((row) => {
              const expanded = Boolean(expandedRows[row.id]);
              const canExpand =
                row.entry.name === 'read' ||
                row.entry.name === 'exec' ||
                row.entry.name === 'write' ||
                row.entry.name === 'edit' ||
                row.entry.artifacts.length > 0 ||
                Boolean(row.entry.meta);
              const color = toolStatusColor(row.entry.status, row.entry.isError);
              return (
                <div
                  key={row.id}
                  style={{
                    borderRadius: 16,
                    background: expanded ? 'rgba(255, 253, 250, 0.92)' : 'rgba(255, 255, 255, 0.5)',
                    border: expanded ? '1px solid rgba(194, 187, 177, 0.28)' : '1px solid rgba(194, 187, 177, 0.12)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => canExpand && setExpandedRows((current) => ({ ...current, [row.id]: !current[row.id] }))}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      cursor: canExpand ? 'pointer' : 'default',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 12, color: 'var(--text-ghost)', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>
                      {canExpand ? (expanded ? '▾' : '▸') : ''}
                    </span>
                    <span style={{ width: 14, color, fontSize: 14, lineHeight: 1.2, paddingTop: 2 }}>
                      {toolStatusDot(row.entry.status, row.entry.isError)}
                    </span>
                    <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={pillStyle()}>{toolLabel(row.entry.name)}</span>
                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>
                          {toolPhaseLabel(row.entry)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {toolPreview(row.entry)}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0, lineHeight: 1.4, paddingTop: 2 }}>
                      {formatEventTime(row.entry.at)}
                    </span>
                  </button>
                  {expanded ? <div style={{ padding: '0 12px 12px 36px' }}><ToolDetailBlock row={row} /></div> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function artifactTitle(artifact: RuntimeBridgeTranscriptArtifact): string {
  return artifact.kind === 'file-edit' ? 'Edited file' : 'Wrote file';
}

function artifactSummary(artifact: RuntimeBridgeTranscriptArtifact): string {
  const fileName = artifact.filePath.split('/').pop() || artifact.filePath;
  return `${artifactTitle(artifact)} · ${fileName}`;
}

function ArtifactPreview({ artifact }: { artifact: RuntimeBridgeTranscriptArtifact }) {
  if (artifact.kind === 'file-edit') {
    return <ChatDiffView filePath={artifact.filePath} beforeText={artifact.oldText} afterText={artifact.newText} />;
  }

  return (
    <ChatFileContentView
      title="Written file"
      filePath={artifact.filePath}
      content={artifact.content}
      defaultExpanded
    />
  );
}

export function ArtifactGroupBlock({ group }: { group: TranscriptArtifactGroup }) {
  const [open, setOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const fileCount = group.artifacts.length;

  return (
    <div style={{ display: 'grid', justifyItems: 'start', gap: 10, marginBottom: 10 }}>
      <section
        style={{
          width: 'min(80ch, 82%)',
          border: '1px solid rgba(114, 150, 133, 0.26)',
          borderRadius: 20,
          background: 'rgba(240, 246, 243, 0.92)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>{open ? '▾' : '▸'}</span>
          <span style={pillStyle({ active: true })}>Files</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>
            {fileCount} artifact{fileCount !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(group.at)}</span>
        </button>
        {open ? (
          <div style={{ borderTop: '1px solid rgba(114, 150, 133, 0.16)', padding: 8, display: 'grid', gap: 6 }}>
            {group.artifacts.map((artifact, index) => {
              const artifactId = `${group.id}-${index}`;
              const expanded = Boolean(expandedRows[artifactId]);
              const count = artifact.kind === 'file-edit' ? lineCount(artifact.newText) : lineCount(artifact.content);
              return (
                <div
                  key={artifactId}
                  style={{
                    borderRadius: 16,
                    background: expanded ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.42)',
                    border: expanded ? '1px solid rgba(114, 150, 133, 0.2)' : '1px solid rgba(114, 150, 133, 0.08)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedRows((current) => ({ ...current, [artifactId]: !current[artifactId] }))}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 12, color: 'var(--text-ghost)', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>
                      {expanded ? '▾' : '▸'}
                    </span>
                    <span style={{ color: '#3f695b', fontSize: 13, lineHeight: 1.4, paddingTop: 2 }}>•</span>
                    <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={pillStyle()}>{artifact.kind === 'file-edit' ? 'Edit' : 'Write'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{count} lines</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{artifactSummary(artifact)}</div>
                    </div>
                  </button>
                  {expanded ? <div style={{ padding: '0 12px 12px 36px' }}><ArtifactPreview artifact={artifact} /></div> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
