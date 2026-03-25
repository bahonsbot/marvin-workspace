'use client';

import { useState } from 'react';


// ─── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  text: string;
  column: 'todo' | 'inprogress' | 'done';
  detail: { summary: string; why?: string; proof?: string; unlocks?: string; completed?: string };
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

// ─── Provisional board data ────────────────────────────────────────────────────

const PROVISIONAL_PERSONAL: Record<string, Column> = {
  todo: {
    id: 'todo',
    title: 'To Do',
    count: 2,
    tasks: [
      {
        id: 'personal-1',
        text: '[Personal] Schedule dentist checkup',
        column: 'todo',
        detail: { summary: '[Personal] Schedule dentist checkup', why: 'Preventive care, overdue by 4 months.' },
      },
      {
        id: 'personal-2',
        text: '[Personal] Renew apartment insurance',
        column: 'todo',
        detail: { summary: '[Personal] Renew apartment insurance', why: 'Policy expires end of month.' },
      },
    ],
  },
  inprogress: {
    id: 'inprogress',
    title: 'In Progress',
    count: 1,
    tasks: [
      {
        id: 'personal-3',
        text: '[Personal] Research Vietnam visa options',
        column: 'inprogress',
        detail: { summary: '[Personal] Research Vietnam visa options', why: 'Current stay valid through May, need to plan ahead.' },
      },
    ],
  },
  done: {
    id: 'done',
    title: 'Done',
    count: 1,
    tasks: [
      {
        id: 'personal-4',
        text: '[Personal] Buy groceries for the week',
        column: 'done',
        detail: { summary: '[Personal] Buy groceries for the week', completed: 'Weekly meal prep session complete.' },
      },
    ],
  },
};

const PROVISIONAL_PROJECTS: Record<string, Column> = {
  todo: {
    id: 'todo',
    title: 'To Do',
    count: 2,
    tasks: [
      {
        id: 'proj-1',
        text: '[Projects] Define scope for Next.js migration',
        column: 'todo',
        detail: { summary: '[Projects] Define scope for Next.js migration', why: 'Need clear boundaries before starting frontend work.' },
      },
      {
        id: 'proj-2',
        text: '[Projects] Collect feedback on design mockups',
        column: 'todo',
        detail: { summary: '[Projects] Collect feedback on design mockups', why: 'Two stakeholders yet to review.' },
      },
    ],
  },
  inprogress: {
    id: 'inprogress',
    title: 'In Progress',
    count: 1,
    tasks: [
      {
        id: 'proj-3',
        text: '[Projects] Set up CI pipeline for staging',
        column: 'inprogress',
        detail: { summary: '[Projects] Set up CI pipeline for staging', why: 'Automation removes manual deploy step.' },
      },
    ],
  },
  done: {
    id: 'done',
    title: 'Done',
    count: 1,
    tasks: [
      {
        id: 'proj-4',
        text: '[Projects] Draft project README',
        column: 'done',
        detail: { summary: '[Projects] Draft project README', completed: 'Structure and first-pass content merged.' },
      },
    ],
  },
};

// ─── Shared kanban components (duplicated here so this stays a self-contained client) ──

function cardStyle(accent = 'var(--border)') {
  return {
    border: `1px solid ${accent}`,
    borderRadius: 18,
    padding: 16,
    background: 'rgba(255, 255, 255, 0.74)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  } as const;
}

function columnPalette(columnId: string) {
  if (columnId === 'todo') {
    return {
      accent: '#c4823a',
      border: 'rgba(196, 130, 58, 0.22)',
      bg: 'linear-gradient(180deg, rgba(196, 130, 58, 0.08) 0%, rgba(255, 255, 255, 0.82) 18%)',
      chipBg: 'rgba(196, 130, 58, 0.12)',
      chipText: '#c4823a',
      emptyText: 'Nothing waiting in backlog.',
    };
  }
  if (columnId === 'inprogress') {
    return {
      accent: '#3c6658',
      border: 'rgba(121, 166, 148, 0.24)',
      bg: 'linear-gradient(180deg, rgba(121, 166, 148, 0.12) 0%, rgba(255, 255, 255, 0.82) 18%)',
      chipBg: 'rgba(121, 166, 148, 0.16)',
      chipText: '#3c6658',
      emptyText: 'No work actively in motion.',
    };
  }
  return {
    accent: '#79a694',
    border: 'rgba(121, 166, 148, 0.22)',
    bg: 'linear-gradient(180deg, rgba(212, 231, 221, 0.75) 0%, rgba(255, 255, 255, 0.82) 18%)',
    chipBg: 'rgba(121, 166, 148, 0.14)',
    chipText: '#3c6658',
    emptyText: 'No completed cards yet.',
  };
}

function extractLane(task: Task) {
  const match = task.detail.summary.match(/^\[(.+?)\]/);
  return match?.[1] ?? 'Task';
}

function laneMeta(lane: string) {
  const normalized = lane.toLowerCase();
  if (normalized === 'personal') {
    return { icon: '🌱', text: 'Personal', color: '#3c6658', bg: 'rgba(121, 166, 148, 0.14)', border: 'rgba(121, 166, 148, 0.22)' };
  }
  if (normalized === 'career') {
    return { icon: '🚀', text: 'Career', color: '#3c6658', bg: 'rgba(212, 231, 221, 0.82)', border: 'rgba(121, 166, 148, 0.22)' };
  }
  if (normalized === 'trading') {
    return { icon: '📈', text: 'Trading', color: '#c4823a', bg: 'rgba(196, 130, 58, 0.12)', border: 'rgba(196, 130, 58, 0.22)' };
  }
  if (normalized === 'projects') {
    return { icon: '📁', text: 'Projects', color: '#3c6658', bg: 'rgba(212, 231, 221, 0.7)', border: 'rgba(121, 166, 148, 0.22)' };
  }
  return { icon: '🧩', text: lane, color: '#7a7a7a', bg: 'rgba(255, 255, 255, 0.6)', border: 'rgba(200, 195, 188, 0.3)' };
}

function displaySummary(summary: string) {
  return summary.replace(/^\[[^\]]+\]\s*/, '');
}

