import { floatingInsetStyle, floatingPanelStyle } from '@/components/shared/floating';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { getSessions } from '@/lib/adapters/sessions';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';

type Session = {
  id: string;
  label: string;
  rawKey?: string;
  state: 'running' | 'idle' | 'unknown';
  kind?: string;
  model?: string | null;
  lastActiveAt?: string | null;
  ageMs?: number | null;
};

type AgentCardType = 'runtime' | 'planned';
type AgentVisualState = 'running' | 'recently-active' | 'idle' | 'unknown' | 'no-session' | 'planned';

type AgentProfile = {
  id: string;
  name: string;
  role: string;
  eyebrow: string;
  accent: string;
  accentSoft: string;
  summary: string;
  model: string;
  cardType: AgentCardType;
  avatarMark: string;
  motif: 'orbit' | 'forge' | 'prism' | 'signal' | 'quill' | 'wayfinder';
  availability?: string;
  readiness?: string;
  activationLabel?: string;
  activationNote?: string;
  match?: (session: Session) => boolean;
};

type ControlPath = Awaited<ReturnType<typeof getOrchestratorIntegrationSummary>>['controlPath'];

type Action = {
  label: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost';
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RECENTLY_ACTIVE_MS = 6 * 60 * 60 * 1000;

function isReviewerLike(session: Session) {
  const raw = (session.rawKey ?? '').toLowerCase();
  const label = (session.label ?? '').toLowerCase();
  const model = (session.model ?? '').toLowerCase();
  const directSubagent = raw.includes(':subagent:') || label.includes('subagent');
  const modelSignalsReviewer = model.includes('qwen') || model.includes('review');
  return raw.includes('reviewer') || label.includes('reviewer') || (directSubagent && modelSignalsReviewer);
}

const ROSTER_AGENTS: AgentProfile[] = [
  {
    id: 'marvin',
    name: 'Marvin',
    role: 'Continuity lead',
    eyebrow: 'Live trio',
    accent: '#315f51',
    accentSoft: '#7da594',
    avatarMark: 'MV',
    motif: 'orbit',
    summary: 'Holds the main seat, keeps continuity intact, and steers the working thread across turns.',
    model: 'codex5.4',
    cardType: 'runtime',
    match: (session) => session.rawKey === 'agent:main:main',
  },
  {
    id: 'builder',
    name: 'Builder',
    role: 'Implementation specialist',
    eyebrow: 'Live trio',
    accent: '#4d7a68',
    accentSoft: '#8ab7a5',
    avatarMark: 'BD',
    motif: 'forge',
    summary: 'Turns approved direction into concrete repo changes when the work needs execution, not just framing.',
    model: 'codex',
    cardType: 'runtime',
    match: (session) => {
      const raw = (session.rawKey ?? '').toLowerCase();
      const label = (session.label ?? '').toLowerCase();
      const model = (session.model ?? '').toLowerCase();
      if (isReviewerLike(session)) return false;

      const subagentSignal = raw.includes(':subagent:') || raw.includes('builder') || label.includes('builder');
      const looksLikeBuilderModel = model.includes('codex');
      return subagentSignal || (looksLikeBuilderModel && !raw.includes(':cron:'));
    },
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Quality gate',
    eyebrow: 'Live trio',
    accent: '#a26a3f',
    accentSoft: '#d3ab84',
    avatarMark: 'RV',
    motif: 'prism',
    summary: 'Pressure-tests the result, catches regressions, and sharpens the work before it hardens into output.',
    model: 'qwenplus',
    cardType: 'runtime',
    match: (session) => isReviewerLike(session),
  },
  {
    id: 'sportsbet-advisor',
    name: 'Rafa',
    role: 'Sportsbet Advisor',
    eyebrow: 'Planned seat',
    accent: '#567955',
    accentSoft: '#9ebb8d',
    avatarMark: 'RF',
    motif: 'signal',
    summary: 'Staged for line reading, betting angles, and pragmatic decision support once direct chat routing exists.',
    model: 'Chat route pending',
    cardType: 'planned',
    availability: 'Prepared as a direct chat specialist.',
    readiness: 'Identity and seat are defined, but no live routing is wired yet.',
    activationLabel: 'Activate in chat',
    activationNote: 'Coming soon. This page does not launch a future chat flow yet.',
  },
  {
    id: 'copywriter',
    name: 'Sloane',
    role: 'Content Creator',
    eyebrow: 'Planned seat',
    accent: '#86685f',
    accentSoft: '#c3a095',
    avatarMark: 'SL',
    motif: 'quill',
    summary: 'Staged for editorial drafting, sharper copy, and content shaping from the main workspace when ready.',
    model: 'Chat route pending',
    cardType: 'planned',
    availability: 'Prepared as a direct chat specialist.',
    readiness: 'Defined in the roster, but still waiting on a truthful runtime path.',
    activationLabel: 'Activate in chat',
    activationNote: 'Unavailable for now. The card signals intent, not a live backend flow.',
  },
  {
    id: 'travel-planner',
    name: 'Pico',
    role: 'Travel Planner',
    eyebrow: 'Planned seat',
    accent: '#486c79',
    accentSoft: '#94bdcb',
    avatarMark: 'PC',
    motif: 'wayfinder',
    summary: 'Staged for itinerary shaping, logistics, and trip planning once the chat route is actually in place.',
    model: 'Chat route pending',
    cardType: 'planned',
    availability: 'Prepared as a direct chat specialist.',
    readiness: 'Ready as an identity and use case, not yet as a live runtime.',
    activationLabel: 'Activate in chat',
    activationNote: 'Unavailable for now. Travel planning still belongs in the existing chat path.',
  },
];

function statePalette(state: AgentVisualState) {
  if (state === 'running') {
    return { bg: 'rgba(121, 166, 148, 0.12)', border: 'rgba(121, 166, 148, 0.26)', text: '#315f51', label: 'Running now' };
  }
  if (state === 'recently-active') {
    return { bg: 'rgba(109, 145, 164, 0.11)', border: 'rgba(109, 145, 164, 0.22)', text: '#496d7b', label: 'Recently active' };
  }
  if (state === 'idle') {
    return { bg: 'rgba(183, 123, 64, 0.10)', border: 'rgba(183, 123, 64, 0.18)', text: '#9d6737', label: 'Idle' };
  }
  if (state === 'unknown') {
    return { bg: 'rgba(200, 195, 188, 0.16)', border: 'rgba(200, 195, 188, 0.24)', text: '#6e6a65', label: 'Signal unclear' };
  }
  if (state === 'planned') {
    return { bg: 'rgba(79, 117, 131, 0.10)', border: 'rgba(79, 117, 131, 0.18)', text: '#4f7583', label: 'Planned' };
  }
  return { bg: 'rgba(235, 230, 224, 0.78)', border: 'rgba(200, 195, 188, 0.26)', text: '#6e6a65', label: 'No current session' };
}

function formatLastActive(value?: string | null) {
  if (!value) return 'No recent signal';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function formatAge(ageMs?: number | null) {
  if (ageMs === null || ageMs === undefined || Number.isNaN(ageMs)) return 'Unknown';
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes === 0 ? `${hours}h ago` : `${hours}h ${remMinutes}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isCronOrSystem(session: Session) {
  const raw = (session.rawKey ?? '').toLowerCase();
  const label = (session.label ?? '').toLowerCase();
  return raw.includes(':cron:') || label.startsWith('cron:') || raw.includes('heartbeat') || raw.includes('system');
}

function quietSystemLabel(session: Session) {
  const label = session.label || 'system';
  return label.replace(/^cron:/i, '').replace(/^subagent:/i, '').replace(/^main:/i, '');
}

function deriveVisualState(agent: AgentProfile, session: Session | null): AgentVisualState {
  if (agent.cardType === 'planned') return 'planned';
  if (!session) return 'no-session';
  if (session.state === 'running') return 'running';
  if (session.state === 'unknown') return 'unknown';
  if ((session.ageMs ?? Number.MAX_SAFE_INTEGER) <= RECENTLY_ACTIVE_MS) return 'recently-active';
  return 'idle';
}

function activityLine(agent: AgentProfile, session: Session | null, visualState: AgentVisualState) {
  if (agent.cardType === 'planned') return agent.availability ?? 'Reserved seat';
  if (!session) return 'No current session is matched to this seat.';
  if (visualState === 'running') return `Working now through ${session.label}.`;
  if (visualState === 'recently-active') return `Last touched the runtime ${formatAge(session.ageMs)} via ${session.label}.`;
  if (visualState === 'idle') return `Idle at the moment. Last active ${formatAge(session.ageMs)}.`;
  return 'A session is present, but the runtime classification is not fully clear.';
}

function contextLine(agent: AgentProfile, session: Session | null) {
  if (agent.cardType === 'planned') return agent.readiness ?? 'Awaiting truthful runtime wiring.';
  if (!session) return `Assigned model ${agent.model}. Session context will appear once a live seat is matched.`;
  return `Assigned model ${agent.model}. Runtime label ${session.label}. Last signal ${formatLastActive(session.lastActiveAt)}.`;
}

function runtimeNote(agent: AgentProfile, session: Session | null, visualState: AgentVisualState) {
  if (agent.cardType === 'planned') return 'Clearly planned, not live.';
  if (visualState === 'running') return 'Live runtime matched to the roster seat.';
  if (visualState === 'recently-active') return 'Recent runtime matched, but not actively moving right now.';
  if (visualState === 'idle') return 'Seat matched, though the last signal is older.';
  if (visualState === 'unknown') return 'Seat matched, but the current state is ambiguous.';
  return 'No live session currently matches this seat.';
}

function actionsForAgent(agent: AgentProfile, session: Session | null, controlPath: ControlPath): Action[] {
  if (agent.cardType === 'planned') {
    return [
      {
        label: agent.activationLabel ?? 'Coming soon',
        disabled: true,
        tone: 'ghost',
      },
    ];
  }

  const actions: Action[] = [];

  actions.push({
    label: agent.id === 'marvin' ? 'Open chat' : 'View chat context',
    href: '/general/chat',
    tone: 'primary',
  });

  if (controlPath.href) {
    actions.push({
      label: agent.id === 'marvin' ? 'Open Control UI' : 'Inspect in Control UI',
      href: controlPath.href,
      external: true,
      tone: 'secondary',
    });
  } else if (session) {
    actions.push({
      label: 'Control path unavailable',
      disabled: true,
      tone: 'ghost',
    });
  }

  if (!session) {
    actions.push({
      label: 'No current session',
      disabled: true,
      tone: 'ghost',
    });
  }

  return actions.slice(0, 2);
}

function ActionButton({ action }: { action: Action }) {
  const commonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    padding: '9px 12px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.01em',
    textDecoration: 'none',
    border: '1px solid transparent',
  } as const;

  if (action.disabled || !action.href) {
    return (
      <span
        style={{
          ...commonStyle,
          color: 'var(--text-muted)',
          background: 'rgba(255, 255, 255, 0.52)',
          borderColor: 'rgba(200, 195, 188, 0.4)',
        }}
      >
        {action.label}
      </span>
    );
  }

  const isPrimary = action.tone === 'primary';

  return (
    <a
      href={action.href}
      target={action.external ? '_blank' : undefined}
      rel={action.external ? 'noopener noreferrer' : undefined}
      style={{
        ...commonStyle,
        color: isPrimary ? '#fffdfb' : 'var(--accent-deep)',
        background: isPrimary
          ? 'linear-gradient(135deg, #10261f 0%, #315f51 100%)'
          : 'rgba(255, 255, 255, 0.78)',
        borderColor: isPrimary ? 'rgba(15, 31, 25, 0.34)' : 'rgba(121, 166, 148, 0.28)',
        boxShadow: isPrimary ? '0 10px 24px rgba(16, 38, 31, 0.16)' : 'none',
      }}
    >
      {action.label}
    </a>
  );
}

function AvatarMedallion({ agent }: { agent: AgentProfile }) {
  const sharedShell = {
    width: 62,
    height: 62,
    borderRadius: 20,
    position: 'relative' as const,
    overflow: 'hidden',
    border: `1px solid ${agent.accent}40`,
    background: `linear-gradient(160deg, ${agent.accentSoft}30 0%, rgba(255, 255, 255, 0.92) 45%, ${agent.accent}18 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 10px 24px ${agent.accent}14`,
  };

  const motifBase = (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 7,
          borderRadius: 16,
          border: `1px solid ${agent.accent}24`,
          background: `radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.92) 0%, ${agent.accentSoft}16 45%, transparent 78%)`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 'auto -18px -18px auto',
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${agent.accentSoft}40 0%, transparent 72%)`,
        }}
      />
    </>
  );

  const motifMap = {
    orbit: (
      <>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: `1px solid ${agent.accent}66` }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 22, borderRadius: '50%', border: `1px solid ${agent.accentSoft}88` }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: 16, left: 34, width: 8, height: 8, borderRadius: '50%', background: agent.accent }} />
      </>
    ),
    forge: (
      <>
        <div aria-hidden="true" style={{ position: 'absolute', left: 15, right: 15, top: 18, height: 5, borderRadius: 999, background: `${agent.accent}bb` }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 19, right: 19, top: 29, height: 5, borderRadius: 999, background: `${agent.accentSoft}cc` }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 23, right: 23, top: 40, height: 5, borderRadius: 999, background: `${agent.accent}88` }} />
      </>
    ),
    prism: (
      <>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 18,
            top: 16,
            width: 26,
            height: 26,
            borderTop: `2px solid ${agent.accent}`,
            borderRight: `2px solid ${agent.accentSoft}`,
            borderBottom: `2px solid ${agent.accent}`,
            transform: 'rotate(45deg)',
            borderRadius: 6,
          }}
        />
        <div aria-hidden="true" style={{ position: 'absolute', left: 27, top: 39, width: 8, height: 8, borderRadius: '50%', background: agent.accent }} />
      </>
    ),
    signal: (
      <>
        <div aria-hidden="true" style={{ position: 'absolute', left: 15, bottom: 18, width: 8, height: 16, borderRadius: 999, background: `${agent.accent}88` }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 27, bottom: 18, width: 8, height: 24, borderRadius: 999, background: `${agent.accent}bb` }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 39, bottom: 18, width: 8, height: 12, borderRadius: 999, background: `${agent.accentSoft}cc` }} />
      </>
    ),
    quill: (
      <>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 21,
            top: 14,
            width: 20,
            height: 30,
            borderRadius: '18px 18px 18px 2px',
            border: `1px solid ${agent.accent}88`,
            background: `linear-gradient(180deg, rgba(255,255,255,0.85) 0%, ${agent.accentSoft}44 100%)`,
            transform: 'rotate(18deg)',
          }}
        />
        <div aria-hidden="true" style={{ position: 'absolute', left: 30, top: 28, width: 1, height: 18, background: `${agent.accent}88`, transform: 'rotate(18deg)' }} />
      </>
    ),
    wayfinder: (
      <>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 17, borderRadius: '50%', border: `1px solid ${agent.accentSoft}aa` }} />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 30,
            top: 18,
            width: 2,
            height: 24,
            background: `${agent.accent}bb`,
            transform: 'rotate(35deg)',
            transformOrigin: 'bottom center',
          }}
        />
        <div aria-hidden="true" style={{ position: 'absolute', left: 28, top: 27, width: 8, height: 8, borderRadius: '50%', background: agent.accent }} />
      </>
    ),
  } as const;

  return (
    <div style={sharedShell}>
      {motifBase}
      {motifMap[agent.motif]}
      <div
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: agent.accent,
          fontWeight: 800,
        }}
      >
        <span>{agent.avatarMark}</span>
        <span style={{ width: 10, height: 1, background: `${agent.accent}88` }} />
      </div>
    </div>
  );
}

