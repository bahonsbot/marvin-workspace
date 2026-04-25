'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  cleanReviewText,
  normalizeAutonomousRunResult,
  parseLightweightMarkdown,
  previewReviewText,
} from '@/lib/autonomous-output';
import {
  AUTONOMOUS_TASK_MODEL_ALIASES,
  AUTONOMOUS_TASK_MODEL_DEFAULT,
  agentDefaultModelLabel,
  formatAutonomousTaskModel,
  type AutonomousTaskModelAlias,
} from '@/lib/task-models';
import { autonomousTaskPreflight } from '@/lib/autonomous-preflight';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskDetail = {
  summary: string;
  why?: string;
  proof?: string;
  unlocks?: string;
  completed?: string;
};

type Task = {
  id: string;
  text: string;
  column: 'backlog' | 'todo' | 'inprogress' | 'review' | 'done';
  detail: TaskDetail;
  meta?: {
    priority?: string;
    agentTarget?: string;
    model?: string;
    sourceType?: string;
    runStatus?: string;
    feedback?: string[];
    needsInputReason?: string;
    needsInputNote?: string;
    runError?: string;
    createdAt?: number;
    artifactPath?: string;
    resultSummary?: string;
  };
};

type Column = {
  id: string;
  title: string;
  count: number;
  tasks: Task[];
};

type BoardId = 'autonomous' | 'personal' | 'projects';
type ManualTaskColumn = 'todo' | 'inprogress' | 'done';
type AutoPriority = 'critical' | 'high' | 'normal' | 'low';
type AutoAgentTarget = 'marvin' | 'builder' | 'reviewer' | 'content-creator';
type AutoModelValue = typeof AUTONOMOUS_TASK_MODEL_DEFAULT | AutonomousTaskModelAlias;

type BoardMeta = {
  id: BoardId;
  label: string;
  icon: string;
};

const BOARDS: BoardMeta[] = [
  { id: 'autonomous', label: 'Autonomous', icon: '⚡' },
  { id: 'personal', label: 'Personal', icon: '🌱' },
  { id: 'projects', label: 'Projects', icon: '📁' },
];

const LS_PERSONAL = 'mc_board_personal';
const LS_PROJECTS = 'mc_board_projects';

function seedPersonal(): Record<string, Column> {
  return {
    todo: {
      id: 'todo', title: 'To Do', count: 2,
      tasks: [
        { id: 'p-seed-1', text: '[Personal] Schedule dentist checkup | Why: Preventive care, overdue by 4 months.', column: 'todo', detail: { summary: '[Personal] Schedule dentist checkup', why: 'Preventive care, overdue by 4 months.' } },
        { id: 'p-seed-2', text: '[Personal] Renew apartment insurance | Why: Policy expires end of month.', column: 'todo', detail: { summary: '[Personal] Renew apartment insurance', why: 'Policy expires end of month.' } },
      ],
    },
    inprogress: {
      id: 'inprogress', title: 'In Progress', count: 1,
      tasks: [
        { id: 'p-seed-3', text: '[Personal] Research Vietnam visa options | Why: Current stay valid through May, need to plan ahead.', column: 'inprogress', detail: { summary: '[Personal] Research Vietnam visa options', why: 'Current stay valid through May, need to plan ahead.' } },
      ],
    },
    done: {
      id: 'done', title: 'Done', count: 1,
      tasks: [
        { id: 'p-seed-4', text: '[Personal] Buy groceries for the week | Completed: Weekly meal prep session complete.', column: 'done', detail: { summary: '[Personal] Buy groceries for the week', completed: 'Weekly meal prep session complete.' } },
      ],
    },
  };
}

function seedProjects(): Record<string, Column> {
  return {
    todo: {
      id: 'todo', title: 'To Do', count: 2,
      tasks: [
        { id: 'pr-seed-1', text: '[Projects] Define scope for Next.js migration | Why: Need clear boundaries before starting frontend work.', column: 'todo', detail: { summary: '[Projects] Define scope for Next.js migration', why: 'Need clear boundaries before starting frontend work.' } },
        { id: 'pr-seed-2', text: '[Projects] Collect feedback on design mockups | Why: Two stakeholders yet to review.', column: 'todo', detail: { summary: '[Projects] Collect feedback on design mockups', why: 'Two stakeholders yet to review.' } },
      ],
    },
    inprogress: {
      id: 'inprogress', title: 'In Progress', count: 1,
      tasks: [
        { id: 'pr-seed-3', text: '[Projects] Set up CI pipeline for staging | Why: Automation removes manual deploy step.', column: 'inprogress', detail: { summary: '[Projects] Set up CI pipeline for staging', why: 'Automation removes manual deploy step.' } },
      ],
    },
    done: {
      id: 'done', title: 'Done', count: 1,
      tasks: [
        { id: 'pr-seed-4', text: '[Projects] Draft project README | Completed: Structure and first-pass content merged.', column: 'done', detail: { summary: '[Projects] Draft project README', completed: 'Structure and first-pass content merged.' } },
      ],
    },
  };
}

function columnsFromBoard(board: Record<string, Column>): Column[] {
  return [board.todo, board.inprogress, board.done];
}

