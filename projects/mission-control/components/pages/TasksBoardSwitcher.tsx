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
};

type Column = {
  id: string;
  title: string;
  count: number;
  tasks: Task[];
};

type BoardId = 'autonomous' | 'personal' | 'projects';

type BoardMeta = {
  id: BoardId;
  label: string;
  icon: string;
};

// ─── Board registry ──────────────────────────────────────────────────────────

const BOARDS: BoardMeta[] = [
  { id: 'autonomous', label: 'Autonomous', icon: '⚡' },
  { id: 'personal', label: 'Personal', icon: '🌱' },
  { id: 'projects', label: 'Projects', icon: '📁' },
];

// ─── Local storage keys ───────────────────────────────────────────────────────

const LS_PERSONAL = 'mc_board_personal';
const LS_PROJECTS = 'mc_board_projects';

// ─── Initial seed data ────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function columnsFromBoard(board: Record<string, Column>): Column[] {
  return [board.todo, board.inprogress, board.done];
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
  return { icon: '🧩', text: lane, color: '#7a7a7a', bg: 'rgba(255, 255, 255, 0.6)', border: 'rgba(200, 195, 188, 0.3)' };
}

function displaySummary(summary: string) {
  return summary.replace(/^\[[^\]]+\]\s*/, '');
}

// ─── Task modal ───────────────────────────────────────────────────────────────

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

    // Capture original task id before the const (avoid self-reference in initializer)
    // isEdit guarantees modal is edit-mode here; use type cast for TypeScript
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
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 31, 25, 0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#fffdfb', borderRadius: 24, border: '1px solid rgba(200, 195, 188, 0.5)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', padding: 28, width: '100%', maxWidth: 480, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{isEdit ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#7a7a7a', padding: 4, lineHeight: 1 }} aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Board</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['personal', 'projects'] as const).map(b => (
              <button key={b} onClick={() => setBoard(b)} style={{ flex: 1, padding: '8px 12px', borderRadius: 12, border: '1px solid', borderColor: board === b ? '#0f1f19' : 'rgba(200,195,188,0.5)', background: board === b ? '#0f1f19' : 'transparent', color: board === b ? '#ffffff' : '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease' }}>
                {b === 'personal' ? '🌱 Personal' : '📁 Projects'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Task summary <span style={{ color: '#c0392b' }}>*</span></label>
          <input type="text" value={summary} onChange={e => setSummary(e.target.value)} placeholder="What needs to be done?" style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 14, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && summary.trim() && handleSave()} />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Phase</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['todo', 'inprogress', 'done'] as const).map(col => (
              <button key={col} onClick={() => setColumn(col)} style={{ flex: 1, padding: '8px 12px', borderRadius: 12, border: '1px solid', borderColor: column === col ? '#0f1f19' : 'rgba(200,195,188,0.5)', background: column === col ? '#0f1f19' : 'transparent', color: column === col ? '#ffffff' : '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease' }}>
                {col === 'todo' ? 'To Do' : col === 'inprogress' ? 'In Progress' : 'Done'}
              </button>
            ))}
          </div>
        </div>

        {!isDone && (
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Why it matters <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a8a8a8' }}>(optional)</span></label>
            <textarea value={why} onChange={e => setWhy(e.target.value)} placeholder="Context or motivation..." rows={2} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        )}

        {isDone && (
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Delivered note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#a8a8a8' }}>(optional)</span></label>
            <textarea value={completed} onChange={e => setCompleted(e.target.value)} placeholder="What was the outcome?" rows={2} style={{ border: '1px solid rgba(200,195,188,0.5)', borderRadius: 12, padding: '10px 14px', fontSize: 13, background: '#faf8f5', color: '#1a1a1a', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(200,195,188,0.5)', background: 'transparent', color: '#7a7a7a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSave} disabled={!summary.trim()} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: summary.trim() ? '#0f1f19' : 'rgba(200,195,188,0.4)', color: summary.trim() ? '#ffffff' : '#a8a8a8', cursor: summary.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, transition: 'all 0.15s ease' }}>
            {isEdit ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, onMove, boardType }: {
  task: Task;
  onEdit?: (task: Task) => void;
  onMove?: (taskId: string, newColumn: Task['column']) => void;
  boardType?: 'autonomous' | 'personal' | 'projects';
}) {
  const lane = extractLane(task);
  const laneSd = laneStyleData(lane);
  const isDone = task.column === 'done';
  const visibleSummary = displaySummary(task.detail.summary);
  const isManual = boardType === 'personal' || boardType === 'projects';

  return (
    <article style={{ ...cardStyle(), display: 'grid', gap: 10, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: laneSd.color, background: laneSd.bg, border: `1px solid ${laneSd.border}` }}>
          <span>{laneSd.icon}</span>
          <span>{laneSd.text}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isManual && onMove && (
            <select value={task.column} onChange={e => onMove(task.id, e.target.value as Task['column'])} style={{ fontSize: 10, fontWeight: 600, padding: '3px 6px', borderRadius: 8, border: '1px solid rgba(200,195,188,0.4)', background: '#faf8f5', color: '#7a7a7a', cursor: 'pointer' }} aria-label="Move to column">
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
          )}
          {isManual && onEdit && (
            <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7a7a7a', padding: '2px 4px' }} aria-label="Edit task">✎</button>
          )}
          <code style={{ fontSize: 10, color: '#a8a8a8' }}>{task.id.slice(0, 8)}</code>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 650, lineHeight: 1.5 }}>{visibleSummary}</div>

      {(task.detail.why || task.detail.completed) && (
        <div style={{ display: 'grid', gap: 8 }}>
          {task.detail.why && <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Why:</span> {task.detail.why}</div>}
          {task.detail.completed && <div style={{ border: '1px solid rgba(121, 166, 148, 0.18)', borderRadius: 12, padding: '9px 10px', background: 'rgba(212, 231, 221, 0.8)', fontSize: 12, color: '#3c6658', lineHeight: 1.6 }}><span style={{ fontWeight: 700 }}>Delivered:</span> {task.detail.completed}</div>}
        </div>
      )}

      <details style={{ margin: 0 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: '#7a7a7a', listStyle: 'none', textDecoration: 'underline', textDecorationStyle: 'dotted', width: 'fit-content' }}>
          {isDone ? 'Inspect card context' : 'Inspect scope'}
        </summary>
        <div style={{ marginTop: 10, fontSize: 12, color: '#7a7a7a', display: 'grid', gap: 8, lineHeight: 1.65 }}>
          {task.detail.proof && <div><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Proof:</span> {task.detail.proof}</div>}
          {task.detail.unlocks && <div><span style={{ fontWeight: 600, color: '#3d3d3d' }}>Unlocks:</span> {task.detail.unlocks}</div>}
        </div>
      </details>
    </article>
  );
}

