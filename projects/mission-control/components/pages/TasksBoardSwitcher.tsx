'use client';

import { useState, useEffect, useCallback } from 'react';

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
  column: 'todo' | 'inprogress' | 'done';
  detail: TaskDetail;
  meta?: {
    priority?: string;
    agentTarget?: string;
    sourceType?: string;
    runStatus?: string;
  };
};

type Column = {
  id: string;
  title: string;
  count: number;
  tasks: Task[];
};

type BoardId = 'autonomous' | 'personal' | 'projects';
type AutoPriority = 'critical' | 'high' | 'normal' | 'low';
type AutoAgentTarget = 'marvin' | 'builder' | 'reviewer' | 'content-creator';

type BoardMeta = {
  id: BoardId;
  label: string;
  icon: string;
};

const BOARDS: BoardMeta[] = [
  { id: 'personal', label: 'Personal', icon: '🌱' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'autonomous', label: 'Autonomous', icon: '⚡' },
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
    border: '1px solid rgba(200, 195, 188, 0.4)',
    borderRadius: 18,
    padding: 16,
    background: 'rgba(255, 255, 255, 0.74)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  };
}

function columnPalette(colId: string) {
  if (colId === 'todo') return { accent: '#c4823a', border: 'rgba(196, 130, 58, 0.22)', bg: 'linear-gradient(180deg, rgba(196, 130, 58, 0.08) 0%, rgba(255, 255, 255, 0.82) 18%)', chipBg: 'rgba(196, 130, 58, 0.12)', chipText: '#c4823a', emptyText: 'Nothing waiting in backlog.' };
  if (colId === 'inprogress') return { accent: '#3c6658', border: 'rgba(121, 166, 148, 0.24)', bg: 'linear-gradient(180deg, rgba(121, 166, 148, 0.12) 0%, rgba(255, 255, 255, 0.82) 18%)', chipBg: 'rgba(121, 166, 148, 0.16)', chipText: '#3c6658', emptyText: 'No work actively in motion.' };
  return { accent: '#79a694', border: 'rgba(121, 166, 148, 0.22)', bg: 'linear-gradient(180deg, rgba(212, 231, 221, 0.75) 0%, rgba(255, 255, 255, 0.82) 18%)', chipBg: 'rgba(121, 166, 148, 0.14)', chipText: '#3c6658', emptyText: 'No completed cards yet.' };
}

function extractLane(task: Task) {
  return task.detail.summary.match(/^\[(.+?)\]/)?.[1] ?? 'Task';
}

function laneStyleData(lane: string) {
  const n = lane.toLowerCase();
  if (n === 'personal') return { icon: '🌱', text: 'Personal', color: '#3c6658', bg: 'rgba(121, 166, 148, 0.14)', border: 'rgba(121, 166, 148, 0.22)' };
  if (n === 'projects') return { icon: '📁', text: 'Projects', color: '#3c6658', bg: 'rgba(212, 231, 221, 0.7)', border: 'rgba(121, 166, 148, 0.22)' };
  if (n === 'autonomous') return { icon: '⚡', text: 'Autonomous', color: '#3c6658', bg: 'rgba(212, 231, 221, 0.7)', border: 'rgba(121, 166, 148, 0.22)' };
  return { icon: '🧩', text: lane, color: '#7a7a7a', bg: 'rgba(255, 255, 255, 0.6)', border: 'rgba(200, 195, 188, 0.3)' };
}

function displaySummary(summary: string) {
  return summary.replace(/^\[[^\]]+\]\s*/, '');
}