function cloneBoard(board: Record<string, Column>): Record<string, Column> {
  return {
    todo: { ...board.todo, tasks: [...board.todo.tasks] },
    inprogress: { ...board.inprogress, tasks: [...board.inprogress.tasks] },
    done: { ...board.done, tasks: [...board.done.tasks] },
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function cardStyle() {
  return {
    border: '1px solid rgba(200, 195, 188, 0.34)',
    borderRadius: 18,
    padding: 16,
    background: 'rgba(255, 255, 255, 0.76)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
  };
}

function columnPalette(colId: string) {
  if (colId === 'backlog') return { accent: '#8d6f4d', border: 'rgba(141, 111, 77, 0.16)', bg: 'linear-gradient(180deg, rgba(141, 111, 77, 0.05) 0%, rgba(255, 255, 255, 0.84) 20%)', chipBg: 'rgba(141, 111, 77, 0.1)', chipText: '#8d6f4d', emptyText: 'No cards parked in backlog.' };
  if (colId === 'todo') return { accent: '#c4823a', border: 'rgba(196, 130, 58, 0.16)', bg: 'linear-gradient(180deg, rgba(196, 130, 58, 0.05) 0%, rgba(255, 255, 255, 0.84) 20%)', chipBg: 'rgba(196, 130, 58, 0.1)', chipText: '#c4823a', emptyText: 'Nothing queued for execution.' };
  if (colId === 'inprogress') return { accent: '#3c6658', border: 'rgba(121, 166, 148, 0.18)', bg: 'linear-gradient(180deg, rgba(121, 166, 148, 0.08) 0%, rgba(255, 255, 255, 0.84) 20%)', chipBg: 'rgba(121, 166, 148, 0.12)', chipText: '#3c6658', emptyText: 'No work actively in motion.' };
  if (colId === 'review') return { accent: '#7f5aa2', border: 'rgba(127, 90, 162, 0.18)', bg: 'linear-gradient(180deg, rgba(127, 90, 162, 0.07) 0%, rgba(255, 255, 255, 0.84) 20%)', chipBg: 'rgba(127, 90, 162, 0.11)', chipText: '#7f5aa2', emptyText: 'Nothing waiting for operator review.' };
  return { accent: '#79a694', border: 'rgba(121, 166, 148, 0.16)', bg: 'linear-gradient(180deg, rgba(212, 231, 221, 0.45) 0%, rgba(255, 255, 255, 0.84) 20%)', chipBg: 'rgba(121, 166, 148, 0.11)', chipText: '#3c6658', emptyText: 'No completed cards yet.' };
}

function autonomousCategoryFromLink(taskText?: string) {
  return taskText?.match(/^\[(.+?)\]/)?.[1]?.trim() ?? 'Autonomous';
}

function extractLane(task: Task) {
  return task.detail.summary.match(/^\[(.+?)\]/)?.[1] ?? 'Task';
}

function laneStyleData(lane: string) {
  const n = lane.toLowerCase();
  if (n === 'personal') return { icon: '🌱', text: 'Personal', color: '#3c6658', bg: 'rgba(121, 166, 148, 0.12)', border: 'rgba(121, 166, 148, 0.2)' };
  if (n === 'projects') return { icon: '📁', text: 'Projects', color: '#3c6658', bg: 'rgba(212, 231, 221, 0.62)', border: 'rgba(121, 166, 148, 0.2)' };
  if (n === 'autonomous') return { icon: '⚡', text: 'Generated', color: '#5f655f', bg: 'rgba(240, 238, 233, 0.9)', border: 'rgba(200, 195, 188, 0.28)' };
  return { icon: '🧩', text: lane, color: '#7a7a7a', bg: 'rgba(255, 255, 255, 0.6)', border: 'rgba(200, 195, 188, 0.3)' };
}

function autonomousTintForColumn(column: Task['column']) {
  if (column === 'backlog') return { bg: 'rgba(141, 111, 77, 0.14)', border: 'rgba(141, 111, 77, 0.18)' };
  if (column === 'todo') return { bg: 'rgba(196, 130, 58, 0.14)', border: 'rgba(196, 130, 58, 0.18)' };
  if (column === 'inprogress') return { bg: 'rgba(121, 166, 148, 0.16)', border: 'rgba(121, 166, 148, 0.2)' };
  if (column === 'review') return { bg: 'rgba(127, 90, 162, 0.15)', border: 'rgba(127, 90, 162, 0.19)' };
  return { bg: 'rgba(121, 166, 148, 0.13)', border: 'rgba(121, 166, 148, 0.18)' };
}

function displaySummary(summary: string) {
  return summary.replace(/^\[[^\]]+\]\s*/, '');
}

function cleanAutonomousTitle(summary: string) {
  return displaySummary(summary)
    .replace(/^\(\d{4}-\d{2}-\d{2}\)\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/^(learn|build|create|write|fix|review|improve|tighten|draft):\s*/i, '')
    .replace(/^\b(career|mission control|projects|personal)\b\s*/i, '')
    .replace(/^[-•\s:]+/, '')
    .split(/\s*[|→]|;\s*deliverable:/i)[0]
    .trim();
}

function formatAutonomousSummary(summary: string) {
  return cleanAutonomousTitle(summary);
}

function capitalizeSupportLead(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function supportPreview(value: string) {
  const sentenceMatch = value.match(/^.*?[.!?](?=\s|$)/);
  if (sentenceMatch) return sentenceMatch[0].trim();
  const semicolonIndex = value.indexOf(';');
  if (semicolonIndex !== -1) return value.slice(0, semicolonIndex).trim();
  return value.trim();
}

function formatAutonomousSupport(detail: TaskDetail, feedback?: string[]) {
  const latestFeedback = Array.isArray(feedback) ? feedback.at(-1) : undefined;
  const source = latestFeedback ?? detail.why ?? detail.completed ?? detail.proof ?? detail.unlocks ?? '';
  const clean = cleanReviewText(source)?.replace(/\s+/g, ' ').trim() ?? '';
  if (!clean) return null;
  return capitalizeSupportLead(clean);
}

function DetailMarkdown({ value, tone = 'default' }: { value?: string; tone?: 'default' | 'muted' | 'feedback' }) {
  const blocks = parseLightweightMarkdown(value);
  if (blocks.length === 0) return null;

  const paragraphColor = tone === 'muted' ? '#6f726f' : tone === 'feedback' ? '#5c476f' : '#37413d';
  const headingColor = tone === 'feedback' ? '#6a4f87' : '#2f3834';

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <div key={`${block.type}-${index}`} style={{ fontSize: block.level === 2 ? 12.5 : 12, fontWeight: 700, color: headingColor }}>{block.text}</div>;
        }
        if (block.type === 'bullet-list') {
          return (
            <ul key={`${block.type}-${index}`} style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: paragraphColor }}>
              {block.items.map((item, itemIndex) => <li key={`${block.type}-${index}-${itemIndex}`}>{item}</li>)}
            </ul>
          );
        }
        if (block.type === 'code') {
          return <pre key={`${block.type}-${index}`} style={{ margin: 0, padding: '10px 12px', borderRadius: 12, background: 'rgba(246, 244, 239, 0.96)', border: '1px solid rgba(200,195,188,0.34)', color: '#3d4541', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', fontSize: 11.5, lineHeight: 1.55 }}>{block.text}</pre>;
        }
        return <p key={`${block.type}-${index}`} style={{ margin: 0, color: paragraphColor }}>{block.text}</p>;
      })}
    </div>
  );
}

function InlineDetailMarkdown({ value }: { value?: string }) {
  const blocks = parseLightweightMarkdown(value);
  if (blocks.length === 0) return null;

  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'heading') return <span>{block.text}</span>;
    if (block.type === 'bullet-list' && block.items[0]) return <span>{block.items[0]}</span>;
    if (block.type === 'code' && block.text) return <span>{block.text}</span>;
  }

  return null;
}

function artifactLabel(path?: string) {
  if (!path) return '';
  const normalized = path.replace(/\/+$/, '');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || normalized;
}

function boardTypeFromLabel(label: string): 'personal' | 'projects' {
  return label.toLowerCase() === 'projects' ? 'projects' : 'personal';
}

type ModalMode =
  | null
  | { mode: 'create'; board: 'personal' | 'projects'; defaultColumn: ManualTaskColumn }
  | { mode: 'edit'; board: 'personal' | 'projects'; task: Task };