// ─── Column view ──────────────────────────────────────────────────────────────

function ColumnView({ column, boardType, onEdit, onMove }: {
  column: Column;
  boardType?: 'autonomous' | 'personal' | 'projects';
  onEdit?: (task: Task) => void;
  onMove?: (taskId: string, newColumn: Task['column']) => void;
}) {
  const palette = columnPalette(column.id);
  const isManual = boardType === 'personal' || boardType === 'projects';

  return (
    <section style={{ minWidth: 0, border: `1px solid ${palette.border}`, borderRadius: 20, padding: 14, background: palette.bg, display: 'grid', gap: 12, alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: palette.accent, boxShadow: `0 0 16px ${palette.accent}55` }} />
          <h3 style={{ margin: 0, fontSize: 16 }}>{column.title}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isManual && <span style={{ fontSize: 11, color: '#a8a8a8' }}>manual</span>}
          <span style={{ fontSize: 12, color: palette.chipText, background: palette.chipBg, padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>{column.count}</span>
        </div>
      </div>

      {column.tasks.length === 0 ? (
        <div style={{ border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, padding: 22, background: 'rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', textAlign: 'center', fontSize: 12, color: '#7a7a7a' }}>{palette.emptyText}</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {column.tasks.map(task => <TaskCard key={task.id} task={task} onEdit={onEdit} onMove={onMove} boardType={boardType} />)}
        </div>
      )}
    </section>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ columns, label, isManual }: { columns: Column[]; label: string; isManual?: boolean }) {
  const [todo, inprogress, done] = columns;

  return (
    <section style={{ ...cardStyle(), display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 16, alignItems: 'start', background: 'linear-gradient(180deg, rgba(212, 231, 221, 0.72) 0%, rgba(255, 255, 255, 0.78) 34%)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Board view</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{label}</div>
        {isManual && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a8a8a8' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a8a8a8', display: 'inline-block' }} />stored locally</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[{ col: todo, title: 'Backlog' }, { col: inprogress, title: 'In progress' }, { col: done, title: 'Done' }].map(({ col, title }) => (
          <div key={title} style={{ border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 14, padding: 12, background: 'rgba(255, 255, 255, 0.58)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: '#7a7a7a' }}>{title}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{col?.count ?? 0}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Sync badge ───────────────────────────────────────────────────────────────

function SyncBadge({ state }: { state: 'unknown' | 'ok' | 'drift' }) {
  const s: Record<typeof state, { bg: string; text: string; dot: string; label: string }> = {
    ok: { bg: 'rgba(121, 166, 148, 0.14)', text: '#3c6658', dot: '#3c6658', label: 'Aligned' },
    drift: { bg: 'rgba(248, 113, 113, 0.14)', text: '#f87171', dot: '#f87171', label: 'Drift' },
    unknown: { bg: 'rgba(200, 195, 188, 0.18)', text: '#7a7a7a', dot: '#7a7a7a', label: 'Unknown' },
  };
  const st = s[state];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: st.bg, padding: '6px 12px', borderRadius: 999 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
      <span style={{ color: st.text, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{st.label}</span>
    </div>
  );
}

// ─── Autonomous content ────────────────────────────────────────────────────────

function AutonomousContent({ columns, syncState, syncDetails }: {
  columns: Column[];
  syncState: 'unknown' | 'ok' | 'drift';
  syncDetails: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SummaryStrip columns={columns} label="Autonomous execution board" />
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
        {columns.map(col => <ColumnView key={col.id} column={col} boardType="autonomous" />)}
      </section>
      <section style={{ ...cardStyle(), display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10, minWidth: 180 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Sync integrity</div>
          <SyncBadge state={syncState} />
          <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>{syncDetails}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
          {['board.json', 'AUTONOMOUS.md', 'tasks-log.md'].map(label => (
            <div key={label} style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: '#7a7a7a' }}>{label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7a7a' }}>—</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Manual board content ─────────────────────────────────────────────────────

function ManualBoardContent({ board, label, onMove, onEdit }: {
  board: Record<string, Column>;
  label: string;
  onMove: (board: 'personal' | 'projects', taskId: string, newColumn: Task['column']) => void;
  onEdit: (task: Task) => void;
}) {
  const cols = columnsFromBoard(board);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SummaryStrip columns={cols} label={`${label} board`} isManual />
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
        {cols.map(col => (
          <ColumnView
            key={col.id}
            column={col}
            boardType={label.toLowerCase() as 'personal' | 'projects'}
            onEdit={onEdit}
            onMove={(taskId, newCol) => onMove(label.toLowerCase() as 'personal' | 'projects', taskId, newCol)}
          />
        ))}
      </section>
    </div>
  );
}

// ─── New task FAB ─────────────────────────────────────────────────────────────

function NewTaskFAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed', bottom: 32, right: 32,
        width: 56, height: 56, borderRadius: '50%',
        background: '#0f1f19', color: '#ffffff',
        border: 'none', cursor: 'pointer',
        fontSize: 26, lineHeight: 1,
        boxShadow: '0 8px 32px rgba(15, 31, 25, 0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      aria-label="New task"
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      +
    </button>
  );
}

// ─── Main switcher ────────────────────────────────────────────────────────────

export function TasksBoardSwitcher({
  autonomousColumns,
  syncState,
  syncDetails,
}: {
  autonomousColumns: Column[];
  syncState: 'unknown' | 'ok' | 'drift';
  syncDetails: string;
}) {
  const [activeBoard, setActiveBoard] = useState<BoardId>('autonomous');
  const [personalBoard, setPersonalBoard] = useState<Record<string, Column>>(() => {
    if (typeof window === 'undefined') return seedPersonal();
    try {
      const stored = localStorage.getItem(LS_PERSONAL);
      if (stored) return JSON.parse(stored);
    } catch {}
    return seedPersonal();
  });
  const [projectsBoard, setProjectsBoard] = useState<Record<string, Column>>(() => {
    if (typeof window === 'undefined') return seedProjects();
    try {
      const stored = localStorage.getItem(LS_PROJECTS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return seedProjects();
  });
  const [modal, setModal] = useState<ModalMode>(null);

  // Persist to localStorage when manual boards change
  useEffect(() => {
    localStorage.setItem(LS_PERSONAL, JSON.stringify(personalBoard));
  }, [personalBoard]);

  useEffect(() => {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projectsBoard));
  }, [projectsBoard]);

  const handleMove = useCallback((board: 'personal' | 'projects', taskId: string, newColumn: Task['column']) => {
    const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard;
    setter(prev => {
      const updated = { ...prev };
      let movedTask: Task | null = null;
      for (const colId of ['todo', 'inprogress', 'done'] as const) {
        const col = updated[colId];
        const idx = col.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          [movedTask] = col.tasks.splice(idx, 1);
          col.count = col.tasks.length;
          break;
        }
      }
      if (!movedTask) return prev;
      movedTask = { ...movedTask, column: newColumn };
      updated[newColumn].tasks.push(movedTask);
      updated[newColumn].count = updated[newColumn].tasks.length;
      return updated;
    });
  }, []);

  const handleSave = useCallback((board: 'personal' | 'projects', task: Task, isNew: boolean) => {
    if (!modal) return;
    const setter = board === 'personal' ? setPersonalBoard : setProjectsBoard;
    setter(prev => {
      const updated = { ...prev };
      if (isNew) {
        updated[task.column].tasks.push(task);
        updated[task.column].count = updated[task.column].tasks.length;
      } else {
        for (const colId of ['todo', 'inprogress', 'done'] as const) {
          const col = updated[colId];
          const idx = col.tasks.findIndex(t => t.id === task.id);
          if (idx !== -1) {
            col.tasks.splice(idx, 1);
            col.count = col.tasks.length;
            break;
          }
        }
        updated[task.column].tasks.push(task);
        updated[task.column].count = updated[task.column].tasks.length;
      }
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNewTaskModal = (board: 'personal' | 'projects', defaultColumn: Task['column']) => {
    setModal({ mode: 'create', board, defaultColumn });
  };

  const showEditModal = (task: Task) => {
    const board: 'personal' | 'projects' = task.detail.summary.toLowerCase().startsWith('[projects]') ? 'projects' : 'personal';
    setModal({ mode: 'edit', board, task });
  };

  const activeIsManual = activeBoard === 'personal' || activeBoard === 'projects';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Board tabs */}
      <div
        role="tablist"
        aria-label="Task boards"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px',
          borderRadius: 999, background: 'rgba(255, 255, 255, 0.74)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(200, 195, 188, 0.4)', width: 'fit-content',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        {BOARDS.map(board => {
          const isActive = activeBoard === board.id;
          return (
            <button
              key={board.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveBoard(board.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: isActive ? 700 : 500, transition: 'all 0.15s ease',
                background: isActive ? 'var(--accent-deep, #0f1f19)' : 'transparent',
                color: isActive ? '#ffffff' : '#7a7a7a',
                boxShadow: isActive ? '0 2px 8px rgba(15, 31, 25, 0.18)' : 'none',
              }}
            >
              <span>{board.icon}</span>
              <span>{board.label}</span>
            </button>
          );
        })}
      </div>

      {/* Board content */}
      <div role="tabpanel">
        {activeBoard === 'autonomous' && (
          <AutonomousContent columns={autonomousColumns} syncState={syncState} syncDetails={syncDetails} />
        )}
        {activeBoard === 'personal' && (
          <ManualBoardContent
            board={personalBoard}
            label="Personal"
            onMove={handleMove}
            onEdit={showEditModal}
          />
        )}
        {activeBoard === 'projects' && (
          <ManualBoardContent
            board={projectsBoard}
            label="Projects"
            onMove={handleMove}
            onEdit={showEditModal}
          />
        )}
      </div>

      {/* FAB — shown only for manual boards */}
      {activeIsManual && (
        <NewTaskFAB onClick={() => showNewTaskModal(activeBoard as 'personal' | 'projects', 'todo')} />
      )}

      {/* Modal */}
      <TaskModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />
    </div>
  );
}