function AgentCard({ agent, session, controlPath }: { agent: AgentProfile; session: Session | null; controlPath: ControlPath }) {
  const visualState = deriveVisualState(agent, session);
  const palette = statePalette(visualState);
  const isPlanned = agent.cardType === 'planned';
  const actions = actionsForAgent(agent, session, controlPath);

  return (
    <article
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 28,
        padding: 20,
        background: `linear-gradient(180deg, ${agent.accent}12 0%, rgba(255, 255, 255, 0.84) 34%, rgba(255, 255, 255, 0.92) 100%)`,
        boxShadow: '0 18px 42px rgba(25, 31, 28, 0.06)',
        display: 'grid',
        gap: 16,
        alignContent: 'start',
        minHeight: 376,
      }}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <AvatarMedallion agent={agent} />
            <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.34 }}>
                {agent.eyebrow}
              </div>
              <div style={{ fontSize: 25, lineHeight: 1.02, letterSpacing: -0.6, wordBreak: 'break-word' }}>{agent.name}</div>
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 11px',
              borderRadius: 999,
              background: palette.bg,
              border: `1px solid ${palette.border}`,
              color: palette.text,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.28,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: palette.text }} />
            {palette.label}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 5 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>{agent.role}</div>
          <p style={{ margin: 0, color: 'var(--muted-strong)', fontSize: 14, lineHeight: 1.66 }}>{agent.summary}</p>
        </div>
      </div>

      <div style={{ ...floatingInsetStyle({ radius: 18, padding: 14, background: 'rgba(255, 255, 255, 0.56)' }), display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Current or last activity</div>
        <div style={{ fontSize: 14, lineHeight: 1.58 }}>{activityLine(agent, session, visualState)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <div style={floatingInsetStyle({ radius: 16, padding: 12, background: 'rgba(255, 255, 255, 0.46)' })}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)' }}>Model</div>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, wordBreak: 'break-word' }}>{agent.model}</div>
        </div>
        <div style={floatingInsetStyle({ radius: 16, padding: 12, background: 'rgba(255, 255, 255, 0.46)' })}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)' }}>
            {isPlanned ? 'Readiness' : 'Session status'}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, wordBreak: 'break-word' }}>
            {isPlanned ? 'Not live yet' : runtimeNote(agent, session, visualState)}
          </div>
        </div>
      </div>

      <div style={{ ...floatingInsetStyle({ radius: 16, padding: 13, background: 'rgba(250, 248, 245, 0.78)' }), display: 'grid', gap: 5 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)' }}>Model and session context</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted-strong)' }}>{contextLine(agent, session)}</div>
      </div>

      <div style={{ display: 'grid', gap: 9, marginTop: 'auto' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)' }}>Actions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
        {isPlanned && agent.activationNote ? <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{agent.activationNote}</div> : null}
      </div>
    </article>
  );
}