function TaskCard({ task }: { task: Task }) {
  const lane = extractLane(task);
  const laneStyle = laneMeta(lane);
  const isDone = task.column === 'done';
  const visibleSummary = displaySummary(task.detail.summary);

  return (
    <article
      style={{
        border: '1px solid rgba(200, 195, 188, 0.4)',
        borderRadius: 16,
        padding: 14,
        background: 'rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            width: 'fit-content',
            padding: '5px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            color: laneStyle.color,
            background: laneStyle.bg,
            border: `1px solid ${laneStyle.border}`,
          }}
        >
          <span>{laneStyle.icon}</span>
          <span>{laneStyle.text}</span>
        </span>
        <code style={{ fontSize: 10, color: '#7a7a7a' }}>{task.id}</code>
      </div>

      <div style={{ fontSize: 14, fontWeight: 650, lineHeight: 1.5 }}>{visibleSummary}</div>

      {(task.detail.why || task.detail.completed) && (
        <div style={{ display: 'grid', gap: 8 }}>
          {task.detail.why && (
            <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: '#3d3d3d' }}>Why:</span> {task.detail.why}
            </div>
          )}
          {task.detail.completed && (
            <div
              style={{
                border: '1px solid rgba(121, 166, 148, 0.18)',
                borderRadius: 12,
                padding: '9px 10px',
                background: 'rgba(212, 231, 221, 0.8)',
                fontSize: 12,
                color: '#3c6658',
                lineHeight: 1.6,
              }}
            >
              <span style={{ fontWeight: 700 }}>Delivered:</span> {task.detail.completed}
            </div>
          )}
        </div>
      )}

      <details style={{ margin: 0 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 11,
            color: '#7a7a7a',
            listStyle: 'none',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            width: 'fit-content',
          }}
        >
          {isDone ? 'Inspect card context' : 'Inspect scope'}
        </summary>
        <div style={{ marginTop: 10, fontSize: 12, color: '#7a7a7a', display: 'grid', gap: 8, lineHeight: 1.65 }}>
          {task.detail.proof && (
            <div>
              <span style={{ fontWeight: 600, color: '#3d3d3d' }}>Proof:</span> {task.detail.proof}
            </div>
          )}
          {task.detail.unlocks && (
            <div>
              <span style={{ fontWeight: 600, color: '#3d3d3d' }}>Unlocks:</span> {task.detail.unlocks}
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

function ColumnView({ column }: { column: Column }) {
  const palette = columnPalette(column.id);

  return (
    <section
      style={{
        minWidth: 0,
        border: `1px solid ${palette.border}`,
        borderRadius: 20,
        padding: 14,
        background: palette.bg,
        display: 'grid',
        gap: 12,
        alignContent: 'start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: palette.accent, boxShadow: `0 0 16px ${palette.accent}55` }} />
          <h3 style={{ margin: 0, fontSize: 16 }}>{column.title}</h3>
        </div>
        <span
          style={{
            fontSize: 12,
            color: palette.chipText,
            background: palette.chipBg,
            padding: '4px 10px',
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          {column.count}
        </span>
      </div>

      {column.tasks.length === 0 ? (
        <div
          style={{
            border: '1px solid rgba(200, 195, 188, 0.4)',
            borderRadius: 16,
            padding: 22,
            background: 'rgba(255, 255, 255, 0.48)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            textAlign: 'center',
            fontSize: 12,
            color: '#7a7a7a',
          }}
        >
          {palette.emptyText}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryStrip({ columns, label }: { columns: Column[]; label: string }) {
  const [todo = { count: 0 }, inprogress = { count: 0 }, done = { count: 0 }] = columns;

  return (
    <section
      style={{
        ...cardStyle('rgba(121, 166, 148, 0.24)'),
        display: 'grid',
        gridTemplateColumns: '1.3fr 0.9fr',
        gap: 16,
        alignItems: 'start',
        background: 'linear-gradient(180deg, rgba(212, 231, 221, 0.72) 0%, rgba(255, 255, 255, 0.78) 34%)',
      }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Board view</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{label}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[{ col: todo, title: 'Backlog' }, { col: inprogress, title: 'In progress' }, { col: done, title: 'Done' }].map(
          ({ col, title }) => (
            <div
              key={title}
              style={{
                border: '1px solid rgba(200, 195, 188, 0.4)',
                borderRadius: 14,
                padding: 12,
                background: 'rgba(255, 255, 255, 0.58)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: '#7a7a7a' }}>{title}</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{col.count}</div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function SyncBadge({ state }: { state: 'unknown' | 'ok' | 'drift' }) {
  const styleByState: Record<typeof state, { bg: string; text: string; dot: string; label: string }> = {
    ok: { bg: 'rgba(121, 166, 148, 0.14)', text: '#3c6658', dot: '#3c6658', label: 'Aligned' },
    drift: { bg: 'rgba(248, 113, 113, 0.14)', text: '#f87171', dot: '#f87171', label: 'Drift' },
    unknown: { bg: 'rgba(200, 195, 188, 0.18)', text: '#7a7a7a', dot: '#7a7a7a', label: 'Unknown' },
  };

  const s = styleByState[state];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: s.bg, padding: '6px 12px', borderRadius: 999 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      <span style={{ color: s.text, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</span>
    </div>
  );
}

function AutonomousContent({ columns, syncState, syncDetails }: { columns: Column[]; syncState: 'unknown' | 'ok' | 'drift'; syncDetails: string }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SummaryStrip columns={columns} label="Autonomous execution board" />
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {columns.map((col) => (
          <ColumnView key={col.id} column={col} />
        ))}
      </section>
      <section
        style={{
          ...cardStyle(),
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 10, minWidth: 180 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a7a7a' }}>Sync integrity</div>
          <SyncBadge state={syncState} />
          <div style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>{syncDetails}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
          {['board.json', 'AUTONOMOUS.md', 'tasks-log.md'].map((label) => (
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

function ProvisionalContent({ board, label }: { board: Record<string, Column>; label: string }) {
  const columns = [board.todo, board.inprogress, board.done];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SummaryStrip columns={columns} label={`${label} board`} />
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {columns.map((col) => (
          <ColumnView key={col.id} column={col} />
        ))}
      </section>
      <section
        style={{
          ...cardStyle(),
          display: 'grid',
          gap: 8,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Provisional board</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#7a7a7a', lineHeight: 1.6 }}>
          This board holds manual tasks. It is not yet connected to a live data source — task entries are illustrative placeholders.
        </p>
      </section>
    </div>
  );
}

// ─── Main switcher component ───────────────────────────────────────────────────

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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Board tabs */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 6px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.74)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(200, 195, 188, 0.4)',
          width: 'fit-content',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
        }}
        role="tablist"
        aria-label="Task boards"
      >
        {BOARDS.map((board) => {
          const isActive = activeBoard === board.id;
          return (
            <button
              key={board.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveBoard(board.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.15s ease',
                background: isActive ? 'var(--accent-deep, #0f1f19)' : 'transparent',
                color: isActive ? '#ffffff' : '#7a7a7a',
                boxShadow: isActive ? '0 2px 8px rgba(15, 31, 25, 0.18)' : 'none',
              }}
            >
              <span>{board.icon}</span>
              <span>{board.label}</span>
              {!isActive && board.id !== 'autonomous' && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.2,
                    padding: '2px 5px',
                    borderRadius: 999,
                    background: 'rgba(200, 195, 188, 0.22)',
                    color: '#a8a8a8',
                  }}
                >
                  prov.
                </span>
              )}
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
          <ProvisionalContent board={PROVISIONAL_PERSONAL} label="Personal" />
        )}
        {activeBoard === 'projects' && (
          <ProvisionalContent board={PROVISIONAL_PROJECTS} label="Projects" />
        )}
      </div>
    </div>
  );
}