function TaskModal({ modal, onClose, onSave }: { modal: ModalMode; onClose: () => void; onSave: (board: 'personal' | 'projects', task: Task, isNew: boolean) => void }) {
  const [board, setBoard] = useState<'personal' | 'projects'>('personal');
  const [summary, setSummary] = useState('');
  const [why, setWhy] = useState('');
  const [completed, setCompleted] = useState('');
  const [column, setColumn] = useState<ManualTaskColumn>('todo');
  const shouldCloseOnMouseUpRef = useRef(false);

  useEffect(() => {
    if (!modal) return;
    if (modal.mode === 'edit') {
      setBoard(modal.board);
      setSummary(displaySummary(modal.task.detail.summary));
      setWhy(modal.task.detail.why ?? '');
      setCompleted(modal.task.detail.completed ?? '');
      setColumn(modal.task.column as ManualTaskColumn);
    } else {
      setBoard(modal.board);
      setSummary('');
      setWhy('');
      setCompleted('');
      setColumn(modal.defaultColumn);
    }
  }, [modal]);

  if (!modal) return null;

  const tag = board === 'personal' ? 'Personal' : 'Projects';
  const isEdit = modal.mode === 'edit';
  const isDone = column === 'done';

  function handleSave() {
    if (!summary.trim()) return;
    const cleanSummary = summary.trim();
    const whyText = why.trim();
    const completedText = completed.trim();
    const textParts = [`[${tag}] ${cleanSummary}`];
    if (whyText) textParts.push(`Why: ${whyText}`);
    if (isDone && completedText) textParts.push(`Completed: ${completedText}`);
    const text = textParts.join(' | ');
    const originalTaskId = isEdit ? (modal as { mode: 'edit'; task: Task }).task.id : null;

    const task: Task = {
      id: originalTaskId ?? makeId(board === 'personal' ? 'p' : 'pr'),
      text,
      column,
      detail: {
        summary: `[${tag}] ${cleanSummary}`,
        ...(whyText ? { why: whyText } : {}),
        ...(isDone && completedText ? { completed: completedText } : {}),
      },
    };
    onSave(board, task, !isEdit);
    onClose();
  }

  return (
    <div
      onMouseDown={e => { shouldCloseOnMouseUpRef.current = e.target === e.currentTarget; }}
      onMouseUp={e => {
        if (shouldCloseOnMouseUpRef.current && e.target === e.currentTarget) onClose();
        shouldCloseOnMouseUpRef.current = false;
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#fffdfb', borderRadius: 24, border: '1px solid rgba(200, 195, 188, 0.5)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', padding: 28, width: '100%', maxWidth: 480, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{isEdit ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#7a7a7a', padding: 4, lineHeight: 1 }} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Board</label><div style={{ display: 'flex', gap: 8 }}>{(['personal', 'projects'] as const).map(b => (<button key={b} onClick={() => setBoard(b)} style={{ flex: 1, padding: '8px 12px', borderRadius: 12, border: '1px solid', borderColor: board === b ? '#0f1f19' : 'rgba(200,195,188,0.5)', background: board === b ? '#0f1f19' : 'transparent', color: board === b ? '#ffffff' : '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease' }}>{b === 'personal' ? '🌱 Personal' : '📁 Projects'}</button>))}</div></div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Task summary <span style={{ color: '#c0392b' }}>*</span></label><input type="text" value={summary} onChange={e => setSummary(e.target.value)} placeholder="What needs to be done?" style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 14, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && summary.trim() && handleSave()} /></div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Phase</label><div style={{ display: 'flex', gap: 8 }}>{(['todo', 'inprogress', 'done'] as const).map(col => (<button key={col} onClick={() => setColumn(col)} style={{ flex: 1, padding: '8px 12px', borderRadius: 12, border: '1px solid', borderColor: column === col ? '#0f1f19' : 'rgba(200,195,188,0.5)', background: column === col ? '#0f1f19' : 'transparent', color: column === col ? '#ffffff' : '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease' }}>{col === 'todo' ? 'To Do' : col === 'inprogress' ? 'In Progress' : 'Done'}</button>))}</div></div>
        {!isDone && <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Why it matters <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a8a8a8' }}>(optional)</span></label><textarea value={why} onChange={e => setWhy(e.target.value)} placeholder="Context or motivation..." rows={2} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} /></div>}
        {isDone && <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Delivered note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a8a8a8' }}>(optional)</span></label><textarea value={completed} onChange={e => setCompleted(e.target.value)} placeholder="What was the outcome?" rows={2} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} /></div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}><button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(200,195,188,0.5)', background: 'transparent', color: '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button><button onClick={handleSave} disabled={!summary.trim()} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: summary.trim() ? '#0f1f19' : 'rgba(200,195,188,0.4)', color: summary.trim() ? '#ffffff' : '#a8a8a8', cursor: summary.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, transition: 'all 0.15s ease' }}>{isEdit ? 'Save changes' : 'Add task'}</button></div>
      </div>
    </div>
  );
}

function AutonomousTaskModal({ open, mode, initialTask, onClose, onSubmit }: { open: boolean; mode: 'create' | 'edit'; initialTask?: Task | null; onClose: () => void; onSubmit: (input: { title: string; description?: string; priority: AutoPriority; agentTarget: AutoAgentTarget; model?: AutonomousTaskModelAlias | null; }) => Promise<void>; }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AutoPriority>('normal');
  const [agentTarget, setAgentTarget] = useState<AutoAgentTarget>('marvin');
  const [model, setModel] = useState<AutoModelValue>(AUTONOMOUS_TASK_MODEL_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldCloseOnMouseUpRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setPriority('normal'); setAgentTarget('marvin'); setModel(AUTONOMOUS_TASK_MODEL_DEFAULT); setSaving(false); setError(null);
      return;
    }
    if (mode === 'edit' && initialTask) {
      setTitle(cleanAutonomousTitle(initialTask.detail.summary));
      setDescription(initialTask.detail.why ?? '');
      setPriority((initialTask.meta?.priority as AutoPriority) ?? 'normal');
      setAgentTarget((initialTask.meta?.agentTarget as AutoAgentTarget) ?? 'marvin');
      setModel((initialTask.meta?.model as AutonomousTaskModelAlias) ?? AUTONOMOUS_TASK_MODEL_DEFAULT);
      setSaving(false);
      setError(null);
      return;
    }
    setTitle(''); setDescription(''); setPriority('normal'); setAgentTarget('marvin'); setModel(AUTONOMOUS_TASK_MODEL_DEFAULT); setSaving(false); setError(null);
  }, [open, mode, initialTask]);

  if (!open) return null;

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true); setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        agentTarget,
        model: model === AUTONOMOUS_TASK_MODEL_DEFAULT ? null : model,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${mode === 'edit' ? 'update' : 'create'} autonomous task.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onMouseDown={e => { shouldCloseOnMouseUpRef.current = e.target === e.currentTarget; }}
      onMouseUp={e => {
        if (shouldCloseOnMouseUpRef.current && e.target === e.currentTarget) onClose();
        shouldCloseOnMouseUpRef.current = false;
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#fffdfb', borderRadius: 24, border: '1px solid rgba(200, 195, 188, 0.5)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', padding: 28, width: '100%', maxWidth: 520, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{mode === 'edit' ? 'Edit autonomous task' : 'New autonomous task'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#7a7a7a', padding: 4, lineHeight: 1 }} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Task title <span style={{ color: '#c0392b' }}>*</span></label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What should Autonomous work on?" style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 14, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && title.trim() && handleSubmit()} /></div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a8a8a8' }}>(optional)</span></label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add context or desired outcome..." rows={3} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Priority</label><select value={priority} onChange={e => setPriority(e.target.value as AutoPriority)} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none' }}><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></div>
          <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Agent</label><select value={agentTarget} onChange={e => setAgentTarget(e.target.value as AutoAgentTarget)} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none' }}><option value="marvin">Marvin</option><option value="builder">Builder</option><option value="reviewer">Reviewer</option><option value="content-creator">Content Creator</option></select></div>
        </div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Model</label><select value={model} onChange={e => setModel(e.target.value as AutoModelValue)} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none' }}><option value={AUTONOMOUS_TASK_MODEL_DEFAULT}>{agentDefaultModelLabel(agentTarget)}</option>{AUTONOMOUS_TASK_MODEL_ALIASES.map((alias) => <option key={alias} value={alias}>{alias}</option>)}</select></div>
        {error ? <div style={{ fontSize: 12, color: '#b04a4a', lineHeight: 1.6 }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}><button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(200,195,188,0.5)', background: 'transparent', color: '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button><button onClick={() => void handleSubmit()} disabled={!title.trim() || saving} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: title.trim() && !saving ? '#0f1f19' : 'rgba(200,195,188,0.4)', color: title.trim() && !saving ? '#ffffff' : '#a8a8a8', cursor: title.trim() && !saving ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>{saving ? mode === 'edit' ? 'Saving…' : 'Adding…' : mode === 'edit' ? 'Save changes' : 'Add task'}</button></div>
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, boardType, isDragging, onDragStart, onDragEnd, onOpen, isSelected, webResearchEnabled }: { task: Task; onEdit?: (task: Task) => void; onDelete?: (task: Task) => void; boardType?: 'autonomous' | 'personal' | 'projects'; isDragging?: boolean; onDragStart?: (taskId: string) => void; onDragEnd?: () => void; onOpen?: (task: Task) => void; isSelected?: boolean; webResearchEnabled?: boolean; }) {
  const lane = extractLane(task);
  const laneSd = laneStyleData(lane);
  const cardTint = autonomousTintForColumn(task.column);
  const visibleSummary = boardType === 'autonomous' ? formatAutonomousSummary(task.detail.summary) : displaySummary(task.detail.summary);
  const latestFeedback = task.meta?.feedback?.at(-1) ?? null;
  const preflight = autonomousTaskPreflight({
    title: task.detail.summary,
    description: task.detail.why,
    agentTarget: task.meta?.agentTarget,
    webResearchEnabled,
  });
  const supportText = boardType === 'autonomous'
    ? formatAutonomousSupport(
      {
        ...task.detail,
        completed: task.meta?.needsInputNote ?? task.meta?.runError ?? task.meta?.resultSummary ?? task.detail.completed,
      },
      task.meta?.feedback,
    )
    : capitalizeSupportLead(task.detail.why ?? task.detail.completed ?? '') || null;
  const [showFullSupport, setShowFullSupport] = useState(false);
  useEffect(() => {
    setShowFullSupport(false);
  }, [task.id, supportText]);
  const supportPreviewText = supportText ? supportPreview(supportText) : null;
  const supportHasMore = Boolean(supportText && supportPreviewText && supportPreviewText.length < supportText.length);
  const visibleSupportText = supportText ? (showFullSupport ? supportText : supportPreviewText ?? supportText) : null;
  const isManual = boardType === 'personal' || boardType === 'projects';
  const showInspection = boardType === 'autonomous' && (task.detail.proof || task.detail.unlocks || latestFeedback || task.meta?.needsInputNote || task.meta?.runError);
  return (
    <article onClick={() => { if (boardType === 'autonomous' && onOpen) onOpen(task); }} draggable={isManual} onDragStart={event => { if (!isManual || !onDragStart) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); onDragStart(task.id); }} onDragEnd={() => { if (!isManual || !onDragEnd) return; onDragEnd(); }} style={{ ...cardStyle(), padding: boardType === 'autonomous' ? 14 : 16, minHeight: boardType === 'autonomous' ? 188 : undefined, display: 'grid', gap: 10, alignContent: 'start', position: 'relative', cursor: boardType === 'autonomous' ? 'pointer' : isManual ? 'grab' : 'default', opacity: isDragging ? 0.58 : 1, transform: isDragging ? 'scale(0.985)' : 'none', background: boardType === 'autonomous' ? cardTint.bg : 'rgba(255, 255, 255, 0.76)', border: isSelected ? '1px solid rgba(60, 102, 88, 0.34)' : `1px solid ${boardType === 'autonomous' ? cardTint.border : 'rgba(200, 195, 188, 0.34)'}`, boxShadow: isSelected ? '0 0 0 1px rgba(60, 102, 88, 0.12), 0 10px 28px rgba(8, 25, 19, 0.08)' : '0 4px 20px rgba(0, 0, 0, 0.05)', transition: 'opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.32, color: laneSd.color, background: laneSd.bg, border: `1px solid ${laneSd.border}` }}><span>{laneSd.icon}</span><span>{laneSd.text}</span></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{isManual && onEdit && <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7a7a7a', padding: '2px 4px' }} aria-label="Edit task">✎</button>}{isManual && onDelete && <button onClick={() => onDelete(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#a06a6a', padding: '2px 4px' }} aria-label="Remove task">✕</button>}</div>
      </div>
      <div style={{ fontSize: boardType === 'autonomous' ? 13.5 : 14, fontWeight: boardType === 'autonomous' ? 600 : 500, lineHeight: 1.45, color: '#222222' }}>{visibleSummary}</div>
      {visibleSupportText ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11.5, color: latestFeedback ? '#7f5aa2' : '#7a7a7a', lineHeight: 1.55 }}>
            <span style={{ fontWeight: latestFeedback ? 700 : 500 }}>{latestFeedback ? 'Feedback:' : ''}</span>
            {latestFeedback ? ' ' : ''}
            {visibleSupportText}
          </div>
          {supportHasMore ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowFullSupport((current) => !current);
              }}
              style={{
                width: 'fit-content',
                padding: 0,
                border: 'none',
                background: 'none',
                color: '#6c766f',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
              }}
            >
              {showFullSupport ? 'Show less' : 'Show more'}
            </button>
          ) : null}
        </div>
      ) : null}
      {boardType === 'autonomous' && task.meta ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{task.meta.priority ? <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,245,234,0.82)', color: '#b26a1f', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{task.meta.priority}</span> : null}{task.meta.agentTarget ? <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(200,195,188,0.45)', color: '#5f655f', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{task.meta.agentTarget}</span> : null}{task.meta.model ? <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(236, 244, 240, 0.84)', border: '1px solid rgba(121,166,148,0.3)', color: '#2d5a4a', fontSize: 10, fontWeight: 700 }}>{task.meta.model}</span> : null}{!preflight.ok ? <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255, 244, 224, 0.9)', border: '1px solid rgba(205, 153, 69, 0.24)', color: '#9a6112', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Blocked</span> : null}</div> : null}
      {boardType === 'autonomous' && !preflight.ok && preflight.warning ? <div style={{ display: 'grid', gap: 4, padding: '10px 11px', borderRadius: 12, background: 'rgba(255, 244, 224, 0.72)', border: '1px solid rgba(205, 153, 69, 0.22)', color: '#7d5314' }}><div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>Execution preflight</div><div style={{ fontSize: 11.5, lineHeight: 1.5 }}>{preflight.warning}</div></div> : null}
      {showInspection ? <details style={{ margin: 0 }}><summary style={{ cursor: 'pointer', fontSize: 11, color: '#7a7a7a', listStyle: 'none', textDecoration: 'underline', textDecorationStyle: 'dotted', width: 'fit-content' }}>Scope</summary><div style={{ marginTop: 10, fontSize: 12, color: '#7a7a7a', display: 'grid', gap: 8, lineHeight: 1.65 }}>{task.detail.proof ? <div style={{ display: 'grid', gap: 4 }}><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Proof</span><InlineDetailMarkdown value={task.detail.proof} /></div> : null}{task.detail.unlocks ? <div><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Unlocks:</span> {task.detail.unlocks}</div> : null}</div></details> : null}
    </article>
  );
}