function QuietSystemCard({ session }: { session: Session }) {
  const palette = statePalette(session.state === 'running' ? 'running' : session.state === 'unknown' ? 'unknown' : 'idle');
  return (
    <article
      style={{
        ...floatingInsetStyle({ padding: 14, radius: 18, background: 'rgba(255, 255, 255, 0.46)' }),
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{quietSystemLabel(session)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{session.model ?? 'Model unavailable'}</div>
        </div>
        <div
          style={{
            fontSize: 10,
            color: palette.text,
            background: palette.bg,
            border: `1px solid ${palette.border}`,
            padding: '5px 8px',
            borderRadius: 999,
            textTransform: 'uppercase',
            fontWeight: 800,
            letterSpacing: 0.28,
            whiteSpace: 'nowrap',
          }}
        >
          {palette.label}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted-strong)', lineHeight: 1.55 }}>
        Last active {formatLastActive(session.lastActiveAt)}. Recent signal {formatAge(session.ageMs)}.
      </div>
    </article>
  );
}

export default async function AgentsPage() {
  const [data, orchestrator] = await Promise.all([getSessions(), getOrchestratorIntegrationSummary()]);
  const sessions = data.sessions as Session[];
  const matchedSessionIds = new Set<string>();

  const roster = ROSTER_AGENTS.map((agent) => {
    if (!agent.match) return { agent, session: null };

    const matched =
      sessions
        .filter((session) => agent.match?.(session))
        .sort((a, b) => (a.ageMs ?? Number.MAX_SAFE_INTEGER) - (b.ageMs ?? Number.MAX_SAFE_INTEGER))[0] ?? null;

    if (matched) matchedSessionIds.add(matched.id);
    return { agent, session: matched };
  });

  const runtimeRoster = roster.filter((item) => item.agent.cardType === 'runtime');
  const activeCount = runtimeRoster.filter((item) => deriveVisualState(item.agent, item.session) === 'running').length;
  const recentlyActiveCount = runtimeRoster.filter((item) => deriveVisualState(item.agent, item.session) === 'recently-active').length;
  const noSessionCount = runtimeRoster.filter((item) => deriveVisualState(item.agent, item.session) === 'no-session').length;

  const quietSystemAgents = sessions
    .filter((session) => !matchedSessionIds.has(session.id))
    .filter((session) => isCronOrSystem(session))
    .filter((session) => (session.ageMs ?? WEEK_MS + 1) <= WEEK_MS)
    .sort((a, b) => (a.ageMs ?? Number.MAX_SAFE_INTEGER) - (b.ageMs ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 12);

  return (
    <PageScaffold title="Agents" titleVariant="system">
      <div style={{ display: 'grid', gap: 22 }}>
        <section
          style={{
            ...floatingPanelStyle({
              padding: 22,
              borderColor: 'rgba(121, 166, 148, 0.2)',
              background: 'linear-gradient(180deg, rgba(248, 246, 242, 0.92) 0%, rgba(255, 255, 255, 0.78) 100%)',
            }),
            display: 'grid',
            gap: 18,
          }}
        >
          <div className="general-main-grid" style={{ gap: 16, alignItems: 'stretch' }}>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--accent-mid)', fontWeight: 700 }}>
                Operational roster
              </div>
              <div style={{ fontSize: 32, lineHeight: 1.08, letterSpacing: -0.9, maxWidth: 620 }}>
                Marvin, Builder, and Reviewer hold the live lane. Planned seats stay clearly staged behind them.
              </div>
              <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.72, maxWidth: 680 }}>
                This page tracks who is genuinely in play, what each seat is for, and whether the runtime currently shows active work, recent movement,
                or no matched session at all. Actions stay tied to the existing chat and Control UI paths only.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              {[
                { label: 'Live trio running', value: `${activeCount} of ${runtimeRoster.length}` },
                { label: 'Recently active', value: recentlyActiveCount > 0 ? String(recentlyActiveCount) : '—' },
                { label: 'No current session', value: noSessionCount > 0 ? String(noSessionCount) : '0' },
                { label: 'Background sessions', value: String(quietSystemAgents.length) },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...floatingInsetStyle({ radius: 18, padding: '14px 16px', background: 'rgba(255, 255, 255, 0.62)' }),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.28 }}>{item.label}</div>
                  <div style={{ fontSize: 18, lineHeight: 1.1, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 2 }}>
                Refreshed {formatLastActive(data.refreshedAt)}.
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          <div className="agents-roster-grid">
            {roster.map(({ agent, session }) => (
              <AgentCard key={agent.id} agent={agent} session={session} controlPath={orchestrator.controlPath} />
            ))}
          </div>
        </section>

        <section
          style={{
            ...floatingPanelStyle({
              padding: 18,
              borderColor: 'rgba(200, 195, 188, 0.28)',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(248, 246, 242, 0.88) 100%)',
            }),
          }}
        >
          <details>
            <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 5 }}>
                  <div style={{ fontSize: 18, lineHeight: 1.2 }}>Quiet system agents</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
                    Supporting cron and system sessions from the last seven days. Useful operational context, but intentionally secondary.
                  </div>
                </div>
                <div
                  style={{
                    color: 'var(--muted)',
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '6px 11px',
                    background: 'rgba(255, 255, 255, 0.56)',
                  }}
                >
                  {quietSystemAgents.length} recent
                </div>
              </div>
            </summary>

            <div style={{ marginTop: 14 }}>
              {quietSystemAgents.length === 0 ? (
                <div
                  style={{
                    ...floatingInsetStyle({ radius: 18, padding: 18, background: 'rgba(255, 255, 255, 0.48)' }),
                    color: 'var(--muted)',
                    textAlign: 'center',
                  }}
                >
                  No recent cron or system agents need attention right now.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 12,
                  }}
                >
                  {quietSystemAgents.map((session) => (
                    <QuietSystemCard key={session.id} session={session} />
                  ))}
                </div>
              )}
            </div>
          </details>
        </section>
      </div>
    </PageScaffold>
  );
}