function formatAutonomousSummary(summary: string) {
  const withoutPrimaryLane = displaySummary(summary)
    .replace(/^\(\d{4}-\d{2}-\d{2}\)\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .split(/\s*[|→]|;\s*deliverable:/i)[0]
    .trim();

  return withoutPrimaryLane.length > 88
    ? `${withoutPrimaryLane.slice(0, 85).trimEnd()}…`
    : withoutPrimaryLane;
}

function boardTypeFromLabel(label: string): 'personal' | 'projects' {
  return label.toLowerCase() === 'projects' ? 'projects' : 'personal';
}

type ModalMode =
  | null
  | { mode: 'create'; board: 'personal' | 'projects'; defaultColumn: Task['column'] }
  | { mode: 'edit'; board: 'personal' | 'projects'; task: Task };

function TaskModal({ modal, onClose, onSave }: { modal: ModalMode; onClose: () => void; onSave: (board: 'personal' | 'projects', task: Task, isNew: boolean) => void }) {
  const [board, setBoard] = useState<'personal' | 'projects'>('personal');
  const [summary, setSummary] = useState('');
  const [why, setWhy] = useState('');
  const [completed, setCompleted] = useState('');
  const [column, setColumn] = useState<Task['column']>('todo');

  useEffect(() => {
    if (!modal) return;
    if (modal.mode === 'edit') {
      setBoard(modal.board);
      setSummary(displaySummary(modal.task.detail.summary));
      setWhy(modal.task.detail.why ?? '');
      setCompleted(modal.task.detail.completed ?? '');
      setColumn(modal.task.column);
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
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 31, 25, 0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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

function AutonomousTaskModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (input: { title: string; description?: string; priority: AutoPriority; agentTarget: AutoAgentTarget }) => Promise<void>; }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AutoPriority>('normal');
  const [agentTarget, setAgentTarget] = useState<AutoAgentTarget>('marvin');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setPriority('normal'); setAgentTarget('marvin'); setSaving(false); setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true); setError(null);
    try {
      await onCreate({ title: title.trim(), description: description.trim() || undefined, priority, agentTarget });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create autonomous task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 31, 25, 0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fffdfb', borderRadius: 24, border: '1px solid rgba(200, 195, 188, 0.5)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', padding: 28, width: '100%', maxWidth: 520, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>New autonomous task</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#7a7a7a', padding: 4, lineHeight: 1 }} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Task title <span style={{ color: '#c0392b' }}>*</span></label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What should Autonomous work on?" style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 14, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && title.trim() && handleCreate()} /></div>
        <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a8a8a8' }}>(optional)</span></label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add context or desired outcome..." rows={3} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Priority</label><select value={priority} onChange={e => setPriority(e.target.value as AutoPriority)} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none' }}><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></div>
          <div style={{ display: 'grid', gap: 6 }}><label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Agent</label><select value={agentTarget} onChange={e => setAgentTarget(e.target.value as AutoAgentTarget)} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none' }}><option value="marvin">Marvin</option><option value="builder">Builder</option><option value="reviewer">Reviewer</option><option value="content-creator">Content Creator</option></select></div>
        </div>
        {error ? <div style={{ fontSize: 12, color: '#b04a4a', lineHeight: 1.6 }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}><button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(200,195,188,0.5)', background: 'transparent', color: '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button><button onClick={() => void handleCreate()} disabled={!title.trim() || saving} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: title.trim() && !saving ? '#0f1f19' : 'rgba(200,195,188,0.4)', color: title.trim() && !saving ? '#ffffff' : '#a8a8a8', cursor: title.trim() && !saving ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>{saving ? 'Adding…' : 'Add task'}</button></div>
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, boardType, isDragging, onDragStart, onDragEnd, onOpen }: { task: Task; onEdit?: (task: Task) => void; onDelete?: (task: Task) => void; boardType?: 'autonomous' | 'personal' | 'projects'; isDragging?: boolean; onDragStart?: (taskId: string) => void; onDragEnd?: () => void; onOpen?: (task: Task) => void; }) {
  const lane = extractLane(task);
  const laneSd = laneStyleData(lane);
  const isDone = task.column === 'done';
  const visibleSummary = boardType === 'autonomous' ? formatAutonomousSummary(task.detail.summary) : displaySummary(task.detail.summary);
  const isManual = boardType === 'personal' || boardType === 'projects';
  const showInspection = boardType === 'autonomous' && (task.detail.proof || task.detail.unlocks);
  return (
    <article onClick={() => { if (boardType === 'autonomous' && onOpen) onOpen(task); }} draggable={isManual} onDragStart={event => { if (!isManual || !onDragStart) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); onDragStart(task.id); }} onDragEnd={() => { if (!isManual || !onDragEnd) return; onDragEnd(); }} style={{ ...cardStyle(), display: 'grid', gap: 10, position: 'relative', cursor: boardType === 'autonomous' ? 'pointer' : isManual ? 'grab' : 'default', opacity: isDragging ? 0.58 : 1, transform: isDragging ? 'scale(0.985)' : 'none', transition: 'opacity 0.15s ease, transform 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, color: laneSd.color, background: laneSd.bg, border: `1px solid ${laneSd.border}` }}><span>{laneSd.icon}</span><span>{laneSd.text}</span></span><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{isManual && onEdit && <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7a7a7a', padding: '2px 4px' }} aria-label="Edit task">✎</button>}{isManual && onDelete && <button onClick={() => onDelete(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#a06a6a', padding: '2px 4px' }} aria-label="Remove task">✕</button>}</div></div>
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: '#222222' }}>{visibleSummary}</div>
      {(task.detail.why || task.detail.completed) && <div style={{ display: 'grid', gap: 8 }}>{task.detail.why && <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}><span style={{ fontWeight: 500, color: '#3d3d3d' }}>Why:</span> {task.detail.why}</div>}{task.detail.completed && <div style={{ border: '1px solid rgba(121, 166, 148, 0.18)', borderRadius: 12, padding: '9px 10px', background: 'rgba(212, 231, 221, 0.8)', fontSize: 12, color: '#3c6658', lineHeight: 1.6 }}><span style={{ fontWeight: 600 }}>Delivered:</span> {task.detail.completed}</div>}</div>}
      {showInspection && <details style={{ margin: 0 }}><summary style={{ cursor: 'pointer', fontSize: 11, color: '#7a7a7a', listStyle: 'none', textDecoration: 'underline', textDecorationStyle: 'dotted', width: 'fit-content' }}>{isDone ? 'Inspect card context' : 'Inspect scope'}</summary><div style={{ marginTop: 10, fontSize: 12, color: '#7a7a7a', display: 'grid', gap: 8, lineHeight: 1.65 }}>{task.detail.proof && <div><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Proof:</span> {task.detail.proof}</div>}{task.detail.unlocks && <div><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Unlocks:</span> {task.detail.unlocks}</div>}</div></details>}
    </article>
  );
}