function ColumnView({ column, boardType, onEdit, onDelete, onDropTask, draggingTaskId, isDropTarget, onDragEnterColumn, onDragLeaveColumn, onDragStartTask, onOpenTask, selectedTaskId, webResearchEnabled }: { column: Column; boardType?: 'autonomous' | 'personal' | 'projects'; onEdit?: (task: Task) => void; onDelete?: (task: Task) => void; onDropTask?: (taskId: string, newColumn: ManualTaskColumn) => void; draggingTaskId?: string | null; isDropTarget?: boolean; onDragEnterColumn?: (columnId: ManualTaskColumn) => void; onDragLeaveColumn?: () => void; onDragStartTask?: (taskId: string, columnId: ManualTaskColumn) => void; onOpenTask?: (task: Task) => void; selectedTaskId?: string | null; webResearchEnabled?: boolean; }) {
  const palette = columnPalette(column.id);
  const isManual = boardType === 'personal' || boardType === 'projects';
  return (
    <section onDragOver={event => { if (!isManual || !onDropTask) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; onDragEnterColumn?.(column.id as ManualTaskColumn); }} onDragEnter={() => { if (!isManual || !onDragEnterColumn) return; onDragEnterColumn(column.id as ManualTaskColumn); }} onDrop={event => { if (!isManual || !onDropTask) return; event.preventDefault(); const taskId = event.dataTransfer.getData('text/plain'); if (taskId) onDropTask(taskId, column.id as ManualTaskColumn); }} style={{ minWidth: 0, border: `1px solid ${isDropTarget ? `${palette.accent}66` : palette.border}`, borderRadius: 18, padding: 12, background: isDropTarget ? `linear-gradient(180deg, ${palette.accent}16 0%, rgba(255, 255, 255, 0.88) 24%)` : palette.bg, display: 'grid', gap: 10, alignContent: 'start', boxShadow: isDropTarget ? `0 0 0 1px ${palette.accent}20 inset` : 'none', transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: palette.accent }} /><h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{column.title}</h3></div><span style={{ fontSize: 11, color: palette.chipText, background: palette.chipBg, padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>{column.count}</span></div>
      {column.tasks.length === 0 ? <div style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, padding: 18, background: 'rgba(255, 255, 255, 0.54)', textAlign: 'center', fontSize: 11.5, color: '#8a8a8a' }}>{palette.emptyText}</div> : <div style={{ display: 'grid', gap: 8 }}>{column.tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpenTask} onEdit={onEdit} onDelete={onDelete} boardType={boardType} isDragging={draggingTaskId === task.id} isSelected={selectedTaskId === task.id} onDragStart={isManual ? taskId => onDragStartTask?.(taskId, column.id as ManualTaskColumn) : undefined} onDragEnd={isManual ? onDragLeaveColumn : undefined} webResearchEnabled={webResearchEnabled} />)}</div>}
    </section>
  );
}

function CompactSyncStatus({ state, details, onCleanup, cleanupBusy }: { state: 'unknown' | 'ok' | 'drift'; details: string; onCleanup: () => Promise<void>; cleanupBusy: boolean; }) {
  const [open, setOpen] = useState(false);
  const config = state === 'ok'
    ? { label: 'Sync aligned', dot: '#3c6658', bg: 'rgba(121, 166, 148, 0.14)', text: '#3c6658' }
    : state === 'drift'
      ? { label: 'Sync drift', dot: '#d46a6a', bg: 'rgba(248, 113, 113, 0.12)', text: '#b45858' }
      : { label: 'Sync unknown', dot: '#8a8a8a', bg: 'rgba(200, 195, 188, 0.16)', text: '#7a7a7a' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0, position: 'relative' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: config.bg }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: config.dot }} /><span style={{ fontSize: 11, fontWeight: 700, color: config.text, textTransform: 'uppercase' }}>{config.label}</span></span>
      <button onClick={() => setOpen((v) => !v)} aria-label="Sync details" title="Sync details" style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(200,195,188,0.45)', background: 'rgba(255,255,255,0.82)', color: '#7a7a7a', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>i</button>
      <button onClick={() => void onCleanup()} disabled={cleanupBusy} aria-label="Apply board truth to AUTONOMOUS.md" title="Apply board truth to AUTONOMOUS.md" style={{ height: 26, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(200,195,188,0.45)', background: 'rgba(255,255,255,0.82)', color: cleanupBusy ? '#9a9a9a' : '#5f655f', cursor: cleanupBusy ? 'progress' : 'pointer', fontSize: 11, fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', letterSpacing: 0.04 }}>Apply board truth</button>
      {open ? <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 4, maxWidth: 360, border: '1px solid rgba(200,195,188,0.45)', borderRadius: 14, background: 'rgba(255,253,251,0.98)', boxShadow: '0 12px 32px rgba(0,0,0,0.08)', padding: '10px 12px', fontSize: 11.5, color: '#6f726f', lineHeight: 1.55 }}>{details}</div> : null}
    </div>
  );
}

