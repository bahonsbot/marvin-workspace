'use client';

import { useEffect, useState } from 'react';
import type { TranscriptArtifactGroup } from '@/lib/chat/runtime-bridge-transcript';
import { monoFont } from '@/components/chat/chat-rich-text';
import { pillStyle } from '@/components/chat/chat-ui-helpers';
import type { RuntimeBridgeTranscriptArtifact, RuntimeBridgeTranscriptEntry } from '@/lib/types/contracts';

export type ToolGroupRow = {
  id: string;
  entry: Extract<RuntimeBridgeTranscriptEntry, { kind: 'tool' }>;
};

export function toolLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function toolPreview(tool: ToolGroupRow['entry']): string {
  const args = tool.args;
  const filePath = typeof args?.file_path === 'string' ? args.file_path : typeof args?.path === 'string' ? args.path : null;
  const command = typeof args?.command === 'string' ? args.command : null;
  if ((tool.name === 'read' || tool.name === 'write' || tool.name === 'edit') && filePath) return filePath.split('/').pop() || filePath;
  if (tool.name === 'exec' && command) return command;
  return tool.meta || tool.name;
}

export function isLowSignalExecTool(tool: ToolGroupRow['entry']): boolean {
  if (tool.name !== 'exec') return false;
  const args = tool.args;
  const command = typeof args?.command === 'string' ? args.command.trim() : '';
  const meta = typeof tool.meta === 'string' ? tool.meta.trim() : '';
  return !command && !meta;
}

export function toolPhaseLabel(tool: ToolGroupRow['entry']): string {
  if (tool.phase === 'start') return 'Running';
  if (tool.phase === 'update') return 'Working';
  return tool.isError ? 'Failed' : 'Completed';
}

export function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ToolDetailBlock({ row }: { row: ToolGroupRow }) {
  const { entry: tool } = row;
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
              const canExpand = row.entry.name === 'read' || row.entry.name === 'exec' || row.entry.name === 'write' || row.entry.name === 'edit';
              return (
                <div key={row.id} style={{ borderRadius: 16, background: expanded ? 'rgba(250, 248, 245, 0.82)' : 'transparent', border: expanded ? '1px solid rgba(200, 195, 188, 0.22)' : '1px solid transparent', padding: '0 2px' }}>
                  <button type="button" onClick={() => canExpand && setExpandedRows((current) => ({ ...current, [row.id]: !current[row.id] }))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: canExpand ? 'pointer' : 'default', textAlign: 'left' }}>
                    <span style={{ width: 12, color: 'var(--text-ghost)', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>{canExpand ? (expanded ? '▾' : '▸') : ''}</span>
                    <span style={{ color: row.entry.isError ? '#b74c43' : '#3f695b', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>✓</span>
                    <span style={{ ...pillStyle(), flexShrink: 0 }}>{toolLabel(row.entry.name)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{toolPreview(row.entry)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0, lineHeight: 1.4, paddingTop: 2 }}>{toolPhaseLabel(row.entry)}</span>
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

function artifactTitle(artifact: RuntimeBridgeTranscriptArtifact): string {
  return artifact.kind === 'file-edit' ? 'Edited file' : 'Wrote file';
}

function artifactSummary(artifact: RuntimeBridgeTranscriptArtifact): string {
  const fileName = artifact.filePath.split('/').pop() || artifact.filePath;
  return `${artifactTitle(artifact)} · ${fileName}`;
}

function ArtifactPreview({ artifact }: { artifact: RuntimeBridgeTranscriptArtifact }) {
  if (artifact.kind === 'file-edit') {
    return (
      <div style={{ marginTop: 10, border: '1px solid rgba(200, 195, 188, 0.26)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.82)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ borderRight: '1px solid rgba(200,195,188,0.2)' }}>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(190, 91, 91, 0.06)' }}>Before</div>
            <pre style={{ margin: 0, padding: '12px 14px', fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-body)', background: 'rgba(255,255,255,0.78)' }}>{artifact.oldText}</pre>
          </div>
          <div>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(66, 124, 93, 0.08)' }}>After</div>
            <pre style={{ margin: 0, padding: '12px 14px', fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-body)', background: 'rgba(255,255,255,0.78)' }}>{artifact.newText}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, border: '1px solid rgba(200, 195, 188, 0.26)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.82)' }}>
      <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'rgba(250, 248, 245, 0.86)' }}>{artifact.filePath.split('/').pop() || artifact.filePath}</div>
      <pre style={{ margin: 0, padding: '12px 14px', fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-body)', background: 'rgba(255,255,255,0.78)' }}>{artifact.content}</pre>
    </div>
  );
}

export function ArtifactGroupBlock({ group }: { group: TranscriptArtifactGroup }) {
  const [open, setOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const fileCount = group.artifacts.length;

  return (
    <div style={{ display: 'grid', justifyItems: 'start', gap: 10, marginBottom: 10 }}>
      <section style={{ width: 'min(78ch, 78%)', border: '1px solid rgba(121, 166, 148, 0.24)', borderRadius: 20, background: 'rgba(242, 248, 245, 0.92)', overflow: 'hidden' }}>
        <button type="button" onClick={() => setOpen((value) => !value)} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>{open ? '▾' : '▸'}</span>
          <span style={pillStyle({ active: true })}>Files</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>{fileCount} file artifact{fileCount !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(group.at)}</span>
        </button>
        {open ? (
          <div style={{ borderTop: '1px solid rgba(121, 166, 148, 0.16)', padding: 8, display: 'grid', gap: 6 }}>
            {group.artifacts.map((artifact, index) => {
              const artifactId = `${group.id}-${index}`;
              const expanded = Boolean(expandedRows[artifactId]);
              return (
                <div key={artifactId} style={{ borderRadius: 16, background: expanded ? 'rgba(255, 255, 255, 0.82)' : 'transparent', border: expanded ? '1px solid rgba(121, 166, 148, 0.18)' : '1px solid transparent', padding: '0 2px' }}>
                  <button type="button" onClick={() => setExpandedRows((current) => ({ ...current, [artifactId]: !current[artifactId] }))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 12, color: 'var(--text-ghost)', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>{expanded ? '▾' : '▸'}</span>
                    <span style={{ color: '#3f695b', fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>•</span>
                    <span style={{ ...pillStyle(), flexShrink: 0 }}>{artifact.kind === 'file-edit' ? 'Edit' : 'Write'}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {artifactSummary(artifact)}
                    </span>
                  </button>
                  {expanded ? <div style={{ padding: '0 12px 12px 34px' }}><ArtifactPreview artifact={artifact} /></div> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