function ColumnView({ column, boardType, onEdit, onDelete, onDropTask, draggingTaskId, isDropTarget, onDragEnterColumn, onDragLeaveColumn, onDragStartTask, onOpenTask }: { column: Column; boardType?: 'autonomous' | 'personal' | 'projects'; onEdit?: (task: Task) => void; onDelete?: (task: Task) => void; onDropTask?: (taskId: string, newColumn: Task['column']) => void; draggingTaskId?: string | null; isDropTarget?: boolean; onDragEnterColumn?: (columnId: Task['column']) => void; onDragLeaveColumn?: () => void; onDragStartTask?: (taskId: string, columnId: Task['column']) => void; onOpenTask?: (task: Task) => void; }) {
  const palette = columnPalette(column.id);
  const isManual = boardType === 'personal' || boardType === 'projects';
  return (
    <section onDragOver={event => { if (!isManual || !onDropTask) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; onDragEnterColumn?.(column.id as Task['column']); }} onDragEnter={() => { if (!isManual || !onDragEnterColumn) return; onDragEnterColumn(column.id as Task['column']); }} onDrop={event => { if (!isManual || !onDropTask) return; event.preventDefault(); const taskId = event.dataTransfer.getData('text/plain'); if (taskId) onDropTask(taskId, column.id as Task['column']); }} style={{ minWidth: 0, border: `1px solid ${isDropTarget ? `${palette.accent}66` : palette.border}`, borderRadius: 20, padding: 14, background: isDropTarget ? `linear-gradient(180deg, ${palette.accent}18 0%, rgba(255, 255, 255, 0.86) 24%)` : palette.bg, display: 'grid', gap: 12, alignContent: 'start', boxShadow: isDropTarget ? `0 0 0 1px ${palette.accent}22 inset` : 'none', transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: palette.accent, boxShadow: `0 0 16px ${palette.accent}55` }} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{column.title}</h3></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, color: palette.chipText, background: palette.chipBg, padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>{column.count}</span></div></div>
      {column.tasks.length === 0 ? <div style={{ border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, padding: 22, background: 'rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', textAlign: 'center', fontSize: 12, color: '#7a7a7a' }}>{palette.emptyText}</div> : <div style={{ display: 'grid', gap: 10 }}>{column.tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpenTask} onEdit={onEdit} onDelete={onDelete} boardType={boardType} isDragging={draggingTaskId === task.id} onDragStart={isManual ? taskId => onDragStartTask?.(taskId, column.id as Task['column']) : undefined} onDragEnd={isManual ? onDragLeaveColumn : undefined} />)}</div>}
    </section>
  );
}