function AutonomousTaskDrawer({ task, onClose, onExecute, onApprove, onReject, onRemove, onEdit, busy, webResearchEnabled }: { task: Task | null; onClose: () => void; onExecute: (task: Task) => Promise<void>; onApprove: (task: Task) => Promise<void>; onReject: (task: Task, note: string) => Promise<void>; onRemove: (task: Task) => Promise<void>; onEdit: (task: Task) => void; busy: boolean; webResearchEnabled?: boolean; }) {
  const [rejectNote, setRejectNote] = useState('');
  const canExecute = task?.column === 'backlog' || task?.column === 'todo';
  const canReview = task?.column === 'review' && task?.meta?.runStatus === 'done';
  const preflight = autonomousTaskPreflight({
    title: task?.detail.summary,
    description: task?.detail.why,
    agentTarget: task?.meta?.agentTarget,
    webResearchEnabled,
  });

  useEffect(() => {
    setRejectNote('');
  }, [task?.id]);

  if (!task) return null;

  const runLabel = task.meta?.runStatus === 'rejected'
    ? 'Rejected'
    : task.meta?.runStatus === 'error'
      ? 'Needs input'
      : task.meta?.runStatus === 'running'
        ? 'Running'
        : task.meta?.runStatus === 'done'
          ? task.column === 'done'
            ? 'Approved'
            : 'Ready for review'
          : 'Not started';
  const taskTitle = cleanAutonomousTitle(task.detail.summary);
  const createdAtLabel = task.meta?.createdAt ? new Date(task.meta.createdAt).toLocaleString('en-GB', { hour12: false }) : null;
  const proofPreview = previewReviewText(task.detail.proof, 280);
  const runSummary = task.meta?.needsInputNote ?? task.meta?.runError ?? task.meta?.resultSummary ?? task.detail.completed;

  return (
    <div style={{ position: 'fixed', top: 34, right: 22, width: 'min(92vw, 620px)', maxHeight: 'calc(100vh - 132px)', zIndex: 1000, pointerEvents: 'none' }}>
      <div style={{ width: '100%', maxHeight: 'calc(100vh - 132px)', background: 'rgba(255,253,251,0.98)', border: '1px solid rgba(200, 195, 188, 0.48)', borderRadius: 26, boxShadow: '0 24px 80px rgba(0,0,0,0.12)', padding: '22px 22px 14px 22px', display: 'grid', gap: 18, alignContent: 'start', overflowY: 'auto', overflowX: 'hidden', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.44, color: '#8a8a8a' }}>Autonomous task</div>
            <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.3, color: '#1a1a1a', fontWeight: 650 }}>{taskTitle}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#7a7a7a', padding: 2, lineHeight: 1, alignSelf: 'flex-start' }} aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(212, 231, 221, 0.8)', fontSize: 10.5, fontWeight: 700, color: '#3c6658', textTransform: 'uppercase' }}>{task.column === 'backlog' ? 'Backlog' : task.column === 'todo' ? 'To Do' : task.column === 'inprogress' ? 'In Progress' : task.column === 'review' ? 'Review' : 'Done'}</span>
          {task.meta?.priority ? <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255, 245, 234, 0.9)', fontSize: 10.5, fontWeight: 700, color: '#b26a1f', textTransform: 'uppercase' }}>{task.meta.priority}</span> : null}
          {task.meta?.agentTarget ? <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(200,195,188,0.5)', fontSize: 10.5, fontWeight: 700, color: '#5f655f', textTransform: 'uppercase' }}>{task.meta.agentTarget}</span> : null}
          <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(236, 244, 240, 0.84)', border: '1px solid rgba(121,166,148,0.3)', fontSize: 10.5, fontWeight: 700, color: '#2d5a4a' }}>{formatAutonomousTaskModel(task.meta?.model, task.meta?.agentTarget)}</span>
          {task.meta?.sourceType ? <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(200,195,188,0.5)', fontSize: 10.5, fontWeight: 700, color: '#5f655f', textTransform: 'uppercase' }}>{task.meta.sourceType}</span> : null}
        </div>

        {task.detail.why ? <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a8a8a' }}>Brief</div><div style={{ border: '1px solid rgba(200,195,188,0.42)', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.82)', fontSize: 13.5, lineHeight: 1.68, color: '#37413d' }}>{capitalizeSupportLead(task.detail.why)}</div></section> : null}

        <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a8a8a' }}>Run status</div><div style={{ border: '1px solid rgba(200,195,188,0.42)', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.82)', display: 'grid', gap: 10 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#1f2f29' }}>{runLabel}</div><div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>{runSummary ? <DetailMarkdown value={runSummary} tone="muted" /> : 'No run summary yet.'}</div>{!preflight.ok && preflight.warning ? <div style={{ display: 'grid', gap: 6, padding: '11px 12px', borderRadius: 14, background: 'rgba(255, 244, 224, 0.82)', border: '1px solid rgba(205, 153, 69, 0.28)', color: '#7d5314' }}><strong style={{ fontSize: 12.5 }}>Execution preflight</strong><div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{preflight.warning}</div></div> : null}{task.meta?.artifactPath ? <a href={`/general/files?file=${encodeURIComponent(task.meta.artifactPath)}`} style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 999, background: 'rgba(236, 244, 240, 0.76)', color: '#2d5a4a', fontSize: 11.5, fontWeight: 700, textDecoration: 'none' }}>Open artefact<span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{artifactLabel(task.meta.artifactPath)}</span></a> : null}</div></section>

        <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a8a8a' }}>Metadata</div><div style={{ border: '1px solid rgba(200,195,188,0.42)', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.82)', display: 'grid', gap: 10 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}><div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Status</div><div style={{ marginTop: 4, fontSize: 12.5, color: '#37413d' }}>{task.column === 'backlog' ? 'Backlog' : task.column === 'todo' ? 'To Do' : task.column === 'inprogress' ? 'In Progress' : task.column === 'review' ? 'Review' : 'Done'}</div></div><div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Priority</div><div style={{ marginTop: 4, fontSize: 12.5, color: '#37413d' }}>{task.meta?.priority ?? 'Normal'}</div></div><div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Agent</div><div style={{ marginTop: 4, fontSize: 12.5, color: '#37413d' }}>{task.meta?.agentTarget ?? 'marvin'}</div></div><div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Model</div><div style={{ marginTop: 4, fontSize: 12.5, color: '#37413d' }}>{formatAutonomousTaskModel(task.meta?.model, task.meta?.agentTarget)}</div></div><div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Source</div><div style={{ marginTop: 4, fontSize: 12.5, color: '#37413d' }}>{task.meta?.sourceType ?? 'generated'}</div></div>{createdAtLabel ? <div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Created</div><div style={{ marginTop: 4, fontSize: 11.8, color: '#6f726f' }}>{createdAtLabel}</div></div> : null}{task.meta?.artifactPath ? <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.35, color: '#9a9a9a' }}>Output</div><a href={`/general/files?file=${encodeURIComponent(task.meta.artifactPath)}`} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2d5a4a', fontSize: 11.8, fontWeight: 700, textDecoration: 'none' }}><span>Open artefact</span><span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{task.meta.artifactPath}</span></a></div> : null}</div></div></section>

        {(task.detail.proof || task.detail.unlocks || task.meta?.feedback?.length || task.meta?.needsInputNote || task.meta?.runError) ? <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a8a8a' }}>Scope details</div><div style={{ border: '1px solid rgba(200,195,188,0.42)', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.82)', display: 'grid', gap: 10, fontSize: 12.5, lineHeight: 1.62, color: '#37413d' }}>{task.meta?.needsInputNote ? <div style={{ display: 'grid', gap: 4 }}><strong>Needs input</strong><DetailMarkdown value={task.meta.needsInputNote} /></div> : null}{task.meta?.runError && task.meta.runError !== task.meta.needsInputNote ? <div style={{ display: 'grid', gap: 4 }}><strong>Run error</strong><DetailMarkdown value={task.meta.runError} /></div> : null}{task.meta?.feedback?.length ? <div style={{ display: 'grid', gap: 8 }}><strong style={{ color: '#6a4f87' }}>Latest operator feedback</strong><div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(127, 90, 162, 0.08)', border: '1px solid rgba(127, 90, 162, 0.18)', color: '#5c476f' }}><DetailMarkdown value={task.meta.feedback[task.meta.feedback.length - 1]} tone="feedback" /></div>{task.meta.feedback.length > 1 ? <details><summary style={{ cursor: 'pointer', fontSize: 11.5, color: '#6f726f', width: 'fit-content' }}>Show previous feedback</summary><div style={{ marginTop: 8, display: 'grid', gap: 8 }}>{task.meta.feedback.slice(0, -1).map((note, index) => <div key={`${task.id}-fb-prev-${index}`} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(200,195,188,0.36)', color: '#5f655f' }}><DetailMarkdown value={note} tone="muted" /></div>)}</div></details> : null}</div> : null}{task.detail.proof && proofPreview.truncated ? <div style={{ display: 'grid', gap: 4 }}><strong>Proof</strong><div>{proofPreview.text}</div></div> : null}{task.detail.proof && proofPreview.truncated ? <details><summary style={{ cursor: 'pointer', fontSize: 11.5, color: '#6f726f', width: 'fit-content' }}>Show full output</summary><div style={{ marginTop: 8 }}><DetailMarkdown value={task.detail.proof} /></div></details> : null}{task.detail.proof && !proofPreview.truncated ? <div style={{ display: 'grid', gap: 4 }}><strong>Proof</strong><DetailMarkdown value={task.detail.proof} /></div> : null}{task.detail.unlocks ? <div><strong>Unlocks:</strong> {task.detail.unlocks}</div> : null}</div></section> : null}

        {canReview ? <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#8a8a8a' }}>Review note</div><textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Why are you rejecting this task?" rows={3} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} /></section> : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
          <div style={{ display: 'flex', gap: 10 }}><button onClick={() => onEdit(task)} disabled={busy} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(200,195,188,0.45)', background: 'rgba(255,255,255,0.94)', color: '#5f655f', cursor: busy ? 'progress' : 'pointer', fontSize: 12.5, fontWeight: 700 }}>Edit</button><button onClick={() => void onRemove(task)} disabled={busy} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(214, 129, 129, 0.35)', background: 'rgba(255, 247, 247, 0.96)', color: '#a44f4f', cursor: busy ? 'progress' : 'pointer', fontSize: 12.5, fontWeight: 700 }}>Remove</button></div>
          <div style={{ display: 'flex', gap: 10 }}>
            {canReview ? (
              <>
                <button onClick={() => void onReject(task, rejectNote.trim() || 'Rejected without note.')} disabled={busy} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(214, 129, 129, 0.45)', background: 'rgba(255, 245, 245, 0.95)', color: '#a44f4f', cursor: busy ? 'progress' : 'pointer', fontSize: 13, fontWeight: 700 }}>Reject</button>
                <button onClick={() => void onApprove(task)} disabled={busy} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: busy ? 'rgba(200,195,188,0.5)' : '#0f1f19', color: '#fff', cursor: busy ? 'progress' : 'pointer', fontSize: 13, fontWeight: 700 }}>{busy ? 'Saving…' : 'Approve'}</button>
              </>
            ) : null}
            {canExecute ? <button onClick={() => void onExecute(task)} disabled={busy || !preflight.ok} title={!preflight.ok && preflight.warning ? preflight.warning : 'Execute'} style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: (busy || !preflight.ok) ? 'rgba(200,195,188,0.5)' : '#0f1f19', color: '#fff', cursor: (busy || !preflight.ok) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800, boxShadow: (busy || !preflight.ok) ? 'none' : '0 10px 24px rgba(15, 31, 25, 0.18)' }}>{busy ? 'Starting…' : !preflight.ok ? 'Blocked' : 'Execute'}</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AutonomousContent({ columns, syncState, syncDetails, onOpenNewTask, onRefreshImport, onCleanupSync, refreshBusy, cleanupBusy, onOpenTask, selectedTaskId, webResearchEnabled, refreshResult }: { columns: Column[]; syncState: 'unknown' | 'ok' | 'drift'; syncDetails: string; onOpenNewTask: () => void; onRefreshImport: () => Promise<void>; onCleanupSync: () => Promise<void>; refreshBusy: boolean; cleanupBusy: boolean; onOpenTask: (task: Task) => void; selectedTaskId: string | null; webResearchEnabled?: boolean; refreshResult?: string | null; }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <CompactSyncStatus state={syncState} details={syncDetails} onCleanup={onCleanupSync} cleanupBusy={cleanupBusy} />
          {refreshResult ? <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.02, color: '#6f756f' }}>{refreshResult}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => void onRefreshImport()} disabled={refreshBusy} style={{ height: 26, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(200,195,188,0.45)', background: 'rgba(255,255,255,0.82)', color: refreshBusy ? '#9a9a9a' : '#5f655f', cursor: refreshBusy ? 'progress' : 'pointer', fontSize: 11, fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', letterSpacing: 0.04 }} aria-label="Import missing tasks from AUTONOMOUS.md" title="Import missing tasks from AUTONOMOUS.md">{refreshBusy ? 'Pulling…' : 'Pull from .md'}</button>
          <button onClick={onOpenNewTask} style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: '#0f1f19', color: '#fff', cursor: 'pointer', fontSize: 20, fontWeight: 700, boxShadow: '0 8px 22px rgba(15, 31, 25, 0.16)' }} aria-label="New task" title="New task">+</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <section className="tasks-board-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', minWidth: 1180 }}>
          {columns.map(col => <ColumnView key={col.id} column={col} boardType="autonomous" onOpenTask={onOpenTask} selectedTaskId={selectedTaskId} webResearchEnabled={webResearchEnabled} />)}
        </section>
      </div>
    </div>
  );
}

