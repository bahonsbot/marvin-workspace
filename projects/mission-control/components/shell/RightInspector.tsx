'use client';

import { usePathname } from 'next/navigation';

type InspectorSection = {
  title: string;
  body: string;
  tone?: 'neutral' | 'accent';
};

type InspectorConfig = {
  eyebrow: string;
  summary: string;
  sections: InspectorSection[];
};

const inspectorByPath: Record<string, InspectorConfig> = {
  '/': {
    eyebrow: 'Home context',
    summary: 'Use this page to orient fast: what is live, what is only partially visible, and where attention belongs next.',
    sections: [
      {
        title: 'Primary job',
        body: 'Surface the current operating picture without turning the landing page into a raw log dump.',
      },
      {
        title: 'Read the labels literally',
        body: 'Adapter-backed means the data comes from real runtime sources. Partial visibility means some truth is available, but not the whole world.',
      },
      {
        title: 'Best next click',
        body: 'If conversation control matters, go to Chat. If session pressure matters, go to Agents.',
        tone: 'accent',
      },
    ],
  },
  '/orchestrator': {
    eyebrow: 'Orchestrator context',
    summary: 'This page frames the real control path. It does not replace chat transport, session state, or auth.',
    sections: [
      {
        title: 'Bridge rule',
        body: 'Prefer explicit reuse of the existing Control UI or local gateway path. No shadow chat stack.',
      },
      {
        title: 'What counts as success',
        body: 'A sharper handoff into the existing control surface, with useful runtime context around it.',
      },
      {
        title: 'Do not fake completeness',
        body: 'If runtime exposes only a local endpoint, show that honestly and explain the fallback.',
        tone: 'accent',
      },
    ],
  },
  '/agents': {
    eyebrow: 'Agents context',
    summary: 'This page is about visibility, not intervention. It should answer who is active, quiet, or unknown at a glance.',
    sections: [
      {
        title: 'Classification rule',
        body: 'Running means active within five minutes. Idle means visible but currently quiet. Unknown means timing data was insufficient.',
      },
      {
        title: 'What to watch',
        body: 'Look for unexpected model usage, stale long-running sessions, or sudden spikes in active direct sessions.',
      },
    ],
  },
  '/cron': {
    eyebrow: 'Cron context',
    summary: 'Cron should reflect scheduler truth first, then runner truth, without collapsing everything into one vague status.',
    sections: [
      {
        title: 'Truth source',
        body: 'Job metadata comes from OpenClaw cron. Recent execution truth is reconciled with runner logs where applicable.',
      },
    ],
  },
  '/tasks': {
    eyebrow: 'Tasks context',
    summary: 'Tasks should stay grounded in board truth and append-only completion evidence, not hand-waved progress.',
    sections: [
      {
        title: 'Sync rule',
        body: 'Board state, AUTONOMOUS.md, and tasks-log should agree closely enough to trust the execution picture.',
      },
    ],
  },
  '/logs': {
    eyebrow: 'Logs context',
    summary: 'Logs should feel like a pulse, not a graveyard. Enough signal to notice movement, not enough noise to hide it.',
    sections: [
      {
        title: 'Current source',
        body: 'Recent operational activity is currently shaped from runner-backed logs instead of raw system firehose output.',
      },
    ],
  },
};

const fallbackConfig: InspectorConfig = {
  eyebrow: 'Inspector',
  summary: 'Context sidecar for the current module. Lightweight on purpose in this phase.',
  sections: [
    {
      title: 'Design rule',
      body: 'Truth over polish. Mission Control should show the real system, even when reality is partial.',
    },
  ],
};

function sectionPalette(tone: InspectorSection['tone']) {
  if (tone === 'accent') {
    return {
      border: '1px solid rgba(110, 168, 255, 0.2)',
      background: 'rgba(110, 168, 255, 0.08)',
    };
  }

  return {
    border: '1px solid var(--border)',
    background: 'rgba(17, 25, 39, 0.7)',
  };
}

export function RightInspector() {
  const pathname = usePathname();
  const config = inspectorByPath[pathname] ?? fallbackConfig;

  return (
    <aside
      style={{
        borderLeft: '1px solid var(--border)',
        padding: 18,
        background: 'linear-gradient(180deg, rgba(10, 16, 27, 0.96) 0%, rgba(8, 13, 22, 0.98) 100%)',
        color: 'var(--muted)',
        display: 'grid',
        alignContent: 'start',
        gap: 14,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}
    >
      <div>
        <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{config.eyebrow}</div>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 }}>{config.summary}</p>
      </div>

      {config.sections.map((item) => {
        const palette = sectionPalette(item.tone);
        return (
          <section
            key={item.title}
            style={{
              border: palette.border,
              borderRadius: 16,
              padding: 14,
              background: palette.background,
            }}
          >
            <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{item.title}</div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65 }}>{item.body}</p>
          </section>
        );
      })}
    </aside>
  );
}