function SummaryStrip({ columns, label, isManual }: { columns: Column[]; label: string; isManual?: boolean }) {
  const [todo, inprogress, done] = columns;
  return (
    <section className="tasks-summary-grid" style={{ ...cardStyle(), background: 'linear-gradient(180deg, rgba(212, 231, 221, 0.72) 0%, rgba(255, 255, 255, 0.78) 34%)' }}><div style={{ display: 'grid', gap: 10 }}><div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Board view</div><div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.25 }}>{label}</div>{isManual && <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>Drag cards between columns to keep this board moving.</div>}</div><div className="tasks-summary-metrics">{[{ col: todo, title: 'Backlog' }, { col: inprogress, title: 'In progress' }, { col: done, title: 'Done' }].map(({ col, title }) => <div key={title} style={{ border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 14, padding: 12, background: 'rgba(255, 255, 255, 0.58)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: '#7a7a7a' }}>{title}</div><div style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{col?.count ?? 0}</div></div>)}</div></section>
  );
}

function SyncBadge({ state }: { state: 'unknown' | 'ok' | 'drift' }) {
  const s: Record<typeof state, { bg: string; text: string; dot: string; label: string }> = { ok: { bg: 'rgba(121, 166, 148, 0.14)', text: '#3c6658', dot: '#3c6658', label: 'Aligned' }, drift: { bg: 'rgba(248, 113, 113, 0.14)', text: '#f87171', dot: '#f87171', label: 'Drift' }, unknown: { bg: 'rgba(200, 195, 188, 0.18)', text: '#7a7a7a', dot: '#7a7a7a', label: 'Unknown' } };
  const st = s[state];
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: st.bg, padding: '6px 12px', borderRadius: 999 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} /><span style={{ color: st.text, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{st.label}</span></div>;
}

function AutonomousTaskDrawer({ task, onClose, onExecute, executing }: { task: Task | null; onClose: () => void; onExecute: (task: Task) => Promise<void>; executing: boolean; }) {
  if (!task) return null;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 31, 25, 0.32)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 'min(92vw, 520px)', height: '100%', background: '#fffdfb', borderLeft: '1px solid rgba(200, 195, 188, 0.5)', boxShadow: '-20px 0 64px rgba(0,0,0,0.18)', padding: 24, display: 'grid', gap: 18, alignContent: 'start', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Autonomous task</div>
            <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.35, color: '#1a1a1a' }}>{displaySummary(task.detail.summary)}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#7a7a7a', padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(212, 231, 221, 0.8)', fontSize: 11, fontWeight: 700, color: '#3c6658', textTransform: 'uppercase' }}>{task.column === 'todo' ? 'To Do' : task.column === 'inprogress' ? 'In Progress' : 'Done'}</span>
          {task.meta?.priority ? <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255, 245, 234, 0.9)', fontSize: 11, fontWeight: 700, color: '#b26a1f', textTransform: 'uppercase' }}>{task.meta.priority}</span> : null}
          {task.meta?.agentTarget ? <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(200,195,188,0.5)', fontSize: 11, fontWeight: 700, color: '#5f655f', textTransform: 'uppercase' }}>{task.meta.agentTarget}</span> : null}
          {task.meta?.sourceType ? <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(200,195,188,0.5)', fontSize: 11, fontWeight: 700, color: '#5f655f', textTransform: 'uppercase' }}>{task.meta.sourceType}</span> : null}
        </div>
        {task.detail.why ? <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Description</div><div style={{ fontSize: 14, lineHeight: 1.7, color: '#37413d' }}>{task.detail.why}</div></section> : null}
        <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Run status</div><div style={{ border: '1px solid rgba(200,195,188,0.45)', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.82)', display: 'grid', gap: 8 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#1f2f29' }}>{task.meta?.runStatus ?? 'Not started'}</div><div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>{task.detail.completed ?? 'No run summary yet.'}</div></div></section>
        {(task.detail.proof || task.detail.unlocks) ? <section style={{ display: 'grid', gap: 8 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Scope details</div><div style={{ display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.65, color: '#37413d' }}>{task.detail.proof ? <div><strong>Proof:</strong> {task.detail.proof}</div> : null}{task.detail.unlocks ? <div><strong>Unlocks:</strong> {task.detail.unlocks}</div> : null}</div></section> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(200,195,188,0.5)', background: 'transparent', color: '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Close</button>
          {(task.column === 'todo') && <button onClick={() => void onExecute(task)} disabled={executing} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: executing ? 'rgba(200,195,188,0.5)' : '#0f1f19', color: '#fff', cursor: executing ? 'progress' : 'pointer', fontSize: 13, fontWeight: 700 }}>{executing ? 'Starting…' : 'Execute'}</button>}
        </div>
      </div>
    </div>
  );
}

function AutonomousContent({ columns, syncState, syncDetails, onOpenNewTask, onRefreshImport, refreshBusy, refreshNote, onOpenTask }: { columns: Column[]; syncState: 'unknown' | 'ok' | 'drift'; syncDetails: string; onOpenNewTask: () => void; onRefreshImport: () => Promise<void>; refreshBusy: boolean; refreshNote: string | null; onOpenTask: (task: Task) => void; }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SummaryStrip columns={columns} label="Autonomous execution board" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>{refreshNote ?? 'Structured store is now live behind the current Autonomous board.'}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => void onRefreshImport()} disabled={refreshBusy} style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid rgba(200, 195, 188, 0.45)', background: 'rgba(255,255,255,0.84)', color: refreshBusy ? '#9a9a9a' : '#1f2f29', cursor: refreshBusy ? 'progress' : 'pointer', fontSize: 12, fontWeight: 700 }}>{refreshBusy ? 'Refreshing…' : 'Refresh import'}</button>
          <button onClick={onOpenNewTask} style={{ padding: '10px 14px', borderRadius: 999, border: 'none', background: '#0f1f19', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>New task</button>
        </div>
      </div>
      <section className="tasks-board-grid">{columns.map(col => <ColumnView key={col.id} column={col} boardType="autonomous" onOpenTask={onOpenTask} />)}</section>
      <section className="tasks-sync-grid" style={{ ...cardStyle() }}><div style={{ display: 'grid', gap: 10, minWidth: 0 }}><div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Sync integrity</div><SyncBadge state={syncState} /><div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.7, maxWidth: 320 }}>{syncDetails}</div></div><div className="tasks-sync-sources">{[{ label: 'autonomous-tasks.json', note: 'Structured workflow store' }, { label: 'AUTONOMOUS.md', note: 'Legacy autonomy compatibility layer' }, { label: 'tasks-log.md', note: 'Completion history' }].map(item => <div key={item.label} style={{ border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 14, padding: 12, background: 'rgba(255, 255, 255, 0.58)', display: 'grid', gap: 6, minWidth: 0 }}><span style={{ fontSize: 11, letterSpacing: 0.2, color: '#5f655f', lineHeight: 1.4, wordBreak: 'break-word' }}>{item.label}</span><span style={{ fontSize: 11, color: '#8a8f8a', lineHeight: 1.5 }}>{item.note}</span></div>)}</div></section>
    </div>
  );
}