function ManualBoardContent({ board, label, onMove, onEdit, onDelete, onCreateTask }: { board: Record<string, Column>; label: string; onMove: (board: 'personal' | 'projects', taskId: string, newColumn: ManualTaskColumn) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onCreateTask: (board: 'personal' | 'projects', defaultColumn: ManualTaskColumn) => void; }) {
  const cols = columnsFromBoard(board); const boardType = boardTypeFromLabel(label); const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null); const [dropColumnId, setDropColumnId] = useState<Task['column'] | null>(null);
  const clearDragState = useCallback(() => { setDraggingTaskId(null); setDropColumnId(null); }, []);
  return <div style={{ display: 'grid', gap: 14 }}><div style={{ display: 'grid', gap: 14 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}><button onClick={() => onCreateTask(boardType, 'todo')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 44, height: 44, padding: '0 16px', borderRadius: 999, background: '#0f1f19', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, boxShadow: '0 8px 24px rgba(15, 31, 25, 0.18)', position: 'relative', zIndex: 2 }} aria-label={`New ${label.toLowerCase()} task`} title="New task"><span style={{ transform: 'translateY(-1px)' }}>+</span></button></div></div><section className="tasks-board-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>{cols.map(col => <ColumnView key={col.id} column={col} boardType={boardType} onEdit={onEdit} onDelete={onDelete} onDropTask={(taskId, newCol) => { onMove(boardType, taskId, newCol); clearDragState(); }} draggingTaskId={draggingTaskId} isDropTarget={dropColumnId === col.id} onDragEnterColumn={columnId => { setDropColumnId(columnId); }} onDragLeaveColumn={clearDragState} onDragStartTask={(taskId, columnId) => { setDraggingTaskId(taskId); setDropColumnId(columnId); }} />)}</section></div>;
}

export function TasksBoardSwitcher({ autonomousColumns, syncState, syncDetails, webResearchEnabled }: { autonomousColumns: Column[]; syncState: 'unknown' | 'ok' | 'drift'; syncDetails: string; webResearchEnabled?: boolean; }) {
  const AUTO_POLL_INTERVAL_MS = 3500;
  const searchParams = useSearchParams();
  const [activeBoard, setActiveBoard] = useState<BoardId>('autonomous');
  const [personalBoard, setPersonalBoard] = useState<Record<string, Column>>(() => { if (typeof window === 'undefined') return seedPersonal(); try { const stored = localStorage.getItem(LS_PERSONAL); if (stored) return JSON.parse(stored); } catch {} return seedPersonal(); });
  const [projectsBoard, setProjectsBoard] = useState<Record<string, Column>>(() => { if (typeof window === 'undefined') return seedProjects(); try { const stored = localStorage.getItem(LS_PROJECTS); if (stored) return JSON.parse(stored); } catch {} return seedProjects(); });
  const [autoColumns, setAutoColumns] = useState<Column[]>(autonomousColumns);
  const [autoSyncState, setAutoSyncState] = useState<'unknown' | 'ok' | 'drift'>(syncState);
  const [autoSyncDetails, setAutoSyncDetails] = useState(syncDetails);
  const [modal, setModal] = useState<ModalMode>(null);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoModalMode, setAutoModalMode] = useState<'create' | 'edit'>('create');
  const [autoModalTask, setAutoModalTask] = useState<Task | null>(null);
  const [autoRefreshBusy, setAutoRefreshBusy] = useState(false);
  const [autoRefreshResult, setAutoRefreshResult] = useState<string | null>(null);
  const [autoCleanupBusy, setAutoCleanupBusy] = useState(false);
  const [selectedAutoTask, setSelectedAutoTask] = useState<Task | null>(null);
  const [autoActionBusy, setAutoActionBusy] = useState(false);
  const autoPollInFlightRef = useRef(false);
  const deepLinkedTaskId = searchParams.get('autonomousTaskId');

  useEffect(() => { setAutoColumns(autonomousColumns); }, [autonomousColumns]);
  useEffect(() => { setAutoSyncState(syncState); setAutoSyncDetails(syncDetails); }, [syncState, syncDetails]);
  useEffect(() => { localStorage.setItem(LS_PERSONAL, JSON.stringify(personalBoard)); }, [personalBoard]);
  useEffect(() => { localStorage.setItem(LS_PROJECTS, JSON.stringify(projectsBoard)); }, [projectsBoard]);

  const fetchAutonomousBoard = useCallback(async () => {
    const boardRes = await fetch('/api/tasks/board', { cache: 'no-store' });
    if (!boardRes.ok) throw new Error('Board refresh failed.');
    const board = await boardRes.json();
    setAutoColumns(board.columns ?? []);
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    const syncRes = await fetch('/api/tasks/sync-status', { cache: 'no-store' });
    if (!syncRes.ok) throw new Error('Sync refresh failed.');
    const sync = await syncRes.json();
    setAutoSyncState(sync.state ?? 'unknown');
    setAutoSyncDetails(sync.details ?? 'Sync status unavailable.');
  }, []);

  const refreshAutonomousBoard = useCallback(async () => {
    setAutoRefreshBusy(true);
    try {
      setAutoRefreshResult(null);
      const importRes = await fetch('/api/tasks/autonomous/import', { method: 'POST' });
      if (!importRes.ok) throw new Error('Import refresh failed.');
      const importJson = await importRes.json().catch(() => ({}));
      const imported = typeof importJson?.imported === 'number' ? importJson.imported : 0;
      const updated = typeof importJson?.updated === 'number' ? importJson.updated : 0;
      const deduped = typeof importJson?.deduped === 'number' ? importJson.deduped : 0;
      const parts = [`${imported} imported`, `${updated} updated`];
      if (deduped > 0) parts.push(`${deduped} deduped`);
      setAutoRefreshResult(parts.join(', '));
      await Promise.all([fetchAutonomousBoard(), fetchSyncStatus()]);
    } finally { setAutoRefreshBusy(false); }
  }, [fetchAutonomousBoard, fetchSyncStatus]);

  const cleanupAutonomousSync = useCallback(async () => {
    setAutoCleanupBusy(true);
    try {
      const cleanupRes = await fetch('/api/tasks/sync-status', { method: 'POST' });
      if (!cleanupRes.ok) throw new Error('Sync cleanup failed.');
      const sync = await cleanupRes.json();
      setAutoSyncState(sync.state ?? 'unknown');
      setAutoSyncDetails(sync.cleanup?.details ? `${sync.cleanup.details} ${sync.details ?? ''}`.trim() : (sync.details ?? 'Sync status unavailable.'));
      await fetchAutonomousBoard();
    } finally {
      setAutoCleanupBusy(false);
    }
  }, [fetchAutonomousBoard]);

  const createAutonomousTask = useCallback(async (input: { title: string; description?: string; priority: AutoPriority; agentTarget: AutoAgentTarget; model?: AutonomousTaskModelAlias | null; }) => {
    const res = await fetch('/api/tasks/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to create autonomous task.');
    }
    await fetchAutonomousBoard();
  }, [fetchAutonomousBoard]);

  const hydrateAutonomousTask = useCallback((t: { id: string; title: string; status: string; description?: string; priority?: string; agentTarget?: string; model?: string; sourceType?: string; createdAt?: number; needsInput?: { reason?: string; note?: string }; run?: { status?: string; summary?: string; result?: string; error?: string }; artifacts?: Array<{ path?: string }>; feedback?: Array<{ by?: string; note?: string }>; linkedAutonomyRef?: { taskText?: string } }): Task => {
    const envelopeArtifacts = (() => {
      if (!t.run?.result) return [] as Array<{ path?: string; kind?: string }>;
      try {
        const parsed = JSON.parse(t.run.result);
        return parsed?.schema === 'mission-control-autonomous-run-v1' && Array.isArray(parsed?.artifacts) ? parsed.artifacts : [];
      } catch {
        return [];
      }
    })();
    const normalizedRun = normalizeAutonomousRunResult(t.run?.result, [
      ...(Array.isArray(t.artifacts) ? t.artifacts : []),
      ...envelopeArtifacts,
    ]);
    const feedback = Array.isArray(t.feedback)
      ? t.feedback
        .filter((item: { by?: string; note?: string }) => item.by === 'operator')
        .map((item: { note?: string }) => item.note)
        .filter((note): note is string => Boolean(note))
      : [];
    const resultSummary = t.run?.status === 'rejected'
      ? 'Rejected. Waiting for Execute.'
      : t.run?.status === 'error'
        ? t.needsInput?.note ?? t.run?.summary ?? t.run?.error
        : normalizedRun.summary ?? t.run?.summary;
    const proof = normalizedRun.proof;
    const category = autonomousCategoryFromLink(t.linkedAutonomyRef?.taskText);
    return {
      id: t.id,
      text: t.title,
      column: t.status === 'backlog' ? 'backlog' : t.status === 'in-progress' ? 'inprogress' : t.status === 'review' ? 'review' : t.status === 'done' ? 'done' : 'todo',
      detail: { summary: `[${category}] ${t.title}`, ...(t.description ? { why: t.description } : {}), ...(resultSummary ? { completed: resultSummary } : {}), ...(proof ? { proof } : {}) },
      meta: {
        priority: t.priority,
        agentTarget: t.agentTarget,
        model: t.model,
        sourceType: t.sourceType,
        runStatus: t.run?.status,
        needsInputReason: t.needsInput?.reason,
        needsInputNote: t.needsInput?.note,
        runError: t.run?.error,
        createdAt: t.createdAt,
        artifactPath: normalizedRun.artifactPath,
        resultSummary,
        feedback,
      },
    };
  }, []);

  const fetchAutonomousTaskDetail = useCallback(async (taskId: string) => {
    const taskRes = await fetch(`/api/tasks/autonomous/${taskId}`, { cache: 'no-store' });
    if (taskRes.status === 404) return null;
    if (!taskRes.ok) throw new Error('Task refresh failed.');
    const json = await taskRes.json();
    return hydrateAutonomousTask(json.task);
  }, [hydrateAutonomousTask]);

  const refreshAutonomousLiveState = useCallback(async (taskId?: string | null) => {
    const results = await Promise.all([
      fetchAutonomousBoard(),
      fetchSyncStatus(),
      taskId ? fetchAutonomousTaskDetail(taskId) : Promise.resolve(null),
    ]);
    const task = results[2];

    if (taskId) {
      setSelectedAutoTask(task);
      setAutoModalTask((current) => current?.id === taskId ? task : current);
    }
  }, [fetchAutonomousBoard, fetchAutonomousTaskDetail, fetchSyncStatus]);

  useEffect(() => {
    if (!deepLinkedTaskId) return;
    if (activeBoard !== 'autonomous') {
      setActiveBoard('autonomous');
    }
    void fetchAutonomousTaskDetail(deepLinkedTaskId)
      .then((task) => {
        if (!task) return;
        setSelectedAutoTask(task);
      })
      .catch((error) => {
        console.error('Autonomous task deep link failed.', error);
      });
  }, [activeBoard, deepLinkedTaskId, fetchAutonomousTaskDetail]);

  const hasRunningAutonomousTask = autoColumns.some((column) =>
    column.tasks.some((task) => task.meta?.runStatus === 'running'),
  );
  const shouldPollAutonomousLiveState = hasRunningAutonomousTask && (activeBoard === 'autonomous' || selectedAutoTask?.meta?.runStatus === 'running');

  useEffect(() => {
    if (!shouldPollAutonomousLiveState) return;

    let cancelled = false;

    const poll = async () => {
      if (autoPollInFlightRef.current) return;
      autoPollInFlightRef.current = true;
      try {
        await refreshAutonomousLiveState(selectedAutoTask?.id ?? null);
      } catch (error) {
        console.error('Autonomous task polling failed.', error);
      } finally {
        autoPollInFlightRef.current = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      if (cancelled) return;
      void poll();
    }, AUTO_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [AUTO_POLL_INTERVAL_MS, refreshAutonomousLiveState, selectedAutoTask?.id, shouldPollAutonomousLiveState]);

  useEffect(() => {
    if (activeBoard !== 'autonomous') return;
    void refreshAutonomousLiveState(selectedAutoTask?.id ?? null).catch((error) => {
      console.error('Autonomous board refresh failed.', error);
    });
  }, [activeBoard, refreshAutonomousLiveState, selectedAutoTask?.id]);

  const updateAutonomousTask = useCallback(async (taskId: string, input: { title: string; description?: string; priority: AutoPriority; agentTarget: AutoAgentTarget; model?: AutonomousTaskModelAlias | null; }) => {
    const res = await fetch(`/api/tasks/autonomous/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update autonomous task.');
    }
    await refreshAutonomousLiveState(taskId);
  }, [refreshAutonomousLiveState]);

  const executeAutonomousTask = useCallback(async (task: Task) => {
    const preflight = autonomousTaskPreflight({
      title: task.detail.summary,
      description: task.detail.why,
      agentTarget: task.meta?.agentTarget,
    });
    if (!preflight.ok) {
      setSelectedAutoTask((current) => current?.id === task.id
        ? {
            ...current,
            meta: {
              ...current.meta,
              needsInputReason: 'missing-web-research-capability',
              needsInputNote: preflight.warning ?? current.meta?.needsInputNote,
              runError: preflight.warning ?? current.meta?.runError,
            },
          }
        : current);
      return;
    }

    setAutoActionBusy(true);
    try {
      const res = await fetch(`/api/tasks/autonomous/${task.id}/execute`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to start autonomous task.');
      }
      await refreshAutonomousLiveState(task.id);
    } finally {
      setAutoActionBusy(false);
    }
  }, [refreshAutonomousLiveState]);

  const approveAutonomousTask = useCallback(async (task: Task) => {
    setAutoActionBusy(true);
    try {
      const res = await fetch(`/api/tasks/autonomous/${task.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to approve autonomous task.');
      }
      await fetchAutonomousBoard();
      setSelectedAutoTask(null);
    } finally {
      setAutoActionBusy(false);
    }
  }, [fetchAutonomousBoard]);

  const rejectAutonomousTask = useCallback(async (task: Task, note: string) => {
    setAutoActionBusy(true);
    try {
      const res = await fetch(`/api/tasks/autonomous/${task.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to reject autonomous task.');
      }
      await fetchAutonomousBoard();
      setSelectedAutoTask(null);
    } finally {
      setAutoActionBusy(false);
    }
  }, [fetchAutonomousBoard]);

  const removeAutonomousTask = useCallback(async (task: Task) => {
    setAutoActionBusy(true);
    try {
      const res = await fetch(`/api/tasks/autonomous/${task.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to remove autonomous task.');
      }
      await fetchAutonomousBoard();
      setSelectedAutoTask(null);
    } finally {
      setAutoActionBusy(false);
    }
  }, [fetchAutonomousBoard]);

  const handleMove = useCallback((board: 'personal' | 'projects', taskId: string, newColumn: ManualTaskColumn) => { const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard; setter(prev => { const updated = cloneBoard(prev); let movedTask: Task | null = null; for (const colId of ['todo', 'inprogress', 'done'] as const) { const col = updated[colId]; const idx = col.tasks.findIndex(t => t.id === taskId); if (idx !== -1) { [movedTask] = col.tasks.splice(idx, 1); col.count = col.tasks.length; break; } } if (!movedTask) return prev; if (movedTask.column === newColumn) return prev; movedTask = { ...movedTask, column: newColumn }; updated[newColumn].tasks.push(movedTask); updated[newColumn].count = updated[newColumn].tasks.length; return updated; }); }, []);
  const handleSave = useCallback((board: 'personal' | 'projects', task: Task, isNew: boolean) => { const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard; setter(prev => { const updated = cloneBoard(prev); const manualColumn = task.column as ManualTaskColumn; if (isNew) { updated[manualColumn].tasks.push(task); updated[manualColumn].count = updated[manualColumn].tasks.length; } else { for (const colId of ['todo', 'inprogress', 'done'] as const) { const col = updated[colId]; const idx = col.tasks.findIndex(t => t.id === task.id); if (idx !== -1) { col.tasks.splice(idx, 1); col.count = col.tasks.length; break; } } updated[manualColumn].tasks.push(task); updated[manualColumn].count = updated[manualColumn].tasks.length; } return updated; }); }, []);
  const handleDelete = useCallback((board: 'personal' | 'projects', taskId: string) => { const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard; setter(prev => { const updated = cloneBoard(prev); for (const colId of ['todo', 'inprogress', 'done'] as const) { const col = updated[colId]; const idx = col.tasks.findIndex(t => t.id === taskId); if (idx !== -1) { col.tasks.splice(idx, 1); col.count = col.tasks.length; return updated; } } return prev; }); }, []);
  const showNewTaskModal = (board: 'personal' | 'projects', defaultColumn: ManualTaskColumn) => setModal({ mode: 'create', board, defaultColumn });
  const showEditModal = (task: Task) => { const board: 'personal' | 'projects' = task.detail.summary.toLowerCase().startsWith('[projects]') ? 'projects' : 'personal'; setModal({ mode: 'edit', board, task }); };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div role="tablist" aria-label="Task boards" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 999, background: 'rgba(255, 255, 255, 0.74)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(200, 195, 188, 0.4)', width: 'fit-content', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)', marginInline: 'auto' }}>{BOARDS.map(board => { const isActive = activeBoard === board.id; return <button key={board.id} role="tab" aria-selected={isActive} onClick={() => setActiveBoard(board.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 500, transition: 'all 0.15s ease', background: isActive ? 'var(--accent-deep, #0f1f19)' : 'transparent', color: isActive ? '#ffffff' : '#7a7a7a', boxShadow: isActive ? '0 2px 8px rgba(15, 31, 25, 0.18)' : 'none' }}><span>{board.icon}</span><span>{board.label}</span></button>; })}</div>
      <div role="tabpanel">{activeBoard === 'autonomous' && <AutonomousContent columns={autoColumns} syncState={autoSyncState} syncDetails={autoSyncDetails} onOpenNewTask={() => { setAutoModalMode('create'); setAutoModalTask(null); setAutoModalOpen(true); }} onRefreshImport={refreshAutonomousBoard} onCleanupSync={cleanupAutonomousSync} refreshBusy={autoRefreshBusy} cleanupBusy={autoCleanupBusy} onOpenTask={setSelectedAutoTask} selectedTaskId={selectedAutoTask?.id ?? null} webResearchEnabled={webResearchEnabled} refreshResult={autoRefreshResult} />}{activeBoard === 'personal' && <ManualBoardContent board={personalBoard} label="Personal" onMove={handleMove} onEdit={showEditModal} onDelete={task => handleDelete('personal', task.id)} onCreateTask={showNewTaskModal} />}{activeBoard === 'projects' && <ManualBoardContent board={projectsBoard} label="Projects" onMove={handleMove} onEdit={showEditModal} onDelete={task => handleDelete('projects', task.id)} onCreateTask={showNewTaskModal} />}</div>
      <TaskModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />
      <AutonomousTaskModal open={autoModalOpen} mode={autoModalMode} initialTask={autoModalTask} onClose={() => { setAutoModalOpen(false); setAutoModalTask(null); }} onSubmit={async (input) => { if (autoModalMode === 'edit' && autoModalTask) { await updateAutonomousTask(autoModalTask.id, input); setAutoModalOpen(false); return; } await createAutonomousTask(input); }} />
      <AutonomousTaskDrawer task={selectedAutoTask} onClose={() => setSelectedAutoTask(null)} onExecute={executeAutonomousTask} onApprove={approveAutonomousTask} onReject={rejectAutonomousTask} onRemove={removeAutonomousTask} onEdit={(task) => { setAutoModalMode('edit'); setAutoModalTask(task); setAutoModalOpen(true); }} busy={autoActionBusy} webResearchEnabled={webResearchEnabled} />
    </div>
  );
}