function ManualBoardContent({ board, label, onMove, onEdit, onDelete, onCreateTask }: { board: Record<string, Column>; label: string; onMove: (board: 'personal' | 'projects', taskId: string, newColumn: Task['column']) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onCreateTask: (board: 'personal' | 'projects', defaultColumn: Task['column']) => void; }) {
  const cols = columnsFromBoard(board); const boardType = boardTypeFromLabel(label); const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null); const [dropColumnId, setDropColumnId] = useState<Task['column'] | null>(null);
  const clearDragState = useCallback(() => { setDraggingTaskId(null); setDropColumnId(null); }, []);
  return <div style={{ display: 'grid', gap: 14 }}><div style={{ display: 'grid', gap: 14 }}><SummaryStrip columns={cols} label={`${label} board`} isManual /><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => onCreateTask(boardType, 'todo')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 44, height: 44, padding: '0 16px', borderRadius: 999, background: '#0f1f19', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, boxShadow: '0 8px 24px rgba(15, 31, 25, 0.18)', position: 'relative', zIndex: 2 }} aria-label={`New ${label.toLowerCase()} task`} title="New task"><span style={{ transform: 'translateY(-1px)' }}>+</span></button></div></div><section className="tasks-board-grid">{cols.map(col => <ColumnView key={col.id} column={col} boardType={boardType} onEdit={onEdit} onDelete={onDelete} onDropTask={(taskId, newCol) => { onMove(boardType, taskId, newCol); clearDragState(); }} draggingTaskId={draggingTaskId} isDropTarget={dropColumnId === col.id} onDragEnterColumn={columnId => { setDropColumnId(columnId); }} onDragLeaveColumn={clearDragState} onDragStartTask={(taskId, columnId) => { setDraggingTaskId(taskId); setDropColumnId(columnId); }} />)}</section></div>;
}

export function TasksBoardSwitcher({ autonomousColumns, syncState, syncDetails }: { autonomousColumns: Column[]; syncState: 'unknown' | 'ok' | 'drift'; syncDetails: string; }) {
  const [activeBoard, setActiveBoard] = useState<BoardId>('personal');
  const [personalBoard, setPersonalBoard] = useState<Record<string, Column>>(() => { if (typeof window === 'undefined') return seedPersonal(); try { const stored = localStorage.getItem(LS_PERSONAL); if (stored) return JSON.parse(stored); } catch {} return seedPersonal(); });
  const [projectsBoard, setProjectsBoard] = useState<Record<string, Column>>(() => { if (typeof window === 'undefined') return seedProjects(); try { const stored = localStorage.getItem(LS_PROJECTS); if (stored) return JSON.parse(stored); } catch {} return seedProjects(); });
  const [autoColumns, setAutoColumns] = useState<Column[]>(autonomousColumns);
  const [modal, setModal] = useState<ModalMode>(null);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoRefreshBusy, setAutoRefreshBusy] = useState(false);
  const [autoRefreshNote, setAutoRefreshNote] = useState<string | null>(null);
  const [selectedAutoTask, setSelectedAutoTask] = useState<Task | null>(null);
  const [autoExecuteBusy, setAutoExecuteBusy] = useState(false);

  useEffect(() => { setAutoColumns(autonomousColumns); }, [autonomousColumns]);
  useEffect(() => { localStorage.setItem(LS_PERSONAL, JSON.stringify(personalBoard)); }, [personalBoard]);
  useEffect(() => { localStorage.setItem(LS_PROJECTS, JSON.stringify(projectsBoard)); }, [projectsBoard]);

  const refreshAutonomousBoard = useCallback(async () => {
    setAutoRefreshBusy(true);
    try {
      const importRes = await fetch('/api/tasks/autonomous/import', { method: 'POST' });
      if (!importRes.ok) throw new Error('Import refresh failed.');
      const boardRes = await fetch('/api/tasks/board', { cache: 'no-store' });
      if (!boardRes.ok) throw new Error('Board refresh failed.');
      const board = await boardRes.json();
      setAutoColumns(board.columns ?? []);
      const importJson = await importRes.json();
      setAutoRefreshNote(`Import refreshed — ${importJson.imported ?? 0} imported, ${importJson.updated ?? 0} updated.`);
    } finally { setAutoRefreshBusy(false); }
  }, []);

  const createAutonomousTask = useCallback(async (input: { title: string; description?: string; priority: AutoPriority; agentTarget: AutoAgentTarget; }) => {
    const res = await fetch('/api/tasks/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to create autonomous task.');
    }
    await refreshAutonomousBoard();
  }, [refreshAutonomousBoard]);

  const executeAutonomousTask = useCallback(async (task: Task) => {
    setAutoExecuteBusy(true);
    try {
      const res = await fetch(`/api/tasks/autonomous/${task.id}/execute`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to start autonomous task.');
      }
      await refreshAutonomousBoard();
      const taskRes = await fetch(`/api/tasks/autonomous/${task.id}`, { cache: 'no-store' });
      if (taskRes.ok) {
        const json = await taskRes.json();
        const t = json.task;
        setSelectedAutoTask({
          id: t.id,
          text: t.title,
          column: t.status === 'in-progress' ? 'inprogress' : t.status === 'done' ? 'done' : 'todo',
          detail: { summary: `[Autonomous] ${t.title}`, ...(t.description ? { why: t.description } : {}), ...(t.run?.summary ? { completed: t.run.summary } : {}), ...(t.run?.result ? { proof: t.run.result } : {}) },
          meta: { priority: t.priority, agentTarget: t.agentTarget, sourceType: t.sourceType, runStatus: t.run?.status ?? 'running' },
        });
      }
    } finally {
      setAutoExecuteBusy(false);
    }
  }, [refreshAutonomousBoard]);

  const handleMove = useCallback((board: 'personal' | 'projects', taskId: string, newColumn: Task['column']) => { const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard; setter(prev => { const updated = cloneBoard(prev); let movedTask: Task | null = null; for (const colId of ['todo', 'inprogress', 'done'] as const) { const col = updated[colId]; const idx = col.tasks.findIndex(t => t.id === taskId); if (idx !== -1) { [movedTask] = col.tasks.splice(idx, 1); col.count = col.tasks.length; break; } } if (!movedTask) return prev; if (movedTask.column === newColumn) return prev; movedTask = { ...movedTask, column: newColumn }; updated[newColumn].tasks.push(movedTask); updated[newColumn].count = updated[newColumn].tasks.length; return updated; }); }, []);
  const handleSave = useCallback((board: 'personal' | 'projects', task: Task, isNew: boolean) => { const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard; setter(prev => { const updated = cloneBoard(prev); if (isNew) { updated[task.column].tasks.push(task); updated[task.column].count = updated[task.column].tasks.length; } else { for (const colId of ['todo', 'inprogress', 'done'] as const) { const col = updated[colId]; const idx = col.tasks.findIndex(t => t.id === task.id); if (idx !== -1) { col.tasks.splice(idx, 1); col.count = col.tasks.length; break; } } updated[task.column].tasks.push(task); updated[task.column].count = updated[task.column].tasks.length; } return updated; }); }, []);
  const handleDelete = useCallback((board: 'personal' | 'projects', taskId: string) => { const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard; setter(prev => { const updated = cloneBoard(prev); for (const colId of ['todo', 'inprogress', 'done'] as const) { const col = updated[colId]; const idx = col.tasks.findIndex(t => t.id === taskId); if (idx !== -1) { col.tasks.splice(idx, 1); col.count = col.tasks.length; return updated; } } return prev; }); }, []);
  const showNewTaskModal = (board: 'personal' | 'projects', defaultColumn: Task['column']) => setModal({ mode: 'create', board, defaultColumn });
  const showEditModal = (task: Task) => { const board: 'personal' | 'projects' = task.detail.summary.toLowerCase().startsWith('[projects]') ? 'projects' : 'personal'; setModal({ mode: 'edit', board, task }); };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" aria-label="Task boards" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 999, background: 'rgba(255, 255, 255, 0.74)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(200, 195, 188, 0.4)', width: 'fit-content', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)', marginInline: 'auto' }}>{BOARDS.map(board => { const isActive = activeBoard === board.id; return <button key={board.id} role="tab" aria-selected={isActive} onClick={() => setActiveBoard(board.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400, transition: 'all 0.15s ease', background: isActive ? 'var(--accent-deep, #0f1f19)' : 'transparent', color: isActive ? '#ffffff' : '#7a7a7a', boxShadow: isActive ? '0 2px 8px rgba(15, 31, 25, 0.18)' : 'none' }}><span>{board.icon}</span><span>{board.label}</span></button>; })}</div>
      <div role="tabpanel">{activeBoard === 'autonomous' && <AutonomousContent columns={autoColumns} syncState={syncState} syncDetails={syncDetails} onOpenNewTask={() => setAutoModalOpen(true)} onRefreshImport={refreshAutonomousBoard} refreshBusy={autoRefreshBusy} refreshNote={autoRefreshNote} onOpenTask={setSelectedAutoTask} />}{activeBoard === 'personal' && <ManualBoardContent board={personalBoard} label="Personal" onMove={handleMove} onEdit={showEditModal} onDelete={task => handleDelete('personal', task.id)} onCreateTask={showNewTaskModal} />}{activeBoard === 'projects' && <ManualBoardContent board={projectsBoard} label="Projects" onMove={handleMove} onEdit={showEditModal} onDelete={task => handleDelete('projects', task.id)} onCreateTask={showNewTaskModal} />}</div>
      <TaskModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />
      <AutonomousTaskModal open={autoModalOpen} onClose={() => setAutoModalOpen(false)} onCreate={createAutonomousTask} />
      <AutonomousTaskDrawer task={selectedAutoTask} onClose={() => setSelectedAutoTask(null)} onExecute={executeAutonomousTask} executing={autoExecuteBusy} />
    </div>
  );
}
